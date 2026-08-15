import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

const HOST = process.env.SG_PRIVATE_GATEWAY_HOST || '127.0.0.1'
const PORT = Number(process.env.SG_PRIVATE_GATEWAY_PORT || 8794)
const PUBLIC_ORIGIN = String(process.env.SG_PRIVATE_GATEWAY_PUBLIC_ORIGIN || '').replace(/\/$/, '')
const ACTIVATION_TOKEN = process.env.SG_PRIVATE_GATEWAY_ACTIVATION_TOKEN || ''
const UPLOAD_TOKEN = process.env.SG_DEBUG_UPLOAD_TOKEN || ''
const EXPIRES_AT = Number(process.env.SG_PRIVATE_GATEWAY_EXPIRES_AT || 0)
const COOKIE_NAME = 'sg_private_add2'
const MAX_UPLOAD_BYTES = 80 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 100_000
const APP_TARGET = { protocol: 'https:', hostname: '127.0.0.1', port: 5174 }
const MODEL_TARGET = { protocol: 'http:', hostname: '127.0.0.1', port: 8791 }
const UPLOAD_TARGET = { protocol: 'http:', hostname: '127.0.0.1', port: 8793 }
const ALLOWED_MODEL_PATHS = new Set([
  '/models/encoder-fp32.onnx',
  '/models/decoder-int8.onnx',
])

if (!PUBLIC_ORIGIN || !ACTIVATION_TOKEN || !UPLOAD_TOKEN || !Number.isFinite(EXPIRES_AT)) {
  throw new Error('Private gateway configuration is incomplete')
}

const EXPECTED_COOKIE = createHash('sha256')
  .update(`scangrade-private-add2:${ACTIVATION_TOKEN}`)
  .digest('base64url')

function secureMatch(candidate, expected) {
  const supplied = Buffer.from(String(candidate || ''))
  const wanted = Buffer.from(String(expected || ''))
  return supplied.length === wanted.length && timingSafeEqual(supplied, wanted)
}

function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((part) => {
    const separator = part.indexOf('=')
    if (separator < 0) return ['', '']
    return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
  }).filter(([key]) => key))
}

function isAuthorized(req) {
  return secureMatch(parseCookies(req.headers.cookie)[COOKIE_NAME], EXPECTED_COOKIE)
}

function noStoreHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store, max-age=0',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'X-Frame-Options': 'DENY',
    ...extra,
  }
}

function send(res, status, body = '', headers = {}) {
  if (res.headersSent) return
  res.writeHead(status, noStoreHeaders(headers))
  res.end(body)
}

function sendNotFound(res) {
  send(res, 404, 'Not found\n', { 'Content-Type': 'text/plain; charset=utf-8' })
}

function cleanProxyHeaders(headers) {
  const output = { ...headers }
  for (const name of [
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade', 'set-cookie', 'cookie',
  ]) delete output[name]
  return output
}

function proxyRequest(req, res, target, targetPath, overrides = {}) {
  return new Promise((resolve) => {
    const requestImpl = target.protocol === 'https:' ? httpsRequest : httpRequest
    const headers = cleanProxyHeaders(req.headers)
    headers.host = `${target.hostname}:${target.port}`
    Object.assign(headers, overrides.headers || {})

    const upstream = requestImpl({
      hostname: target.hostname,
      port: target.port,
      path: targetPath,
      method: req.method,
      headers,
      timeout: REQUEST_TIMEOUT_MS,
      ...(target.protocol === 'https:' ? { rejectUnauthorized: false } : {}),
    }, (upstreamResponse) => {
      const responseHeaders = cleanProxyHeaders(upstreamResponse.headers)
      delete responseHeaders['access-control-allow-origin']
      delete responseHeaders['access-control-allow-credentials']
      res.writeHead(upstreamResponse.statusCode || 502, responseHeaders)
      upstreamResponse.pipe(res)
      upstreamResponse.on('end', resolve)
    })

    upstream.on('timeout', () => upstream.destroy(new Error('Upstream timed out')))
    upstream.on('error', () => {
      if (!res.headersSent) send(res, 502, 'Temporary test service unavailable\n', {
        'Content-Type': 'text/plain; charset=utf-8',
      })
      else res.destroy()
      resolve()
    })
    req.pipe(upstream)
  })
}

