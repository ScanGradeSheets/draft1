#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const DEFAULT_CANDIDATES = 'private-evidence/reports/nonrow-whole-answer-variants-20260708/candidate-rows.json'
const DEFAULT_DEBUG_ROOT = 'private-evidence/debug-scans'
const DEFAULT_OUT = 'private-evidence/reports/visual-blank-candidate-gate-20260708/summary.json'

function parseArgs(argv) {
  const opts = {
    rows: DEFAULT_ROWS,
    candidates: DEFAULT_CANDIDATES,
    debugRoot: DEFAULT_DEBUG_ROOT,
    out: DEFAULT_OUT,
    maxChangedSlots: 1
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--rows') opts.rows = argv[++i]
    else if (arg === '--candidates') opts.candidates = argv[++i]
    else if (arg === '--debug-root') opts.debugRoot = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg === '--max-changed-slots') opts.maxChangedSlots = Number(argv[++i])
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function unwrapDebug(raw) {
  return raw?.debug && typeof raw.debug === 'object' ? raw.debug : raw
}

async function collectDebugFiles(entry) {
  const stat = await fs.stat(entry).catch(() => null)
  if (!stat) return []
  if (stat.isFile()) return path.basename(entry) === 'debug.json' ? [entry] : []
  if (!stat.isDirectory()) return []
  const out = []
  const names = await fs.readdir(entry, { withFileTypes: true })
  for (const name of names) {
    const child = path.join(entry, name.name)
    if (name.isDirectory()) out.push(...await collectDebugFiles(child))
    else if (name.isFile() && name.name === 'debug.json') out.push(child)
  }
  return out
}

function tensorInkQuality(tensor) {
  const values = tensor && typeof tensor.length === 'number' ? tensor : []
  const binary = Array(28 * 28).fill(false)
  let inkPixels = 0
  let weightedInk = 0
  let minX = 28
  let minY = 28
  let maxX = -1
  let maxY = -1
  const rowCounts = Array(28).fill(0)
  const colCounts = Array(28).fill(0)
  let edgeInkPixels = 0
  let centerInkPixels = 0
  for (let i = 0; i < Math.min(values.length, 28 * 28); i += 1) {
    const value = Number(values[i]) || 0
    if (value <= 0.16) continue
    const y = Math.floor(i / 28)
    const x = i - y * 28
    binary[i] = true
    inkPixels += 1
    weightedInk += value
    rowCounts[y] += 1
    colCounts[x] += 1
    if (x <= 1 || x >= 26 || y <= 1 || y >= 26) edgeInkPixels += 1
    if (x >= 7 && x <= 20 && y >= 6 && y <= 22) centerInkPixels += 1
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const inkW = maxX >= minX ? maxX - minX + 1 : 0
  const inkH = maxY >= minY ? maxY - minY + 1 : 0
  const density = inkW > 0 && inkH > 0 ? inkPixels / (inkW * inkH) : 0
  const maxRowCount = rowCounts.length ? Math.max(...rowCounts) : 0
  const maxColCount = colCounts.length ? Math.max(...colCounts) : 0
  const edgeInkRatio = inkPixels ? edgeInkPixels / inkPixels : 0
  const centerInkRatio = inkPixels ? centerInkPixels / inkPixels : 0
  const verticalLineScore = inkPixels ? maxColCount / inkPixels : 0
  const horizontalLineScore = inkPixels ? maxRowCount / inkPixels : 0

  const visited = Array(28 * 28).fill(false)
  const components = []
  const stack = []
  for (let i = 0; i < binary.length; i += 1) {
    if (!binary[i] || visited[i]) continue
    let count = 0
    let touchesEdge = false
    stack.push(i)
    visited[i] = true
    while (stack.length) {
      const current = stack.pop()
      count += 1
      const y = Math.floor(current / 28)
      const x = current - y * 28
      if (x <= 1 || x >= 26 || y <= 1 || y >= 26) touchesEdge = true
      for (const next of [current - 1, current + 1, current - 28, current + 28]) {
        if (next < 0 || next >= binary.length || visited[next] || !binary[next]) continue
        const ny = Math.floor(next / 28)
        const nx = next - ny * 28
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
        visited[next] = true
        stack.push(next)
      }
    }
    components.push({ count, touchesEdge })
  }
  components.sort((a, b) => b.count - a.count)
  const componentCount = components.length
  const largestComponentPixels = components[0]?.count || 0
  const largestComponentRatio = inkPixels ? largestComponentPixels / inkPixels : 0
  const smallComponentCount = components.filter((component) => component.count > 0 && component.count <= 4).length
  const edgeComponentCount = components.filter((component) => component.touchesEdge).length
  const horizontalArtifactLikely =
    inkPixels >= 8 &&
    inkW >= 11 &&
    (inkH <= 6 || maxRowCount >= Math.max(9, Math.round(inkPixels * 0.42)))
  const verticalArtifactLikely =
    inkPixels >= 10 &&
    inkPixels <= 90 &&
    inkW <= 7 &&
    inkH >= 12 &&
    density <= 0.72 &&
    edgeInkRatio >= 0.20
  const edgeArtifactLikely =
    inkPixels >= 8 &&
    edgeInkRatio >= 0.48 &&
    (inkW <= 8 || inkH <= 8 || density <= 0.46)
  const fragmentedArtifactLikely =
    inkPixels >= 8 &&
    componentCount >= 4 &&
    largestComponentRatio <= 0.68
  const lineArtifactLikely =
    horizontalArtifactLikely ||
    verticalArtifactLikely ||
    edgeArtifactLikely ||
    fragmentedArtifactLikely
  const ok =
    inkPixels >= 14 &&
    inkW >= 3 &&
    inkH >= 8 &&
    largestComponentRatio >= 0.48 &&
    !horizontalArtifactLikely &&
    !edgeArtifactLikely
  return {
    inkPixels,
    weightedInk,
    inkW,
    inkH,
    density,
    maxRowCount,
    maxColCount,
    edgeInkRatio,
    centerInkRatio,
    verticalLineScore,
    horizontalLineScore,
    componentCount,
    largestComponentPixels,
    largestComponentRatio,
    smallComponentCount,
    edgeComponentCount,
    horizontalArtifactLikely,
    verticalArtifactLikely,
    edgeArtifactLikely,
    fragmentedArtifactLikely,
    lineArtifactLikely,
    ok
  }
}

function tensorQualityScore(quality) {
  if (!quality) return -Infinity
  let score = 0
  if (quality.ok) score += 1000
  if (!quality.lineArtifactLikely) score += 220
  if (quality.horizontalArtifactLikely) score -= 220
  if (quality.edgeArtifactLikely) score -= 160
  if (quality.verticalArtifactLikely) score -= 120
  if (quality.fragmentedArtifactLikely) score -= 100
  score += Math.min(quality.inkPixels || 0, 120)
  score += Math.min(quality.inkW || 0, 20) * 4
  score += Math.min(quality.inkH || 0, 24) * 4
  score += Math.round((quality.largestComponentRatio || 0) * 80)
  score += Math.round((quality.centerInkRatio || 0) * 35)
  score -= Math.round((quality.edgeInkRatio || 0) * 90)
  score -= Math.max(0, (quality.componentCount || 0) - 2) * 12
  return score
}

function summarizeTensorItem(item) {
  const candidates = [
    { name: 'base', tensor: item?.tensor },
    ...(Array.isArray(item?.tensorVariants) ? item.tensorVariants : [])
  ].filter((candidate) => candidate?.tensor)
  const qualities = candidates.map((candidate) => ({
    name: candidate.name || 'variant',
    ...tensorInkQuality(candidate.tensor)
  }))
  let best = null
  for (const quality of qualities) {
    if (!best || tensorQualityScore(quality) > tensorQualityScore(best)) best = quality
  }
  const summary = qualities.some((quality) => quality.name !== 'base')
    ? qualities.filter((quality) => quality.name !== 'base')
    : qualities
  const variantCount = summary.length
  const usableVariantCount = summary.filter((quality) => (
    quality.ok &&
    !quality.lineArtifactLikely &&
    (quality.inkPixels || 0) >= 14 &&
    (quality.inkH || 0) >= 7
  )).length
  const artifactVariantCount = summary.filter((quality) => quality.lineArtifactLikely).length
  const weakVariantCount = summary.filter((quality) => (
    !quality.ok ||
    (quality.inkPixels || 0) < 12 ||
    (quality.inkH || 0) < 6 ||
    quality.lineArtifactLikely
  )).length
  return {
    best: best || {},
    base: qualities.find((quality) => quality.name === 'base') || {},
    strict: qualities.find((quality) => quality.name === 'strict') || {},
    variantCount,
    usableVariantCount,
    artifactVariantCount,
    weakVariantCount,
    usableVariantRatio: variantCount ? usableVariantCount / variantCount : 0,
    artifactVariantRatio: variantCount ? artifactVariantCount / variantCount : 0,
    weakVariantRatio: variantCount ? weakVariantCount / variantCount : 0,
    allVariantsWeak: variantCount > 0 && usableVariantCount === 0
  }
}

function featureObject(row, quality) {
  const best = quality.best || {}
  const base = quality.base || {}
  const strict = quality.strict || {}
  return {
    bias: 1,
    detailConfidence: Number(row.detailConfidence) || 0,
    detailTopGap: Number(row.detailTopGap) || 0,
    digitIndex: Number(row.digitIndex) || 0,
    slotCount: Number(row.slotCount) || 0,
    expectedLength: String(row.expected || '').length,
    family: row.family,
    slotName: row.slotName,
    detailDigit: String(row.detailDigit ?? 'none'),
    variantCount: quality.variantCount || 0,
    usableVariantCount: quality.usableVariantCount || 0,
    artifactVariantCount: quality.artifactVariantCount || 0,
    weakVariantCount: quality.weakVariantCount || 0,
    usableVariantRatio: quality.usableVariantRatio || 0,
    artifactVariantRatio: quality.artifactVariantRatio || 0,
    weakVariantRatio: quality.weakVariantRatio || 0,
    allVariantsWeak: Boolean(quality.allVariantsWeak),
    bestInkPixels: best.inkPixels || 0,
    bestWeightedInk: best.weightedInk || 0,
    bestInkW: best.inkW || 0,
    bestInkH: best.inkH || 0,
    bestDensity: best.density || 0,
    bestMaxRowCount: best.maxRowCount || 0,
    bestMaxColCount: best.maxColCount || 0,
    bestEdgeInkRatio: best.edgeInkRatio || 0,
    bestCenterInkRatio: best.centerInkRatio || 0,
    bestVerticalLineScore: best.verticalLineScore || 0,
    bestHorizontalLineScore: best.horizontalLineScore || 0,
    bestComponentCount: best.componentCount || 0,
    bestLargestComponentRatio: best.largestComponentRatio || 0,
    bestSmallComponentCount: best.smallComponentCount || 0,
    bestEdgeComponentCount: best.edgeComponentCount || 0,
    bestHorizontalArtifactLikely: Boolean(best.horizontalArtifactLikely),
    bestVerticalArtifactLikely: Boolean(best.verticalArtifactLikely),
    bestEdgeArtifactLikely: Boolean(best.edgeArtifactLikely),
    bestFragmentedArtifactLikely: Boolean(best.fragmentedArtifactLikely),
    bestLineArtifactLikely: Boolean(best.lineArtifactLikely),
    bestOk: Boolean(best.ok),
    baseInkPixels: base.inkPixels || 0,
    baseInkW: base.inkW || 0,
    baseInkH: base.inkH || 0,
    baseComponentCount: base.componentCount || 0,
    strictInkPixels: strict.inkPixels || 0,
    strictInkW: strict.inkW || 0,
    strictInkH: strict.inkH || 0,
    strictComponentCount: strict.componentCount || 0
  }
}

function oneHot(value, key) {
  return `${key}=${String(value ?? 'none')}`
}

function collectFeatureKeys(records, minCount = 5) {
  const numeric = new Set()
  const categoricalCounts = new Map()
  for (const record of records) {
    for (const [key, value] of Object.entries(record.features)) {
      if (typeof value === 'number' || typeof value === 'boolean') numeric.add(key)
      else {
        const hot = oneHot(value, key)
        categoricalCounts.set(hot, (categoricalCounts.get(hot) || 0) + 1)
      }
    }
  }
  return {
    numeric: [...numeric].sort(),
    categorical: [...categoricalCounts.entries()]
      .filter(([, count]) => count >= minCount)
      .map(([key]) => key)
      .sort()
  }
}

function vectorize(records, keys, fit = null) {
  const catIndex = new Map(keys.categorical.map((key, index) => [key, index]))
  const rows = records.map((record) => {
    const nums = keys.numeric.map((key) => {
      const value = record.features[key]
      if (value === true) return 1
      if (value === false) return 0
      return Number(value) || 0
    })
    const cats = Array(keys.categorical.length).fill(0)
    for (const [key, value] of Object.entries(record.features)) {
      if (typeof value === 'number' || typeof value === 'boolean') continue
      const index = catIndex.get(oneHot(value, key))
      if (index !== undefined) cats[index] = 1
    }
    return nums.concat(cats)
  })
  const numericCount = keys.numeric.length
  const mean = fit?.mean || Array(rows[0]?.length || 0).fill(0)
  const std = fit?.std || Array(rows[0]?.length || 0).fill(1)
  if (!fit && rows.length) {
    for (let col = 0; col < numericCount; col += 1) {
      const values = rows.map((row) => row[col])
      mean[col] = values.reduce((sum, n) => sum + n, 0) / values.length
      const variance = values.reduce((sum, n) => sum + (n - mean[col]) ** 2, 0) / values.length
      std[col] = Math.sqrt(variance) || 1
    }
  }
  return {
    x: rows.map((row) => row.map((value, col) => (value - mean[col]) / (std[col] || 1))),
    y: records.map((record) => record.label),
    fit: { mean, std }
  }
}

function sigmoid(value) {
  const x = Math.max(-40, Math.min(40, value))
  return 1 / (1 + Math.exp(-x))
}

function trainLogistic(x, y, { l2 = 0.01, epochs = 1200, lr = 0.07 } = {}) {
  const cols = x[0]?.length || 0
  const weights = Array(cols).fill(0)
  const pos = Math.max(1, y.filter(Boolean).length)
  const neg = Math.max(1, y.length - pos)
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const grad = Array(cols).fill(0)
    for (let i = 0; i < x.length; i += 1) {
      const z = x[i].reduce((sum, value, col) => sum + value * weights[col], 0)
      const pred = sigmoid(z)
      const sampleWeight = y[i] ? y.length / (2 * pos) : y.length / (2 * neg)
      const error = (pred - y[i]) * sampleWeight
      for (let col = 0; col < cols; col += 1) grad[col] += error * x[i][col]
    }
    const step = lr * (0.35 + 0.65 * (1 - epoch / Math.max(1, epochs)))
    for (let col = 0; col < cols; col += 1) {
      weights[col] -= step * ((grad[col] / Math.max(1, x.length)) + l2 * weights[col])
    }
  }
  return weights
}

function scoreRecords(records, keys, fit, weights) {
  const { x } = vectorize(records, keys, fit)
  return x.map((row) => sigmoid(row.reduce((sum, value, col) => sum + value * weights[col], 0)))
}

function slotIndex(name) {
  if (name === 'left') return 0
  if (name === 'right') return 1
  if (/^slot-\d+$/.test(name)) return Number(name.slice(5)) - 1
  return null
}

function blankedSlots(pattern) {
  return String(pattern || '')
    .split('|')
    .map((part) => part.match(/^([^:]+):([^>]*)>null$/))
    .filter(Boolean)
    .map((match) => match[1])
}

function summarize(items) {
  const out = { n: items.length, correct: 0, wrong: 0, rescued: 0, harmedCurrentCorrect: 0 }
  for (const item of items) {
    if (item.correct) out.correct += 1
    else out.wrong += 1
    if (item.rescued) out.rescued += 1
    if (item.harmedCurrentCorrect) out.harmedCurrentCorrect += 1
  }
  out.accuracyPct = out.n ? Number((out.correct / out.n * 100).toFixed(1)) : 0
  return out
}

function groupBestCandidates(rows, threshold) {
  const groups = new Map()
  for (const row of rows) {
    if (row.minBlankFilledScore >= threshold) continue
    const existing = groups.get(row.key)
    if (!existing || row.minBlankFilledScore < existing.minBlankFilledScore) groups.set(row.key, row)
  }
  return [...groups.values()]
}

async function loadSlotRecords(opts) {
  const rows = await readJson(opts.rows)
  const debugCache = new Map()
  const records = []
  for (const row of rows) {
    if (row.truthBlank !== true && row.truthDigit === null) continue
    const debugPath = row.debugPath
    if (!debugCache.has(debugPath)) debugCache.set(debugPath, unwrapDebug(await readJson(debugPath)))
    const debug = debugCache.get(debugPath)
    const tensorItem = (debug.tensors || []).find((item) => Number(item.id) === Number(row.detailId))
    if (!tensorItem) continue
    const quality = summarizeTensorItem(tensorItem)
    records.push({
      split: row.split,
      label: row.truthBlank !== true,
      row,
      features: featureObject(row, quality)
    })
  }
  return records
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const slotRecords = await loadSlotRecords(opts)
  const train = slotRecords.filter((record) => record.split === 'calibration')
  const keys = collectFeatureKeys(train)
  const trainVector = vectorize(train, keys)
  const weights = trainLogistic(trainVector.x, trainVector.y, { l2: 0.01 })

  const debugFiles = await collectDebugFiles(opts.debugRoot)
  const debugByCapture = new Map(debugFiles.map((file) => [path.basename(path.dirname(file)), file]))
  const debugCache = new Map()
  const candidateRaw = await readJson(opts.candidates)
  const candidateRows = candidateRaw.candidateRows || candidateRaw
  const scored = []
  let missingTensor = 0
  for (const row of candidateRows) {
    const blanks = blankedSlots(row.changePattern)
    if (!blanks.length) continue
    if (Number(row.changedSlots) > opts.maxChangedSlots) continue
    const debugPath = debugByCapture.get(row.captureId)
    if (!debugPath) {
      missingTensor += 1
      continue
    }
    if (!debugCache.has(debugPath)) debugCache.set(debugPath, unwrapDebug(await readJson(debugPath)))
    const debug = debugCache.get(debugPath)
    const replay = await readJson(row.replayFile)
    const details = (replay.predictionDetails || [])
      .filter((detail) => Number(detail.questionNum) === Number(row.questionLabel))
      .sort((a, b) => Number(a.digitIndex || 0) - Number(b.digitIndex || 0))
    const blankScores = []
    const blankDetails = []
    let allFound = true
    for (const slot of blanks) {
      const index = slotIndex(slot)
      const detail = index === null ? null : details[index]
      const tensorItem = detail ? (debug.tensors || []).find((item) => Number(item.id) === Number(detail.id)) : null
      if (!detail || !tensorItem) {
        allFound = false
        break
      }
      const quality = summarizeTensorItem(tensorItem)
      const pseudoRow = {
        detailConfidence: detail.confidence,
        detailTopGap: detail.topGap,
        digitIndex: detail.digitIndex,
        slotCount: details.length,
        expected: row.expected,
        family: row.family,
        slotName: slot,
        detailDigit: detail.digit
      }
      const record = { features: featureObject(pseudoRow, quality), label: true }
      const filledScore = scoreRecords([record], keys, trainVector.fit, weights)[0] || 0
      blankScores.push(filledScore)
      blankDetails.push({
        slot,
        detailId: detail.id,
        digit: detail.digit,
        confidence: detail.confidence,
        topGap: detail.topGap,
        filledScore: Number(filledScore.toFixed(6)),
        quality: quality.best
      })
    }
    if (!allFound) {
      missingTensor += 1
      continue
    }
    scored.push({
      ...row,
      blankedSlots: blanks,
      minBlankFilledScore: Math.min(...blankScores),
      maxBlankFilledScore: Math.max(...blankScores),
      blankDetails
    })
  }

  const thresholds = [0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.15, 0.18, 0.2, 0.25, 0.3, 0.4, 0.5]
  const runs = thresholds.map((threshold) => {
    const selected = groupBestCandidates(scored, threshold)
    return {
      threshold,
      total: summarize(selected),
      bySplit: Object.fromEntries(['calibration', 'validation', 'holdout'].map((split) => [
        split,
        summarize(selected.filter((row) => row.split === split))
      ])),
      examples: {
        correct: selected.filter((row) => row.correct).slice(0, 10),
        wrong: selected.filter((row) => !row.correct).slice(0, 20)
      }
    }
  })
  const zeroWrongFull = runs.filter((run) => run.total.n > 0 && run.total.wrong === 0)
  const zeroWrongSafety = runs.filter((run) => (
    run.bySplit.calibration.wrong === 0 &&
    run.bySplit.validation.wrong === 0 &&
    run.bySplit.holdout.wrong === 0 &&
    run.total.n > 0
  ))
  const report = {
    generatedAt: new Date().toISOString(),
    rows: opts.rows,
    candidates: opts.candidates,
    debugRoot: opts.debugRoot,
    maxChangedSlots: opts.maxChangedSlots,
    slotRecordCount: slotRecords.length,
    candidateCount: candidateRows.length,
    blankCandidateCount: scored.length,
    missingTensor,
    scoreSpread: {
      correct: summarize(scored.filter((row) => row.correct)),
      wrong: summarize(scored.filter((row) => !row.correct))
    },
    runs,
    bestZeroWrongFull: zeroWrongFull.sort((a, b) => b.total.correct - a.total.correct)[0] || null,
    bestZeroWrongSafety: zeroWrongSafety.sort((a, b) => b.total.correct - a.total.correct)[0] || null,
    topCorrectScores: scored.filter((row) => row.correct).sort((a, b) => a.minBlankFilledScore - b.minBlankFilledScore).slice(0, 30),
    topWrongScores: scored.filter((row) => !row.correct).sort((a, b) => a.minBlankFilledScore - b.minBlankFilledScore).slice(0, 30)
  }
  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({
    out: opts.out,
    blankCandidateCount: report.blankCandidateCount,
    bestZeroWrongFull: report.bestZeroWrongFull && {
      threshold: report.bestZeroWrongFull.threshold,
      total: report.bestZeroWrongFull.total,
      bySplit: report.bestZeroWrongFull.bySplit
    },
    bestZeroWrongSafety: report.bestZeroWrongSafety && {
      threshold: report.bestZeroWrongSafety.threshold,
      total: report.bestZeroWrongSafety.total,
      bySplit: report.bestZeroWrongSafety.bySplit
    }
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
