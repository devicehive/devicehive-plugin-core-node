[DeviceHive]: https://devicehive.com "DeviceHive framework"
[Message]: https://github.com/devicehive/devicehive-proxy-message "Message"
[DeviceHive WS Proxy]: https://github.com/devicehive/devicehive-ws-proxy "DeviceHive WS Proxy"

# DeviceHive plugin core functionality (Node JS implementation)

This module makes it possible to quickly and easily create DeviceHive plugins using NodeJS.

## Module structure
### PluginCore class (private)
    
PluginCore class implements basic interaction functionality with [DeviceHive] service. 
User is not able to use it.
    
### ProxyClient class (private)

ProxyClient class implements basic transport functionality with [DeviceHive WS Proxy] service (in plugin mode). 
User is not able to use it.

### DeviceHivePlugin class (public)

DeviceHivePlugin class implements interface for user's plugin service classes. 
User is able to extends their own plugin services from the DeviceHivePlugin class.

```javascript
    const { DeviceHivePlugin } = require(`devicehive-plugin-core`);

    class PluginService extends DeviceHivePlugin {
        beforeStart() {}
        afterStart() {}
        handleMessage(message) {}
        beforeStop() {}
        onError(error) {}
    }
```

#### Plugin lifecycle hooks

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


#### Plugin API

DeviceHivePlugin class has few methods that are defined internally by core functionality:

    sendMessage(message) {}
    subscribe(subscriptionGroup) {}
    unsubscribe() {}
    
1) **_sendMessage_** - Sends [Message] object to WS plugin server. Returns Promise with response/error
2) **_subscribe_** - Subscribes to plugin topic with optionally mentioned subscription group
3) **_unsubscribe_** - Unsubscribes from plugin topic

#### Plugin entry point

To start plugin you should use next static method of DeviceHivePlugin class:

    DeviceHivePlugin.start(<pluginService>, <config>, [<envPrefix>]);
    
where:
- **pluginService** - instance of User's own DeviceHivePlugin implementation
- **config** - configuration object or path to configuration json file. See Configuration section
- **envPrefix** - prefix to add to environmental variables to override configuration fields

Example:

```javascript
    const { DeviceHivePlugin } = require(`devicehive-plugin-core`);

    class PluginService extends DeviceHivePlugin {
        beforeStart() {}
        afterStart() {}
        handleMessage(message) {}
        beforeStop() {}
        onError(error) {}
    }
    
    DeviceHivePlugin.start(new PluginService(), {
         DEVICE_HIVE_PLUGIN_WS_ENDPOINT: "ws://localhost:3001",
         DEVICE_HIVE_AUTH_SERVICE_API_URL: "http://localhost:8090/dh/rest",
         PLUGIN_ACCESS_TOKEN: "plugin_access_token",
         AUTO_SUBSCRIPTION_ON_START: true
    }, "MY_PLUGIN_SERVICE");
```

# Configuration

* **_DEVICE_HIVE_PLUGIN_WS_ENDPOINT_** - Path to DeviceHive WS server with plugin support 
* **_DEVICE_HIVE_AUTH_SERVICE_API_URL_** - Path to DeviceHive Auth REST API service 
* **_PLUGIN_TOPIC_** - Plugin topic 
* **_PLUGIN_TOKEN_LIFE_TIME_MIN_** - Plugin topic lifetime in minutes. _Optional parameter_
* **_USER_LOGIN_** - User login (plugin owner ar administrator). _Optional parameter_ 
* **_USER_PASSWORD_** - User password (plugin owner ar administrator). _Optional parameter_  
* **_USER_ACCESS_TOKEN_** - User access token (plugin owner ar administrator). _Optional parameter_  
* **_USER_REFRESH_TOKEN_** - User refresh token (plugin owner ar administrator). _Optional parameter_  
* **_PLUGIN_ACCESS_TOKEN_** - Plugin access token. _Optional parameter_  
* **_PLUGIN_REFRESH_TOKEN_** - Plugin refresh token. _Optional parameter_  
* **_AUTO_SUBSCRIPTION_ON_START_** - Flag to on/off auto subscription to plugin topic on plugin start

Each configuration field can be overridden with corresponding environmental variable with "PLUGIN" prefix, for example:

    PLUGIN.PLUGIN_TOKEN_LIFE_TIME_MIN=60

Prefix separator can be overridden by **_ENVSEPARATOR_** environmental variable. Example:

    ENVSEPARATOR=_
    PLUGIN_PLUGIN_TOKEN_LIFE_TIME_MIN=60

# Plugin Authentication

For plugin authentication next configuration combinations can bu used:

1) **_PLUGIN_ACCESS_TOKEN_**  
2) **_PLUGIN_REFRESH_TOKEN_**
3) **_USER_ACCESS_TOKEN_** + **_PLUGIN_TOPIC_** + **_DEVICE_HIVE_AUTH_SERVICE_API_URL_**
4) **_USER_REFRESH_TOKEN_** + **_PLUGIN_TOPIC_** + **_DEVICE_HIVE_AUTH_SERVICE_API_URL_**
5) **_USER_LOGIN_** + **_USER_PASSWORD_** + **_PLUGIN_TOPIC_** + **_DEVICE_HIVE_AUTH_SERVICE_API_URL_**

For 3-5 combination the **_PLUGIN_TOKEN_LIFE_TIME_MIN_**  configuration field can be mentioned.

