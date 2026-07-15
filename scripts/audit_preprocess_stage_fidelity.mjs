#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from 'playwright'

const ROWS_PATH = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const OUT_PATH = 'private-evidence/reports/preprocess-stage-fidelity-20260709.json'
const BASE_URL = process.env.SG_REPLAY_URL || 'https://127.0.0.1:5174'
const BATCH_SIZE = 40

const rows = JSON.parse(await fs.readFile(ROWS_PATH, 'utf8')).filter((row) => row.truthDigit !== null)
const debugCache = new Map()
async function debugFor(file) {
  if (!debugCache.has(file)) {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
    debugCache.set(file, parsed?.debug || parsed)
  }
  return debugCache.get(file)
}

const items = []
for (const row of rows) {
  const debug = await debugFor(row.debugPath)
  const image = debug?.rawCropDataUrls?.[Number(row.detailId)]
  if (!image) continue
  items.push({
    key: `${row.captureId}::${row.detailId}`,
    image,
    isVirtual: row.slotCount > 1,
    currentDigitCorrect: row.currentDigitCorrect,
    truthDigit: row.truthDigit,
    family: row.family,
    slotName: row.slotName,
    layoutId: row.layoutId,
    anyVariantCorrect: row.anyVariantCorrect,
    correctVariantNames: row.correctVariantNames || []
  })
}

const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ ignoreHTTPSErrors: true })
await page.goto(`${BASE_URL}/?liveOcrDebug=1`, { waitUntil: 'networkidle', timeout: 45000 })
await page.waitForFunction(() => !!window.cv && typeof window.cv.Mat !== 'undefined', undefined, { timeout: 60000 })

const output = []
for (let start = 0; start < items.length; start += BATCH_SIZE) {
  const batch = items.slice(start, start + BATCH_SIZE)
  const result = await page.evaluate(async ({ batch }) => {
    const { preprocessToMNISTWithDebug } = await import('/src/homography.js')
    const loadMat = async (dataUrl) => {
      const image = new Image()
      image.src = dataUrl
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject })
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      canvas.getContext('2d').drawImage(image, 0, 0)
      return cv.imread(canvas)
    }
    const matMetrics = (mat, threshold = 32) => {
      const values = Array.from(mat.data)
      const active = []
      let sum = 0, sumSq = 0, minX = mat.cols, minY = mat.rows, maxX = -1, maxY = -1, edge = 0
      const edgeBand = Math.max(1, Math.round(Math.min(mat.cols, mat.rows) * 0.06))
      for (let y = 0; y < mat.rows; y += 1) {
        for (let x = 0; x < mat.cols; x += 1) {
          const value = values[y * mat.cols + x]
          sum += value
          sumSq += value * value
          if (value > threshold) {
            active.push(value)
            minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
            if (x < edgeBand || x >= mat.cols - edgeBand || y < edgeBand || y >= mat.rows - edgeBand) edge += 1
          }
        }
      }
      const count = values.length, mean = sum / Math.max(1, count)
      return {
        width: mat.cols, height: mat.rows, mean, std: Math.sqrt(Math.max(0, sumSq / Math.max(1, count) - mean * mean)),
        activePixels: active.length, activeFraction: active.length / Math.max(1, count), mass: sum / 255,
        bboxW: maxX >= minX ? maxX - minX + 1 : 0, bboxH: maxY >= minY ? maxY - minY + 1 : 0,
        edgeActiveRatio: active.length ? edge / active.length : 0,
        touchesEdge: minX <= 1 || minY <= 1 || maxX >= mat.cols - 2 || maxY >= mat.rows - 2
      }
    }
    const tensorMetrics = (tensor) => {
      let active = 0, mass = 0, minX = 28, minY = 28, maxX = -1, maxY = -1
      for (let y = 0; y < 28; y += 1) for (let x = 0; x < 28; x += 1) {
        const value = Number(tensor[y * 28 + x]) || 0
        mass += value
        if (value > 0.12) { active += 1; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
      }
      const bboxW = maxX >= minX ? maxX - minX + 1 : 0, bboxH = maxY >= minY ? maxY - minY + 1 : 0
      return {
        activePixels: active, mass, bboxW, bboxH,
        centerOffsetX: bboxW ? (minX + maxX) / 2 - 13.5 : null,
        centerOffsetY: bboxH ? (minY + maxY) / 2 - 13.5 : null,
        touchesEdge: minX <= 1 || minY <= 1 || maxX >= 26 || maxY >= 26
      }
    }
    const difference = (less, more) => {
      const a = less.data, b = more.data
      let removed = 0, added = 0, reference = 0, overlap = 0
      for (let i = 0; i < a.length; i += 1) {
        const av = a[i] / 255, bv = b[i] / 255
        removed += Math.max(0, bv - av)
        added += Math.max(0, av - bv)
        overlap += Math.min(av, bv)
        reference += bv
      }
      return { removedFraction: removed / Math.max(1e-9, reference), addedFraction: added / Math.max(1e-9, reference), retainedFraction: overlap / Math.max(1e-9, reference) }
    }
    const process = async (item) => {
      const raw = await loadMat(item.image)
      const configs = {
        strict: { protectInteriorStrokes: item.isVirtual, strictLineRemoval: item.isVirtual },
        gentle: { protectInteriorStrokes: item.isVirtual, strictLineRemoval: false, skipRuleArtifactCleanup: true, skipPrintedLineCleanup: true },
        noRule: { protectInteriorStrokes: item.isVirtual, strictLineRemoval: item.isVirtual, skipRuleArtifactCleanup: true },
        noComponent: { protectInteriorStrokes: item.isVirtual, strictLineRemoval: item.isVirtual, skipPrintedLineCleanup: true }
      }
      const stages = {}
      for (const [name, options] of Object.entries(configs)) stages[name] = preprocessToMNISTWithDebug(raw, options)
      const strictInk = stages.strict.debug.inkMask
      const strictInkMetrics = matMetrics(strictInk)
      const strictTensorMetrics = tensorMetrics(stages.strict.tensor)
      const inkAspect = strictInkMetrics.bboxH ? strictInkMetrics.bboxW / strictInkMetrics.bboxH : null
      const tensorAspect = strictTensorMetrics.bboxH ? strictTensorMetrics.bboxW / strictTensorMetrics.bboxH : null
      const out = {
        key: item.key,
        rawGray: matMetrics(stages.strict.debug.gray, 32),
        strictInk: strictInkMetrics,
        strictTensor: strictTensorMetrics,
        strictVsGentle: difference(strictInk, stages.gentle.debug.inkMask),
        ruleCleanupEffect: difference(strictInk, stages.noRule.debug.inkMask),
        componentCleanupEffect: difference(strictInk, stages.noComponent.debug.inkMask),
        aspectLogDistortion: inkAspect && tensorAspect ? Math.abs(Math.log(tensorAspect / inkAspect)) : null
      }
      raw.delete()
      for (const stage of Object.values(stages)) {
        stage.debug.gray.delete(); stage.debug.inkMask.delete(); stage.debug.framed.delete()
      }
      return out
    }
    const out = []
    for (const item of batch) out.push(await process(item))
    return out
  }, { batch })
  output.push(...result)
  console.log(`${Math.min(start + batch.length, items.length)}/${items.length}`)
}
await browser.close()