function debugRedirectLocation(activationUrl) {
  const query = new URLSearchParams({
    v3BrowserLocalStrongShadow: '1',
    v3BrowserLocalAdd2StitchedApply: '1',
    v3BrowserLocalStrongFrames: '1',
    v3BrowserLocalStrongLimit: '8',
    v3BrowserLocalStrongTimeoutMs: '90000',
  })
  for (const key of ['test', 'v3BurstReplay']) {
    const value = activationUrl.searchParams.get(key)
    if (value) query.set(key, value)
  }
  const fragment = new URLSearchParams({
    debugAutoUpload: '1',
    debugUploadUrl: `${PUBLIC_ORIGIN}/debug-upload`,
    debugUploadToken: UPLOAD_TOKEN,
  })
  return `/debug?${query}#${fragment}`
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://private-gateway.local')

  if (url.pathname === '/health' && req.method === 'GET') {
    send(res, Date.now() < EXPIRES_AT ? 200 : 410, Date.now() < EXPIRES_AT ? 'ok\n' : 'expired\n', {
      'Content-Type': 'text/plain; charset=utf-8',
    })
    return
  }
  if (Date.now() >= EXPIRES_AT) {
    sendNotFound(res)
    return
  }

  const activationPrefix = '/activate/'
  if (url.pathname.startsWith(activationPrefix) && req.method === 'GET') {
    const candidate = url.pathname.slice(activationPrefix.length)
    if (!secureMatch(candidate, ACTIVATION_TOKEN)) {
      sendNotFound(res)
      return
    }
    const maxAge = Math.max(1, Math.floor((EXPIRES_AT - Date.now()) / 1000))
    send(res, 302, '', {
      'Set-Cookie': `${COOKIE_NAME}=${EXPECTED_COOKIE}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`,
      'Location': debugRedirectLocation(url),
    })
    return
  }

  if (!isAuthorized(req)) {
    sendNotFound(res)
    return
  }

  if (url.pathname === '/debug-upload') {
    if (req.method !== 'POST') {
      sendNotFound(res)
      return
    }
    const declaredLength = Number(req.headers['content-length'] || 0)
    if (declaredLength > MAX_UPLOAD_BYTES) {
      send(res, 413, 'Upload too large\n', { 'Content-Type': 'text/plain; charset=utf-8' })
      return
    }
    await proxyRequest(req, res, UPLOAD_TARGET, '/', {
      headers: {
        origin: 'https://scangrade.io',
        'x-scangrade-debug-token': UPLOAD_TOKEN,
      },
    })
    return
  }

  if (url.pathname.startsWith('/local-model-probe/')) {
    if (!['GET', 'HEAD'].includes(req.method || '')) {
      sendNotFound(res)
      return
    }
    const modelPath = url.pathname.slice('/local-model-probe'.length)
    if (!ALLOWED_MODEL_PATHS.has(modelPath)) {
      sendNotFound(res)
      return
    }
    await proxyRequest(req, res, MODEL_TARGET, `${modelPath}${url.search}`)
    return
  }

  if (!['GET', 'HEAD'].includes(req.method || '')) {
    sendNotFound(res)
    return
  }
  await proxyRequest(req, res, APP_TARGET, `${url.pathname}${url.search}`)
})

server.requestTimeout = REQUEST_TIMEOUT_MS
server.headersTimeout = 15_000
server.keepAliveTimeout = 5_000

server.listen(PORT, HOST, () => {
  console.log(`ScanGrade private test gateway listening on http://${HOST}:${PORT}`)
  console.log(`Expires at ${new Date(EXPIRES_AT).toISOString()}`)
})

const expiryTimer = setTimeout(() => {
  server.close(() => process.exit(0))
}, Math.max(1, EXPIRES_AT - Date.now()))
expiryTimer.unref()
