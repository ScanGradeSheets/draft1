#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')

const ROWS_PATH = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const OUT_PATH = 'private-evidence/reports/pipeline-fidelity-audit-20260709.json'

function pct(n, d) { return d ? Number((100 * n / d).toFixed(1)) : 0 }
function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null }
function median(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
function quantile(values, q) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * q)))]
}
function dist(a, b) { return Math.hypot(b.x - a.x, b.y - a.y) }
function angle(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const denominator = Math.max(1e-9, Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y))
  return Math.acos(Math.max(-1, Math.min(1, (ab.x * cb.x + ab.y * cb.y) / denominator))) * 180 / Math.PI
}
function polygonArea(points) {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const next = points[(i + 1) % points.length]
    sum += points[i].x * next.y - next.x * points[i].y
  }
  return Math.abs(sum) / 2
}
function perspectiveMetrics(debug) {
  const anchors = debug?.warpOrientation?.detectedAnchors
  if (!Array.isArray(anchors) || anchors.length !== 4) return {}
  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]))
  const tl = byId.get('tl'), tr = byId.get('tr'), br = byId.get('br'), bl = byId.get('bl')
  if (!tl || !tr || !br || !bl) return {}
  const top = dist(tl, tr), bottom = dist(bl, br), left = dist(tl, bl), right = dist(tr, br)
  const widthRatio = Math.max(top, bottom) / Math.max(1, Math.min(top, bottom))
  const heightRatio = Math.max(left, right) / Math.max(1, Math.min(left, right))
  const angles = [angle(bl, tl, tr), angle(tl, tr, br), angle(tr, br, bl), angle(br, bl, tl)]
  const maxAngleDeviation = Math.max(...angles.map((value) => Math.abs(90 - value)))
  const imageW = Number(debug?.imageSize?.width) || Number(debug?.captureQuality?.cropW) || 1
  const imageH = Number(debug?.imageSize?.height) || Number(debug?.captureQuality?.cropH) || 1
  const occupancy = polygonArea([tl, tr, br, bl]) / Math.max(1, imageW * imageH)
  const perspectiveSeverity = Math.sqrt(
    Math.log(widthRatio) ** 2 +
    Math.log(heightRatio) ** 2 +
    (maxAngleDeviation / 45) ** 2
  )
  return { top, bottom, left, right, widthRatio, heightRatio, maxAngleDeviation, occupancy, perspectiveSeverity }
}

async function pngMetrics(file) {
  const png = PNG.sync.read(await fs.readFile(file))
  const values = []
  let edgeDark = 0, edgePixels = 0, dark = 0
  const border = Math.max(1, Math.round(Math.min(png.width, png.height) * 0.06))
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const i = (y * png.width + x) * 4
      const lum = 0.299 * png.data[i] + 0.587 * png.data[i + 1] + 0.114 * png.data[i + 2]
      values.push(lum)
    }
  }
  const bg = quantile(values, 0.82) ?? 255
  const threshold = bg - 28
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const lum = values[y * png.width + x]
      const isDark = lum < threshold
      if (isDark) dark += 1
      if (x < border || x >= png.width - border || y < border || y >= png.height - border) {
        edgePixels += 1
        if (isDark) edgeDark += 1
      }
    }
  }
  const avg = mean(values)
  const variance = mean(values.map((value) => (value - avg) ** 2))
  return {
    width: png.width,
    height: png.height,
    luminanceMean: avg,
    luminanceStd: Math.sqrt(variance),
    background: bg,
    darkFraction: dark / values.length,
    edgeDarkFraction: edgeDark / Math.max(1, edgePixels)
  }
}

