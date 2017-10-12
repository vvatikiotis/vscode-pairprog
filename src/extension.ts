import * as vscode from 'vscode'
import { StatusBarItem, window, commands } from 'vscode'

import ShareDB = require('sharedb')
import ShareDBClient = require('sharedb/lib/client')
import ShareDBLogger = require('sharedb-logger')
import WS = require('ws')
import WebSocketJSONStream from './utils/ws-json-stream'

import http = require('http')
import Koa from './server'
import destroyable = require('server-destroy')
import uuidv4 = require('uuid/v4')

import {
    tap, merge, compose, equals, length, keys, head, isEmpty, empty, map, find,
    split, trim, append, prop, propOr,
} from 'ramda'

import Debug from 'debug'
const debugServer = Debug('server')
const debug = Debug('client')

// debug.log writes to stderr by default. Rebind it to console.log
debug.log = console.log.bind(console)

import { setup as apiSetup, read, create } from './utils/xhr-helpers'
import { SessionDBType, SessionDocumentType } from './types'

const { workspace, TextEdit, Position, Range } = vscode
const sessionServerPort = 3000
const sessionServerUrl = `localhost:${sessionServerPort}`
apiSetup('')

let isServerRunning = false
let server = null
let serverStatusBarItem: StatusBarItem
let sharedDocsStatusBarItem: StatusBarItem

