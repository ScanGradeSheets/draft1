#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'
import { answerContextRect, answerZoneRect } from '../src/v3/answer-zones.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SOURCE = path.join(ROOT, 'private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json')
const UI = path.join(ROOT, 'private-evidence/reports/v3-local-first-all-yellows-ui-20260714.json')
const OUT = path.join(ROOT, 'private-evidence/reports/v3-context-crop-recent-packets-20260714.json')
const IMAGE_OUT = path.join(ROOT, 'private-evidence/reports/v3-context-crop-recent-packets-20260714-images')
const COMPACT_URL = process.env.SG_COMPACT_URL || 'http://127.0.0.1:8769/v3/recognize'
const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null

function cropCanvas(image, rect) {
  const canvas = createCanvas(rect.w, rect.h)
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, rect.w, rect.h)
  context.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
  return canvas
}

async function recognize(items) {
  const results = []
  for (let offset = 0; offset < items.length; offset += 48) {
    const batch = items.slice(offset, offset + 48)
    const response = await fetch(COMPACT_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: batch.map((row) => ({ id: row.id, questionNum: row.questionNum, continuousImageDataUrl: row.dataUrl })) }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(`${response.status}: ${JSON.stringify(body)}`)
    results.push(...body.results)
    console.log(`${Math.min(offset + batch.length, items.length)}/${items.length}`)
  }
  return new Map(results.map((row) => [String(row.id), row]))
}

function summarize(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const yellow = scorable.filter((row) => row.isYellow)
  return {
    answers: scorable.length,
    primaryTop1Correct: scorable.filter((row) => row.primaryRead === row.truth).length,
    contextTop1Correct: scorable.filter((row) => row.contextRead === row.truth).length,
    primaryTop3ContainsTruth: scorable.filter((row) => row.primaryChoices.includes(row.truth)).length,
    contextTop3ContainsTruth: scorable.filter((row) => row.contextChoices.includes(row.truth)).length,
    unionTop3ContainsTruth: scorable.filter((row) => [...new Set([...row.primaryChoices, ...row.contextChoices])].includes(row.truth)).length,
    contextTop1Gains: scorable.filter((row) => row.primaryRead !== row.truth && row.contextRead === row.truth).length,
    contextTop1Losses: scorable.filter((row) => row.primaryRead === row.truth && row.contextRead !== row.truth).length,
    yellowAnswers: yellow.length,
    yellowTruthInitiallyAvailable: yellow.filter((row) => row.initialChoices.includes(row.truth)).length,
    yellowTruthAvailableWithContextAtSixChoiceCap: yellow.filter((row) => row.contextReviewChoices.includes(row.truth)).length,
    yellowContextAddsTruth: yellow.filter((row) => !row.initialChoices.includes(row.truth) && row.contextReviewChoices.includes(row.truth)).length,
    yellowContextAddsTruthPctPoints: pct(
      yellow.filter((row) => !row.initialChoices.includes(row.truth) && row.contextReviewChoices.includes(row.truth)).length,
      yellow.length,
    ),
  }
}

const source = read(SOURCE)
const ui = read(UI)
const uiByKey = new Map(ui.rows.map((row) => [`${row.packetId}|${row.layoutId}|${Number(row.questionNum)}`, row]))
const layoutCache = new Map()
const pageCache = new Map()
const items = []
const rows = []
fs.mkdirSync(IMAGE_OUT, { recursive: true })
const uploadedWarpedByShortId = new Map()
const uploadedRoot = path.join(ROOT, 'private-evidence/debug-scans')
for (const dateName of fs.readdirSync(uploadedRoot)) {
  const dateRoot = path.join(uploadedRoot, dateName)
  if (!fs.statSync(dateRoot).isDirectory()) continue
  for (const captureName of fs.readdirSync(dateRoot)) {
    const candidate = path.join(dateRoot, captureName, 'warped.png')
    if (fs.existsSync(candidate)) uploadedWarpedByShortId.set(captureName.split('-').at(-1), candidate)
  }
}

