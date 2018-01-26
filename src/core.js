const { MessageBuilder } = require(`devicehive-proxy-message`);
const Config = require(`../config`).plugin;
const ProxyClient = require(`./ProxyClient`);
const PluginService = require(`../plugin`);
const debug = require(`debug`)(`plugin-core`);
const request = require(`request`);
const dateFormat = require('dateformat');


/**
 * Configuration constants
 */
const DEVICE_HIVE_PLUGIN_WS_ENDPOINT = Config.DEVICE_HIVE_PLUGIN_WS_ENDPOINT;
const DEVICE_HIVE_AUTH_SERVICE_API_URL = Config.DEVICE_HIVE_AUTH_SERVICE_API_URL;
const PLUGIN_TOKEN_LIFE_TIME_MIN = Config.PLUGIN_TOKEN_LIFE_TIME_MIN || 30;
const PLUGIN_TOPIC = Config.PLUGIN_TOPIC;
const USER_LOGIN = Config.USER_LOGIN;
const USER_PASSWORD = Config.USER_PASSWORD;
const USER_ACCESS_TOKEN = Config.USER_ACCESS_TOKEN;
const USER_REFRESH_TOKEN = Config.USER_REFRESH_TOKEN;
const PLUGIN_ACCESS_TOKEN = Config.PLUGIN_ACCESS_TOKEN;
const PLUGIN_REFRESH_TOKEN = Config.PLUGIN_REFRESH_TOKEN;
const AUTO_SUBSCRIPTION_ON_START = Config.AUTO_SUBSCRIPTION_ON_START;
const SUBSCRIPTION_GROUP = Config.SUBSCRIPTION_GROUP;

/**
 * Services resources
 */
const pluginService = new PluginService();


/**
 * Start plugin core
 */
checkConfiguration();
start();


/**
 * Checks mandatory configuration fields
 */
