#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(await fs.readFile(path.join(root, 'private-evidence/v3/live-continuous-answer-zones-manifest.json'), 'utf8'))
const trainingReport = JSON.parse(await fs.readFile(path.join(root, 'private-evidence/reports/v3-sequence-live.json'), 'utf8'))
const leftUrl = String(process.env.SG_V3_LEFT_URL || 'http://127.0.0.1:8767').replace(/\/$/, '')
const rightUrl = String(process.env.SG_V3_RIGHT_URL || 'http://127.0.0.1:8771').replace(/\/$/, '')
const entries = manifest.entries.filter((entry) => entry.split === (process.env.SG_V3_SPLIT || 'holdout'))

async function itemsFor(batch) {
  return Promise.all(batch.map(async (entry) => ({
    id: entry.uid,
    questionNum: entry.questionNum,
    continuousImageDataUrl: `data:image/png;base64,${(await fs.readFile(path.resolve(root, entry.imagePath))).toString('base64')}`,
  })))
}

async function recognize(baseUrl) {
  const all = []
  let elapsedMs = 0
  for (let offset = 0; offset < entries.length; offset += 64) {
    const items = await itemsFor(entries.slice(offset, offset + 64))
    const started = performance.now()
    const response = await fetch(`${baseUrl}/v3/recognize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
    })
    const payload = await response.json()
    elapsedMs += performance.now() - started
    if (!response.ok || payload?.results?.length !== items.length) throw new Error(`${baseUrl}: ${payload?.error || 'incomplete response'}`)
    all.push(...payload.results)
  }
  return { rows: new Map(all.map((item) => [String(item.id), item])), elapsedMs }
}

const [left, right] = await Promise.all([recognize(leftUrl), recognize(rightUrl)])
const comparisons = entries.map((entry) => {
  const a = left.rows.get(String(entry.uid))
  const b = right.rows.get(String(entry.uid))
  const referenceRows = [...(trainingReport.validationRows || []), ...(trainingReport.holdoutRows || [])]
  const reference = referenceRows.find((row) => row.captureId === entry.captureId && Number(row.questionNum) === Number(entry.questionNum))
  return {
    uid: entry.uid, truth: String(entry.truth), reference: String(reference?.modelRead ?? ''),
    left: a?.read, right: b?.read, same: a?.read === b?.read,
  }
})
const output = {
  split: process.env.SG_V3_SPLIT || 'holdout', total: comparisons.length,
  exactReadMatches: comparisons.filter((row) => row.same).length,
  mismatches: comparisons.filter((row) => !row.same),
  leftCorrect: comparisons.filter((row) => row.left === row.truth).length,
  rightCorrect: comparisons.filter((row) => row.right === row.truth).length,
  leftReferenceMatches: comparisons.filter((row) => row.left === row.reference).length,
  rightReferenceMatches: comparisons.filter((row) => row.right === row.reference).length,
  leftElapsedMs: Number(left.elapsedMs.toFixed(1)), rightElapsedMs: Number(right.elapsedMs.toFixed(1)),
}
console.log(JSON.stringify(output, null, 2))
if (output.mismatches.length) process.exitCode = 2
