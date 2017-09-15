import Debug from 'debug'
import { 
  pickBy, 
  pipe, 
  propOr, 
  identity,
  mapObjIndexed,
  values,
  join,
  merge,
  compose,
  map,
  toPairs,
  reduce,
  always,
  ifElse,
} from 'ramda'
import { isArrayLike } from 'ramda-adjunct'

const debug = Debug('lgc:xhr-helpers:utils')

const jsonHeaders = {
  'Accept': 'application/json',
  'Content-Type': 'application/json',
}

let loginUrl = '/login'
let push = () => debug('WARNING: calling push without proper setup - NOOP')

export function setup(appLoginUrl, pushFn) {
  push = pushFn
  loginUrl = appLoginUrl
}

class GenericError extends Error {
  constructor({ type, message, response = {} }) {
    super({ type, message, response })
    this.type = type
    this.message = message
    this.response = response
    this.name = 'GenericError'

    if (typeof Error.captureStackTrace === 'function') {
      Error.captureStackTrace(this, this.constructor)
    } else {
      this.stack = (new Error(message)).stack
    }
  }
}

const objToUrlParams = pipe(
  pickBy(identity),                                         // keep only non-falsy keys
  mapObjIndexed((v, k) => k + '=' + encodeURIComponent(v)), // map k: v -> k: 'k=urlEncoded(v)'
  values,                                                   // get values array
  join('&'),                                                // mr. obvious
)

const fieldsToObj = reduce((acc, err) => { acc[err.name] = err.key || null; return acc })

export function params(o = {}, ampFirst) {
  if (typeof o === 'string') return o

  const paramsStr = objToUrlParams(o)
  const query = ampFirst ? '&' + paramsStr : paramsStr
  return paramsStr ? query : ''
}

export function parseUrlParams(query) {
  query = (query || window.location.search).substr(1)

  const result = {}
  query.split('&').forEach(part => {
    var item = part.split('=')
    if (item[0]) result[item[0]] = window.decodeURIComponent(item[1])
  })

  return result
}

export const formParams = compose(join('&'), map(join('=')), toPairs)

export function getHeaders(token) {
  const tokenHeader = token ? { 'Authorization': `Bearer ${token}` } : {}
  return merge(tokenHeader, jsonHeaders)
}

export function checkHttpStatus(response) {
  if (response.ok) return response

  const status = response.status
  const message = 'Http Status != OK'
  switch (status) {
    case 401:
      push(loginUrl)
      return null
    case 400:
      return response.json().then((err) => {
        throw new GenericError({
          type: status,
          message,
          response: {
            error: err.error,
            description: propOr(null, 'error_description')(err),
            fields: ifElse(isArrayLike, fieldsToObj({}), always({}))(err.fields),
          },
        })
      })
    default:
      throw new GenericError({ type: status, message, response })
  }
}

export function parseJSON(response) {
  return response.json()
}