function checkConfiguration () {
    const hasWsPluginEndpoint = DEVICE_HIVE_PLUGIN_WS_ENDPOINT;
    const hasPluginTokens = PLUGIN_ACCESS_TOKEN || PLUGIN_REFRESH_TOKEN;
    const hasPluginTopic = PLUGIN_TOPIC;
    const hasUserTokens = USER_ACCESS_TOKEN || USER_REFRESH_TOKEN;
    const hasUserCredentials = USER_LOGIN && USER_PASSWORD;
    const hasAuthServiceEndpoint = DEVICE_HIVE_AUTH_SERVICE_API_URL;
    let shouldExit = false;


    if (!hasWsPluginEndpoint) {
        pluginService.onError(`DeviceHive WebSocket endpoint should be 
            configured via DEVICE_HIVE_WEB_SOCKET_SERVER field`);
        shouldExit = true;
    }

    if (!hasPluginTokens && !(hasPluginTopic && hasAuthServiceEndpoint && (hasUserTokens || hasUserCredentials))) {
        pluginService.onError(`DeviceHive Plugin access/refresh token or User access/refresh token or User credentials
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
function start () {
    const proxyClient = new ProxyClient(DEVICE_HIVE_PLUGIN_WS_ENDPOINT);

    debug(`Plugin core has been started`);

    proxyClient.on(`open`, async () => {
        debug(`Plugin core is initializing and starting the plugin`);

        pluginService.sendMessage = (message) => proxyClient.sendMessage(message);
        pluginService.subscribe = () => subscribePlugin(pluginService.topic);
        pluginService.unsubscribe = () => unsubscribePlugin(pluginService.topic);

        pluginService.beforeStart();

        startAuthenticationFlow()
            .then((pluginTopic) => AUTO_SUBSCRIPTION_ON_START ? subscribePlugin(pluginTopic, SUBSCRIPTION_GROUP) : Promise.resolve())
            .then(() => proxyClient.on(`message`, (message) => handleMessage(message)))
            .then(() => pluginService.afterStart())
            .catch((error) => pluginService.onError(error));
    });

    proxyClient.on(`close`, () => {
        debug(`Plugin core stops plugin`);
        pluginService.beforeStop();
        process.exit();
    });

    proxyClient.on(`error`, (error) => {
        debug(`Error: ${error}`);
        pluginService.onError(error);
    });
}

/**
 * Plugin incoming message handler
 * @param message
 */
function handleMessage(message) {
    if (pluginService.isAuthenticated) {
        pluginService.handleMessage(message);
    }
}

/**
 * Initiates plugin authentication process by presented in configuration authentication resources
 * @returns {Promise<void>}
 */
async function startAuthenticationFlow() {
    let pluginTopic;

    if (PLUGIN_ACCESS_TOKEN) {
        pluginTopic = await authenticatePlugin(PLUGIN_ACCESS_TOKEN);
    } else if (PLUGIN_REFRESH_TOKEN) {
        const pluginAccessToken = await refreshToken(PLUGIN_REFRESH_TOKEN);
        pluginTopic = await authenticatePlugin(pluginAccessToken);
    } else if (USER_ACCESS_TOKEN && PLUGIN_TOPIC) {
        const pluginAccessToken = await getPluginAccessToken(USER_ACCESS_TOKEN);
        pluginTopic = await authenticatePlugin(pluginAccessToken);
    } else if (USER_REFRESH_TOKEN && PLUGIN_TOPIC) {
        const userAccessToken = await refreshToken(USER_REFRESH_TOKEN);
        const pluginAccessToken = await getPluginAccessToken(userAccessToken);
        pluginTopic = await authenticatePlugin(pluginAccessToken);
    } else if (USER_LOGIN && USER_PASSWORD && PLUGIN_TOPIC) {
        const userAccessToken = await getUserAccessToken(USER_LOGIN, USER_PASSWORD);
        const pluginAccessToken = await getPluginAccessToken(userAccessToken);
        pluginTopic = await authenticatePlugin(pluginAccessToken);
    }

    return pluginTopic;
}

/**
 * Send HTTP request
 * @param options
 * @returns {Promise<Object>}
 */
function sendHttpRequest(options) {
    return new Promise((resolve, reject) => {
        request(options, (err, response, body) => err || body.error ? reject(err || body.message) : resolve(body));
    });
}

/**
 * Get user access token by user credentials
 * @param login
 * @param password
 * @returns {Promise<String>}
 */
async function getUserAccessToken(login, password) {
    const responseBody = await sendHttpRequest({
        url: `${DEVICE_HIVE_AUTH_SERVICE_API_URL}/token`,
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
async function refreshToken(refreshToken) {
    const responseBody = await sendHttpRequest({
        url: `${DEVICE_HIVE_AUTH_SERVICE_API_URL}/token/refresh`,
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
async function getPluginAccessToken(userAccessToken) {
    const currentDate = new Date();
    const expirationDate = new Date(currentDate.getTime() + PLUGIN_TOKEN_LIFE_TIME_MIN * 60000);
    const responseBody = await sendHttpRequest({
        url: `${DEVICE_HIVE_AUTH_SERVICE_API_URL}/token/plugin/create`,
        method: `POST`,
        auth: { bearer: userAccessToken },
        json: { a: [ 0 ],  e: dateFormat(expirationDate, "isoDateTime"), t: 1, tpc: PLUGIN_TOPIC }
    });

    return responseBody.accessToken;
}

/**
 * Authenticates plugin by plugin access token. Returns plugin topic
 * @param pluginAccessToken
 * @returns {Promise<String>}
 */
async function authenticatePlugin(pluginAccessToken) {
    const authenticatePluginResponseMessage = await pluginService.sendMessage(
            MessageBuilder.authenticatePlugin({token: pluginAccessToken}));
    const pluginTopic = authenticatePluginResponseMessage.payload.topic;

    pluginService.topic = pluginTopic;
    pluginService.isAuthenticated = true;

    return pluginTopic;
}

/**
 * Subscribe plugin to plugin topic an mentioned subscription group
 * @param pluginTopic
 * @param subscriptionGroup
 * @returns {Promise<void>}
 */
async function subscribePlugin(pluginTopic, subscriptionGroup) {
    const subscriptionPayload = { topicList: [ pluginTopic ] };

    if (subscriptionGroup) {
        subscriptionPayload.subscriptionGroup = subscriptionGroup;
    }

    await pluginService.sendMessage(MessageBuilder.subscribeTopic(subscriptionPayload));

    pluginService.isSubscribed = true;
}

/**
 * Unsubscribe plugin from plugin topic
 * @param pluginTopic
 * @returns {Promise<void>}
 */
async function unsubscribePlugin(pluginTopic) {
    await pluginService.sendMessage(MessageBuilder.unsubscribeTopic({topicList: [ pluginTopic ]}));

    pluginService.isSubscribed = false;
}