const byKey = new Map(output.map((item) => [item.key, item]))
const joined = items.map(({ image, ...item }) => ({ ...item, ...(byKey.get(item.key) || {}) }))
function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null }
function pct(n, d) { return d ? Number((100 * n / d).toFixed(1)) : 0 }
function bucket(rows) { const correct = rows.filter((row) => row.currentDigitCorrect).length; return { total: rows.length, correct, accuracyPct: pct(correct, rows.length) } }
function quartiles(metric) {
  const usable = joined.filter((row) => Number.isFinite(metric(row))).sort((a, b) => metric(a) - metric(b))
  const n = Math.max(1, Math.floor(usable.length / 4)), low = usable.slice(0, n), high = usable.slice(-n)
  return { low: { range: [metric(low[0]), metric(low.at(-1))], ...bucket(low) }, high: { range: [metric(high[0]), metric(high.at(-1))], ...bucket(high) } }
}
const metricFns = {
  strictRemovedFromGentle: (row) => row.strictVsGentle?.removedFraction,
  ruleCleanupRemoved: (row) => row.ruleCleanupEffect?.removedFraction,
  componentCleanupRemoved: (row) => row.componentCleanupEffect?.removedFraction,
  strictInkEdgeRatio: (row) => row.strictInk?.edgeActiveRatio,
  strictInkActiveFraction: (row) => row.strictInk?.activeFraction,
  tensorTouchesEdge: (row) => row.strictTensor?.touchesEdge ? 1 : 0,
  aspectLogDistortion: (row) => row.aspectLogDistortion
}
const report = {
  generatedAt: new Date().toISOString(),
  rows: joined.length,
  overall: bucket(joined),
  metricQuartiles: Object.fromEntries(Object.entries(metricFns).map(([key, fn]) => [key, quartiles(fn)])),
  meansCorrectVsWrong: Object.fromEntries(Object.entries(metricFns).map(([key, fn]) => [key, {
    correct: mean(joined.filter((row) => row.currentDigitCorrect).map(fn).filter(Number.isFinite)),
    wrong: mean(joined.filter((row) => !row.currentDigitCorrect).map(fn).filter(Number.isFinite))
  }])),
  rowsData: joined
}
await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
await fs.writeFile(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ rows: report.rows, overall: report.overall, metricQuartiles: report.metricQuartiles, meansCorrectVsWrong: report.meansCorrectVsWrong, out: OUT_PATH }, null, 2))
