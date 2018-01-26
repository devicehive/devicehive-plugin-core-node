const WS = require(`ws`);
const EventEmitter = require(`events`);
const { Message, MessageUtils } = require(`devicehive-proxy-message`);
const uuid = require('uuid/v1');
const debug = require(`debug`)(`proxy-client`);


/**
 * DeviceHive WebSocket Proxy client
 */
class ProxyClient extends EventEmitter {

    /**
     * Creates new ProxyClient object
     * @param webSocketServerUrl
     */
    constructor(webSocketServerUrl) {
        super();

        const me = this;

        me.ws = new WS(webSocketServerUrl);

        me.ws.addEventListener(`open`, () => {
            process.nextTick(() => me.emit(`open`));
            debug(`Connected to ${webSocketServerUrl}`);
        });

        me.ws.addEventListener(`close`, () => {
            process.nextTick(() => me.emit(`close`));
            debug(`Connection has been closed`);
        });

        me.ws.addEventListener(`error`, (error) => {
            me.emit(`error`, error);
            debug(`Proxy client error: ${error}`);
        });

        me.ws.addEventListener(`ping`, (pingData) => {
            me.emit(`ping`, pingData);
            debug(`Ping from WebSocket server`);
        });

        me.ws.addEventListener(`message`, (event) => {
            try {
                let messages = JSON.parse(event.data);

                messages = messages.length ? messages : [messages];

                messages.forEach((message) => {
                    const normalizedMessage = Message.normalize(message);

                    me.emit(`message`, normalizedMessage);

                    if (message.id) {
                        me.emit(message.id, normalizedMessage);
                    }
                });
            } catch (error) {
                debug(`Error on incoming message: ${error}`);
            }
        });
    }

    /**
     * Send message to WS server with response timeout.
     * @param message
     * @param responseTimeout
     * @returns {Promise<Message>}
     */
    sendMessage(message=new Message(), responseTimeout=0) {
        const me = this;
        const messageId = message.id = message.id || uuid();

        return new Promise((resolve, reject) => {
            let timeoutHandler;
            const responseListener = (message) => {
                clearTimeout(timeoutHandler);
                me.removeListener(messageId, responseListener);
                message.status === MessageUtils.FAILED_STATUS ?
                    reject(message.payload.message) :
                    resolve(message);
            };

            me.addListener(messageId, responseListener);

            if (responseTimeout > 0) {
                timeoutHandler = setTimeout(() => {
                    reject(new Error(`Request with id ${messageId} has reached timeout: ${responseTimeout}`));
                }, responseTimeout);
            }

            me.ws.send(message.toString());
        });
    }
}


module.exports = ProxyClient;
