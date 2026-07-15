#!/usr/bin/env node
import fs from 'node:fs/promises'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { createCanvas, loadImage } from 'canvas'
import * as ort from 'onnxruntime-web'

const root = path.resolve(import.meta.dirname, '..')
const modelPath = path.resolve(root, process.env.SCANGRADE_V3_COMPACT_MODEL || 'private-evidence/models/v3-sequence-live/model.onnx')
const host = process.env.SCANGRADE_V3_HOST || '127.0.0.1'
const port = Number(process.env.SCANGRADE_V3_PORT || 8767)
const tlsCertPath = process.env.SCANGRADE_V3_TLS_CERT || ''
const tlsKeyPath = process.env.SCANGRADE_V3_TLS_KEY || tlsCertPath
const allowedOrigins = new Set(String(process.env.SCANGRADE_V3_ALLOWED_ORIGINS || '').split(',').map((item) => item.trim()).filter(Boolean))
const requiredToken = String(process.env.SCANGRADE_V3_TOKEN || '')
const forbidden = new Set(['answerkey', 'expected', 'expectedanswer', 'mathematicalanswer', 'canonicaldigits'])
ort.env.wasm.numThreads = 1
ort.env.wasm.simd = false
const session = await ort.InferenceSession.create(await fs.readFile(modelPath), { executionProviders: ['wasm'] })

function hasKeyLeak(value) {
  if (Array.isArray(value)) return value.some(hasKeyLeak)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, item]) => forbidden.has(key.replace(/[-_]/g, '').toLowerCase()) || hasKeyLeak(item))
}

async function tensorFor(dataUrl) {
  const image = await loadImage(dataUrl)
  const scale = Math.min(192 / image.width, 64 / image.height)
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = createCanvas(192, 64)
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, 192, 64)
  context.drawImage(image, Math.floor((192 - width) / 2), Math.floor((64 - height) / 2), width, height)
  const rgba = context.getImageData(0, 0, 192, 64).data
  const values = new Float32Array(192 * 64)
  for (let index = 0; index < values.length; index += 1) {
    const offset = index * 4
    const gray = .299 * rgba[offset] + .587 * rgba[offset + 1] + .114 * rgba[offset + 2]
    values[index] = 1 - gray / 255
  }
  return values
}

function softmax(values) {
  const max = Math.max(...values)
  const exp = values.map((value) => Math.exp(value - max))
  const total = exp.reduce((sum, value) => sum + value, 0)
  return exp.map((value) => value / total)
}

function argmax(values) {
  let best = 0
  for (let index = 1; index < values.length; index += 1) if (values[index] > values[best]) best = index
  return best
}

async function recognize(items) {
  const batch = new Float32Array(items.length * 192 * 64)
  for (let index = 0; index < items.length; index += 1) batch.set(await tensorFor(items[index].continuousImageDataUrl), index * 192 * 64)
  const output = await session.run({ image: new ort.Tensor('float32', batch, [items.length, 1, 64, 192]) })
  return items.map((item, index) => {
    const length = softmax(Array.from(output.length.data.slice(index * 2, index * 2 + 2)))
    const tens = softmax(Array.from(output.tens.data.slice(index * 10, index * 10 + 10)))
    const ones = softmax(Array.from(output.ones.data.slice(index * 10, index * 10 + 10)))
    const lengthIndex = argmax(length)
    const tensIndex = argmax(tens)
    const onesIndex = argmax(ones)
    const probabilities = lengthIndex === 1 ? [length[1], tens[tensIndex], ones[onesIndex]] : [length[0], ones[onesIndex]]
    const candidates = []
    for (let digit = 0; digit < 10; digit += 1) {
      const components = [length[0], ones[digit]]
      candidates.push({
        read: String(digit),
        jointProbability: components[0] * components[1],
        minComponentProbability: Math.min(...components),
      })
    }
    for (let left = 0; left < 10; left += 1) {
      for (let right = 0; right < 10; right += 1) {
        const components = [length[1], tens[left], ones[right]]
        candidates.push({
          read: `${left}${right}`,
          jointProbability: components[0] * components[1] * components[2],
          minComponentProbability: Math.min(...components),
        })
      }
    }
    candidates.sort((a, b) => b.jointProbability - a.jointProbability || b.minComponentProbability - a.minComponentProbability)
    return {
      id: item.id, questionNum: item.questionNum, frameIndex: item.frameIndex ?? null,
      read: lengthIndex === 1 ? `${tensIndex}${onesIndex}` : String(onesIndex),
      meanComponentProbability: probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length,
      minComponentProbability: Math.min(...probabilities),
      topCandidates: candidates.slice(0, 5).map((candidate) => ({
        ...candidate,
        jointProbability: Number(candidate.jointProbability.toFixed(8)),
        minComponentProbability: Number(candidate.minComponentProbability.toFixed(6)),
      })),
      model: 'scangrade-v3-compact-continuous', keyBlind: true,
    }
  })
}

function cors(response, request) {
  const origin = request.headers.origin
  if (origin && (!allowedOrigins.size || allowedOrigins.has(origin))) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }
}

function originAllowed(request) {
  const origin = request.headers.origin
  return !origin || !allowedOrigins.size || allowedOrigins.has(origin)
}

function authorized(request) {
  if (!requiredToken) return true
  return request.headers.authorization === `Bearer ${requiredToken}`
}

function reply(response, request, status, value) {
  cors(response, request)
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(value))
}

const requestHandler = async (request, response) => {
  if (request.method === 'OPTIONS') {
    if (!originAllowed(request)) return reply(response, request, 403, { ok: false, error: 'origin not allowed' })
    cors(response, request)
    response.writeHead(204, { 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' })
    return response.end()
  }
  if (request.method === 'GET' && request.url === '/health') return reply(response, request, 200, { ok: true, model: 'scangrade-v3-compact-continuous', modelPath })
  if (request.method !== 'POST' || request.url !== '/v3/recognize') return reply(response, request, 404, { ok: false, error: 'not found' })
  if (!originAllowed(request)) return reply(response, request, 403, { ok: false, error: 'origin not allowed' })
  if (!authorized(request)) return reply(response, request, 401, { ok: false, error: 'unauthorized' })
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > 30_000_000) return reply(response, request, 413, { ok: false, error: 'request too large' })
    chunks.push(chunk)
  }
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (hasKeyLeak(payload)) return reply(response, request, 400, { ok: false, error: 'answer-key fields are forbidden' })
    if (!Array.isArray(payload.items) || payload.items.length < 1 || payload.items.length > 64 || payload.items.some((item) => !item.continuousImageDataUrl)) {
      return reply(response, request, 400, { ok: false, error: 'items must contain 1-64 continuous images' })
    }
    return reply(response, request, 200, { ok: true, results: await recognize(payload.items) })
  } catch (error) {
    return reply(response, request, 500, { ok: false, error: String(error?.message || error) })
  }
}
const server = tlsCertPath
  ? https.createServer({ cert: await fs.readFile(tlsCertPath), key: await fs.readFile(tlsKeyPath) }, requestHandler)
  : http.createServer(requestHandler)
const protocol = tlsCertPath ? 'https' : 'http'
server.listen(port, host, () => console.log(`V3 compact recognizer listening on ${protocol}://${host}:${port}; model=${modelPath}`))
