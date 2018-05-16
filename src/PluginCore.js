const configurator = require(`../config`);
const { MessageBuilder } = require(`devicehive-proxy-message`);
const ProxyClient = require(`./ProxyClient`);
const debug = require(`debug`)(`plugin-core`);
const request = require(`request`);
const dateFormat = require('dateformat');


/**
 * PluginCore class
 */
class PluginCore {

    /**
     * Send HTTP request
     * @param options
     * @returns {Promise<Object>}
     */
    static _sendHttpRequest(options) {
        return new Promise((resolve, reject) => {
            request(options, (err, response, body) => {
                err || (body && body.error) ? reject(err || body.message) :
                    body ? resolve(body) : reject(`${options.url}: ${response.statusMessage}`)
            });
        });
    }

    /**
     * Creates new PluginCore class instance
     * @param pluginService
     * @param pathToConfigJsonOrPlainObject
     * @param envPrefix
     */
    constructor(pluginService, pathToConfigJsonOrPlainObject, envPrefix) {
        const me = this;

        me.pluginService = pluginService;
        me.config = configurator(pathToConfigJsonOrPlainObject, envPrefix, true);
        me._checkConfiguration();

        me.proxyClient = new ProxyClient(me.config.DEVICE_HIVE_PLUGIN_WS_ENDPOINT);
    }

    /**
     * Checks mandatory configuration fields
     */
    _checkConfiguration () {
        const me = this;
        const hasWsPluginEndpoint = me.config.DEVICE_HIVE_PLUGIN_WS_ENDPOINT;
        const hasPluginTokens = me.config.PLUGIN_ACCESS_TOKEN || me.config.PLUGIN_REFRESH_TOKEN;
        const hasPluginTopic = me.config.PLUGIN_TOPIC;
        const hasUserTokens = me.config.USER_ACCESS_TOKEN || me.config.USER_REFRESH_TOKEN;
        const hasUserCredentials = me.config.USER_LOGIN && me.config.USER_PASSWORD;
        const hasAuthServiceEndpoint = me.config.DEVICE_HIVE_AUTH_SERVICE_API_URL;
        let shouldExit = false;


        if (!hasWsPluginEndpoint) {
            me.pluginService.onError(`DeviceHive WebSocket endpoint should be 
            configured via DEVICE_HIVE_WEB_SOCKET_SERVER field`);
            shouldExit = true;
        }

        if (!hasPluginTokens && !(hasPluginTopic && hasAuthServiceEndpoint && (hasUserTokens || hasUserCredentials))) {
            me.pluginService.onError(`DeviceHive Plugin access/refresh token or User access/refresh token or User credentials
         with Plugin topic ans Auth service endpoint should be configured via config file or environmental variables`);
            shouldExit = true;
        }

        if (shouldExit === true) {
            process.exit();
        }
    }

    /**
     * Starts plugin core and plugin service
     */
    start() {
        const me = this;

        debug(`Plugin core has been started`);

        me.proxyClient.on(`open`, async () => {
            debug(`Plugin core is initializing and starting the plugin`);

            me.pluginService.sendMessage = (message) => me.proxyClient.sendMessage(message);
            me.pluginService.subscribe = () => me._subscribePlugin(me.pluginService.topic);
            me.pluginService.unsubscribe = () => me._unsubscribePlugin(me.pluginService.topic);

            me.pluginService.beforeStart();

            me._startAuthenticationFlow()
                .then((pluginTopic) => me.config.AUTO_SUBSCRIPTION_ON_START ? me._subscribePlugin(pluginTopic, me.config.SUBSCRIPTION_GROUP) : Promise.resolve())
                .then(() => me.proxyClient.on(`message`, (message) => me._handleMessage(message)))
                .then(() => me.pluginService.afterStart())
                .catch((error) => me.pluginService.onError(error));
        });

        me.proxyClient.on(`close`, () => {
            debug(`Plugin core stops plugin`);
            me.pluginService.beforeStop();
            process.exit();
        });

        me.proxyClient.on(`error`, (error) => {
            debug(`Error: ${error}`);
            me.pluginService.onError(error);
        });
    }

    /**
     * Plugin incoming message handler
     * @param message
     */
    _handleMessage(message) {
        const me = this;

        if (me.pluginService.isAuthenticated) {
            me.pluginService.handleMessage(message);
        }
    }

