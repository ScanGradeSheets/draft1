#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const scorePath = path.resolve(ROOT, process.argv[2] || 'private-evidence/reports/evidence-pipeline-final-score-20260714.json')
const outPath = path.resolve(ROOT, process.argv[3] || 'private-evidence/reports/nonrow-slot-strong-evidence-20260715.json')
const baseUrl = String(process.env.SG_REVIEW_URL || 'https://hobbes-mac-mini.tail9a3379.ts.net/review-model').replace(/\/$/, '')
const requestOrigin = String(process.env.SG_REVIEW_ORIGIN || new URL(baseUrl).origin)
const score = JSON.parse(fs.readFileSync(scorePath, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '')
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null

const sourceRows = score.rows.filter((row) => row.scorable && row.layoutFamily === 'non-row')
const items = []
const sources = new Map()

for (const row of sourceRows) {
  const debug = JSON.parse(fs.readFileSync(path.join(ROOT, row.debugFile), 'utf8'))
  const group = (debug.answerGroups || []).find((item) => Number(item.questionNum) === Number(row.questionNum))
  if (!group) throw new Error(`missing answer group ${row.packetId}|${row.layoutId}|${row.questionNum}`)
  const ids = (group.digitBoxIds || []).map(Number)
  for (let slotIndex = 0; slotIndex < ids.length; slotIndex += 1) {
    const boxId = ids[slotIndex]
    const imageDataUrl = debug.rawCropDataUrls?.[boxId]
    if (!imageDataUrl) throw new Error(`missing raw crop ${row.packetId}|${row.layoutId}|${row.questionNum}|${boxId}`)
    const id = `${row.packetId}|${row.layoutId}|${row.questionNum}|slot-${slotIndex}`
    items.push({ id, questionNum: Number(row.questionNum), frameIndex: 0, imageDataUrl })
    sources.set(id, { ...row, slotIndex, boxId })
  }
}

const results = []
for (let offset = 0; offset < items.length; offset += 24) {
  const batch = items.slice(offset, offset + 24)
  const response = await fetch(`${baseUrl}/recognize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: requestOrigin },
    body: JSON.stringify({ items: batch }),
  })
  if (!response.ok) throw new Error(`strong service returned ${response.status}`)
  const payload = await response.json()
  if (payload.answerKeyUsed !== false || !Array.isArray(payload.results) || payload.results.length !== batch.length) {
    throw new Error('strong service failed key-blind/completeness contract')
  }
  results.push(...payload.results)
}

const byQuestion = new Map()
for (const result of results) {
  const source = sources.get(String(result.id))
  if (!source) throw new Error(`unjoined result ${result.id}`)
  const key = `${source.packetId}|${source.layoutId}|${source.questionNum}`
  if (!byQuestion.has(key)) byQuestion.set(key, { source, slots: [] })
  byQuestion.get(key).slots.push({
    slotIndex: source.slotIndex,
    boxId: source.boxId,
    read: digits(result.read),
    minTokenProbability: Number(result.minTokenProbability || 0),
    meanTokenProbability: Number(result.meanTokenProbability || 0),
  })
}

const rows = [...byQuestion.values()].map(({ source, slots }) => {
  slots.sort((a, b) => a.slotIndex - b.slotIndex)
  const slotStrongRead = slots.map((slot) => slot.read).join('')
  return {
    packetId: source.packetId,
    layoutId: source.layoutId,
    questionNum: source.questionNum,
    truthText: source.truthText,
    currentRead: source.readText,
    currentAutomatic: source.automatic,
    currentCorrect: source.correct,
    slotStrongRead,
    slotStrongCorrect: slotStrongRead === source.truthText,
    slots,
    debugFile: source.debugFile,
  }
})

const yellow = rows.filter((row) => !row.currentAutomatic)
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  purpose: 'Key-blind diagnostic: run the existing strong whole-answer reader independently on each retained browser raw slot crop for every scorable non-row answer.',
  answerKeyProvidedToModel: false,
  truthUsedOnlyAfterInference: true,
  sourceScore: path.relative(ROOT, scorePath),
  service: baseUrl,
  overall: {
    answers: rows.length,
    slotItems: items.length,
    correct: rows.filter((row) => row.slotStrongCorrect).length,
    accuracyPct: pct(rows.filter((row) => row.slotStrongCorrect).length, rows.length),
  },
  currentYellow: {
    answers: yellow.length,
    correct: yellow.filter((row) => row.slotStrongCorrect).length,
    accuracyPct: pct(yellow.filter((row) => row.slotStrongCorrect).length, yellow.length),
  },
  byLayout: Object.fromEntries([...new Set(rows.map((row) => row.layoutId))].sort().map((layoutId) => {
    const group = rows.filter((row) => row.layoutId === layoutId)
    const groupYellow = group.filter((row) => !row.currentAutomatic)
    return [layoutId, {
      answers: group.length,
      correct: group.filter((row) => row.slotStrongCorrect).length,
      accuracyPct: pct(group.filter((row) => row.slotStrongCorrect).length, group.length),
      yellowAnswers: groupYellow.length,
      yellowCorrect: groupYellow.filter((row) => row.slotStrongCorrect).length,
    }]
  })),
  rows,
}

fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: path.relative(ROOT, outPath), overall: report.overall, currentYellow: report.currentYellow, byLayout: report.byLayout }, null, 2))
