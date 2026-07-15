#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'
import { analyzeCropContainment, answerContextRect, answerZoneRect } from '../src/v3/answer-zones.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT = path.join(ROOT, 'private-evidence/reports/v3-context-crop-containment-20260714.json')
const IMAGE_OUT = path.join(ROOT, 'private-evidence/reports/v3-context-crop-containment-20260714-images')
const COMPACT_URL = process.env.SG_COMPACT_URL || 'http://127.0.0.1:8769/v3/recognize'
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null

const truthDoc = read('private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json')
const correctionsDoc = read('private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/visual-audit-corrections-20260713.json')
const currentDoc = read('private-evidence/reports/v3-local-first-historical-single-frame-20260714.json')
const corrections = new Map((correctionsDoc.corrections || []).map((row) => [`${row.captureId}|${Number(row.questionNum)}`, digits(row.to)]))
const current = new Map(currentDoc.rows.map((row) => [`${row.captureId}|${Number(row.questionNum)}`, row]))
const packetManifest = read('public/worksheets/grade1-last-week-test-20260617/manifest.json')
const svgByLayout = new Map((packetManifest.templates || []).map((row) => [row.layout_id, path.join(ROOT, 'public/worksheets/grade1-last-week-test-20260617', row.filename)]))

function cropCanvas(image, rect) {
  const canvas = createCanvas(rect.w, rect.h)
  const context = canvas.getContext('2d')
  context.fillStyle = '#fff'
  context.fillRect(0, 0, rect.w, rect.h)
  context.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
  return canvas
}

function grayscale(canvas) {
  const rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  const gray = new Uint8Array(canvas.width * canvas.height)
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4
    gray[index] = Math.round(.299 * rgba[offset] + .587 * rgba[offset + 1] + .114 * rgba[offset + 2])
  }
  return gray
}

function suppressPrintedTemplate(captured, template, radius = 7) {
  const width = captured.width, height = captured.height
  const gray = grayscale(captured)
  const templateGray = grayscale(template)
  const printed = new Uint8Array(width * height)
  for (let index = 0; index < printed.length; index += 1) printed[index] = Number(templateGray[index] < 155)
  const horizontal = new Uint8Array(printed.length)
  for (let y = 0; y < height; y += 1) {
    let count = 0
    for (let x = 0; x < width; x += 1) {
      count += printed[y * width + x]
      if (x > radius * 2) count -= printed[y * width + x - radius * 2 - 1]
      horizontal[y * width + x] = Number(count > 0)
    }
  }
  const dilated = new Uint8Array(printed.length)
  for (let x = 0; x < width; x += 1) {
    let count = 0
    for (let y = 0; y < height; y += 1) {
      count += horizontal[y * width + x]
      if (y > radius * 2) count -= horizontal[(y - radius * 2 - 1) * width + x]
      dilated[y * width + x] = Number(count > 0)
    }
  }
  for (let index = 0; index < gray.length; index += 1) if (dilated[index]) gray[index] = 255
  return gray
}

async function compact(items) {
  const output = []
  for (let offset = 0; offset < items.length; offset += 48) {
    const batch = items.slice(offset, offset + 48)
    const response = await fetch(COMPACT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: batch.map((item) => ({
        id: item.id,
        questionNum: item.questionNum,
        continuousImageDataUrl: item.dataUrl,
      })) }),
    })
    const body = await response.json()
    if (!response.ok) throw new Error(`${COMPACT_URL} returned ${response.status}: ${JSON.stringify(body)}`)
    output.push(...(body.results || []))
    console.log(`${Math.min(offset + batch.length, items.length)}/${items.length}`)
  }
  return new Map(output.map((row) => [String(row.id), row]))
}

