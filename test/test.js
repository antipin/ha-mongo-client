import test from 'ava'
import { Server } from 'mongodb-topology-manager'
import fs from 'fs'
import path from 'path'
import InsistentMongoClient from '../'

const DB_PATH = path.join(__dirname, 'db')

test.before(() => {

    const serverManager = new Server()
    return serverManager.discover().catch(err => { throw Error('Unable to find mongod binary') })
})

test('Correct intervals', (t) => new Promise((resolve, reject) => {

    const attemptsLimit = 5

    let interval = 0.1
    let multiplier = 2
    let maxInterval = 1
    let attemptsCounter = 0

    const insistentMongoClient = new InsistentMongoClient('mongodb://unknown:27017', {}, {
        initInterval: interval,
        multiplier:   multiplier,
        maxInterval:  maxInterval,
    })

    t.plan(attemptsLimit * 2)

    insistentMongoClient.on('retrying', retry => {

        attemptsCounter += 1
        interval = Math.min(interval * multiplier, maxInterval)

        t.is(retry.attempt, attemptsCounter)
        t.is(retry.interval, interval)

        if (attemptsCounter === attemptsLimit) {

            insistentMongoClient.abort()
            resolve()
        }
    })

    insistentMongoClient.connect()
}))

test('Connecting to delayed mongod', (t) => {

    const serverManager = new Server('mongod', { dbpath: DB_PATH })

    const insistentMongoClient = new InsistentMongoClient('mongodb://localhost:27017', {})

    return serverManager.discover()
        .then(() => {
            // Starting mongod with delay
            setTimeout(
                () => serverManager.purge()
                    .then(() => serverManager.start())
                    .catch(err => { throw err }),
                1000
            )
        })
        .then(() => insistentMongoClient.connect())
        .then(db => db.close())
        .then(() => serverManager.stop())
        .then(() => serverManager.purge())
        .then(() => new Promise((resolve, reject) => {
            fs.rmdir(DB_PATH, (err) => {
                if (err) return reject(err)
                resolve()
            })
        }))
        .catch(err => { throw err })
})