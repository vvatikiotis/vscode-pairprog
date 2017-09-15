import * as vscode from 'vscode';
const gulf = require('gulf')
import { type as textOT } from 'ot-text'
const net = require('net')
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



// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const { window, workspace, TextEdit, Position, Range } = vscode    

    const masterDoc = new gulf.Document({
        storageAdapter: new gulf.MemoryAdapter,
        ottype: textOT,
    })
    masterDoc.initializeFromStorage('')

    const commitHandler = (edit, ownEdit) => {
        console.log(`server :: edit: ${JSON.stringify(edit)}, ownEdit: ${ownEdit}`)
        console.log(`doc content: ${masterDoc.content}`)
    }
    masterDoc.on('commit', commitHandler)

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


    // start server
    const disposableStartServer = vscode.commands.registerCommand('extension.startServer', () => {
        const cb = tap(_ => console.log(`Session server listening at ${sessionServerPort}`), app.callback())
        http.createServer(cb).listen(sessionServerPort)        
    })

    const disposableStartSession = vscode.commands.registerCommand('extension.startSession', () => {
        const sessionId = uuidv4()
        create(`${sessionServerUrl}/session`, { id: sessionId, name: 'Session name'}, null)
            .then(session => console.log(`session: ${session.id}, ${session.name}`))
            .catch(err => console.log(`error ${err}`))
        
        // const otConnHandler = (socket) => {
        //     console.log('Server :: New connection')

        //     const sessionId = uuidv4()
            
        //     const slave = masterDoc.slaveLink()

        //     socket.on('pipe', (src) => console.log(`Pipping to server`))
        //     socket.on('error', (err) => console.log('error'))          

        //     socket.pipe(slave).pipe(socket)
        // }

        // const otServer = net.createServer(otConnHandler)
        // otServer.listen(8080, () => {
        //     console.log('Starting Gulf server')
        // })

    })


    let master = true
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

        const doc = new gulf.EditableDocument({
            storageAdapter: new gulf.MemoryAdapter,
            ottype: textOT,
        })
            
        let content
        
        doc._onBeforeChange = function() {
            console.log('onBeforeChange')
            return Promise.resolve()
        }
        
        doc._onChange = function(cs) {
            console.log(`onChange cs: ${cs}`)
            
            content = textOT.apply(content, cs)
            console.log(`onChange content: ${content}`)
            
            return Promise.resolve()
        }
        
        doc._setContent = function(newcontent) {
            console.log(`setContent: ${newcontent}`)
            content = newcontent
            return Promise.resolve()
        }
        
        const commitHandler = (edit, ownEdit) => {
            console.log(`client :: edit: ${JSON.stringify(edit)}, ownEdit: ${ownEdit}`)
            console.log(`doc content: ${doc.content}`)
        }

        // const socket = net.connect(8080, function() {
        //     console.log('Client :: connect!');
        //     const master = doc.masterLink()
        //     doc.on('commit', commitHandler)
        //     socket.on('pipe', (src) => console.log(`Pipping to client`))
          
        //     socket.pipe(master).pipe(socket)
        //     const initialText = textEditor.document.getText()
        //     console.log(`Client :: connect :: initialText: ${initialText}`)
        //     setTimeout(() => doc.submitChange([1, initialText]), 1000)
        // })
    
        // vscode.window.showInformationMessage('Connecting');
    });

    context.subscriptions.push(disposableStartServer);    

    context.subscriptions.push(disposableStartSession)
    context.subscriptions.push(disposableConnect);
    
}