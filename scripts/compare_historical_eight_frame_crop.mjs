#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const CONTROL = path.join(ROOT, 'private-evidence/reports/v3-crop-historical-matched-control-20260714')
const CANDIDATE = path.join(ROOT, 'private-evidence/reports/v3-crop-historical-matched-candidate-20260714')
const OUT = path.join(ROOT, 'private-evidence/reports/v3-crop-historical-matched-comparison-20260714.json')
const TRUTH_FILE = path.join(ROOT, 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json')
const CORRECTIONS_FILE = path.join(ROOT, 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/visual-audit-corrections-20260713.json')

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null

const corrections = new Map((readJson(CORRECTIONS_FILE).corrections || []).map((row) => [`${row.captureId}|${Number(row.questionNum)}`, digits(row.to)]))
const truth = new Map()
for (const row of readJson(TRUTH_FILE).entries || []) {
  const key = `${row.captureId}|${Number(row.questionNum)}`
  truth.set(key, {
    text: row.truthStatus === 'blank' ? 'blank' : (corrections.get(key) || digits(row.truth)),
    status: row.truthStatus,
  })
}

function replayFiles(root) {
  return fs.readdirSync(root).filter((name) => name.endsWith('-replay-result.json')).sort()
}

function load(root) {
  const files = replayFiles(root)
  if (files.length !== 33) throw new Error(`${root} expected 33 replay files, found ${files.length}`)
  const rows = new Map()
  for (const name of files) {
    const replay = readJson(path.join(root, name))
    const captureId = replay.file
    for (const group of replay.groups || []) {
      const questionNum = Number(group.label)
      const key = `${captureId}|${questionNum}`
      const label = truth.get(key)
      if (!label?.text) throw new Error(`missing handwritten truth ${key}`)
      const read = digits(group.predicted)
      const automatic = group.review !== true
      rows.set(key, {
        captureId, questionNum, truthText: label.text, truthStatus: label.status,
        read, automatic, correct: automatic ? read === label.text : null,
      })
    }
  }
  if (rows.size !== 264) throw new Error(`${root} expected 264 answers, found ${rows.size}`)
  return rows
}

function summarize(rows) {
  const automatic = rows.filter((row) => row.automatic)
  return {
    answers: rows.length,
    automatic: automatic.length,
    coveragePct: pct(automatic.length, rows.length),
    automaticCorrect: automatic.filter((row) => row.correct).length,
    automaticWrong: automatic.filter((row) => !row.correct).length,
    manualReview: rows.length - automatic.length,
  }
}

const control = load(CONTROL)
const candidate = load(CANDIDATE)
const pairs = [...control.entries()].map(([key, before]) => {
  const after = candidate.get(key)
  if (!after) throw new Error(`candidate missing ${key}`)
  return { key, truthText: before.truthText, truthStatus: before.truthStatus, control: before, candidate: after,
    decisionChanged: before.read !== after.read || before.automatic !== after.automatic }
})
const controlRows = pairs.map((row) => row.control)
const candidateRows = pairs.map((row) => row.candidate)
const manualStatuses = new Set(['manual', 'primary-labelled', 'verified'])
const manualPairs = pairs.filter((row) => manualStatuses.has(row.truthStatus))
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  answerKeyUsedAsTruth: false,
  note: 'Historical corpus influenced development. Seeded-auto-correct labels are reported separately from manual labels.',
  allTruth: { control: summarize(controlRows), candidate: summarize(candidateRows) },
  manualTruthOnly: {
    answers: manualPairs.length,
    control: summarize(manualPairs.map((row) => row.control)),
    candidate: summarize(manualPairs.map((row) => row.candidate)),
  },
  pairedChanges: {
    decisionsChanged: pairs.filter((row) => row.decisionChanged).length,
    newAutomatic: pairs.filter((row) => !row.control.automatic && row.candidate.automatic).length,
    removedAutomatic: pairs.filter((row) => row.control.automatic && !row.candidate.automatic).length,
    newCorrectAutomatic: pairs.filter((row) => !row.control.automatic && row.candidate.automatic && row.candidate.correct).length,
    newWrongAutomatic: pairs.filter((row) => !row.control.automatic && row.candidate.automatic && !row.candidate.correct).length,
    removedCorrectAutomatic: pairs.filter((row) => row.control.automatic && row.control.correct && !row.candidate.automatic).length,
    removedWrongAutomatic: pairs.filter((row) => row.control.automatic && !row.control.correct && !row.candidate.automatic).length,
  },
  gate: {
    complete: pairs.length === 264,
    noNewConfidentErrors: pairs.every((row) => !(row.candidate.automatic && !row.candidate.correct && (!row.control.automatic || row.control.correct))),
    noCoverageRegression: summarize(candidateRows).automatic >= summarize(controlRows).automatic,
  },
  changedPairs: pairs.filter((row) => row.decisionChanged),
}
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), allTruth: result.allTruth, manualTruthOnly: result.manualTruthOnly, pairedChanges: result.pairedChanges, gate: result.gate }, null, 2))
