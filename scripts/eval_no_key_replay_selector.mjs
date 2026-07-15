#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const DEFAULT_DEBUG_ROOT = 'private-evidence/debug-scans'

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    rows: DEFAULT_ROWS,
    debugRoot: DEFAULT_DEBUG_ROOT,
    out: null,
    seed: 137,
    layoutFeatures: false,
    qualityFeatures: false,
    dirs: []
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--rows') opts.rows = argv[++i]
    else if (arg === '--debug-root') opts.debugRoot = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg === '--seed') opts.seed = Number(argv[++i])
    else if (arg === '--layout-features') opts.layoutFeatures = true
    else if (arg === '--quality-features') opts.qualityFeatures = true
    else opts.dirs.push(arg)
  }
  if (!opts.dirs.length) {
    throw new Error('Usage: node scripts/eval_no_key_replay_selector.mjs [--layout-features] [--out file] <replay-dir>...')
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
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

function normalizeAnswer(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

function normalizeDigit(value) {
  if (value === null || value === undefined || value === '' || value === '_') return null
  const digit = Number(value)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined
}

function cellsToText(cells) {
  const text = cells.map((cell) => (cell === null || cell === undefined ? '_' : String(cell))).join('')
  return text.replace(/_/g, '').replace(/^0+(?=\d)/, '')
}

function questionKey(captureId, label) {
  return `${String(captureId ?? '').trim()}::${String(label ?? '').trim()}`
}

function captureIdFromReplay(result, file) {
  return result?.file || path.basename(file, '-replay-result.json')
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function tensorInkQuality(tensor) {
  const values = tensor && typeof tensor.length === 'number' ? tensor : []
  const binary = Array(28 * 28).fill(false)
  let inkPixels = 0
  let minX = 28
  let minY = 28
  let maxX = -1
  let maxY = -1
  const rowCounts = Array(28).fill(0)
  const colCounts = Array(28).fill(0)
  let centerInkPixels = 0
  for (let i = 0; i < Math.min(values.length, 28 * 28); i += 1) {
    const value = Number(values[i]) || 0
    if (value <= 0.16) continue
    const y = Math.floor(i / 28)
    const x = i - y * 28
    binary[i] = true
    inkPixels += 1
    rowCounts[y] += 1
    colCounts[x] += 1
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
  const centerInkRatio = inkPixels ? centerInkPixels / inkPixels : 0

  const visited = Array(28 * 28).fill(false)
  const components = []
  const stack = []
  for (let i = 0; i < binary.length; i += 1) {
    if (!binary[i] || visited[i]) continue
    let count = 0
    stack.push(i)
    visited[i] = true
    while (stack.length) {
      const current = stack.pop()
      count += 1
      const y = Math.floor(current / 28)
      const x = current - y * 28
      for (const next of [current - 1, current + 1, current - 28, current + 28]) {
        if (next < 0 || next >= binary.length || visited[next] || !binary[next]) continue
        const ny = Math.floor(next / 28)
        const nx = next - ny * 28
        if (Math.abs(nx - x) + Math.abs(ny - y) !== 1) continue
        visited[next] = true
        stack.push(next)
      }
    }
    components.push(count)
  }
  components.sort((a, b) => b - a)
  const componentCount = components.length
  const largestComponentRatio = inkPixels ? (components[0] || 0) / inkPixels : 0
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
    density <= 0.72
  const fragmentedArtifactLikely =
    inkPixels >= 8 &&
    componentCount >= 4 &&
    largestComponentRatio <= 0.68
  const ok =
    inkPixels >= 14 &&
    inkW >= 3 &&
    inkH >= 8 &&
    largestComponentRatio >= 0.48 &&
    !horizontalArtifactLikely
  return {
    inkPixels,
    inkW,
    inkH,
    density,
    maxRowCount,
    maxColCount,
    centerInkRatio,
    componentCount,
    largestComponentRatio,
    horizontalArtifactLikely,
    verticalArtifactLikely,
    fragmentedArtifactLikely,
    lineArtifactLikely: horizontalArtifactLikely || verticalArtifactLikely || fragmentedArtifactLikely,
    ok
  }
}

function tensorQualityScore(quality) {
  if (!quality) return -Infinity
  let score = 0
  if (quality.ok) score += 1000
  if (!quality.lineArtifactLikely) score += 200
  if (quality.horizontalArtifactLikely) score -= 220
  if (quality.verticalArtifactLikely) score -= 120
  if (quality.fragmentedArtifactLikely) score -= 100
  score += Math.min(quality.inkPixels || 0, 120)
  score += Math.min(quality.inkW || 0, 20) * 4
  score += Math.min(quality.inkH || 0, 24) * 4
  score += Math.round((quality.largestComponentRatio || 0) * 80)
  score += Math.round((quality.centerInkRatio || 0) * 35)
  score -= Math.max(0, (quality.componentCount || 0) - 2) * 12
  return score
}

function summarizeTensorItem(item) {
  const candidates = [
    { name: 'base', tensor: item?.tensor },
    ...(Array.isArray(item?.tensorVariants) ? item.tensorVariants : [])
  ].filter((candidate) => candidate?.tensor)
  const variantQualities = candidates.map((candidate) => ({
    name: candidate.name || 'variant',
    ...tensorInkQuality(candidate.tensor)
  }))
  let bestQuality = null
  for (const quality of variantQualities) {
    if (!bestQuality || tensorQualityScore(quality) > tensorQualityScore(bestQuality)) bestQuality = quality
  }
  const summaryQualities = variantQualities.some((quality) => quality.name !== 'base')
    ? variantQualities.filter((quality) => quality.name !== 'base')
    : variantQualities
  const variantCount = summaryQualities.length
  const usableVariantCount = summaryQualities.filter((quality) => (
    quality.ok &&
    !quality.lineArtifactLikely &&
    (quality.inkPixels || 0) >= 14 &&
    (quality.inkH || 0) >= 7
  )).length
  const artifactVariantCount = summaryQualities.filter((quality) => quality.lineArtifactLikely).length
  const weakVariantCount = summaryQualities.filter((quality) => (
    !quality.ok ||
    (quality.inkPixels || 0) < 12 ||
    (quality.inkH || 0) < 6 ||
    quality.lineArtifactLikely
  )).length
  return {
    id: item?.id,
    digitIndex: item?.digitIndex,
    variantCount,
    usableVariantCount,
    artifactVariantCount,
    weakVariantCount,
    usableVariantRatio: variantCount ? usableVariantCount / variantCount : 0,
    artifactVariantRatio: variantCount ? artifactVariantCount / variantCount : 0,
    weakVariantRatio: variantCount ? weakVariantCount / variantCount : 0,
    allVariantsWeak: variantCount > 0 && usableVariantCount === 0,
    bestQuality: bestQuality || {}
  }
}

function predictionDetailsForGroup(result, group) {
  const questionNum = Number(group?.label)
  return (result.predictionDetails || [])
    .filter((detail) => Number(detail.questionNum) === questionNum)
    .sort((a, b) => Number(a.digitIndex || 0) - Number(b.digitIndex || 0))
}

function addEvidence(map, digit, reason, confidence, topGap = 0) {
  const normalized = normalizeDigit(digit)
  if (normalized === null || normalized === undefined) return
  const score = Math.max(0, Math.min(1, Number(confidence) || 0))
  if (score <= 0) return
  if (!map.has(normalized)) {
    map.set(normalized, {
      digit: normalized,
      maxConfidence: 0,
      maxTopGap: 0,
      variantTop1Count: 0,
      topKCount: 0,
      modelTopKCount: 0,
      reasons: new Set()
    })
  }
  const item = map.get(normalized)
  item.maxConfidence = Math.max(item.maxConfidence, score)
  item.maxTopGap = Math.max(item.maxTopGap, Number(topGap) || 0)
  item.reasons.add(reason)
  if (reason.startsWith('variant:')) item.variantTop1Count += 1
  if (reason.includes('topk')) item.topKCount += 1
  if (reason === 'model-topk') item.modelTopKCount += 1
}

function slotAlternatives(prediction) {
  const current = normalizeDigit(prediction?.blank || prediction?.empty ? null : prediction?.digit)
  const byDigit = new Map()
  if (current !== null && current !== undefined) {
    addEvidence(byDigit, current, 'current-read', prediction.confidence || 0.2, prediction.topGap || 0)
  }
  for (const item of prediction?.topK || []) {
    addEvidence(byDigit, item?.digit, 'model-topk', item?.confidence || 0.01)
  }
  for (const variant of prediction?.preprocessVariants || []) {
    addEvidence(
      byDigit,
      variant?.digit,
      `variant:${variant?.name || 'unnamed'}`,
      variant?.confidence || variant?.topGap || 0.01,
      variant?.topGap || 0
    )
    for (const item of variant?.topK || []) {
      addEvidence(byDigit, item?.digit, `variant-topk:${variant?.name || 'unnamed'}`, item?.confidence || 0.01)
    }
  }
  return [...byDigit.values()]
    .filter((candidate) => candidate.digit !== current)
    .map((candidate) => ({
      ...candidate,
      reasons: [...candidate.reasons].sort()
    }))
    .sort((a, b) =>
      b.maxConfidence - a.maxConfidence ||
      b.variantTop1Count - a.variantTop1Count ||
      b.topKCount - a.topKCount
    )
    .slice(0, 3)
}

function candidateAnswers(details) {
  const currentCells = details.map((detail) => normalizeDigit(detail.blank || detail.empty ? null : detail.digit))
  const currentText = cellsToText(currentCells)
  const perSlot = details.map(slotAlternatives)
  const out = []
  const visit = (index, cells, changes) => {
    if (index >= details.length) {
      if (!changes.length) return
      const text = cellsToText(cells)
      if (!text || text === currentText) return
      const confidences = changes.map((change) => change.maxConfidence)
      const topGaps = changes.map((change) => change.maxTopGap)
      const variantCounts = changes.map((change) => change.variantTop1Count)
      const topKCounts = changes.map((change) => change.topKCount)
      out.push({
        text,
        currentText,
        cells,
        changedSlots: changes.length,
        minConfidence: Math.min(...confidences),
        maxConfidence: Math.max(...confidences),
        avgConfidence: confidences.reduce((sum, n) => sum + n, 0) / confidences.length,
        minTopGap: Math.min(...topGaps),
        maxTopGap: Math.max(...topGaps),
        minVariantTop1Count: Math.min(...variantCounts),
        sumVariantTop1Count: variantCounts.reduce((sum, n) => sum + n, 0),
        minTopKCount: Math.min(...topKCounts),
        sumTopKCount: topKCounts.reduce((sum, n) => sum + n, 0),
        allHaveVariantTop1: changes.every((change) => change.variantTop1Count > 0),
        allHaveTopK: changes.every((change) => change.topKCount > 0),
        changedSlotPattern: changes.map((change) => `${change.slotIndex}:${change.from}->${change.to}`).join('|'),
        changedDigitPattern: changes.map((change) => `${change.from}->${change.to}`).join('|'),
        changes
      })
      return
    }
    visit(index + 1, cells.concat([currentCells[index]]), changes)
    for (const candidate of perSlot[index]) {
      visit(index + 1, cells.concat([candidate.digit]), changes.concat([{
        slotIndex: index,
        from: currentCells[index],
        to: candidate.digit,
        ...candidate
      }]))
    }
  }
  visit(0, [], [])
  return out.sort((a, b) =>
    b.minConfidence - a.minConfidence ||
    b.sumVariantTop1Count - a.sumVariantTop1Count ||
    a.changedSlots - b.changedSlots
  )
}

function buildFeatures(item, candidate, opts) {
  const currentLength = item.current.length
  const candidateLength = candidate.text.length
  const changedFromOne = candidate.changes.some((change) => change.from === 1)
  const changedToOne = candidate.changes.some((change) => change.to === 1)
  const changedFromSevenNine = candidate.changes.some((change) => change.from === 7 || change.from === 9)
  const changedToSevenNine = candidate.changes.some((change) => change.to === 7 || change.to === 9)
  const allVariantNames = new Set()
  const changedSlotQualities = []
  for (const change of candidate.changes) {
    for (const reason of change.reasons || []) {
      if (reason.startsWith('variant:') || reason.startsWith('variant-topk:')) {
        allVariantNames.add(reason.split(':')[1] || 'unnamed')
      }
    }
    const quality = item.slotQualities?.[change.slotIndex]
    if (quality) changedSlotQualities.push(quality)
  }
  const features = {
    bias: 1,
    minConfidence: candidate.minConfidence,
    maxConfidence: candidate.maxConfidence,
    avgConfidence: candidate.avgConfidence,
    minConfidenceSq: candidate.minConfidence * candidate.minConfidence,
    minTopGap: candidate.minTopGap,
    maxTopGap: candidate.maxTopGap,
    changedSlots: candidate.changedSlots,
    oneChangedSlot: candidate.changedSlots === 1,
    twoChangedSlots: candidate.changedSlots === 2,
    minVariantTop1Count: candidate.minVariantTop1Count,
    sumVariantTop1Count: candidate.sumVariantTop1Count,
    minTopKCount: candidate.minTopKCount,
    sumTopKCount: candidate.sumTopKCount,
    allHaveVariantTop1: candidate.allHaveVariantTop1,
    allHaveTopK: candidate.allHaveTopK,
    currentLength,
    candidateLength,
    lengthDelta: candidateLength - currentLength,
    family: item.family,
    slotCount: String(item.slotCount),
    changedSlotPattern: candidate.changedSlotPattern,
    changedDigitPattern: candidate.changedDigitPattern,
    changedFromOne,
    changedToOne,
    changedFromSevenNine,
    changedToSevenNine,
    variantNameCount: allVariantNames.size
  }
  if (opts.qualityFeatures) {
    const count = Math.max(1, changedSlotQualities.length)
    const bestQualities = changedSlotQualities.map((quality) => quality.bestQuality || {})
    features.qualitySlotCount = changedSlotQualities.length
    features.qualityMinUsableVariantRatio = changedSlotQualities.length ? Math.min(...changedSlotQualities.map((quality) => quality.usableVariantRatio || 0)) : 0
    features.qualityAvgUsableVariantRatio = changedSlotQualities.reduce((sum, quality) => sum + (quality.usableVariantRatio || 0), 0) / count
    features.qualityMaxArtifactVariantRatio = changedSlotQualities.length ? Math.max(...changedSlotQualities.map((quality) => quality.artifactVariantRatio || 0)) : 0
    features.qualityAvgArtifactVariantRatio = changedSlotQualities.reduce((sum, quality) => sum + (quality.artifactVariantRatio || 0), 0) / count
    features.qualityMaxWeakVariantRatio = changedSlotQualities.length ? Math.max(...changedSlotQualities.map((quality) => quality.weakVariantRatio || 0)) : 0
    features.qualityAvgWeakVariantRatio = changedSlotQualities.reduce((sum, quality) => sum + (quality.weakVariantRatio || 0), 0) / count
    features.qualityAllChangedSlotsHaveUsableVariant = changedSlotQualities.length > 0 && changedSlotQualities.every((quality) => (quality.usableVariantCount || 0) > 0)
    features.qualityAnyChangedSlotAllWeak = changedSlotQualities.some((quality) => quality.allVariantsWeak)
    features.qualityAllChangedSlotsAllWeak = changedSlotQualities.length > 0 && changedSlotQualities.every((quality) => quality.allVariantsWeak)
    features.qualityAvgBestInkPixels = bestQualities.reduce((sum, quality) => sum + (quality.inkPixels || 0), 0) / count
    features.qualityAvgBestInkW = bestQualities.reduce((sum, quality) => sum + (quality.inkW || 0), 0) / count
    features.qualityAvgBestInkH = bestQualities.reduce((sum, quality) => sum + (quality.inkH || 0), 0) / count
    features.qualityAvgBestComponentCount = bestQualities.reduce((sum, quality) => sum + (quality.componentCount || 0), 0) / count
    features.qualityAvgBestLargestComponentRatio = bestQualities.reduce((sum, quality) => sum + (quality.largestComponentRatio || 0), 0) / count
    features.qualityAnyBestLineArtifact = bestQualities.some((quality) => quality.lineArtifactLikely)
    features.qualityAnyBestFragmentedArtifact = bestQualities.some((quality) => quality.fragmentedArtifactLikely)
  }
  if (opts.layoutFeatures) features.layoutId = item.layoutId
  return features
}

function oneHot(value, key) {
  return `${key}=${String(value ?? 'none')}`
}

function collectFeatureKeys(records, minCount = 3) {
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
    y: records.map((record) => record.correct ? 1 : 0),
    fit: { mean, std }
  }
}

function sigmoid(value) {
  const x = Math.max(-40, Math.min(40, value))
  return 1 / (1 + Math.exp(-x))
}

function trainLogistic(x, y, { l2 = 0.01, epochs = 1000, lr = 0.08 } = {}) {
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

function attachScores(items, records, scores) {
  const byKey = new Map()
  records.forEach((record, index) => {
    byKey.set(`${record.itemKey}::${record.candidateIndex}`, scores[index])
  })
  return items.map((item) => ({
    ...item,
    scoredCandidates: item.candidates.map((candidate, index) => ({
      ...candidate,
      modelScore: byKey.get(`${item.key}::${index}`) || 0
    })).sort((a, b) => b.modelScore - a.modelScore)
  }))
}

function emptyScore() {
  return {
    reviewGroups: 0,
    reviewWrongLeans: 0,
    suggested: 0,
    correct: 0,
    wrong: 0,
    rescued: 0,
    harmedCurrentCorrect: 0
  }
}

function scoreItems(items, gate) {
  const score = emptyScore()
  const examples = { correct: [], wrong: [] }
  for (const item of items) {
    if (!item.review) continue
    score.reviewGroups += 1
    if (!item.currentCorrect) score.reviewWrongLeans += 1
    const candidate = item.scoredCandidates.find((entry) =>
      entry.modelScore >= gate.minScore &&
      entry.minConfidence >= gate.minConfidence &&
      entry.changedSlots <= gate.maxChangedSlots
    )
    if (!candidate) continue
    score.suggested += 1
    const ok = candidate.text === item.truth
    if (ok) {
      score.correct += 1
      if (!item.currentCorrect) score.rescued += 1
      if (examples.correct.length < 12) examples.correct.push({ ...item, candidate })
    } else {
      score.wrong += 1
      if (item.currentCorrect) score.harmedCurrentCorrect += 1
      if (examples.wrong.length < 20) examples.wrong.push({ ...item, candidate })
    }
  }
  return {
    ...score,
    accuracyPct: score.suggested ? Number((score.correct / score.suggested * 100).toFixed(1)) : 0,
    rescuePct: score.reviewWrongLeans ? Number((score.rescued / score.reviewWrongLeans * 100).toFixed(1)) : 0,
    suggestionCoveragePct: score.reviewGroups ? Number((score.suggested / score.reviewGroups * 100).toFixed(1)) : 0,
    examples
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const truth = await readJson(opts.truth)
  const rows = await readJson(opts.rows)
  const truthEntries = (truth.entries || [])
    .filter((entry) => entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label')
  const truthByQuestion = new Map(truthEntries.map((entry) => [
    questionKey(entry.captureId, entry.questionLabel),
    entry
  ]))
  const splitByQuestion = new Map()
  for (const row of rows) {
    const key = questionKey(row.captureId, row.questionLabel)
    if (row.split && !splitByQuestion.has(key)) splitByQuestion.set(key, row.split)
  }
  const debugByCapture = new Map()
  const debugCache = new Map()
  if (opts.qualityFeatures) {
    const debugFiles = await collectDebugFiles(opts.debugRoot)
    for (const file of debugFiles) debugByCapture.set(path.basename(path.dirname(file)), file)
  }
  const replayFiles = (await Promise.all(opts.dirs.map(collectReplayFiles))).flat().sort()
  const items = []

  for (const file of replayFiles) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    let tensorQualityById = new Map()
    if (opts.qualityFeatures) {
      const debugFile = debugByCapture.get(captureId)
      if (debugFile) {
        if (!debugCache.has(debugFile)) {
          const wrapped = await readJson(debugFile)
          debugCache.set(debugFile, wrapped.debug || wrapped)
        }
        const debug = debugCache.get(debugFile)
        tensorQualityById = new Map((debug?.tensors || []).map((item) => [Number(item.id), summarizeTensorItem(item)]))
      }
    }
    for (const group of result.groups || []) {
      const key = questionKey(captureId, group.label)
      const truthEntry = truthByQuestion.get(key)
      const split = splitByQuestion.get(key)
      if (!truthEntry || !split) continue
      const details = predictionDetailsForGroup(result, group)
      if (!details.length) continue
      const current = normalizeAnswer(group.predicted)
      const truthText = normalizeAnswer(truthEntry.truth)
      const candidates = candidateAnswers(details)
      const slotQualities = opts.qualityFeatures
        ? details.map((detail) => tensorQualityById.get(Number(detail.id)) || null)
        : null
      items.push({
        key,
        captureId,
        layoutId: truthEntry.layoutId,
        family: layoutFamily(truthEntry.layoutId),
        split,
        questionLabel: truthEntry.questionLabel,
        expected: normalizeAnswer(truthEntry.expected),
        truth: truthText,
        current,
        currentCorrect: current === truthText,
        review: Boolean(group.review),
        slotCount: details.length,
        slotQualities,
        candidates: candidates.slice(0, 20),
        cropPath: truthEntry.cropPath,
        replayFile: file
      })
    }
  }

  const records = []
  for (const item of items) {
    item.candidates.forEach((candidate, index) => {
      records.push({
        itemKey: item.key,
        candidateIndex: index,
        split: item.split,
        correct: candidate.text === item.truth,
        features: buildFeatures(item, candidate, opts)
      })
    })
  }
  const trainRecords = records.filter((record) => record.split === 'calibration')
  const keys = collectFeatureKeys(trainRecords)
  const trainVector = vectorize(trainRecords, keys)
  const l2s = [0, 0.0003, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3]
  const thresholds = []
  for (const minScore of [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6, 0.5, 0.4]) {
    for (const minConfidence of [0, 0.3, 0.5, 0.7, 0.85]) {
      for (const maxChangedSlots of [1, 2]) thresholds.push({ minScore, minConfidence, maxChangedSlots })
    }
  }

  const runs = []
  for (const l2 of l2s) {
    const weights = trainLogistic(trainVector.x, trainVector.y, { l2, epochs: 1200, lr: 0.07 })
    const scoredRecords = new Map()
    for (const split of ['calibration', 'validation', 'holdout']) {
      const splitRecords = records.filter((record) => record.split === split)
      const splitScores = scoreRecords(splitRecords, keys, trainVector.fit, weights)
      scoredRecords.set(split, { records: splitRecords, scores: splitScores })
    }
    const allScores = []
    const allRecords = []
    for (const split of ['calibration', 'validation', 'holdout']) {
      allRecords.push(...scoredRecords.get(split).records)
      allScores.push(...scoredRecords.get(split).scores)
    }
    const scoredItems = attachScores(items, allRecords, allScores)
    const bySplit = {
      calibration: scoredItems.filter((item) => item.split === 'calibration'),
      validation: scoredItems.filter((item) => item.split === 'validation'),
      holdout: scoredItems.filter((item) => item.split === 'holdout')
    }
    for (const gate of thresholds) {
      runs.push({
        l2,
        gate,
        calibration: scoreItems(bySplit.calibration, gate),
        validation: scoreItems(bySplit.validation, gate),
        holdout: scoreItems(bySplit.holdout, gate)
      })
    }
  }

  const calibrationZeroWrong = runs
    .filter((run) => run.calibration.wrong === 0 && run.calibration.suggested > 0)
    .sort((a, b) =>
      b.calibration.rescued - a.calibration.rescued ||
      a.validation.wrong - b.validation.wrong ||
      b.validation.rescued - a.validation.rescued ||
      a.holdout.wrong - b.holdout.wrong ||
      b.holdout.rescued - a.holdout.rescued
    )
    .slice(0, 30)

  const validationZeroWrong = runs
    .filter((run) => run.validation.wrong === 0 && run.validation.suggested > 0)
    .sort((a, b) =>
      b.validation.rescued - a.validation.rescued ||
      a.holdout.wrong - b.holdout.wrong ||
      b.holdout.rescued - a.holdout.rescued
    )
    .slice(0, 30)

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    rows: opts.rows,
    debugRoot: opts.qualityFeatures ? opts.debugRoot : null,
    replayDirs: opts.dirs,
    layoutFeatures: opts.layoutFeatures,
    qualityFeatures: opts.qualityFeatures,
    replayFileCount: replayFiles.length,
    itemCount: items.length,
    candidateRecordCount: records.length,
    featureCounts: { numeric: keys.numeric.length, categorical: keys.categorical.length },
    splitCounts: Object.fromEntries(['calibration', 'validation', 'holdout'].map((split) => [
      split,
      items.filter((item) => item.split === split).length
    ])),
    calibrationZeroWrong,
    validationZeroWrong,
    compactRuns: runs.map((run) => ({
      l2: run.l2,
      gate: run.gate,
      calibration: {
        suggested: run.calibration.suggested,
        correct: run.calibration.correct,
        wrong: run.calibration.wrong,
        rescued: run.calibration.rescued,
        accuracyPct: run.calibration.accuracyPct
      },
      validation: {
        suggested: run.validation.suggested,
        correct: run.validation.correct,
        wrong: run.validation.wrong,
        rescued: run.validation.rescued,
        accuracyPct: run.validation.accuracyPct
      },
      holdout: {
        suggested: run.holdout.suggested,
        correct: run.holdout.correct,
        wrong: run.holdout.wrong,
        rescued: run.holdout.rescued,
        accuracyPct: run.holdout.accuracyPct
      }
    }))
  }

  if (opts.out) {
    await fs.mkdir(path.dirname(opts.out), { recursive: true })
    await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  }
  const best = calibrationZeroWrong[0] || null
  console.log(JSON.stringify({
    out: opts.out,
    replayFileCount: report.replayFileCount,
    itemCount: report.itemCount,
    candidateRecordCount: report.candidateRecordCount,
    featureCounts: report.featureCounts,
    splitCounts: report.splitCounts,
    calibrationZeroWrongCount: calibrationZeroWrong.length,
    bestCalibrationZeroWrong: best && {
      l2: best.l2,
      gate: best.gate,
      calibration: {
        suggested: best.calibration.suggested,
        correct: best.calibration.correct,
        wrong: best.calibration.wrong,
        rescued: best.calibration.rescued,
        accuracyPct: best.calibration.accuracyPct
      },
      validation: {
        suggested: best.validation.suggested,
        correct: best.validation.correct,
        wrong: best.validation.wrong,
        rescued: best.validation.rescued,
        accuracyPct: best.validation.accuracyPct
      },
      holdout: {
        suggested: best.holdout.suggested,
        correct: best.holdout.correct,
        wrong: best.holdout.wrong,
        rescued: best.holdout.rescued,
        accuracyPct: best.holdout.accuracyPct
      }
    },
    validationZeroWrongTop: validationZeroWrong.slice(0, 5).map((run) => ({
      l2: run.l2,
      gate: run.gate,
      validation: {
        suggested: run.validation.suggested,
        correct: run.validation.correct,
        wrong: run.validation.wrong,
        rescued: run.validation.rescued,
        accuracyPct: run.validation.accuracyPct
      },
      holdout: {
        suggested: run.holdout.suggested,
        correct: run.holdout.correct,
        wrong: run.holdout.wrong,
        rescued: run.holdout.rescued,
        accuracyPct: run.holdout.accuracyPct
      }
    }))
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
