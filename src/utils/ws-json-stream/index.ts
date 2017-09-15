const util = require('util')
const Duplex = require('stream').Duplex

export default class WebSocketJSONStream extends Duplex {
  constructor(ws) {
    super({ objectMode: true })
    this._ws = ws
    ws.on('message', (msg) => { this.push(JSON.parse(msg)) })
    ws.on('close', () => {
      this.push(null)     // end readable stream
      this.end()          // end writable stream
  
      this.emit('close')
      this.emit('end')
    });
    this.on('error', function() { ws.close() })
    this.on('end', function() { ws.close() })
  }

  _read() {}

  _write(msg, encoding, next) {
    this._ws.send(JSON.stringify(msg))
    next()  
  } 
}
