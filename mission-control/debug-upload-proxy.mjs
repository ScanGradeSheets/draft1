import { createServer, request as httpRequest } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

const HOST = process.env.SG_DEBUG_PROXY_HOST || '127.0.0.1'
const PORT = Number(process.env.SG_DEBUG_PROXY_PORT || 8793)
const TARGET_HOST = '127.0.0.1'
const TARGET_PORT = Number(process.env.SG_MISSION_CONTROL_PORT || 8787)
const TOKEN = process.env.SG_DEBUG_UPLOAD_TOKEN || ''
const MAX_BODY_BYTES = Number(process.env.SG_DEBUG_UPLOAD_MAX_BYTES || 80 * 1024 * 1024)
const REQUEST_TIMEOUT_MS = 70_000
const RATE_WINDOW_MS = 10 * 60_000
const RATE_MAX_REQUESTS = 60
const ALLOWED_ORIGIN = 'https://scangrade.io'
const rateWindows = new Map()

function responseHeaders(origin = '') {
  return {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(origin === ALLOWED_ORIGIN ? {
      'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,X-ScanGrade-Debug-Token',
      'Vary': 'Origin',
    } : {}),
  }
}

function sendJson(res, status, payload, origin = '') {
  if (res.headersSent) return
  res.writeHead(status, responseHeaders(origin))
  res.end(`${JSON.stringify(payload)}\n`)
}

function secureTokenMatch(candidate) {
  if (!TOKEN || typeof candidate !== 'string') return false
  const expected = Buffer.from(TOKEN)
  const supplied = Buffer.from(candidate)
  return expected.length === supplied.length && timingSafeEqual(expected, supplied)
}

function requestClientKey(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  return forwarded || req.socket.remoteAddress || 'unknown'
}

function rateLimitAllows(req) {
  const now = Date.now()
  const key = requestClientKey(req)
  const current = rateWindows.get(key)
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateWindows.set(key, { startedAt: now, count: 1 })
    return true
  }
  current.count += 1
  return current.count <= RATE_MAX_REQUESTS
}

async function collectBody(req) {
  const declared = Number(req.headers['content-length'] || 0)
  if (declared > MAX_BODY_BYTES) {
    const error = new Error('Debug bundle exceeds the upload limit')
    error.statusCode = 413
    throw error
  }
  const chunks = []
  let bytes = 0
  for await (const chunk of req) {
    bytes += chunk.length
    if (bytes > MAX_BODY_BYTES) {
      const error = new Error('Debug bundle exceeds the upload limit')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function forwardToPrivateReceiver(body, token) {
  return new Promise((resolve, reject) => {
    const upstream = httpRequest({
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: '/api/debug-scans',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': body.length,
        'X-ScanGrade-Debug-Token': token,
      },
      timeout: REQUEST_TIMEOUT_MS,
    }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8')
        let payload = {}
        try { payload = JSON.parse(text) } catch { /* sanitized below */ }
        resolve({ status: response.statusCode || 502, payload })
      })
    })
    upstream.on('timeout', () => upstream.destroy(new Error('Private receiver timed out')))
    upstream.on('error', reject)
    upstream.end(body)
  })
}

const server = createServer(async (req, res) => {
  const origin = String(req.headers.origin || '')
  const url = new URL(req.url || '/', 'http://localhost')

  if (url.pathname !== '/') {
    sendJson(res, 404, { error: 'Not found' }, origin)
    return
  }
  if (origin !== ALLOWED_ORIGIN) {
    sendJson(res, 403, { error: 'Origin not allowed' })
    return
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, responseHeaders(origin))
    res.end()
    return
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' }, origin)
    return
  }
  try {
    let body = await collectBody(req)
    let suppliedToken = String(req.headers['x-scangrade-debug-token'] || '')
    const contentType = String(req.headers['content-type'] || '').toLowerCase()
    if (!secureTokenMatch(suppliedToken) && contentType.startsWith('text/plain')) {
      let envelope = null
      try { envelope = JSON.parse(body.toString('utf8')) } catch { /* rejected below */ }
      suppliedToken = String(envelope?.debugUploadToken || '')
      if (secureTokenMatch(suppliedToken) && envelope?.payload && typeof envelope.payload === 'object') {
        body = Buffer.from(JSON.stringify(envelope.payload))
      }
    }
    if (!secureTokenMatch(suppliedToken)) {
      sendJson(res, 401, { error: 'Unauthorized' }, origin)
      return
    }
    if (!rateLimitAllows(req)) {
      sendJson(res, 429, { error: 'Too many uploads; try again shortly' }, origin)
      return
    }
    const upstream = await forwardToPrivateReceiver(body, TOKEN)
    if (upstream.status < 200 || upstream.status >= 300 || upstream.payload?.ok === false) {
      sendJson(res, upstream.status >= 400 ? upstream.status : 502, {
        error: upstream.payload?.error || 'Private receiver rejected the bundle',
      }, origin)
      return
    }
    // Never expose local filesystem paths returned by Mission Control.
    sendJson(res, 201, { ok: true, id: upstream.payload?.id || null }, origin)
  } catch (error) {
    sendJson(res, error.statusCode || 502, { error: error.message || 'Upload failed' }, origin)
  }
})

server.requestTimeout = REQUEST_TIMEOUT_MS
server.headersTimeout = 10_000
server.keepAliveTimeout = 5_000

server.listen(PORT, HOST, () => {
  console.log(`ScanGrade debug upload proxy: http://${HOST}:${PORT}`)
})