    /**
     * Initiates plugin authentication process by presented in configuration authentication resources
     * @returns {Promise<void>}
     */
    async _startAuthenticationFlow() {
        const me = this;
        let pluginTopic;

        if (me.config.PLUGIN_ACCESS_TOKEN) {
            pluginTopic = await me._authenticatePlugin(me.config.PLUGIN_ACCESS_TOKEN);
        } else if (me.config.PLUGIN_REFRESH_TOKEN) {
            const pluginAccessToken = await me._refreshToken(me.config.PLUGIN_REFRESH_TOKEN);
            pluginTopic = await me._authenticatePlugin(pluginAccessToken);
        } else if (me.config.USER_ACCESS_TOKEN && me.config.PLUGIN_TOPIC) {
            const pluginAccessToken = await me._getPluginAccessToken(me.config.USER_ACCESS_TOKEN);
            pluginTopic = await me._authenticatePlugin(pluginAccessToken);
        } else if (me.config.USER_REFRESH_TOKEN && me.config.PLUGIN_TOPIC) {
            const userAccessToken = await me._refreshToken(me.config.USER_REFRESH_TOKEN);
            const pluginAccessToken = await me._getPluginAccessToken(userAccessToken);
            pluginTopic = await me._authenticatePlugin(pluginAccessToken);
        } else if (me.config.USER_LOGIN && me.config.USER_PASSWORD && me.config.PLUGIN_TOPIC) {
            const userAccessToken = await me._getUserAccessToken(me.config.USER_LOGIN, me.config.USER_PASSWORD);
            const pluginAccessToken = await me._getPluginAccessToken(userAccessToken);
            pluginTopic = await me._authenticatePlugin(pluginAccessToken);
        }

        return pluginTopic;
    }

    /**
     * Get user access token by user credentials
     * @param login
     * @param password
     * @returns {Promise<String>}
     */
    async _getUserAccessToken(login, password) {
        const me = this;

        const responseBody = await PluginCore._sendHttpRequest({
            url: `${me.config.DEVICE_HIVE_AUTH_SERVICE_API_URL}/token`,
            method: `POST`,
            json: { login: login, password: password }
        });

        return responseBody.accessToken;
    }

    /**
     * Refresh user/plugin tokens by refresh user/plugin token. Returns access token
     * @param refreshToken
     * @returns {Promise<String>}
     */
    async _refreshToken(refreshToken) {
        const me = this;

        const responseBody = await PluginCore._sendHttpRequest({
            url: `${me.config.DEVICE_HIVE_AUTH_SERVICE_API_URL}/token/refresh`,
            method: `POST`,
            json: { refreshToken: refreshToken }
        });

        return responseBody.accessToken;
    }

    /**
     * Get plugin access token by user access token
     * @param userAccessToken
     * @returns {Promise<String>}
     */
    async _getPluginAccessToken(userAccessToken) {
        const me = this;

        const currentDate = new Date();
        const expirationDate = new Date(currentDate.getTime() + me.config.PLUGIN_TOKEN_LIFE_TIME_MIN * 60000);
        const responseBody = await PluginCore._sendHttpRequest({
            url: `${me.config.DEVICE_HIVE_AUTH_SERVICE_API_URL}/token/plugin/create`,
            method: `POST`,
            auth: { bearer: userAccessToken },
            json: { a: [ 0 ],  e: dateFormat(expirationDate, "isoDateTime"), t: 1, tpc: me.config.PLUGIN_TOPIC }
        });

        return responseBody.accessToken;
    }

    /**
     * Authenticates plugin by plugin access token. Returns plugin topic
     * @param pluginAccessToken
     * @returns {Promise<String>}
     */
    async _authenticatePlugin(pluginAccessToken) {
        const me = this;

        const authenticatePluginResponseMessage = await me.pluginService.sendMessage(
            MessageBuilder.authenticatePlugin({token: pluginAccessToken}));
        const pluginTopic = authenticatePluginResponseMessage.payload.topic;

        me.pluginService.topic = pluginTopic;
        me.pluginService.isAuthenticated = true;

        return pluginTopic;
    }

    /**
     * Subscribe plugin to plugin topic an mentioned subscription group
     * @param pluginTopic
     * @param subscriptionGroup
     * @returns {Promise<void>}
     */
    async _subscribePlugin(pluginTopic, subscriptionGroup) {
        const me = this;

        const subscriptionPayload = { topicList: [ pluginTopic ] };

        if (subscriptionGroup) {
            subscriptionPayload.subscriptionGroup = subscriptionGroup;
        }

        await me.pluginService.sendMessage(MessageBuilder.subscribeTopic(subscriptionPayload));

        me.pluginService.isSubscribed = true;
    }

    /**
     * Unsubscribe plugin from plugin topic
     * @param pluginTopic
     * @returns {Promise<void>}
     */
    async _unsubscribePlugin(pluginTopic) {
        const me = this;

        await me.pluginService.sendMessage(MessageBuilder.unsubscribeTopic({topicList: [ pluginTopic ]}));

        me.pluginService.isSubscribed = false;
    }
}


module.exports = PluginCore;