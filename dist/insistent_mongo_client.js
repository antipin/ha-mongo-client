import EventEmitter from 'events'
import { MongoClient } from 'mongodb'

/**
 * Initial timeout in second between retry attempts
 * @type {number}
 */
const RETRY_INIT_TIMEOUT = 0.1

/**
 * Maximum possible timeout in second between retry attempts
 * @type {number}
 */
const RETRY_MAX_TIMEOUT = 5

/**
 * Multiplier is used to increase RETRY_TIMEOUT until it reach RETRY_MAX_TIMEOUT value
 * @type {number}
 */
const RETRY_MULTIPLIER = 2

/**
 * The callback format for results
 * @callback MongoClient~connectCallback
 * @param {MongoError} error An error instance representing the error during the execution.
 * @param {Db} db The connected database.
 */

/**
 * Creates a new wrapped high available MongoClient instance
 * @class
 * @return {InsistentMongoClient} a wrapped high available MongoClient instance.
 */
class InsistentMongoClient extends EventEmitter {

    /**
     * @param {string} url MongoDB connection string
     * @param {Object} connectionOptions MongoClient options (@see http://mongodb.github.io/node-mongodb-native/2.1/reference/connecting/connection-settings/)
     * @param {Object} retriesOptions Retries behavior options
     * @param {number} retriesOptions.initTimeout Initial timeout between first connections
     * @param {number} retriesOptions.maxTimeout Maximum possible timeout between retries
     * @param {number} retriesOptions.multiplier Multiplier is used to increase initTimeout until it reach maxTimeout value
     * @constructor
     */
    constructor(url, connectionOptions, retriesOptions) {
        this._url = url
        this._connectionOptions = connectionOptions
        this._retriesOptions = Object.assign({}, retriesOptions, {
            initTimeout: RETRY_INIT_TIMEOUT,
            maxTimeout:  RETRY_MAX_TIMEOUT,
            multiplier:  RETRY_MULTIPLIER,
        })
    }

    /**
     * Emphatically connects to MongoDB
     *
     * @method
     * @param {MongoClient~connectCallback} [callback] The command result callback
     * @return {Promise} returns Promise if no callback provided
     */
    connect(callback) {

        // Return a promise if no callback provided
        if (typeof callback !== 'function') {

            const PromiseLibrary = this._connectionOptions.promiseLibrary || Promise

            return new PromiseLibrary((resolve, reject) => {

                this._reconnect('promise', resolve)
            })
        }

        // Fallback to callback
        this._reconnect('callback', callback)
    }

    /**
     * Emphatically connects to MongoDB
     *
     * @method
     * @param {string} asyncStrategy Type of resolver function. Must be either 'callback' or 'promise'.
     * @param {Function} callback Callback or resolve function.
     * @param {number} [retryTimeout] Retry timeout.
     * @param {number} [retryAttempts] Retry attempts counter.
     */
    _reconnect(asyncStrategy, callback, retryTimeout, retryAttempts) {

        retryTimeout = retryTimeout || this._retriesOptions.timeout
        retryAttempts = retryAttempts || 0

        MongoClient.connect(this._url, this._connectionOptions, (err, database) => {

            if (err) {

                retryTimeout = Math.min(retryTimeout * this._retriesOptions.multiplier, this._retriesOptions.maxTimeout)
                retryAttempts += 1

                this.emit('retrying', {
                    attempt: retryAttempts,
                    timeout: retryTimeout,
                })

                return setTimeout(
                    () => this._reconnect(asyncStrategy, callback, retryTimeout, retryAttempts),
                    retryTimeout * 1000
                )
            }

            switch (asyncStrategy) {
                case 'callback': return callback(null, database)
                case 'promise':  return callback(database)
            }
        })
    }
}

export default InsistentMongoClient