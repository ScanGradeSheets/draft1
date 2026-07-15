#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const manifestPath = path.resolve(ROOT, process.env.SG_V3_MANIFEST || 'private-evidence/v3/four-packet-sequence-20260714/manifest.json')
const baseUrl = String(process.env.SG_V3_REVIEW_URL || 'http://127.0.0.1:8768').replace(/\/$/, '')
const origin = String(process.env.SG_V3_REVIEW_ORIGIN || '').trim()
const batchSizes = String(process.env.SG_V3_BATCH_SIZES || '1,8,24').split(',').map(Number).filter((value) => value > 0 && value <= 64)
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

function imageDataUrl(entry) {
  return `data:image/png;base64,${fs.readFileSync(path.resolve(ROOT, entry.recognitionPath)).toString('base64')}`
}

async function recognize(items) {
  const started = performance.now()
  const response = await fetch(`${baseUrl}/recognize`, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify({ items }),
  })
  const payload = await response.json()
  return { response, payload, elapsedMs: performance.now() - started }
}

const healthStarted = performance.now()
const healthResponse = await fetch(`${baseUrl}/health`)
const health = await healthResponse.json()
const healthElapsedMs = performance.now() - healthStarted
const results = []
for (const size of batchSizes) {
  const items = manifest.entries.slice(0, size).map((entry, index) => ({
    id: `benchmark-${size}-${index}`,
    questionNum: entry.questionNum,
    imageDataUrl: imageDataUrl(entry),
  }))
  const { response, payload, elapsedMs } = await recognize(items)
  if (!response.ok || payload?.results?.length !== size) throw new Error(payload?.error || `incomplete batch ${size}`)
  results.push({
    size,
    roundTripMs: Number(elapsedMs.toFixed(1)),
    inferenceMs: Number(payload.inferenceMs || 0),
    answersPerSecond: Number((size / (elapsedMs / 1000)).toFixed(1)),
  })
}
const leak = await fetch(`${baseUrl}/recognize`, {
  method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
  body: JSON.stringify({ answerKey: '7', items: [{ id: 'leak', questionNum: 1, imageDataUrl: imageDataUrl(manifest.entries[0]) }] }),
})
const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  manifest: path.relative(ROOT, manifestPath),
  health: { ...health, roundTripMs: Number(healthElapsedMs.toFixed(1)) },
  results,
  answerKeyLeakRejected: leak.status === 400,
}
const outputPath = process.env.SG_V3_BENCHMARK_OUT ? path.resolve(ROOT, process.env.SG_V3_BENCHMARK_OUT) : ''
if (outputPath) fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ ...report, ...(outputPath ? { output: path.relative(ROOT, outputPath) } : {}) }, null, 2))
