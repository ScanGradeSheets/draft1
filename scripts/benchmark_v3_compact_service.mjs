#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const manifestPath = path.resolve(root, process.env.SG_V3_MANIFEST || 'private-evidence/v3/live-continuous-answer-zones-manifest.json')
const baseUrl = String(process.env.SG_V3_COMPACT_URL || 'http://127.0.0.1:8767').replace(/\/$/, '')
const batchSizes = String(process.env.SG_V3_BATCH_SIZES || '1,10,30')
  .split(',').map(Number).filter((value) => Number.isInteger(value) && value > 0 && value <= 64)

const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
const entries = manifest.entries || manifest.items || []
if (!entries.length) throw new Error(`No entries in ${manifestPath}`)

async function imageDataUrl(entry) {
  const source = entry.imagePath || entry.image_path || entry.path
  const absolute = path.isAbsolute(source) ? source : path.resolve(root, source)
  return `data:image/png;base64,${(await fs.readFile(absolute)).toString('base64')}`
}

const results = []
for (const size of batchSizes) {
  const selected = entries.slice(0, size)
  const items = await Promise.all(selected.map(async (entry, index) => ({
    id: `benchmark-${size}-${index}`,
    questionNum: entry.questionNum ?? entry.question_num ?? index + 1,
    continuousImageDataUrl: await imageDataUrl(entry),
  })))
  const started = performance.now()
  const response = await fetch(`${baseUrl}/v3/recognize`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
  })
  const payload = await response.json()
  const elapsedMs = performance.now() - started
  if (!response.ok || payload?.results?.length !== size) throw new Error(payload?.error || `Incomplete result for batch ${size}`)
  results.push({ size, elapsedMs: Number(elapsedMs.toFixed(1)), answersPerSecond: Number((size / (elapsedMs / 1000)).toFixed(1)) })
}

const leakResponse = await fetch(`${baseUrl}/v3/recognize`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ items: [{ id: 'leak-test', questionNum: 1, answerKey: '7', continuousImageDataUrl: await imageDataUrl(entries[0]) }] }),
})
const output = {
  generatedAt: new Date().toISOString(), baseUrl, manifestPath, results,
  answerKeyLeakRejected: leakResponse.status === 400,
}
console.log(JSON.stringify(output, null, 2))