function rank(values) {
  return values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
    .reduce((out, item, position) => { out[item.index] = position + 1; return out }, [])
}
function spearman(rows, xKey, yKey = 'errorRate') {
  const usable = rows.filter((row) => Number.isFinite(row[xKey]) && Number.isFinite(row[yKey]))
  if (usable.length < 4) return null
  const xs = rank(usable.map((row) => row[xKey]))
  const ys = rank(usable.map((row) => row[yKey]))
  const mx = mean(xs), my = mean(ys)
  const numerator = xs.reduce((sum, x, i) => sum + (x - mx) * (ys[i] - my), 0)
  const denominator = Math.sqrt(
    xs.reduce((sum, x) => sum + (x - mx) ** 2, 0) * ys.reduce((sum, y) => sum + (y - my) ** 2, 0)
  )
  return denominator ? Number((numerator / denominator).toFixed(3)) : null
}
function bucket(rows) {
  const errors = rows.filter((row) => !row.currentDigitCorrect).length
  return { total: rows.length, correct: rows.length - errors, errors, accuracyPct: pct(rows.length - errors, rows.length) }
}
function pageBucket(rows) {
  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const errors = rows.reduce((sum, row) => sum + row.errors, 0)
  return { pages: rows.length, total, correct: total - errors, errors, accuracyPct: pct(total - errors, total), meanPageErrorPct: pct(rows.reduce((sum, row) => sum + row.errorRate, 0), rows.length) }
}
function metricQuartiles(rows, key, bucketFn = bucket) {
  const usable = rows.filter((row) => Number.isFinite(row[key])).sort((a, b) => a[key] - b[key])
  const count = Math.max(1, Math.floor(usable.length / 4))
  const low = usable.slice(0, count), high = usable.slice(-count)
  return {
    lowRange: [low[0]?.[key] ?? null, low.at(-1)?.[key] ?? null],
    low: bucketFn(low),
    highRange: [high[0]?.[key] ?? null, high.at(-1)?.[key] ?? null],
    high: bucketFn(high)
  }
}

const rows = JSON.parse(await fs.readFile(ROWS_PATH, 'utf8')).filter((row) => row.truthDigit !== null)
const debugCache = new Map()
const imageCache = new Map()
const layoutCache = new Map()
const cropRectCache = new Map()
async function debugFor(file) {
  if (!debugCache.has(file)) {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'))
    debugCache.set(file, parsed?.debug || parsed)
  }
  return debugCache.get(file)
}
async function imageFor(file) {
  if (!imageCache.has(file)) imageCache.set(file, await pngMetrics(file))
  return imageCache.get(file)
}
async function layoutFor(layoutId) {
  if (!layoutCache.has(layoutId)) layoutCache.set(layoutId, JSON.parse(await fs.readFile(`layouts/${layoutId}.json`, 'utf8')))
  return layoutCache.get(layoutId)
}
async function cropRectsFor(replayFile) {
  const file = replayFile.replace(/-replay-result\.json$/, '-crop-rects.json')
  if (!cropRectCache.has(file)) {
    let value = []
    try { value = JSON.parse(await fs.readFile(file, 'utf8')) } catch {}
    cropRectCache.set(file, value)
  }
  return cropRectCache.get(file)
}
function expectedRectFor(layout, id) {
  const box = (layout?.boxes || []).find((candidate) => Number(candidate?.id) === Number(id))
  if (!box) return null
  const normalized = layout?.page?.units === 'normalized'
  const scaleX = normalized ? 1700 : 1700 / layout.page.width_mm
  const scaleY = normalized ? 2200 : 2200 / layout.page.height_mm
  if (normalized) {
    const x = (box.x - box.width) * scaleX, y = (box.y - box.height) * scaleY
    return { x, y, w: box.width * scaleX, h: box.height * scaleY }
  }
  const w = box.width * scaleX, h = box.height * scaleY
  return { x: box.cx * scaleX - w / 2, y: box.cy * scaleY - h / 2, w, h }
}