function summarize(rows) {
  const scorable = rows.filter((row) => row.truth != null)
  const automatic = scorable.filter((row) => row.currentAutomatic)
  const flagged = scorable.filter((row) => row.templateSuppressedContainment?.suspicious)
  const flaggedAutomatic = flagged.filter((row) => row.currentAutomatic)
  return {
    answers: scorable.length,
    suspicious: flagged.length,
    suspiciousPct: pct(flagged.length, scorable.length),
    suspiciousAutomatic: flaggedAutomatic.length,
    suspiciousAutomaticCorrect: flaggedAutomatic.filter((row) => row.currentCorrect).length,
    suspiciousAutomaticWrong: flaggedAutomatic.filter((row) => !row.currentCorrect).length,
    primaryCompactCorrect: scorable.filter((row) => row.primaryCompactRead === row.truth).length,
    contextCompactCorrect: scorable.filter((row) => row.contextCompactRead === row.truth).length,
    primaryTop3ContainsTruth: scorable.filter((row) => row.primaryCompactChoices.includes(row.truth)).length,
    contextTop3ContainsTruth: scorable.filter((row) => row.contextCompactChoices.includes(row.truth)).length,
    unionTop3ContainsTruth: scorable.filter((row) => [...new Set([...row.primaryCompactChoices, ...row.contextCompactChoices])].includes(row.truth)).length,
    contextCorrectGains: scorable.filter((row) => row.primaryCompactRead !== row.truth && row.contextCompactRead === row.truth).length,
    contextCorrectLosses: scorable.filter((row) => row.primaryCompactRead === row.truth && row.contextCompactRead !== row.truth).length,
  }
}

fs.mkdirSync(IMAGE_OUT, { recursive: true })
const layoutCache = new Map()
const pageCache = new Map()
const templateCache = new Map()
const rows = []
const inferenceItems = []
for (const entry of truthDoc.entries || []) {
  const key = `${entry.captureId}|${Number(entry.questionNum)}`
  const currentRow = current.get(key)
  if (!currentRow) continue
  const layout = layoutCache.get(entry.layoutId) || read(`layouts/${entry.layoutId}.json`)
  layoutCache.set(entry.layoutId, layout)
  const group = (layout.question_groups || []).find((row) => Number(row.question_num) === Number(entry.questionNum))
  if (!group) throw new Error(`missing group ${key}`)
  const debugPath = path.resolve(ROOT, entry.debugPath)
  const warpedPath = path.join(path.dirname(debugPath), 'warped.png')
  let image = pageCache.get(warpedPath)
  if (!image) {
    image = await loadImage(warpedPath)
    pageCache.set(warpedPath, image)
  }
  const options = { width: image.width, height: image.height, geometrySource: 'layout' }
  const primaryRect = answerZoneRect(group, layout, options)
  const contextRect = answerContextRect(group, layout, options)
  if (!primaryRect || !contextRect) throw new Error(`missing crop geometry ${key}`)
  const primaryCanvas = cropCanvas(image, primaryRect)
  const contextCanvas = cropCanvas(image, contextRect)
  let template = templateCache.get(entry.layoutId)
  if (!template) {
    const svgPath = svgByLayout.get(entry.layoutId)
    if (!svgPath) throw new Error(`missing blank template ${entry.layoutId}`)
    const svg = await loadImage(svgPath)
    const canvas = createCanvas(image.width, image.height)
    const templateContext = canvas.getContext('2d')
    templateContext.fillStyle = '#fff'
    templateContext.fillRect(0, 0, canvas.width, canvas.height)
    templateContext.drawImage(svg, 0, 0, canvas.width, canvas.height)
    template = canvas
    templateCache.set(entry.layoutId, template)
  }
  const templateContextCanvas = createCanvas(contextRect.w, contextRect.h)
  templateContextCanvas.getContext('2d').drawImage(template, contextRect.x, contextRect.y, contextRect.w, contextRect.h, 0, 0, contextRect.w, contextRect.h)
  const primaryWithinContext = {
    x: primaryRect.x - contextRect.x,
    y: primaryRect.y - contextRect.y,
    w: primaryRect.w,
    h: primaryRect.h,
  }
  const containment = analyzeCropContainment(grayscale(contextCanvas), contextCanvas.width, contextCanvas.height, primaryWithinContext)
  const templateSuppressedContainment = analyzeCropContainment(
    suppressPrintedTemplate(contextCanvas, templateContextCanvas),
    contextCanvas.width,
    contextCanvas.height,
    primaryWithinContext,
  )
  const truth = entry.truthStatus === 'blank' ? null : (corrections.get(key) || digits(entry.truth))
  const short = entry.captureId.split('-').at(-1)
  const stem = `${short}-q${String(entry.questionNum).padStart(2, '0')}`
  const primaryId = `${key}|primary`
  const contextId = `${key}|context`
  inferenceItems.push({ id: primaryId, questionNum: entry.questionNum, dataUrl: primaryCanvas.toDataURL('image/png') })
  inferenceItems.push({ id: contextId, questionNum: entry.questionNum, dataUrl: contextCanvas.toDataURL('image/png') })
  if (templateSuppressedContainment?.suspicious || ['e91e0b5a', 'ef396737', 'db0080f8', '82a1269a'].includes(short)) {
    fs.writeFileSync(path.join(IMAGE_OUT, `${stem}-primary.png`), primaryCanvas.toBuffer('image/png'))
    fs.writeFileSync(path.join(IMAGE_OUT, `${stem}-context.png`), contextCanvas.toBuffer('image/png'))
  }
  rows.push({
    key, captureId: entry.captureId, split: currentRow.split, layoutId: entry.layoutId,
    family: currentRow.family, questionNum: Number(entry.questionNum), truthStatus: entry.truthStatus, truth,
    currentRead: currentRow.v2Read, currentAutomatic: currentRow.v2Automatic, currentCorrect: currentRow.v2Correct,
    primaryRect, contextRect, containment, templateSuppressedContainment, primaryId, contextId,
  })
}

