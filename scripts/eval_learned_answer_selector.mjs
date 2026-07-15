#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_CANDIDATES = 'private-evidence/reports/nonrow-whole-answer-variants-20260708/candidate-rows.json'
const DEFAULT_OUT = 'private-evidence/reports/learned-answer-selector-20260708/summary.json'

function parseArgs(argv) {
  const opts = {
    candidates: DEFAULT_CANDIDATES,
    out: DEFAULT_OUT,
    trainSplits: ['calibration'],
    safetySplits: ['calibration', 'validation'],
    maxChangedSlots: Infinity,
    excludeBlankCandidates: false,
    iterations: 2500,
    learningRate: 0.06,
    l2: 0.002
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--candidates') opts.candidates = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg === '--train-splits') opts.trainSplits = argv[++i].split(',').map((item) => item.trim()).filter(Boolean)
    else if (arg === '--safety-splits') opts.safetySplits = argv[++i].split(',').map((item) => item.trim()).filter(Boolean)
    else if (arg === '--max-changed-slots') opts.maxChangedSlots = Number(argv[++i])
    else if (arg === '--exclude-blank-candidates') opts.excludeBlankCandidates = true
    else if (arg === '--iterations') opts.iterations = Number(argv[++i])
    else if (arg === '--learning-rate') opts.learningRate = Number(argv[++i])
    else if (arg === '--l2') opts.l2 = Number(argv[++i])
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function sigmoid(value) {
  if (value > 35) return 1
  if (value < -35) return 0
  return 1 / (1 + Math.exp(-value))
}

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function numeric(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function addFeature(features, key, value = 1) {
  features.set(key, (features.get(key) || 0) + value)
}

function sourceHas(row, token) {
  return String(row.sourceTypeKey || '').split('+').includes(token)
}

function namesHas(row, token) {
  return String(row.sourceNameKey || '').split('+').includes(token)
}

function patternParts(row) {
  return String(row.changePattern || '').split('|').filter(Boolean)
}

function featurize(row) {
  const features = new Map()
  addFeature(features, 'bias')
  addFeature(features, `layout:${row.layoutId}`)
  addFeature(features, `slot:${row.changedSlotKey}`)
  addFeature(features, `len:${row.candidateLength}`)
  addFeature(features, `currentLen:${row.currentLength}`)
  addFeature(features, `changed:${row.changedSlots}`)
  addFeature(features, `unchangedReview:${row.unchangedReviewSlots}`)
  addFeature(features, `changedReview:${row.changedReviewSlots}`)
  addFeature(features, row.allCompanionSlotsStable ? 'stable:yes' : 'stable:no')
  addFeature(features, row.allChangedHaveVariantTop1 ? 'all-vtop:yes' : 'all-vtop:no')
  addFeature(features, row.allChangedHaveModelTopK ? 'all-topk:yes' : 'all-topk:no')

  const minConfidence = numeric(row.minConfidence)
  const maxConfidence = numeric(row.maxConfidence)
  const minTopGap = numeric(row.minTopGap)
  const maxTopGap = numeric(row.maxTopGap)
  addFeature(features, 'minConfidence', minConfidence)
  addFeature(features, 'maxConfidence', maxConfidence)
  addFeature(features, 'minTopGap', minTopGap)
  addFeature(features, 'maxTopGap', maxTopGap)
  addFeature(features, 'variantTop1Count', Math.min(8, numeric(row.minVariantTop1Count)) / 8)
  addFeature(features, 'candidateIndex', 1 / (1 + numeric(row.candidateIndex)))
  addFeature(features, 'confidenceGapProduct', minConfidence * minTopGap)

  for (const token of String(row.sourceTypeKey || '').split('+').filter(Boolean)) addFeature(features, `sourceType:${token}`)
  for (const token of String(row.sourceNameKey || '').split('+').filter(Boolean)) addFeature(features, `sourceName:${token}`)
  for (const part of patternParts(row)) {
    addFeature(features, `pattern:${part}`)
    const match = part.match(/^([^:]+):([^>]+)>(.+)$/)
    if (match) {
      addFeature(features, `from:${match[1]}:${match[2]}`)
      addFeature(features, `to:${match[1]}:${match[3]}`)
      addFeature(features, `move:${match[2]}>${match[3]}`)
    }
  }

  addFeature(features, 'hasBlankCandidate', sourceHas(row, 'blank-candidate') ? 1 : 0)
  addFeature(features, 'hasExpectedSlot', namesHas(row, 'expected-slot') ? 1 : 0)
  addFeature(features, 'hasEdgeBandSlot', namesHas(row, 'edge-band-slot') ? 1 : 0)
  addFeature(features, 'hasNoSideErase', namesHas(row, 'no-side-erase') ? 1 : 0)
  return features
}

function buildVocab(rows) {
  const vocab = new Map()
  for (const row of rows) {
    for (const key of featurize(row).keys()) {
      if (!vocab.has(key)) vocab.set(key, vocab.size)
    }
  }
  return vocab
}

function vectorize(row, vocab) {
  const vector = []
  for (const [key, value] of featurize(row).entries()) {
    const index = vocab.get(key)
    if (index !== undefined && value !== 0) vector.push([index, value])
  }
  return vector
}

function dot(weights, vector) {
  let sum = 0
  for (const [index, value] of vector) sum += weights[index] * value
  return sum
}

function trainLogistic(rows, opts) {
  const vocab = buildVocab(rows)
  const examples = rows.map((row) => ({
    row,
    vector: vectorize(row, vocab),
    y: row.correct ? 1 : 0,
    weight: row.correct ? 3.5 : 1
  }))
  const weights = Array(vocab.size).fill(0)
  for (let iter = 0; iter < opts.iterations; iter += 1) {
    const lr = opts.learningRate / Math.sqrt(1 + iter / 250)
    for (const example of examples) {
      const p = sigmoid(dot(weights, example.vector))
      const error = (example.y - p) * example.weight
      for (const [index, value] of example.vector) {
        weights[index] += lr * (error * value - opts.l2 * weights[index])
      }
    }
  }
  return { vocab, weights }
}

function scoreRows(rows, model) {
  return rows.map((row) => ({
    ...row,
    selectorScore: sigmoid(dot(model.weights, vectorize(row, model.vocab)))
  }))
}

function groupRows(rows) {
  const groups = new Map()
  for (const row of rows) {
    if (!groups.has(row.key)) groups.set(row.key, [])
    groups.get(row.key).push(row)
  }
  return [...groups.values()]
}

function selectForGroups(rows, threshold) {
  const selected = []
  for (const group of groupRows(rows)) {
    const best = [...group].sort((a, b) =>
      b.selectorScore - a.selectorScore ||
      a.candidateIndex - b.candidateIndex
    )[0]
    if (best && best.selectorScore >= threshold) selected.push(best)
  }
  return selected
}

function summarizeSelection(rows, threshold) {
  const eligibleGroups = groupRows(rows).length
  const selected = selectForGroups(rows, threshold)
  const correct = selected.filter((row) => row.correct).length
  const wrong = selected.length - correct
  const rescued = selected.filter((row) => row.rescued).length
  const harmedCurrentCorrect = selected.filter((row) => row.harmedCurrentCorrect).length
  return {
    threshold: Number(threshold.toFixed(6)),
    eligibleGroups,
    selected: selected.length,
    correct,
    wrong,
    rescued,
    harmedCurrentCorrect,
    coveragePct: pct(selected.length, eligibleGroups),
    accuracyPct: pct(correct, selected.length),
    rescuePct: pct(rescued, eligibleGroups),
    examples: {
      correct: selected.filter((row) => row.correct).slice(0, 8).map(summarizeRow),
      wrong: selected.filter((row) => !row.correct).slice(0, 12).map(summarizeRow)
    }
  }
}

function summarizeRow(row) {
  return {
    captureId: row.captureId,
    layoutId: row.layoutId,
    split: row.split,
    questionLabel: row.questionLabel,
    current: row.current,
    truth: row.truth,
    candidateText: row.candidateText,
    selectorScore: Number(row.selectorScore.toFixed(6)),
    candidateIndex: row.candidateIndex,
    changedSlots: row.changedSlots,
    changedSlotKey: row.changedSlotKey,
    changePattern: row.changePattern,
    sourceTypeKey: row.sourceTypeKey,
    sourceNameKey: row.sourceNameKey,
    minConfidence: Number(numeric(row.minConfidence).toFixed(4)),
    minTopGap: Number(numeric(row.minTopGap).toFixed(4)),
    cropPath: row.cropPath
  }
}

function candidateThresholds(rows) {
  return [...new Set(rows.map((row) => row.selectorScore))]
    .sort((a, b) => b - a)
}

function chooseThreshold(scoredCalibrationRows) {
  let best = null
  for (const threshold of candidateThresholds(scoredCalibrationRows)) {
    const summary = summarizeSelection(scoredCalibrationRows, threshold)
    if (summary.wrong > 0 || summary.selected === 0) continue
    if (
      !best ||
      summary.rescued > best.rescued ||
      (summary.rescued === best.rescued && summary.selected > best.selected) ||
      (summary.rescued === best.rescued && summary.selected === best.selected && threshold < best.threshold)
    ) {
      best = summary
    }
  }
  return best
}

function chooseThresholdAcross(scoredRows, preferredRows = scoredRows) {
  let best = null
  for (const threshold of candidateThresholds(scoredRows)) {
    const safety = summarizeSelection(scoredRows, threshold)
    if (safety.wrong > 0 || safety.selected === 0) continue
    const preferred = summarizeSelection(preferredRows, threshold)
    if (
      !best ||
      preferred.rescued > best.preferred.rescued ||
      (preferred.rescued === best.preferred.rescued && preferred.selected > best.preferred.selected) ||
      (preferred.rescued === best.preferred.rescued && preferred.selected === best.preferred.selected && threshold < best.threshold)
    ) {
      best = { threshold: safety.threshold, safety, preferred }
    }
  }
  return best
}

function topWeights(model, limit = 40) {
  const entries = [...model.vocab.entries()].map(([key, index]) => ({ key, weight: model.weights[index] }))
  return {
    positive: entries.sort((a, b) => b.weight - a.weight).slice(0, limit),
    negative: entries.sort((a, b) => a.weight - b.weight).slice(0, limit)
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const data = await readJson(opts.candidates)
  const rows = (data.candidateRows || []).filter((row) =>
    Number(row.changedSlots) <= opts.maxChangedSlots &&
    (!opts.excludeBlankCandidates || !String(row.sourceTypeKey || '').split('+').includes('blank-candidate'))
  )
  const trainRows = rows.filter((row) => opts.trainSplits.includes(row.split))
  const model = trainLogistic(trainRows, opts)
  const scoredRows = scoreRows(rows, model)
  const scoredBySplit = {
    calibration: scoredRows.filter((row) => row.split === 'calibration'),
    validation: scoredRows.filter((row) => row.split === 'validation'),
    holdout: scoredRows.filter((row) => row.split === 'holdout')
  }
  const safetyRows = scoredRows.filter((row) => opts.safetySplits.includes(row.split))
  const preferredSafetyRows = scoredRows.filter((row) => opts.safetySplits.includes(row.split) && row.split !== 'calibration')
  const calibrationOnlyThreshold = chooseThreshold(scoredBySplit.calibration)
  const calibrationValidationThreshold = chooseThresholdAcross(
    safetyRows,
    preferredSafetyRows.length ? preferredSafetyRows : safetyRows
  )
  const threshold = calibrationValidationThreshold?.threshold ?? calibrationOnlyThreshold?.threshold ?? 1
  const report = {
    generatedAt: new Date().toISOString(),
    candidates: opts.candidates,
    sourceReport: data.sourceReport,
    rowCount: rows.length,
    groupCounts: Object.fromEntries(Object.entries(scoredBySplit).map(([split, splitRows]) => [split, groupRows(splitRows).length])),
    model: {
      type: 'calibration-only logistic regression',
      trainSplits: opts.trainSplits,
      safetySplits: opts.safetySplits,
      maxChangedSlots: opts.maxChangedSlots,
      excludeBlankCandidates: opts.excludeBlankCandidates,
      iterations: opts.iterations,
      learningRate: opts.learningRate,
      l2: opts.l2,
      featureCount: model.vocab.size,
      topWeights: topWeights(model, 30)
    },
    thresholdChoice: {
      selectedStrategy: calibrationValidationThreshold ? 'calibration+validation-zero-wrong' : 'calibration-zero-wrong',
      calibrationOnly: calibrationOnlyThreshold,
      calibrationValidation: calibrationValidationThreshold
    },
    bySplit: Object.fromEntries(Object.entries(scoredBySplit).map(([split, splitRows]) => [
      split,
      summarizeSelection(splitRows, threshold)
    ])),
    full: summarizeSelection(scoredRows, threshold),
    topCandidatesByScore: scoredRows
      .sort((a, b) => b.selectorScore - a.selectorScore)
      .slice(0, 40)
      .map(summarizeRow)
  }
  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({
    out: opts.out,
    rowCount: report.rowCount,
    groupCounts: report.groupCounts,
    featureCount: report.model.featureCount,
    thresholdChoice: report.thresholdChoice,
    bySplit: Object.fromEntries(Object.entries(report.bySplit).map(([split, summary]) => [split, {
      selected: summary.selected,
      correct: summary.correct,
      wrong: summary.wrong,
      rescued: summary.rescued,
      accuracyPct: summary.accuracyPct
    }])),
    full: {
      selected: report.full.selected,
      correct: report.full.correct,
      wrong: report.full.wrong,
      rescued: report.full.rescued,
      accuracyPct: report.full.accuracyPct
    }
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