const enriched = []
for (const row of rows) {
  const debug = await debugFor(row.debugPath)
  const id = Number(row.detailId)
  const rawFile = path.join(path.dirname(row.debugPath), 'raw-crops', `raw-${String(id + 1).padStart(2, '0')}.png`)
  const modelFile = path.join(path.dirname(row.debugPath), 'model-inputs', `model-${String(id + 1).padStart(2, '0')}.png`)
  const raw = await imageFor(rawFile).catch(() => ({}))
  const modelInput = await imageFor(modelFile).catch(() => ({}))
  const layout = await layoutFor(row.layoutId).catch(() => null)
  const cropRects = await cropRectsFor(row.replayFile)
  const actualRect = cropRects.find((candidate) => Number(candidate?.id) === id)?.boxRect || null
  const expectedRect = expectedRectFor(layout, id)
  const boxCenterShiftX = actualRect && expectedRect ? ((actualRect.x + actualRect.w / 2) - (expectedRect.x + expectedRect.w / 2)) / Math.max(1, expectedRect.w) : null
  const boxCenterShiftY = actualRect && expectedRect ? ((actualRect.y + actualRect.h / 2) - (expectedRect.y + expectedRect.h / 2)) / Math.max(1, expectedRect.h) : null
  const preprocess = Array.isArray(debug.preprocessStats) ? debug.preprocessStats[id] || {} : {}
  const quality = Array.isArray(debug.cropQuality)
    ? debug.cropQuality.find((candidate) => Number(candidate?.id) === id) || debug.cropQuality[id] || {}
    : {}
  const capture = debug.captureQuality || {}
  const perspective = perspectiveMetrics(debug)
  const burstScores = Array.isArray(capture.burstScores) ? capture.burstScores.map((item) => Number(item.score)).filter(Number.isFinite).sort((a, b) => b - a) : []
  enriched.push({
    ...row,
    focusScore: Number(capture.focusScore),
    captureLumaMean: Number(capture.lumaMean),
    captureLumaVariance: Number(capture.lumaVariance),
    burstFrameCount: Number(capture.burstFrameCount),
    burstWinnerMargin: burstScores.length > 1 ? burstScores[0] - burstScores[1] : null,
    ...perspective,
    rawLuminanceStd: raw.luminanceStd,
    rawDarkFraction: raw.darkFraction,
    rawEdgeDarkFraction: raw.edgeDarkFraction,
    rawAspect: raw.width && raw.height ? raw.width / raw.height : null,
    boxCenterShiftX,
    boxCenterShiftY,
    boxCenterShiftMagnitude: Number.isFinite(boxCenterShiftX) && Number.isFinite(boxCenterShiftY) ? Math.hypot(boxCenterShiftX, boxCenterShiftY) : null,
    boxWidthRatio: actualRect && expectedRect ? actualRect.w / expectedRect.w : null,
    boxHeightRatio: actualRect && expectedRect ? actualRect.h / expectedRect.h : null,
    preprocessBg: Number(preprocess.bg),
    preprocessScale: Number(preprocess.scale),
    preprocessInkMean: Number(preprocess.inkMean),
    finalInkPixels: Number(quality.inkPixels),
    finalInkW: Number(quality.inkW),
    finalInkH: Number(quality.inkH),
    finalInkDensity: Number(quality.density),
    finalEdgeInkRatio: Number(quality.edgeInkRatio),
    artifactVariantRatio: Number(quality.artifactVariantRatio),
    weakVariantRatio: Number(quality.weakVariantRatio),
    finalDarkFraction: modelInput.darkFraction,
    cropVariantCorrect: (row.correctVariantNames || []).some((name) => !['strict', 'edge-clean', 'no-rule-cleanup', 'no-component-cleanup', 'gentle'].includes(name)),
    preprocessOnlyVariantCorrect: (row.correctVariantNames || []).some((name) => ['strict', 'edge-clean', 'no-rule-cleanup', 'no-component-cleanup', 'gentle'].includes(name))
  })
}

const pageMap = new Map()
for (const row of enriched) {
  if (!pageMap.has(row.captureId)) {
    pageMap.set(row.captureId, {
      captureId: row.captureId,
      layoutId: row.layoutId,
      family: row.family,
      focusScore: row.focusScore,
      captureLumaMean: row.captureLumaMean,
      captureLumaVariance: row.captureLumaVariance,
      burstWinnerMargin: row.burstWinnerMargin,
      perspectiveSeverity: row.perspectiveSeverity,
      maxAngleDeviation: row.maxAngleDeviation,
      widthRatio: row.widthRatio,
      heightRatio: row.heightRatio,
      occupancy: row.occupancy,
      total: 0,
      errors: 0
    })
  }
  const page = pageMap.get(row.captureId)
  page.total += 1
  if (!row.currentDigitCorrect) page.errors += 1
}
const pages = [...pageMap.values()].map((page) => ({ ...page, errorRate: page.errors / page.total }))
const layoutErrorMeans = new Map()
for (const layoutId of new Set(pages.map((page) => page.layoutId))) {
  layoutErrorMeans.set(layoutId, mean(pages.filter((page) => page.layoutId === layoutId).map((page) => page.errorRate)))
}
for (const page of pages) page.layoutAdjustedErrorRate = page.errorRate - layoutErrorMeans.get(page.layoutId)

