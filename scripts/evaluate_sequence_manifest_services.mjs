#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const manifestPath = path.resolve(ROOT, process.argv[2] || 'private-evidence/v3/four-packet-sequence-20260714/manifest.json')
const outputPath = path.resolve(ROOT, process.argv[3] || 'private-evidence/reports/v3-four-packet-service-baseline-20260714.json')
const largeUrl = process.env.SG_LARGE_URL || 'http://127.0.0.1:8768/recognize'
const compactUrl = process.env.SG_COMPACT_URL || 'http://127.0.0.1:8769/v3/recognize'

function dataUrl(relative) {
  return `data:image/png;base64,${fs.readFileSync(path.resolve(ROOT, relative)).toString('base64')}`
}

async function post(url, payload) {
  const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} ${await response.text()}`)
  return response.json()
}

function summarize(rows, field) {
  const total = rows.length
  const correct = rows.filter((row) => row[field] === row.truth).length
  return { total, correct, exactAccuracyPct: total ? Number((100 * correct / total).toFixed(1)) : 0 }
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const rows = []
  for (let index = 0; index < manifest.entries.length; index += 24) {
    const batch = manifest.entries.slice(index, index + 24)
    const largePayload = { items: batch.map((row) => ({ id: row.uid, questionNum: row.questionNum, imageDataUrl: dataUrl(row.recognitionPath) })) }
    const compactPayload = { items: batch.map((row) => ({ id: row.uid, questionNum: row.questionNum, continuousImageDataUrl: dataUrl(row.recognitionPath) })) }
    const [large, compact] = await Promise.all([post(largeUrl, largePayload), post(compactUrl, compactPayload)])
    const largeById = new Map(large.results.map((row) => [row.id, row]))
    const compactById = new Map(compact.results.map((row) => [row.id, row]))
    for (const row of batch) {
      const l = largeById.get(row.uid)
      const c = compactById.get(row.uid)
      rows.push({ ...row, largeRead: l?.read || '', largeMinTokenProbability: l?.minTokenProbability, compactRead: c?.read || '', compactMinComponentProbability: c?.minComponentProbability })
    }
  }
  const splits = Object.fromEntries(['development', 'validation', 'holdout'].map((split) => {
    const selected = rows.filter((row) => row.split === split)
    return [split, { large: summarize(selected, 'largeRead'), compact: summarize(selected, 'compactRead') }]
  }))
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    answerKeyProvidedToModels: false,
    manifest: path.relative(ROOT, manifestPath),
    services: { largeUrl, compactUrl },
    splits,
    rows,
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ output: path.relative(ROOT, outputPath), splits }, null, 2))
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
