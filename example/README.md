[DeviceHive]: https://devicehive.com "DeviceHive framework"
[Message]: https://github.com/devicehive/devicehive-proxy-message "Message"
[devicehive-plugin-core-node]: https://github.com/devicehive/devicehive-plugin-core-node "devicehive-plugin-core-node"

# DeviceHive plugin template (Node JS implementation)

Based on [devicehive-plugin-core-node]

# Configuration

    [path-to-plugin-project]/plugin/config.json    

* **_DEVICE_HIVE_PLUGIN_WS_ENDPOINT_** - Path to DeviceHive WS server with plugin support (default: "ws://localhost:3001")  
* **_DEVICE_HIVE_AUTH_SERVICE_API_URL_** - Path to DeviceHive Auth REST API service (default: "http://localhost:8090/dh/rest")  
* **_PLUGIN_TOPIC_** - Plugin topic 
* **_PLUGIN_TOKEN_LIFE_TIME_MIN_** - Plugin topic lifetime in minutes. _Optional parameter_ (default: 30)  
* **_USER_LOGIN_** - User login (plugin owner ar administrator). _Optional parameter_ 
* **_USER_PASSWORD_** - User password (plugin owner ar administrator). _Optional parameter_  
* **_USER_ACCESS_TOKEN_** - User access token (plugin owner ar administrator). _Optional parameter_  
* **_USER_REFRESH_TOKEN_** - User refresh token (plugin owner ar administrator). _Optional parameter_  
* **_PLUGIN_ACCESS_TOKEN_** - Plugin access token. _Optional parameter_  
* **_PLUGIN_REFRESH_TOKEN_** - Plugin refresh token. _Optional parameter_  
* **_AUTO_SUBSCRIPTION_ON_START_** - Flag to on/off auto subscription to plugin topic on plugin start (default: true)

Each configuration field can be overridden with corresponding environmental variable with "PLUGIN" prefix, for example:

    PLUGIN.PLUGIN_TOKEN_LIFE_TIME_MIN=60

Prefix separator can be overridden by **_ENVSEPARATOR_** environmental variable. Example:

    ENVSEPARATOR=_
    PLUGIN_PLUGIN_TOKEN_LIFE_TIME_MIN=60
    
For plugin authentication next configuration combinations can bu used:

1) **_PLUGIN_ACCESS_TOKEN_**  
2) **_PLUGIN_REFRESH_TOKEN_**
3) **_USER_ACCESS_TOKEN_** + **_PLUGIN_TOPIC_** + **_DEVICE_HIVE_AUTH_SERVICE_API_URL_**
4) **_USER_REFRESH_TOKEN_** + **_PLUGIN_TOPIC_** + **_DEVICE_HIVE_AUTH_SERVICE_API_URL_**
5) **_USER_LOGIN_** + **_USER_PASSWORD_** + **_PLUGIN_TOPIC_** + **_DEVICE_HIVE_AUTH_SERVICE_API_URL_**

For 3-5 combination the **_PLUGIN_TOKEN_LIFE_TIME_MIN_**  configuration field can be mentioned.
    
# Plugin entry point

The entry point of the DeviceHive plugin is the plugin/index.js file. 
It creates all necessary resources and connects DeviceHivePlugin lifecycle hooks to internal handlers.
To start the plugin just use next command

    node ./plugin/index.js
    
or

    npm start 

# Plugin extension point

To extend this plugin template with some additional logic you should use next file:

    ./plugin/index.js
    
This class contains class PluginService which is extended form interface class DeviceHivePlugin (see [devicehive-plugin-core-node])
and has lifecycle hooks that are mentioned below. 

## Plugin lifecycle hooks

    beforeStart() {}
    afterStart() {
    handleMessage(message) {}
    beforeStop() {}
    onError(error) {}

1) **_beforeStart_** - This hook fires before plugin will do try to connect to [DeviceHive] WS plugin server
2) **_afterStart_** - This hook fires after plugin successfully connects to [DeviceHive] WS plugin server
3) **_handleMessage_** - This hook fires on every incoming [Message] from [DeviceHive]
4) **_beforeStop_** - This hook fires before plugin will stop it's own process because of some critical reason (For example, WS plugin serer closes the connection)
5) **_onError_** - This hook fires on every internal error (critical/non critical)


# Plugin API

DeviceHivePlugin class has few methods that are defined internally by core functionality:

    sendMessage(message) {}
    subscribe(subscriptionGroup) {}
    unsubscribe() {}
    
1) **_sendMessage_** - Sends [Message] object to WS plugin server. Returns Promise with response/error
2) **_subscribe_** - Subscribes to plugin topic with optionally mentioned subscription group
3) **_unsubscribe_** - Unsubscribes from plugin topic