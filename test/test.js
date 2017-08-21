import test from 'ava'
import { Server } from 'mongodb-topology-manager'
import fs from 'fs'
import path from 'path'
import HAMongoClient from '../src/ha_mongo_client'

const DB_PATH = path.join(__dirname, 'db')

test.before(() => {

    const serverManager = new Server()

    return serverManager
        .discover()
        .catch(() => { 

            throw Error('Unable to find mongod binary')

        })

})

test('Correct intervals', (t) => new Promise((resolve) => {

    const attemptsLimit = 5
    const multiplier = 2
    const maxInterval = 1
    let interval = 0.1
    let attemptsCounter = 0

    const hAMongoClient = new HAMongoClient('mongodb://unknown:27017', {}, {
        initInterval: interval,
        multiplier,
        maxInterval,
    })

    t.plan(attemptsLimit * 2)

    hAMongoClient.on('retry', retry => {

        attemptsCounter += 1
        interval = Math.min(interval * multiplier, maxInterval)

        t.is(retry.attempt, attemptsCounter)
        t.is(retry.interval, interval)

        if (attemptsCounter === attemptsLimit) {

            hAMongoClient.abort()
            resolve()

        }

    })

    hAMongoClient.connect()

}))

test('Connecting to delayed mongod', (t) => {

    const serverManager = new Server('mongod', { dbpath: DB_PATH })
    const hAMongoClient = new HAMongoClient('mongodb://localhost:27017', {})
    
    t.plan(1)

    return serverManager.discover()
        .then(() => {

            // Starting mongod with delay
            setTimeout(
                () => serverManager.purge()
                    .then(() => serverManager.start())
                    .catch(err => {

                        throw err
                    
                    }),
                1000
            )

        })
        .then(() => hAMongoClient.connect())
        .then(db => db.close())
        .then(() => serverManager.stop())
        .then(() => serverManager.purge())
        .then(() => new Promise((resolve, reject) => {

            fs.rmdir(DB_PATH, (err) => {

                if (err) return reject(err)

                return resolve()

            })

        }))
        .then(() => t.pass())
        .catch(err => {

            throw err

        })

})