function warpedFor(sourceRow) {
  const evidence = path.resolve(ROOT, sourceRow.evidenceFile)
  const direct = path.join(path.dirname(evidence), 'warped.png')
  if (fs.existsSync(direct)) return direct
  const captureDirectory = path.basename(path.dirname(evidence))
  for (const retainedRoot of ['v3-review-display-row-full-20260714', 'v3-review-display-nonrow-safety-20260714', 'v3-dual-crop-review-p02-20260714']) {
    const retained = path.join(ROOT, 'private-evidence/reports', retainedRoot, sourceRow.packetId, 'debug', captureDirectory, 'warped.png')
    if (fs.existsSync(retained)) return retained
  }
  const uploaded = uploadedWarpedByShortId.get(captureDirectory.replace(/-captured$/, ''))
  if (uploaded) return uploaded
  throw new Error(`missing retained warped page for ${sourceRow.packetId} ${captureDirectory}`)
}

for (const sourceRow of source.rows) {
  const key = `${sourceRow.packetId}|${sourceRow.layoutId}|${Number(sourceRow.questionNum)}`
  const layout = layoutCache.get(sourceRow.layoutId) || read(path.join(ROOT, 'layouts', `${sourceRow.layoutId}.json`))
  layoutCache.set(sourceRow.layoutId, layout)
  const group = (layout.question_groups || []).find((row) => Number(row.question_num) === Number(sourceRow.questionNum))
  const warpedPath = warpedFor(sourceRow)
  let image = pageCache.get(warpedPath)
  if (!image) { image = await loadImage(warpedPath); pageCache.set(warpedPath, image) }
  const options = { width: image.width, height: image.height, geometrySource: 'layout' }
  const primaryRect = answerZoneRect(group, layout, options)
  const contextRect = answerContextRect(group, layout, options)
  const primary = cropCanvas(image, primaryRect)
  const context = cropCanvas(image, contextRect)
  const primaryId = `${key}|primary`, contextId = `${key}|context`
  items.push({ id: primaryId, questionNum: sourceRow.questionNum, dataUrl: primary.toDataURL('image/png') })
  items.push({ id: contextId, questionNum: sourceRow.questionNum, dataUrl: context.toDataURL('image/png') })
  const uiRow = uiByKey.get(key)
  rows.push({
    key, packetId: sourceRow.packetId, layoutId: sourceRow.layoutId, family: sourceRow.layoutFamily,
    questionNum: Number(sourceRow.questionNum), scorable: sourceRow.scorable, truth: sourceRow.truthText,
    isYellow: !!uiRow, initialChoices: uiRow?.initialChoices || [], primaryId, contextId, primaryRect, contextRect,
  })
}

const outputs = await recognize(items)
for (const row of rows) {
  const primary = outputs.get(row.primaryId), context = outputs.get(row.contextId)
  row.primaryRead = digits(primary?.read)
  row.contextRead = digits(context?.read)
  row.primaryChoices = (primary?.topCandidates || []).slice(0, 3).map((item) => digits(item.read)).filter(Boolean)
  row.contextChoices = (context?.topCandidates || []).slice(0, 3).map((item) => digits(item.read)).filter(Boolean)
  row.contextReviewChoices = [...new Set([...row.initialChoices, ...row.contextChoices])].slice(0, 6)
  if (row.isYellow && !row.initialChoices.includes(row.truth) && row.contextReviewChoices.includes(row.truth)) {
    const evidence = source.rows.find((item) => `${item.packetId}|${item.layoutId}|${Number(item.questionNum)}` === row.key)
    const warpedPath = warpedFor(evidence)
    const image = pageCache.get(warpedPath)
    fs.writeFileSync(path.join(IMAGE_OUT, `${row.packetId}-${row.layoutId}-q${String(row.questionNum).padStart(2, '0')}-context.png`), cropCanvas(image, row.contextRect).toBuffer('image/png'))
  }
  delete row.primaryId
  delete row.contextId
}

const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), answerKeyProvidedToRecognizer: false,
  purpose: 'Four-packet matched replay of a retained larger context crop through the compact key-blind reader.',
  overall: summarize(rows),
  byFamily: Object.fromEntries(['row', 'non-row'].map((family) => [family, summarize(rows.filter((row) => row.family === family))])),
  byPacket: Object.fromEntries([...new Set(rows.map((row) => row.packetId))].map((packetId) => [packetId, summarize(rows.filter((row) => row.packetId === packetId))])),
  addedYellowTruthCases: rows.filter((row) => row.isYellow && !row.initialChoices.includes(row.truth) && row.contextReviewChoices.includes(row.truth)),
  rows,
}
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), overall: report.overall, byFamily: report.byFamily, byPacket: report.byPacket, addedYellowTruthCases: report.addedYellowTruthCases }, null, 2))