const inference = await compact(inferenceItems)
for (const row of rows) {
  const primary = inference.get(row.primaryId)
  const context = inference.get(row.contextId)
  if (!primary || !context) throw new Error(`missing compact output ${row.key}`)
  row.primaryCompactRead = digits(primary.read)
  row.contextCompactRead = digits(context.read)
  row.primaryCompactConfidence = Number(primary.minComponentProbability || 0)
  row.contextCompactConfidence = Number(context.minComponentProbability || 0)
  row.primaryCompactChoices = (primary.topCandidates || []).slice(0, 3).map((item) => digits(item.read)).filter(Boolean)
  row.contextCompactChoices = (context.topCandidates || []).slice(0, 3).map((item) => digits(item.read)).filter(Boolean)
  delete row.primaryId
  delete row.contextId
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  purpose: 'Key-blind historical stress test of a retained expanded context crop and crop-containment diagnostic.',
  answerKeyProvidedToRecognizer: false,
  limitations: [
    'Historical pages influenced development and are not a prospective final holdout.',
    'The compact model is the only reader rerun here; the larger TrOCR runtime was unavailable in the current local Python environment.',
    'Printed-template subtraction is not yet applied, so containment flags are diagnostic until visually audited.',
  ],
  overall: summarize(rows),
  nonDevelopment: summarize(rows.filter((row) => row.split !== 'development')),
  byFamilyNonDevelopment: Object.fromEntries(['row', 'non-row'].map((family) => [family, summarize(rows.filter((row) => row.split !== 'development' && row.family === family))])),
  byLayout: Object.fromEntries([...new Set(rows.map((row) => row.layoutId))].map((layoutId) => [layoutId, summarize(rows.filter((row) => row.layoutId === layoutId))])),
  knownCases: rows.filter((row) => ['e91e0b5a', 'ef396737', 'db0080f8', '82a1269a'].includes(row.captureId.split('-').at(-1))),
  rows,
}
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), overall: report.overall, nonDevelopment: report.nonDevelopment, byFamilyNonDevelopment: report.byFamilyNonDevelopment, knownCases: report.knownCases.map((row) => ({ key: row.key, truth: row.truth, currentRead: row.currentRead, rawSuspicious: row.containment?.suspicious, templateSuppressedSuspicious: row.templateSuppressedContainment?.suspicious, primaryCompactRead: row.primaryCompactRead, contextCompactRead: row.contextCompactRead })) }, null, 2))
