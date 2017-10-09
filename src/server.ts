import Koa = require('koa')
import Router = require('koa-router')
import bodyParser = require('koa-bodyparser')
import http = require('http')
import ShareDB = require('sharedb')
import ShareDBClient = require('sharedb/lib/client')
import ShareDBLogger = require('sharedb-logger')
import WS = require('ws')
import WebSocketJSONStream from './utils/ws-json-stream'

import { SessionDBType, SessionDocumentType } from './types'

import {
    append, compose, map, join, values, pluck, toPairs, pick, curry, forEach, tap,
    assoc, find,
} from 'ramda'

const sessions: SessionDBType = {}
const sessionDocuments: SessionDocumentType = {}

const getSessionsByProps = (...args) => compose(
    map(o => compose(join(': '), values, pick([...args]))(o)),
    pluck(1),
    toPairs,
)

const isShared = (sessionId, docId) => find(id => id === docId, sessionDocuments[sessionId] || [])

const app = new Koa()
const router = new Router()
router.post('/', (ctx, next) => {
    const { request, response } = ctx
    response.type = 'application/json'
    response.body = { status1: 'ok'}
})
router.get('/sessions', (ctx, next) => {
    const { request, response } = ctx
    response.type = 'application/json'
    response.body = getSessionsByProps('id', 'name')(sessions)
})
router.post('/session', (ctx, next) => {
    const { request, response } = ctx
    const { id, name } = request.body
    sessions[id] = { id, name, startedAt: Date.now() }
    response.type = 'application/json'
    response.body = { id, name }
})

router.post('/document', (ctx, next) => {
    const { request, response } = ctx
    const { sessionId, docId } = request.body

    response.type = 'application/json'
    if (isShared(sessionId, docId)) {
        response.body = {}
    } else {
        sessionDocuments[sessionId] = append(docId, sessionDocuments[sessionId] || [])
        response.body = { [sessionId]: sessionDocuments[sessionId] }
    }
})

router.get('/documents/:sessionId', (ctx, next) => {
    const { request, response, params } = ctx
    response.type = 'application/json'
    response.body = sessionDocuments[params.sessionId] || []
})

app.use(bodyParser())
app.use(router.routes())

export default app

const sessionServerPort = 3000

export const start = () => {
    const cb = tap(_ => console.log(`Session server listening at ${sessionServerPort}`), Koa.callback())
    const server = http.createServer(cb)

    const shareDB = new ShareDB()
    const shareDBLogger = ShareDBLogger(shareDB)
    const wss = new WS.Server({ server })
    wss.on('connection', (ws, req) => {
        console.log(`ShareDB client connected`)
        const stream = new WebSocketJSONStream(ws)
        shareDB.listen(stream)
    })
    wss.on('close', (ws, req) => console.log(`ShareDB client disconnected`))

    server.listen(sessionServerPort)
}
