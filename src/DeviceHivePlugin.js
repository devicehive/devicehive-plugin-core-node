const PluginCore = require(`./PluginCore`);

/**
 *  DeviceHive plugin base class
 */
class DeviceHivePlugin {

    /**
     * Configuring and starting DeviceHive Plugin core functionality
     * @param pluginService
     * @param pathToConfigJsonOrPlainObject
     * @param envPrefix
     */
    static start(pluginService, pathToConfigJsonOrPlainObject, envPrefix) {
        let shouldExit = false;

        if (pluginService instanceof DeviceHivePlugin) {
            if (pathToConfigJsonOrPlainObject) {
                const pluginCore = new PluginCore(pluginService, pathToConfigJsonOrPlainObject, envPrefix);

                pluginCore.start();
            } else {
                pluginService.onError(`DeviceHivePlugin is not configured. Please, provide the configuration object or path to configuration json file.`);
                shouldExit = true;
            }
        } else {
            console.error(`PluginService should be an instance of DeviceHivePlugin class.`);
            shouldExit = true;
        }

        if (shouldExit) {
            process.exit();
        }
    }


    /**
     * Creates new DeviceHivePlugin object
     */
    constructor() {
        const me = this;

        me._isAuthenticated = false;
        me._isSubscribed = false;
        me._topic = '';
    }

    get isAuthenticated() {
        return this._isAuthenticated;
    }

    set isAuthenticated(value) {
        this._isAuthenticated = value;
    }

    get isSubscribed() {
        return this._isSubscribed;
    }

    set isSubscribed(value) {
        this._isSubscribed = value;
    }

    get topic() {
        return this._topic;
    }

    set topic(value) {
        this._topic = value;
    }

    /**
     * Before plugin starts hook
     */
    beforeStart() {}

    /**
     * After plugin starts hook
     */
    afterStart() {}

    /**
     * Message handler
     * @param message
     */
    handleMessage(message) {}

    /**
     * Before plugin stops hook
     */
    beforeStop() {}

    /**
     * Plugin error handler
     * @param error
     */
    onError(error) {}

    /**
     * Send message to WS server
     * Internally defined. DO NOT OVERRIDE IT!
     * @param message
     */
    sendMessage(message) {}

    /**
     * Subscribe plugin to plugin topic and mentioned subscription group
     * Internally defined. DO NOT OVERRIDE IT!
     */
    subscribe(subscriptionGroup) {}

    /**
     * Unsubscribe plugin from plugin topic
     * Internally defined. DO NOT OVERRIDE IT!
     */
    unsubscribe() {}
}


module.exports = DeviceHivePlugin;