const variantNames = ['strict', 'edge-clean', 'no-rule-cleanup', 'no-component-cleanup', 'gentle', 'center-safe-slot', 'expected-slot', 'edge-band-slot', 'low-slot', 'wide-slot', 'no-side-erase', 'raw-border-slot']
const currentWrong = enriched.filter((row) => !row.currentDigitCorrect)
const variantRescues = Object.fromEntries(variantNames.map((name) => {
  const rescued = currentWrong.filter((row) => (row.correctVariantNames || []).includes(name))
  return [name, { rescued: rescued.length, wrongTotal: currentWrong.length, rescuePct: pct(rescued.length, currentWrong.length) }]
}))

const metrics = ['focusScore', 'captureLumaMean', 'captureLumaVariance', 'burstWinnerMargin', 'perspectiveSeverity', 'maxAngleDeviation', 'widthRatio', 'heightRatio', 'occupancy']
const pageMetricAnalysis = Object.fromEntries(metrics.map((key) => [key, {
  spearmanWithPageErrorRate: spearman(pages, key),
  spearmanWithLayoutAdjustedErrorRate: spearman(pages, key, 'layoutAdjustedErrorRate'),
  spearmanRowPages: spearman(pages.filter((page) => page.family === 'row'), key),
  spearmanNonRowPages: spearman(pages.filter((page) => page.family === 'non-row'), key),
  quartiles: metricQuartiles(pages, key, pageBucket)
}]))
const digitMetrics = ['rawLuminanceStd', 'rawDarkFraction', 'rawEdgeDarkFraction', 'rawAspect', 'boxCenterShiftMagnitude', 'boxCenterShiftX', 'boxCenterShiftY', 'boxWidthRatio', 'boxHeightRatio', 'preprocessScale', 'preprocessInkMean', 'finalInkPixels', 'finalInkW', 'finalInkH', 'finalInkDensity', 'finalEdgeInkRatio', 'artifactVariantRatio', 'weakVariantRatio']
const digitMetricAnalysis = Object.fromEntries(digitMetrics.map((key) => [key, { quartiles: metricQuartiles(enriched, key) }]))

const report = {
  generatedAt: new Date().toISOString(),
  inputRows: enriched.length,
  pages: pages.length,
  overall: bucket(enriched),
  byFamily: Object.fromEntries([...new Set(enriched.map((row) => row.family))].sort().map((key) => [key, bucket(enriched.filter((row) => row.family === key))])),
  bySlot: Object.fromEntries([...new Set(enriched.map((row) => row.slotName))].sort().map((key) => [key, bucket(enriched.filter((row) => row.slotName === key))])),
  byLayout: Object.fromEntries([...new Set(enriched.map((row) => row.layoutId))].sort().map((key) => [key, bucket(enriched.filter((row) => row.layoutId === key))])),
  variantRescues,
  currentWrongFailureRouting: {
    total: currentWrong.length,
    anyVariantCorrect: currentWrong.filter((row) => row.anyVariantCorrect).length,
    preprocessOnlyVariantCorrect: currentWrong.filter((row) => row.preprocessOnlyVariantCorrect).length,
    cropVariantCorrect: currentWrong.filter((row) => row.cropVariantCorrect).length,
    noStoredVariantCorrect: currentWrong.filter((row) => !row.anyVariantCorrect).length
  },
  pageMetricAnalysis,
  digitMetricAnalysis,
  pagesData: pages,
  rows: enriched
}
await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
await fs.writeFile(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  overall: report.overall,
  currentWrongFailureRouting: report.currentWrongFailureRouting,
  pageMetricAnalysis: report.pageMetricAnalysis,
  variantRescues: report.variantRescues,
  out: OUT_PATH
}, null, 2))
