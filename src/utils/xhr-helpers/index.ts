import Debug from 'debug'
import { curry, forEachObjIndexed } from 'ramda'
import fetch from 'node-fetch'

import {
  params,
  formParams,
  parseUrlParams,
  getHeaders,
  checkHttpStatus,
  parseJSON,
  setup as setupUtils,
} from './utils'

const debug = Debug('lgc:xhr-helpers') // eslint-disable-line no-unused-vars

let apiPrefix = '/api'
function setup(api, loginUrl = '', push = () => {}) {
  apiPrefix = api
  setupUtils(loginUrl, push)
}

const tokenXhr = curry((endpoint, token, data) => {
  endpoint = apiPrefix + endpoint
  return fetch(endpoint, {
    method: 'POST',
    mode: 'cors',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic YnJvd3Nlcjo=',
    },
    body: formParams(data),
  })
    .then(checkHttpStatus)
    .then(parseJSON)
})

function read(endpoint, token) {
  endpoint = apiPrefix + endpoint

  return fetch(endpoint, {
    method: 'get',
    mode: 'cors',
    credentials: 'include',
    headers: getHeaders(token),
  }).then(checkHttpStatus)
    .then(parseJSON)
}

function create(endpoint = '', data, token, { method = 'post', responseBody = true } = {}) {
  endpoint = apiPrefix + endpoint
  return fetch(endpoint, {
    method,
    mode: 'cors',
    credentials: 'include',
    headers: getHeaders(token),
    body: data ? JSON.stringify(data) : '',
  }).then(checkHttpStatus)
    .then(response => responseBody ? parseJSON(response) : response)
}

function update(endpoint = '', data, token, { responseBody = true } = {}) {
  return create(endpoint, data, token, { method: 'put', responseBody })
}

function destroy(endpoint = '', token) {
  endpoint = apiPrefix + endpoint
  return fetch(endpoint, {
    method: 'delete',
    mode: 'cors',
    credentials: 'include',
    headers: getHeaders(token),
  }).then(checkHttpStatus)
}

// function upload(url = '', opts = {}, onProgress) {
//   const { method, headers = {}, body } = opts
//   const endpoint = apiPrefix + url
//   const xhr = new XMLHttpRequest()
//   return [new Promise((resolve, reject) => {
//     xhr.open(method || 'get', endpoint)
//     forEachObjIndexed((val, key) => xhr.setRequestHeader(key, val), headers)
//     xhr.onload = evt => resolve(evt.target.responseText)
//     xhr.onerror = reject
//     if (xhr.upload && onProgress) {
//       xhr.upload.onprogress = onProgress
//     }
//     xhr.send(body)
//   }), xhr]
// }

export {
  setup,
  params,
  parseUrlParams,
  tokenXhr,
  read,
  create,
  update,
  destroy,
  // upload,
}
