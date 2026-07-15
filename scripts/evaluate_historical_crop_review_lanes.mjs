#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const RUNS = {
  control: 'private-evidence/reports/v3-crop-historical-matched-control-20260714',
  candidate: 'private-evidence/reports/v3-crop-historical-matched-candidate-20260714',
}
const OUT = path.join(ROOT, 'private-evidence/reports/v3-crop-historical-review-lanes-20260714.json')
const TRUTH_FILE = path.join(ROOT, 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json')
const CORRECTIONS_FILE = path.join(ROOT, 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/visual-audit-corrections-20260713.json')
const LARGE_URL = 'http://127.0.0.1:8768/recognize'
const COMPACT_URL = 'http://127.0.0.1:8769/v3/recognize'

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null
const dataUrl = (file) => `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`

const corrections = new Map((readJson(CORRECTIONS_FILE).corrections || []).map((row) => [`${row.captureId}|${Number(row.questionNum)}`, digits(row.to)]))
const truth = new Map()
for (const row of readJson(TRUTH_FILE).entries || []) {
  const key = `${row.captureId}|${Number(row.questionNum)}`
  truth.set(key, {
    text: row.truthStatus === 'blank' ? 'blank' : (corrections.get(key) || digits(row.truth)),
    status: row.truthStatus,
  })
}

function cropItems(root) {
  const directory = path.join(ROOT, root)
  const items = []
  for (const name of fs.readdirSync(directory).filter((item) => /-v3-q\d+\.png$/.test(item)).sort()) {
    const match = name.match(/^(.*)-v3-q(\d+)\.png$/)
    const captureId = match[1]
    const questionNum = Number(match[2])
    const key = `${captureId}|${questionNum}`
    const label = truth.get(key)
    if (!label?.text) throw new Error(`missing truth ${key}`)
    items.push({ key, captureId, questionNum, truthText: label.text, truthStatus: label.status, file: path.join(directory, name) })
  }
  if (items.length !== 264) throw new Error(`${root} expected 264 crops, found ${items.length}`)
  return items
}

async function post(url, payload) {
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const body = await response.json()
  if (!response.ok) throw new Error(`${url} returned ${response.status}: ${JSON.stringify(body)}`)
  return body
}

async function evaluate(items) {
  const rows = []
  for (let offset = 0; offset < items.length; offset += 24) {
    const batch = items.slice(offset, offset + 24)
    const large = await post(LARGE_URL, { items: batch.map((item) => ({ id: item.key, questionNum: item.questionNum, imageDataUrl: dataUrl(item.file) })) })
    const compact = await post(COMPACT_URL, { items: batch.map((item) => ({ id: item.key, questionNum: item.questionNum, continuousImageDataUrl: dataUrl(item.file) })) })
    const largeById = new Map((large.results || []).map((item) => [item.id, item]))
    const compactById = new Map((compact.results || []).map((item) => [item.id, item]))
    for (const item of batch) {
      const largeResult = largeById.get(item.key)
      const compactResult = compactById.get(item.key)
      if (!largeResult || !compactResult) throw new Error(`incomplete model response for ${item.key}`)
      const largeRead = digits(largeResult.read)
      const compactRead = digits(compactResult.read)
      rows.push({
        key: item.key, captureId: item.captureId, questionNum: item.questionNum,
        truthText: item.truthText, truthStatus: item.truthStatus,
        largeRead, largeCorrect: largeRead === item.truthText,
        largeMinConfidence: Number(largeResult.minTokenProbability) || 0,
        compactRead, compactCorrect: compactRead === item.truthText,
        compactMinConfidence: Number(compactResult.minComponentProbability) || 0,
        readersAgree: largeRead != null && largeRead === compactRead,
        agreementCorrect: largeRead != null && largeRead === compactRead && largeRead === item.truthText,
      })
    }
    console.log(`${Math.min(offset + batch.length, items.length)}/${items.length}`)
  }
  return rows
}

function summarize(rows) {
  const agreements = rows.filter((row) => row.readersAgree)
  return {
    answers: rows.length,
    largeCorrect: rows.filter((row) => row.largeCorrect).length,
    largeAccuracyPct: pct(rows.filter((row) => row.largeCorrect).length, rows.length),
    compactCorrect: rows.filter((row) => row.compactCorrect).length,
    compactAccuracyPct: pct(rows.filter((row) => row.compactCorrect).length, rows.length),
    readerAgreements: agreements.length,
    agreementCorrect: agreements.filter((row) => row.agreementCorrect).length,
    agreementWrong: agreements.filter((row) => !row.agreementCorrect).length,
  }
}

const controlRows = await evaluate(cropItems(RUNS.control))
const candidateRows = await evaluate(cropItems(RUNS.candidate))
const candidateByKey = new Map(candidateRows.map((row) => [row.key, row]))
const pairs = controlRows.map((control) => ({ control, candidate: candidateByKey.get(control.key) }))
const manual = (rows) => rows.filter((row) => row.truthStatus === 'manual')
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  answerKeyProvidedToModels: false,
  historicalDevelopmentWarning: 'This historical corpus influenced model and crop development; results are stress-test evidence, not a new holdout.',
  allTruth: { control: summarize(controlRows), candidate: summarize(candidateRows) },
  manualTruthOnly: { control: summarize(manual(controlRows)), candidate: summarize(manual(candidateRows)) },
  pairedChanges: {
    largeReadsChanged: pairs.filter((row) => row.control.largeRead !== row.candidate.largeRead).length,
    compactReadsChanged: pairs.filter((row) => row.control.compactRead !== row.candidate.compactRead).length,
    largeCorrectGained: pairs.filter((row) => !row.control.largeCorrect && row.candidate.largeCorrect).length,
    largeCorrectLost: pairs.filter((row) => row.control.largeCorrect && !row.candidate.largeCorrect).length,
    compactCorrectGained: pairs.filter((row) => !row.control.compactCorrect && row.candidate.compactCorrect).length,
    compactCorrectLost: pairs.filter((row) => row.control.compactCorrect && !row.candidate.compactCorrect).length,
  },
  changedPairs: pairs.filter((row) => row.control.largeRead !== row.candidate.largeRead || row.control.compactRead !== row.candidate.compactRead),
}
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), allTruth: result.allTruth, manualTruthOnly: result.manualTruthOnly, pairedChanges: result.pairedChanges }, null, 2))
