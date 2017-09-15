import * as vscode from 'vscode';

const ShareDB = require('sharedb')
const ShareDBClient = require('sharedb/lib/client')
const ShareDBLogger = require('sharedb-logger')
const WS = require('ws')
// const WebSocketJSONStream = require('./utils/ws-json-stream')
import WebSocketJSONStream from './utils/ws-json-stream'

const http = require('http')
const Koa = require('koa')
const Router = require('koa-router')
const bodyParser = require('koa-bodyparser')

const uuidv4 = require('uuid/v4');

import { setup, read, create } from './utils/xhr-helpers'
import { 
    append, compose, map, join, values, pluck, toPairs, pick, curry, forEach, tap,
} from 'ramda'

import Debug from 'debug'
const debug = Debug('server')

// session info store
type SessionType = {
    id: string,
    name: string,
    startedAt: number,
}
type SessionDBType = {
    [key: string]: SessionType
}
const sessions: SessionDBType = {}

const listSessionsByProps = (...args) => compose(
    map(o => compose(join(': '), values, pick([...args]))(o)),
    pluck(1),
    toPairs
  )

  const sessionServerPort = 3000
  const sessionServerUrl = `http://localhost:${sessionServerPort}`
  setup('')

  const wsPort = 3001
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const { window, workspace, TextEdit, Position, Range } = vscode    

    // Koa
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
        response.body = listSessionsByProps('id', 'name')(sessions)
    })
    router.post('/session', (ctx, next) => {
        const { request, response } = ctx
        const { id, name } = request.body
        sessions[id] = { id, name, startedAt: Date.now() }
        response.type = 'application/json'
        response.body = { id, name }
    })
    app.use(bodyParser())
    app.use(router.routes())


    let shareDB
    let shareDBLogger

    // start server
    const disposableStartServer = vscode.commands.registerCommand('extension.startServer', () => {
        const cb = tap(_ => console.log(`Session server listening at ${sessionServerPort}`), app.callback())
        const server = http.createServer(cb)
        
        shareDB = new ShareDB()
        shareDBLogger = new ShareDBLogger(shareDB)
        const wss = new WS.Server({ server })
        wss.on('connection', (ws, req) => {
            console.log(`client connected`);
            const stream = new WebSocketJSONStream(ws)
            shareDB.listen(stream)
        })
        wss.on('close', (ws, req) => console.log(`client disconnected`))

        server.listen(sessionServerPort)
    })

    const disposableStartSession = vscode.commands.registerCommand('extension.startSession', () => {
        const sessionId = uuidv4()
        create(`${sessionServerUrl}/session`, { id: sessionId, name: 'Session name'}, null)
            .then(session => {
                const editor = window.activeTextEditor
                if (typeof editor === "undefined") {
                    console.log('no active editor');
                    return false
                }

                console.log(`session: ${session.id}, ${session.name}`)
                const ws = new WS(`ws://localhost:3000`)
                const sharedbConnection = new ShareDBClient.Connection(ws)
                const doc = sharedbConnection.get('First_collection', 'my_doc')
                doc.create(editor.document.getText())
                doc.subscribe((err) => {
                    if (err) {
                        console.log(`error ${err}`)
                        return false
                    }

                    if (!doc.data) { // does not exist so we create the document and replace the code editor content by the document content
                        doc.create(editor.document.getText());
                    } else { // it exist, we set the code editor content to the latest document snapshot
                        editor.edit(editBuilder => editBuilder.insert(new Position(0,0), doc.data))
                    }
                 
                    // we listen to the "op" event which will fire when a change in content (an operation) is applied to the document, "source" argument determinate the origin which can be local or remote (false)
                    doc.on('op', function(op, source) {
                        var i = 0, j = 0,
                            from,
                            to,
                            operation,
                            o;
                         
                        if (source === false) { // we integrate the operation if it come from the server
                            for (i = 0; i < op.length; i += 1) {
                                operation = op[i];
                                 
                                for (j = 0; j < operation.o.length; j += 1) {
                                    o = operation.o[j];
                                     
                                    if (o["d"]) { // delete operation
                                        from = code_editor.posFromIndex(o.p);
                                        to = code_editor.posFromIndex(o.p + o.d.length);
                                        code_editor.replaceRange("", from, to, "remote");
                                    } else if (o["i"]) { // insert operation
                                        from = code_editor.posFromIndex(o.p);
                                        code_editor.replaceRange(o.i, from, from, "remote");
                                    } else {
                                        console.log("Unknown type of operation.")
                                    }
                                }
                            }
                        }
                    });
                     
                    const sharedb_doc_ready = true; // th
                })

        
            })
            .catch(err => console.log(`error ${err}`))
        
    })


    // connect to server
    var disposableConnect = vscode.commands.registerCommand('extension.connect', () => {
        const activeSessions = read(`${sessionServerUrl}/sessions`, null).catch(err => console.log('error: ', err))
        window.showQuickPick(activeSessions)

        const textEditor = window.activeTextEditor
        if (typeof textEditor === "undefined") {
            console.log('no active editor');
            return false
        }

        vscode.window.onDidChangeActiveTextEditor(()=> {
            console.log('active editor changed')
        })

        // vscode.window.onDidChangeTextEditorSelection(()=> {
        //     console.log('onDidChangeTextEditorSelectiona')
        // })

        // textEditor.edit(editBuilder => {
        //     editBuilder.insert(new Position(0,0), 'New doc content')
        // })
        // .then(fullfilled => console.log('fulfilled'), rejected => console.log('rejected'))

        vscode.workspace.onDidChangeTextDocument((evt) => {
            const { contentChanges } = evt
            console.log(`document changes: `, evt)
        })

    
        // vscode.window.showInformationMessage('Connecting');
    });

    context.subscriptions.push(disposableStartServer);    

    context.subscriptions.push(disposableStartSession)
    context.subscriptions.push(disposableConnect);
    
}