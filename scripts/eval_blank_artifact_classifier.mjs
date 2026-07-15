#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_DEBUG_ROOT = 'private-evidence/debug-scans'

function parseArgs(argv) {
  const opts = {
    rows: DEFAULT_ROWS,
    truth: DEFAULT_TRUTH,
    debugRoot: DEFAULT_DEBUG_ROOT,
    out: 'private-evidence/reports/blank-artifact-classifier-20260708/summary.json',
    visualOnly: false,
    simulateReplayDirs: []
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--rows') opts.rows = argv[++i]
    else if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--debug-root') opts.debugRoot = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg === '--visual-only') opts.visualOnly = true
    else if (arg === '--simulate-replay') opts.simulateReplayDirs.push(argv[++i])
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function unwrapDebug(raw) {
  return raw?.debug && typeof raw.debug === 'object' ? raw.debug : raw
}

async function collectReplayFiles(entry) {
  const stat = await fs.stat(entry).catch(() => null)
  if (!stat) return []
  if (stat.isFile()) return entry.endsWith('-replay-result.json') ? [entry] : []
  if (!stat.isDirectory()) return []
  const out = []
  const names = await fs.readdir(entry, { withFileTypes: true })
  for (const name of names) {
    const child = path.join(entry, name.name)
    if (name.isDirectory()) out.push(...await collectReplayFiles(child))
    else if (name.isFile() && name.name.endsWith('-replay-result.json')) out.push(child)
  }
  return out
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

function captureIdFromReplay(result, file) {
  return result?.file || path.basename(file, '-replay-result.json')
}

function questionKey(captureId, label) {
  return `${String(captureId ?? '').trim()}::${String(label ?? '').trim()}`
}

function normalizeAnswer(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function slotName(slotCount, digitIndex) {
  if (slotCount <= 1) return 'single'
  if (digitIndex === 0) return 'left'
  if (digitIndex === slotCount - 1) return 'right'
  return `slot-${digitIndex + 1}`
}

function predictionDetailsForGroup(result, group) {
  const questionNum = Number(group?.label)
  return (result.predictionDetails || [])
    .filter((detail) => Number(detail.questionNum) === questionNum)
    .sort((a, b) => Number(a.digitIndex || 0) - Number(b.digitIndex || 0))
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
    (
      inkH <= 6 ||
      maxRowCount >= Math.max(9, Math.round(inkPixels * 0.42))
    )
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

function featureObject(row, quality, opts = {}) {
  const best = quality.best || {}
  const base = quality.base || {}
  const strict = quality.strict || {}
  const features = {
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
  if (!opts.visualOnly) {
    features.groupReview = Boolean(row.groupReview)
    features.detailReviewNeeded = Boolean(row.detailReviewNeeded)
    features.confidencePolicyCleared = Boolean(row.confidencePolicyCleared)
    features.layoutId = row.layoutId
    features.robustOverride = row.robustOverride || 'none'
    features.preprocessReviewReason = row.preprocessReviewReason || 'none'
  }
  return features
}

function oneHot(value, key) {
  return `${key}=${String(value ?? 'none')}`
}

function collectFeatureKeys(records, minCount = 5) {
  const numeric = new Set()
  const categoricalCounts = new Map()
  for (const record of records) {
    for (const [key, value] of Object.entries(record.features)) {
      if (typeof value === 'number' || typeof value === 'boolean') {
        numeric.add(key)
      } else {
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

function emptyAnswerBucket() {
  return {
    total: 0,
    auto: 0,
    autoCorrect: 0,
    autoWrong: 0,
    yellow: 0,
    yellowLeaningCorrect: 0,
    yellowLeaningWrong: 0
  }
}

function bumpAnswerBucket(bucket, predicted, truth, review) {
  const app = normalizeAnswer(predicted)
  const actual = normalizeAnswer(truth)
  bucket.total += 1
  if (review) {
    bucket.yellow += 1
    if (app === actual) bucket.yellowLeaningCorrect += 1
    else bucket.yellowLeaningWrong += 1
  } else {
    bucket.auto += 1
    if (app === actual) bucket.autoCorrect += 1
    else bucket.autoWrong += 1
  }
}

function addAnswerPercentages(bucket) {
  return {
    ...bucket,
    autoCoveragePct: bucket.total ? Number((bucket.auto / bucket.total * 100).toFixed(1)) : 0,
    autoAccuracyPct: bucket.auto ? Number((bucket.autoCorrect / bucket.auto * 100).toFixed(1)) : 0,
    yellowPct: bucket.total ? Number((bucket.yellow / bucket.total * 100).toFixed(1)) : 0,
    yellowLeaningCorrectPct: bucket.yellow ? Number((bucket.yellowLeaningCorrect / bucket.yellow * 100).toFixed(1)) : 0
  }
}

function scoreSplit(records, threshold) {
  const out = {
    total: records.length,
    filled: 0,
    blank: 0,
    predictedFilled: 0,
    predictedBlank: 0,
    trueFilled: 0,
    falseFilled: 0,
    trueBlank: 0,
    falseBlank: 0
  }
  const examples = { falseBlank: [], falseFilled: [], trueBlank: [] }
  for (const record of records) {
    const predictedFilled = record.score >= threshold
    if (record.label) out.filled += 1
    else out.blank += 1
    if (predictedFilled) out.predictedFilled += 1
    else out.predictedBlank += 1
    if (predictedFilled && record.label) out.trueFilled += 1
    else if (predictedFilled && !record.label) {
      out.falseFilled += 1
      if (examples.falseFilled.length < 12) examples.falseFilled.push(record.example)
    } else if (!predictedFilled && !record.label) {
      out.trueBlank += 1
      if (examples.trueBlank.length < 12) examples.trueBlank.push(record.example)
    } else if (!predictedFilled && record.label) {
      out.falseBlank += 1
      if (examples.falseBlank.length < 20) examples.falseBlank.push(record.example)
    }
  }
  return {
    ...out,
    accuracyPct: out.total ? Number(((out.trueFilled + out.trueBlank) / out.total * 100).toFixed(1)) : 0,
    filledRecallPct: out.filled ? Number((out.trueFilled / out.filled * 100).toFixed(1)) : 0,
    blankRecallPct: out.blank ? Number((out.trueBlank / out.blank * 100).toFixed(1)) : 0,
    predictedBlankPrecisionPct: out.predictedBlank ? Number((out.trueBlank / out.predictedBlank * 100).toFixed(1)) : 0,
    examples
  }
}

function auc(records) {
  const sorted = [...records].sort((a, b) => a.score - b.score)
  let rankSum = 0
  let pos = 0
  let neg = 0
  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].label) {
      pos += 1
      rankSum += i + 1
    } else {
      neg += 1
    }
  }
  if (!pos || !neg) return 0
  return Number(((rankSum - pos * (pos + 1) / 2) / (pos * neg)).toFixed(4))
}

async function simulateReplayPolicy({ opts, keys, fit, weights, threshold }) {
  if (!opts.simulateReplayDirs.length) return null
  const truth = await readJson(opts.truth)
  const truthEntries = (truth.entries || []).filter((entry) => entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label')
  const truthByQuestion = new Map(truthEntries.map((entry) => [questionKey(entry.captureId, entry.questionLabel), entry]))
  const rowSplit = new Map()
  for (const row of await readJson(opts.rows)) {
    const key = questionKey(row.captureId, row.questionLabel)
    if (row.split && !rowSplit.has(key)) rowSplit.set(key, row.split)
  }
  const debugFiles = await collectDebugFiles(opts.debugRoot)
  const debugByCapture = new Map(debugFiles.map((file) => [path.basename(path.dirname(file)), file]))
  const replayFiles = (await Promise.all(opts.simulateReplayDirs.map(collectReplayFiles))).flat().sort()
  const debugCache = new Map()

  const baseline = emptyAnswerBucket()
  const demotion = emptyAnswerBucket()
  const autoBlank = emptyAnswerBucket()
  const suggestion = {
    reviewGroups: 0,
    suggested: 0,
    correct: 0,
    wrong: 0,
    rescued: 0,
    harmedCurrentCorrect: 0,
    items: [],
    examples: { correct: [], wrong: [], demoted: [], autoBlankWrong: [] }
  }
  const bySplit = new Map()
  const splitBucket = (split) => {
    if (!bySplit.has(split)) {
      bySplit.set(split, {
        baseline: emptyAnswerBucket(),
        demotion: emptyAnswerBucket(),
        autoBlank: emptyAnswerBucket(),
        suggestion: { reviewGroups: 0, suggested: 0, correct: 0, wrong: 0, rescued: 0, harmedCurrentCorrect: 0 }
      })
    }
    return bySplit.get(split)
  }

  let matchedGroups = 0
  let slotsWithDebug = 0
  let classifierBlankSlots = 0
  let classifierBlankNonBlankCurrentSlots = 0

  for (const replayFile of replayFiles) {
    const result = await readJson(replayFile)
    const captureId = captureIdFromReplay(result, replayFile)
    const debugFile = debugByCapture.get(captureId)
    let tensorById = new Map()
    if (debugFile) {
      if (!debugCache.has(debugFile)) debugCache.set(debugFile, unwrapDebug(await readJson(debugFile)))
      const debug = debugCache.get(debugFile)
      tensorById = new Map((debug?.tensors || []).map((item) => [Number(item.id), item]))
    }
    for (const group of result.groups || []) {
      const key = questionKey(captureId, group.label)
      const entry = truthByQuestion.get(key)
      if (!entry) continue
      matchedGroups += 1
      const split = rowSplit.get(key) || 'unknown'
      const splitStats = splitBucket(split)
      const truthText = normalizeAnswer(entry.truth)
      const baselinePredicted = normalizeAnswer(group.predicted)
      const baselineReview = Boolean(group.review)
      bumpAnswerBucket(baseline, baselinePredicted, truthText, baselineReview)
      bumpAnswerBucket(splitStats.baseline, baselinePredicted, truthText, baselineReview)
      if (baselineReview) {
        suggestion.reviewGroups += 1
        splitStats.suggestion.reviewGroups += 1
      }

      const details = predictionDetailsForGroup(result, group)
      const cells = []
      const blankScores = []
      let anyClassifierBlank = false
      let anyClassifierBlankedNonBlankCurrent = false
      for (const detail of details) {
        const tensorItem = tensorById.get(Number(detail.id))
        const currentCell = detail?.blank || detail?.empty ? '_' : String(detail?.digit ?? '_')
        let filledScore = 1
        if (tensorItem) {
          slotsWithDebug += 1
          const quality = summarizeTensorItem(tensorItem)
          const pseudoRow = {
            detailConfidence: detail.confidence,
            detailTopGap: detail.topGap,
            digitIndex: detail.digitIndex,
            slotCount: details.length,
            expected: group.expected,
            family: layoutFamily(entry.layoutId),
            slotName: slotName(details.length, Number(detail.digitIndex) || 0),
            detailDigit: detail.digit
          }
          const record = { features: featureObject(pseudoRow, quality, { visualOnly: true }), label: true }
          filledScore = scoreRecords([record], keys, fit, weights)[0] || 0
        }
        const predictedBlank = filledScore < threshold
        blankScores.push(Number(filledScore.toFixed(4)))
        if (predictedBlank) {
          anyClassifierBlank = true
          classifierBlankSlots += 1
          if (currentCell !== '_') {
            anyClassifierBlankedNonBlankCurrent = true
            classifierBlankNonBlankCurrentSlots += 1
          }
          cells.push('_')
        } else {
          cells.push(currentCell)
        }
      }
      const blankedPredicted = normalizeAnswer(cells.join(''))
      const demotionReview = baselineReview || anyClassifierBlankedNonBlankCurrent
      bumpAnswerBucket(demotion, baselinePredicted, truthText, demotionReview)
      bumpAnswerBucket(splitStats.demotion, baselinePredicted, truthText, demotionReview)
      bumpAnswerBucket(autoBlank, blankedPredicted, truthText, baselineReview)
      bumpAnswerBucket(splitStats.autoBlank, blankedPredicted, truthText, baselineReview)

      const example = {
        captureId,
        layoutId: entry.layoutId,
        split,
        questionLabel: entry.questionLabel,
        expected: entry.expected,
        truth: entry.truth,
        baselinePredicted,
        baselineReview,
        blankedPredicted,
        demotionReview,
        blankScores,
        replayFile
      }
      if (!baselineReview && demotionReview && suggestion.examples.demoted.length < 20) {
        suggestion.examples.demoted.push(example)
      }
      if (baselineReview && blankedPredicted && blankedPredicted !== baselinePredicted) {
        suggestion.suggested += 1
        splitStats.suggestion.suggested += 1
        const ok = blankedPredicted === truthText
        const suggestionItem = {
          ...example,
          correct: ok,
          rescued: ok && baselinePredicted !== truthText,
          harmedCurrentCorrect: !ok && baselinePredicted === truthText
        }
        suggestion.items.push(suggestionItem)
        if (ok) {
          suggestion.correct += 1
          splitStats.suggestion.correct += 1
          if (baselinePredicted !== truthText) {
            suggestion.rescued += 1
            splitStats.suggestion.rescued += 1
          }
          if (suggestion.examples.correct.length < 20) suggestion.examples.correct.push(example)
        } else {
          suggestion.wrong += 1
          splitStats.suggestion.wrong += 1
          if (baselinePredicted === truthText) {
            suggestion.harmedCurrentCorrect += 1
            splitStats.suggestion.harmedCurrentCorrect += 1
          }
          if (suggestion.examples.wrong.length < 30) suggestion.examples.wrong.push(example)
        }
      }
      if (!baselineReview && blankedPredicted !== truthText && suggestion.examples.autoBlankWrong.length < 20) {
        suggestion.examples.autoBlankWrong.push(example)
      }
    }
  }

  return {
    replayDirs: opts.simulateReplayDirs,
    replayFileCount: replayFiles.length,
    matchedGroups,
    slotsWithDebug,
    classifierBlankSlots,
    classifierBlankNonBlankCurrentSlots,
    threshold,
    baseline: addAnswerPercentages(baseline),
    demotion: addAnswerPercentages(demotion),
    autoBlank: addAnswerPercentages(autoBlank),
    suggestion: {
      ...suggestion,
      accuracyPct: suggestion.suggested ? Number((suggestion.correct / suggestion.suggested * 100).toFixed(1)) : 0,
      rescuePct: suggestion.reviewGroups ? Number((suggestion.rescued / suggestion.reviewGroups * 100).toFixed(1)) : 0
    },
    bySplit: Object.fromEntries([...bySplit.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([split, value]) => [
      split,
      {
        baseline: addAnswerPercentages(value.baseline),
        demotion: addAnswerPercentages(value.demotion),
        autoBlank: addAnswerPercentages(value.autoBlank),
        suggestion: {
          ...value.suggestion,
          accuracyPct: value.suggestion.suggested ? Number((value.suggestion.correct / value.suggestion.suggested * 100).toFixed(1)) : 0
        }
      }
    ]))
  }
}

async function loadRecords(rowsPath, opts) {
  const rows = await readJson(rowsPath)
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
      key: `${row.captureId}::${row.questionLabel}::${row.digitIndex}`,
      split: row.split,
      label: row.truthBlank !== true,
      row,
      quality,
      features: featureObject(row, quality, opts),
      example: {
        uid: row.uid,
        captureId: row.captureId,
        layoutId: row.layoutId,
        family: row.family,
        questionLabel: row.questionLabel,
        digitIndex: row.digitIndex,
        slotName: row.slotName,
        truth: row.truth,
        truthDigit: row.truthDigit,
        truthBlank: row.truthBlank,
        detailDigit: row.detailDigit,
        detailConfidence: row.detailConfidence,
        detailTopGap: row.detailTopGap,
        groupPredicted: row.groupPredicted,
        groupReview: row.groupReview,
        preprocessReviewReason: row.preprocessReviewReason,
        robustOverride: row.robustOverride,
        quality: {
          usableVariantRatio: quality.usableVariantRatio,
          artifactVariantRatio: quality.artifactVariantRatio,
          weakVariantRatio: quality.weakVariantRatio,
          best: quality.best
        }
      }
    })
  }
  return records
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const records = await loadRecords(opts.rows, opts)
  const train = records.filter((record) => record.split === 'calibration')
  const keys = collectFeatureKeys(train)
  const trainVector = vectorize(train, keys)
  const l2s = [0, 0.0003, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3]
  const thresholds = [0.02, 0.04, 0.06, 0.08, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.97, 0.99]
  const runs = []
  for (const l2 of l2s) {
    const weights = trainLogistic(trainVector.x, trainVector.y, { l2 })
    const scored = []
    for (const split of ['calibration', 'validation', 'holdout']) {
      const splitRecords = records.filter((record) => record.split === split)
      const scores = scoreRecords(splitRecords, keys, trainVector.fit, weights)
      scored.push(...splitRecords.map((record, index) => ({ ...record, score: scores[index] })))
    }
    for (const threshold of thresholds) {
      runs.push({
        l2,
        threshold,
        calibration: scoreSplit(scored.filter((record) => record.split === 'calibration'), threshold),
        validation: scoreSplit(scored.filter((record) => record.split === 'validation'), threshold),
        holdout: scoreSplit(scored.filter((record) => record.split === 'holdout'), threshold)
      })
    }
  }
  const bestCalibrationNoFalseBlank = runs
    .filter((run) => run.calibration.falseBlank === 0 && run.calibration.trueBlank > 0)
    .sort((a, b) =>
      b.calibration.trueBlank - a.calibration.trueBlank ||
      a.validation.falseBlank - b.validation.falseBlank ||
      b.validation.trueBlank - a.validation.trueBlank ||
      a.holdout.falseBlank - b.holdout.falseBlank ||
      b.holdout.trueBlank - a.holdout.trueBlank
    )
    .slice(0, 20)
  const bestValidationNoFalseBlank = runs
    .filter((run) => run.validation.falseBlank === 0 && run.validation.trueBlank > 0)
    .sort((a, b) =>
      b.validation.trueBlank - a.validation.trueBlank ||
      a.holdout.falseBlank - b.holdout.falseBlank ||
      b.holdout.trueBlank - a.holdout.trueBlank
    )
    .slice(0, 20)
  const splitCounts = Object.fromEntries(['calibration', 'validation', 'holdout'].map((split) => {
    const splitRecords = records.filter((record) => record.split === split)
    return [split, {
      total: splitRecords.length,
      filled: splitRecords.filter((record) => record.label).length,
      blank: splitRecords.filter((record) => !record.label).length
    }]
  }))
  const report = {
    generatedAt: new Date().toISOString(),
    rows: opts.rows,
    truth: opts.truth,
    debugRoot: opts.debugRoot,
    visualOnly: opts.visualOnly,
    recordCount: records.length,
    splitCounts,
    featureCounts: { numeric: keys.numeric.length, categorical: keys.categorical.length },
    aucBySplit: Object.fromEntries(['calibration', 'validation', 'holdout'].map((split) => {
      const previewRun = runs.find((run) => run.l2 === 0.03)
      if (!previewRun) return [split, 0]
      return [split, null]
    })),
    bestCalibrationNoFalseBlank,
    bestValidationNoFalseBlank,
    compactRuns: runs.map((run) => ({
      l2: run.l2,
      threshold: run.threshold,
      calibration: {
        trueBlank: run.calibration.trueBlank,
        falseBlank: run.calibration.falseBlank,
        predictedBlankPrecisionPct: run.calibration.predictedBlankPrecisionPct,
        blankRecallPct: run.calibration.blankRecallPct,
        filledRecallPct: run.calibration.filledRecallPct
      },
      validation: {
        trueBlank: run.validation.trueBlank,
        falseBlank: run.validation.falseBlank,
        predictedBlankPrecisionPct: run.validation.predictedBlankPrecisionPct,
        blankRecallPct: run.validation.blankRecallPct,
        filledRecallPct: run.validation.filledRecallPct
      },
      holdout: {
        trueBlank: run.holdout.trueBlank,
        falseBlank: run.holdout.falseBlank,
        predictedBlankPrecisionPct: run.holdout.predictedBlankPrecisionPct,
        blankRecallPct: run.holdout.blankRecallPct,
        filledRecallPct: run.holdout.filledRecallPct
      }
    }))
  }

  // Recompute AUC from a representative regularization level for quick model-quality orientation.
  const weights = trainLogistic(trainVector.x, trainVector.y, { l2: 0.03 })
  const scoredForAuc = []
  for (const split of ['calibration', 'validation', 'holdout']) {
    const splitRecords = records.filter((record) => record.split === split)
    const scores = scoreRecords(splitRecords, keys, trainVector.fit, weights)
    scoredForAuc.push(...splitRecords.map((record, index) => ({ ...record, score: scores[index] })))
  }
  report.aucBySplit = Object.fromEntries(['calibration', 'validation', 'holdout'].map((split) => [
    split,
    auc(scoredForAuc.filter((record) => record.split === split))
  ]))

  const simulationGate = bestCalibrationNoFalseBlank[0] || null
  if (simulationGate) {
    const simWeights = trainLogistic(trainVector.x, trainVector.y, { l2: simulationGate.l2 })
    report.replaySimulation = await simulateReplayPolicy({
      opts,
      keys,
      fit: trainVector.fit,
      weights: simWeights,
      threshold: simulationGate.threshold
    })
  }

  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  const best = bestCalibrationNoFalseBlank[0] || null
  console.log(JSON.stringify({
    out: opts.out,
    visualOnly: opts.visualOnly,
    recordCount: report.recordCount,
    splitCounts: report.splitCounts,
    featureCounts: report.featureCounts,
    aucBySplit: report.aucBySplit,
    bestCalibrationNoFalseBlank: best && {
      l2: best.l2,
      threshold: best.threshold,
      calibration: {
        trueBlank: best.calibration.trueBlank,
        falseBlank: best.calibration.falseBlank,
        blankRecallPct: best.calibration.blankRecallPct,
        filledRecallPct: best.calibration.filledRecallPct
      },
      validation: {
        trueBlank: best.validation.trueBlank,
        falseBlank: best.validation.falseBlank,
        blankRecallPct: best.validation.blankRecallPct,
        filledRecallPct: best.validation.filledRecallPct
      },
      holdout: {
        trueBlank: best.holdout.trueBlank,
        falseBlank: best.holdout.falseBlank,
        blankRecallPct: best.holdout.blankRecallPct,
        filledRecallPct: best.holdout.filledRecallPct
      }
    },
    replaySimulation: report.replaySimulation && {
      matchedGroups: report.replaySimulation.matchedGroups,
      classifierBlankSlots: report.replaySimulation.classifierBlankSlots,
      baseline: report.replaySimulation.baseline,
      demotion: report.replaySimulation.demotion,
      autoBlank: report.replaySimulation.autoBlank,
      suggestion: {
        suggested: report.replaySimulation.suggestion.suggested,
        correct: report.replaySimulation.suggestion.correct,
        wrong: report.replaySimulation.suggestion.wrong,
        rescued: report.replaySimulation.suggestion.rescued,
        harmedCurrentCorrect: report.replaySimulation.suggestion.harmedCurrentCorrect,
        accuracyPct: report.replaySimulation.suggestion.accuracyPct
      }
    },
    validationNoFalseBlankTop: bestValidationNoFalseBlank.slice(0, 5).map((run) => ({
      l2: run.l2,
      threshold: run.threshold,
      validation: {
        trueBlank: run.validation.trueBlank,
        falseBlank: run.validation.falseBlank,
        blankRecallPct: run.validation.blankRecallPct,
        filledRecallPct: run.validation.filledRecallPct
      },
      holdout: {
        trueBlank: run.holdout.trueBlank,
        falseBlank: run.holdout.falseBlank,
        blankRecallPct: run.holdout.blankRecallPct,
        filledRecallPct: run.holdout.filledRecallPct
      }
    }))
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
