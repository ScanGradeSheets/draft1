#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { webkit } from 'playwright'

const root = process.cwd()
const score = JSON.parse(fs.readFileSync(path.join(
  root,
  'private-evidence/reports/v3-historical-fresh-replay-20260713-score-visual-audited.json',
), 'utf8'))
const captures = JSON.parse(fs.readFileSync(path.join(
  root,
  'private-evidence/reports/v3-historical-fresh-replay-20260713/historical-inputs.json',
), 'utf8')).captures
const captureById = new Map(captures.map((capture) => [capture.captureId, capture]))
const modelBase = process.env.SG_MODEL_BASE || 'https://127.0.0.1:8792'
const appUrl = process.env.SG_APP_URL || 'https://127.0.0.1:5174'
const outputPath = path.resolve(process.env.SG_OUT || path.join(
  root,
  'private-evidence/reports/historical-row-yellow-stitched-webkit-20260815.json',
))
const debugCache = new Map()

function readDebug(captureId) {
  if (debugCache.has(captureId)) return debugCache.get(captureId)
  const capture = captureById.get(captureId)
  if (!capture) return null
  const debugPath = path.join(root, path.dirname(capture.file), 'debug.json')
  if (!fs.existsSync(debugPath)) return null
  const raw = JSON.parse(fs.readFileSync(debugPath, 'utf8'))
  const debug = raw?.debug && typeof raw.debug === 'object' ? raw.debug : raw
  debugCache.set(captureId, debug)
  return debug
}

const missing = []
const sourceRows = score.rows.filter((row) => row.family === 'row' && !row.v2Automatic)
const items = sourceRows.map((row) => {
  const debug = readDebug(row.captureId)
  const group = (debug?.answerGroups || []).find((candidate) =>
    Number(candidate.questionNum) === Number(row.questionNum))
  const ids = Array.isArray(group?.digitBoxIds) ? group.digitBoxIds.map(Number) : []
  const slotDataUrls = ids.map((id) => debug?.rawCropDataUrls?.[id]).filter(Boolean)
  if (!ids.length || slotDataUrls.length !== ids.length) {
    missing.push(`${row.captureId}|${row.layoutId}|${row.questionNum}`)
    return null
  }
  return {
    id: `${row.captureId}|${row.layoutId}|${row.questionNum}`,
    captureId: row.captureId,
    layoutId: row.layoutId,
    questionNum: Number(row.questionNum),
    slotDataUrls,
    slotCount: ids.length,
  }
}).filter(Boolean)

const browser = await webkit.launch({ headless: true })
const nonReadRequests = []
let modelResult
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      nonReadRequests.push({ method: request.method(), url: request.url() })
    }
  })
  await page.route('**/*', async (route) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
  modelResult = await page.evaluate(async ({ items, modelBase }) => {
    const loadImage = (src) => new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = src
    })
    const modelItems = []
    for (const item of items) {
      const images = await Promise.all(item.slotDataUrls.map(loadImage))
      const gap = 10
      const pad = 8
      const canvas = document.createElement('canvas')
      canvas.width = images.reduce((sum, image) => sum + image.width, 0) +
        gap * Math.max(0, images.length - 1) + pad * 2
      canvas.height = Math.max(...images.map((image) => image.height)) + pad * 2
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.imageSmoothingEnabled = false
      let x = pad
      for (const image of images) {
        ctx.drawImage(image, x, pad + Math.floor((canvas.height - pad * 2 - image.height) / 2))
        x += image.width + gap
      }
      modelItems.push({
        id: item.id,
        questionNum: item.questionNum,
        imageDataUrl: canvas.toDataURL('image/png'),
        cropVariant: 'historical-saved-raw-stitched',
        contract: {
          layoutFamily: 'row',
          physicalSlotCount: item.slotCount,
          maxHandwrittenDigits: Math.max(1, item.slotCount),
          optionalSlotIndices: [],
        },
      })
    }
    const module = await import('/src/v3/trocr-small-shadow-client.js')
    return module.requestBrowserLocalStrongPersistentShadow(modelItems, {
      enabled: true,
      encoderUrl: `${modelBase}/models/encoder-fp32.onnx`,
      decoderUrl: `${modelBase}/models/decoder-int8.onnx`,
      limit: modelItems.length,
      timeoutMs: 180000,
    })
  }, { items, modelBase })
} finally {
  await browser.close()
}

const truthById = new Map(sourceRows.map((row) => [
  `${row.captureId}|${row.layoutId}|${row.questionNum}`,
  row,
]))
const rows = (modelResult?.results || []).map((result) => {
  const truth = truthById.get(result.id)
  return {
    id: result.id,
    captureId: truth?.captureId,
    layoutId: truth?.layoutId,
    questionNum: truth?.questionNum,
    truthStatus: truth?.truthStatus,
    truth: truth?.truth,
    read: result.text,
    minTokenProbability: result.minTokenProbability,
    correct: String(result.text) === String(truth?.truth),
  }
})
const thresholds = Object.fromEntries([0.98, 0.99, 0.995, 0.999].map((threshold) => {
  const selected = rows.filter((row) => row.minTokenProbability >= threshold)
  const manual = selected.filter((row) => row.truthStatus === 'manual')
  const summarize = (subset) => ({
    selected: subset.length,
    correct: subset.filter((row) => row.correct).length,
    errors: subset.filter((row) => !row.correct).map((row) => row.id),
  })
  return [String(threshold), { allTruth: summarize(selected), manualTruth: summarize(manual) }]
}))
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policyStatus: 'retrospective-falsification-only-not-deployable',
  purpose:
    'Falsify a row-only, original-yellow, high-confidence stitched-reader rescue against all available historical row reviews.',
  integrity: {
    answerKeyProvidedToRecognizer: false,
    truthProvidedToRecognizer: false,
    truthJoinedOnlyAfterPredictions: true,
    sealedPacketsUsed: false,
  },
  sourceRowCount: sourceRows.length,
  attempted: items.length,
  missing,
  modelStatus: modelResult?.status,
  elapsedMs: modelResult?.elapsedMs,
  nonReadRequests,
  thresholds,
  rows,
}
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  outputPath: path.relative(root, outputPath),
  sourceRowCount: sourceRows.length,
  attempted: items.length,
  completed: rows.length,
  missing,
  modelStatus: modelResult?.status,
  elapsedMs: modelResult?.elapsedMs,
  thresholds,
  nonReadRequests,
}, null, 2))