export function activate(context: vscode.ExtensionContext) {
    let sessions: SessionDBType = {}
    let sessionDocuments: SessionDocumentType = {}

    const disposableShowStopServerCmd = vscode.commands.registerCommand('extension.showStopServerCmd', async () => {
        const sel = await window.showQuickPick(['PairProg: Stop server'])
        if (sel) commands.executeCommand('extension.stopServer')
    })

    const disposableShowSharedDocs = vscode.commands.registerCommand('extension.showSharedDocs', async () => {
        const sel = await window.showQuickPick(prop((keys(sessionDocuments)), sessionDocuments))
    })

    //
    // start server
    //
    const disposableStartServer = vscode.commands.registerCommand('extension.startServer', () => {
        if (isServerRunning) {
            window.showErrorMessage('Share server is already running')
            return false
        }
        const cb = tap(_ => debugServer(`Session server listening at ${sessionServerPort}`), Koa.callback())
        server = http.createServer(cb)
        if (server) isServerRunning = true

        const shareDB = new ShareDB()
        const shareDBLogger = ShareDBLogger(shareDB)
        const wss = new WS.Server({ server })
        wss.on('connection', (ws, req) => {
            debugServer(`ShareDB client connected`)
            const stream = new WebSocketJSONStream(ws)
            shareDB.listen(stream)
        })
        wss.on('close', (ws, req) => debugServer(`ShareDB client disconnected`))

        const onServerListening = () => {
            serverStatusBarItem = window.createStatusBarItem(vscode.StatusBarAlignment.Left)
            serverStatusBarItem.text = '$(server)'
            serverStatusBarItem.tooltip = `PairProg: Server running at ${sessionServerUrl}`
            serverStatusBarItem.command = 'extension.showStopServerCmd'
            serverStatusBarItem.show()
        }
        server.listen(sessionServerPort, onServerListening)
        destroyable(server)
    })

    const handleSharing = (collectionId, docId, msg = 'no origin specified') => {
        let fromRemote = false
        const editor = window.activeTextEditor
        if (typeof editor === 'undefined') {
            debug(`${msg}: no active editor`)
            return false
        }

        const ws = new WS(`ws://${sessionServerUrl}`)
        const sharedbConnection = new ShareDBClient.Connection(ws)
        const doc = sharedbConnection.get(collectionId, docId)
        doc.subscribe(err => {
            if (err) {
                debug(`error ${err}`)
                return false
            }

            // does not exist so we create the document and replace the code editor content by the document content
            if (!doc.data) {
                debug(`${msg}: create doc`)
                doc.create(editor.document.getText())
            } else { // it exist, we set the code editor content to the latest document snapshot
                debug(`${msg}: edit doc`)
                editor.edit(editBuilder => editBuilder.replace(new Position(0, 0), doc.data))
                fromRemote = true
            }

            // we listen to the "op" event which will fire when a change in content (an operation) is applied
            // to the document, "source" argument determinate the origin which can be local or remote (false)
            doc.on('op', (op, source) => {
                let operation
                let o

                if (source === false) { // we integrate the operation if it come from the server
                    for (let i = 0; i < op.length; i += 1) {
                        operation = op[i]

                        for (let j = 0; j < operation.o.length; j += 1) {
                            o = operation.o[j]

                            if (o.d) { // delete operation
                                debug(`${msg}: doc handler :: VSC delete Op for ${editor.document.fileName}`)
                                // from = code_editor.posFromIndex(o.p);
                                // to = code_editor.posFromIndex(o.p + o.d.length);
                                // code_editor.replaceRange("", from, to, "remote");
                                fromRemote = true
                            } else if (o.i) { // insert operation
                                debug(`${msg}: doc handler :: VSC insert Op for ${editor.document.fileName}`)
                                const editPosition = editor.document.positionAt(o.p)
                                editor.edit(editBuilder => editBuilder.insert(editPosition, o.i))
                                fromRemote = true
                                // from = code_editor.posFromIndex(o.p);
                                // code_editor.replaceRange(o.i, from, from, "remote");
                            } else {
                                debug('Unknown type of operation.')
                            }
                        }
                    }
                }
            })
        })

        // handles local changes only
        workspace.onDidChangeTextDocument(evt => {
            const isSameDocument = editor.document.fileName === evt.document.fileName
            if (!isSameDocument) return false

            const { text } =  evt.contentChanges[0]
            debug()
            const { start, end } = evt.contentChanges[0].range
            editor.document.offsetAt(start)
            debug(`${msg}: document changes:
                ${start.line}:${start.character} -> ${end.line}:${end.character},
                text: ${JSON.stringify(text.slice(0, 10))}`)

            const op = { p: [], t: 'text0', o: [] }
            if (!fromRemote && text !== '') {
                debug(`${msg}: evt handler :: submitOp`)
                op.o.push({ p: editor.document.offsetAt(start), i: text })
                doc.submitOp(op)
            }
            fromRemote = false
        })
    }

    //
    // Start a share session action
    //
    const disposableStartSession = vscode.commands.registerCommand('extension.startSession', async () => {
        if (compose(equals(1), length, keys())(sessions)) {
            vscode.window.showErrorMessage(`Cannot start more than one sessions`)
            return false
        }
        const sessionId = uuidv4().slice(0, 8)

        try {
            const sessionName = await window.showInputBox({ prompt: 'Set your session name' })
            if (isEmpty(sessionName)) {
                window.showErrorMessage('No session started. Please name your session')
                return false
            }
            const session = await create(
                `http://${sessionServerUrl}/session`,
                { id: sessionId, name: sessionName, startedAt: Date.now() },
                null,
            )
            debug(`session: ${session.id}, ${session.name}`)
            sessions[session.id] = session
            vscode.window.showInformationMessage(
                `Sharing session **${session.name}**, with ID ${session.id}, is now online`,
            )

            const docsCount = propOr([], sessionId, sessionDocuments).length
            if (!sharedDocsStatusBarItem) {
                sharedDocsStatusBarItem =  window.createStatusBarItem(vscode.StatusBarAlignment.Left)
                sharedDocsStatusBarItem.show()
            }
            sharedDocsStatusBarItem.text = `$(mirror) ${docsCount}`
            sharedDocsStatusBarItem.tooltip = `Session ${session.name}: ${docsCount} shared documents`
            sharedDocsStatusBarItem.command = 'extension.showSharedDocs'
        } catch (err) {
            vscode.window.showErrorMessage(`Cannot create sharing session. ${err}`)
        }
    })

    //
    // Share document action
    //
    const disposableShareDoc =  vscode.commands.registerTextEditorCommand('extension.shareDoc', async () => {
        // only 1 session supported, i.e. the first in sessions object
        const sessionId = compose(head, keys)(sessions)

        if (!sessionId) {
            window.showErrorMessage('Start a pair session before sharing a document')
            return false
        }

        const docId = window.activeTextEditor.document.fileName
        if (!docId) {
            window.showErrorMessage('You need to share a document')
            return false
        }

        const sharedDoc = await create(`http://${sessionServerUrl}/document`, { sessionId, docId }, null)
        if (isEmpty(sharedDoc)) {
            window.showWarningMessage('This document is already being shared')
            return false
        }

        vscode.window.showInformationMessage(`Sharing ${docId}`)
        sessionDocuments[sessionId] = append(docId, sessionDocuments[sessionId])
        handleSharing(sessionId, docId, 'master')

        const docsCount = propOr([], sessionId, sessionDocuments).length
        sharedDocsStatusBarItem.text = `$(mirror) ${docsCount}`
        sharedDocsStatusBarItem.tooltip = `Session ${sessions[sessionId].name}: ${docsCount} shared documents`
    })

    //
    // Connect to a share session action
    //
    const disposableConnectSession = vscode.commands.registerCommand('extension.connectSession', async () => {
        try {
            let session
            const activeSessions = await read(`http://${sessionServerUrl}/sessions`, null)
            if (isEmpty(activeSessions)) window.showWarningMessage('There are no sessions')
            else session = await window.showQuickPick(activeSessions)

            if (isEmpty(session)) window.showWarningMessage('No session selected')
            else {
                const [id, name] = split(':', session)
                if (!sessions[id]) {
                    sessions[id] = { id, name: trim(name), startedAt: Date.now() }
                }
            }

            // TODO: need to implement the shareddocs statusbar item func
        } catch (err) {
            vscode.window.showErrorMessage(`Cannot connect to sharing session. ${err}`)
         }
    })

    //
    // Engage in a shared doc
    //
    const disposableEngage = vscode.commands.registerTextEditorCommand('extension.engageDoc', async () => {
        const sessionId = compose(head, keys)(sessions)
        try {
            const sharedDocs = await read(`http://${sessionServerUrl}/documents/${sessionId}`, null)
            if (isEmpty(sharedDocs)) {
                window.showWarningMessage('There are no shared documents in this session')
                return false
            }

            const docId = await window.showQuickPick(sharedDocs)
            handleSharing(sessionId, docId, 'slave')

            // TODO: need to implement the shareddocs statusbar item func
        } catch (err) {
            window.showErrorMessage(`Cannot complete operation: ${err}`)
        }
    })

    //
    // Stop local share server
    //
    const disposableStopServer = vscode.commands.registerCommand('extension.stopServer', async () => {
        server.destroy(() => {
            serverStatusBarItem.hide()
            if (sharedDocsStatusBarItem) sharedDocsStatusBarItem.hide()
            sharedDocsStatusBarItem = null
            server = null
            isServerRunning = false
            sessions = empty(sessions)
            sessionDocuments = empty(sessionDocuments)
            debugServer('Http server has closed')
        })
    })

    context.subscriptions.push(disposableStartServer,
        disposableStartSession,
        disposableShareDoc,
        disposableConnectSession,
        disposableEngage,
        disposableStopServer,
        disposableShowStopServerCmd,
        disposableShowSharedDocs,
    )
}

export function deactivate(context: vscode.ExtensionContext) {
    return new Promise((resolve, reject) => {
        serverStatusBarItem.dispose()
        sharedDocsStatusBarItem.dispose()
        server.destroy(() => resolve(0))
    })
}
