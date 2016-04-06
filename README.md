[![npm](https://img.shields.io/npm/v/ha-mongo-client.svg)](https://www.npmjs.com/package/ha-mongo-client)
[![Build status](https://img.shields.io/travis/antipin/ha-mongo-client/master.svg)](https://travis-ci.org/antipin/ha-mongo-client)
[![David](https://img.shields.io/david/antipin/ha-mongo-client.svg)](https://david-dm.org/antipin/ha-mongo-client)
[![David](https://img.shields.io/david/dev/antipin/ha-mongo-client.svg)](https://david-dm.org/antipin/ha-mongo-client/#info=devDependencies&view=table)

High Availability for MongoClient
=================================

HAMongoClient is a lightweight wrapper around native MongoClient
that allows continuously retry connections to MongoDB.

It allows to start application independently on MongoDB and connect to it when it's ready.

Installation
------------

``$ npm install --save ha-mongo-client``

Usage
-----

```javascript
import HAMongoClient from 'ha-mongo-client'

const haMongoClient = new HAMongoClient('mongodb://localhost:27017',
    
    // Original MongoClient options
    {
        ...
    },
    
    // Retries behaviour settings.
    // In this case intervals will be 0.1, 0,2, 0.4, 0.8, 1.6, 3.2, 5, 5, 5 ... 
    {
        initInterval: 0.1,  // Initial delay before retrying. Default 0.1 sec
        multiplier:   2,    // Multiply delay by this number with each retry to prevent overwhelming the server. Default 2
        maxInterval:  5,    // Maximum number of seconds to wait before retrying again. Default 5 sec
    }
)

// HAMongoClient#connect method can either return a Promise
haMongoClient.connect().then(db => {
    
    db.close()
})

// or use a callback
haMongoClient.connect(db => {

    db.close()
})

// You can listen for 'retry' event
haMongoClient.on('retry', retry => {

    console.log(`Attempt number ${retry.attempt}. Next reconnect attempt in ${retry.interval} sec.`)
})
```
