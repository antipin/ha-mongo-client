import EventEmitter from 'events'
import { MongoClient } from 'mongodb'

/**
 * Initial interval in second between retry attempts
 * @type {number}
 */
const RETRY_INIT_INTERVAL = 0.1

/**
 * Maximum possible interval in second between retry attempts
 * @type {number}
 */
const RETRY_MAX_INTERVAL = 5

/**
 * Multiplier is used to increase RETRY_INTERVAL until it reach RETRY_MAX_INTERVAL value
 * @type {number}
 */
const RETRY_MULTIPLIER = 2

/**
 * The callback format for results
 * @callback MongoClient~connectCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {Db} db The connected database.
 */

export default class HAMongoClient extends EventEmitter {

    /**
     * Creates a new wrapped high available MongoClient instance
     * @param {string} url MongoDB connection string
     * @param {Object} connectionOptions MongoClient options (@see http://bit.ly/node-mongodb-native-connection-settings)
     * @param {Object} retriesOptions Retries behavior options
     * @param {number} retriesOptions.initInterval Initial interval between first connections
     * @param {number} retriesOptions.maxInterval Maximum possible interval between retries
     * @param {number} retriesOptions.multiplier Multiplier is used to increase initInterval 
                                                 until it reach maxInterval value
     * @constructor
     * @returns {HAMongoClient} a wrapped high available MongoClient instance.
     */
    constructor(url, connectionOptions, retriesOptions) {

        super()

        this._url = url
        this._connectionOptions = connectionOptions
        this._retriesOptions = Object.assign({
            initInterval: RETRY_INIT_INTERVAL,
            maxInterval:  RETRY_MAX_INTERVAL,
            multiplier:  RETRY_MULTIPLIER,
        }, retriesOptions)
        this._timeoutId = null

    }

    /**
     * Emphatically connects to MongoDB
     * @method
     * @param {MongoClient~connectCallback} [callback] The command result callback
     * @returns {Promise} returns Promise if no callback provided
     */
    connect(callback) {

        // Return a promise if no callback provided
        if (typeof callback !== 'function') {

            const PromiseLibrary = this._connectionOptions.promiseLibrary || Promise

            return new PromiseLibrary((resolve) => {

                this._reconnect('promise', resolve)

            })

        }

        // Fallback to callback
        this._reconnect('callback', callback)

    }

    /**
     * Emphatically connects to MongoDB
     * @method
     * @param {string} asyncStrategy Type of resolver function. Must be either 'callback' or 'promise'.
     * @param {Function} callback Callback or resolve function.
     * @param {number} [retryInterval] Retry interval.
     * @param {number} [retryAttempts] Retry attempts counter.
     * @fires HAMongoClient#retry
     * @returns {void}
     */
    _reconnect(asyncStrategy, callback, retryInterval, retryAttempts) {

        retryInterval = retryInterval || this._retriesOptions.initInterval
        retryAttempts = retryAttempts || 0

        const { multiplier, maxInterval } = this._retriesOptions

        MongoClient.connect(this._url, this._connectionOptions, (err, database) => {

            if (err) {

                retryInterval = Math.min(retryInterval * multiplier, maxInterval)
                retryAttempts += 1

                this.emit('retry', {
                    attempt: retryAttempts,
                    interval: retryInterval,
                    error: err,
                })

                this._timeoutId = setTimeout(
                    () => this._reconnect(asyncStrategy, callback, retryInterval, retryAttempts),
                    retryInterval * 1000
                )

                return

            }

            this._timeoutId = null

            switch (asyncStrategy) {

                case 'callback': 
                    return callback(null, database)

                case 'promise':
                default:
                    return callback(database)

            }

        })

    }

    /**
     * Aborts reconnect attempts
     * @returns {void}
     */
    abort() {

        clearTimeout(this._timeoutId)

    }

}

