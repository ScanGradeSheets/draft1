#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from 'canvas'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const SG3_RUN = path.join(
  ROOT,
  'private-evidence',
  'sg3-9-photo-confidence-20260606',
  'candidate-shape-rescues'
)
const OUT_DIR = path.join(
  ROOT,
  'private-evidence',
  'sg3-9-photo-confidence-20260606',
  'four-vs-one-analysis'
)
const OLDER_LABELED_ROOT = path.join(
  ROOT,
  'benchmarks',
  'uploaded_student_samples',
  'results-20260601-new3-handwriting-labels'
)

function parseArgs(argv) {
  const opts = {
    sg3Run: SG3_RUN,
    olderRoot: OLDER_LABELED_ROOT,
    outDir: OUT_DIR
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--sg3-run') {
      opts.sg3Run = path.resolve(argv[++i])
    } else if (arg === '--older-root') {
      opts.olderRoot = path.resolve(argv[++i])
    } else if (arg === '--out') {
      opts.outDir = path.resolve(argv[++i])
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a'
}

function fmt(value, digits = 1) {
  return Number.isFinite(value) ? value.toFixed(digits) : 'n/a'
}

function asAnswer(value) {
  return value == null ? '' : String(value).trim()
}

function predictionDigitIndex(prediction) {
  const digitIndex = Number(prediction?.digitIndex)
  if (Number.isInteger(digitIndex)) return digitIndex
  const id = Number(prediction?.id)
  return Number.isInteger(id) ? id % 2 : 0
}

function predictionQuestionNum(prediction) {
  const questionNum = Number(prediction?.questionNum)
  if (Number.isInteger(questionNum) && questionNum > 0) return questionNum
  const id = Number(prediction?.id)
  return Number.isInteger(id) ? Math.floor(id / 2) + 1 : null
}

function predictedAnswerForQuestion(predictions, questionNum) {
  return predictions
    .filter((prediction) => predictionQuestionNum(prediction) === questionNum)
    .sort((a, b) => predictionDigitIndex(a) - predictionDigitIndex(b))
    .map((prediction) => prediction?.digit ?? '')
    .join('')
}

function topConfidence(prediction, digit) {
  const match = (prediction?.topK || []).find((item) => Number(item?.digit) === Number(digit))
  return Number(match?.confidence) || 0
}

function featureSet(values, threshold = 0.22) {
  const n = 28
  let total = 0
  let weightedX = 0
  let weightedY = 0
  let minX = n
  let maxX = -1
  let minY = n
  let maxY = -1
  const valueAt = (x, y) => values[y * n + x] || 0
  const sumRegion = (x0, x1, y0, y1) => {
    let sum = 0
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const value = valueAt(x, y)
        if (value > threshold) sum += value
      }
    }
    return sum
  }
  const longestRowRun = (y) => {
    let best = 0
    let current = 0
    for (let x = 0; x < n; x += 1) {
      if (valueAt(x, y) > threshold) {
        current += 1
        best = Math.max(best, current)
      } else {
        current = 0
      }
    }
    return best
  }
  const longestColRun = (x) => {
    let best = 0
    let current = 0
    for (let y = 0; y < n; y += 1) {
      if (valueAt(x, y) > threshold) {
        current += 1
        best = Math.max(best, current)
      } else {
        current = 0
      }
    }
    return best
  }

  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const value = valueAt(x, y)
      if (value <= threshold) continue
      total += value
      weightedX += x * value
      weightedY += y * value
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }

  let topLongest = 0
  let bottomLongest = 0
  let leftLongest = 0
  let rightLongest = 0
  for (let y = 4; y < 12; y += 1) topLongest = Math.max(topLongest, longestRowRun(y))
  for (let y = 17; y < 24; y += 1) bottomLongest = Math.max(bottomLongest, longestRowRun(y))
  for (let x = 2; x < 12; x += 1) leftLongest = Math.max(leftLongest, longestColRun(x))
  for (let x = 16; x < 26; x += 1) rightLongest = Math.max(rightLongest, longestColRun(x))

  const boxW = maxX >= minX ? maxX - minX + 1 : 0
  const boxH = maxY >= minY ? maxY - minY + 1 : 0
  return {
    centerX: total ? weightedX / total : 0,
    centerY: total ? weightedY / total : 0,
    top: sumRegion(0, n, 0, 9),
    middle: sumRegion(0, n, 9, 19),
    bottom: sumRegion(0, n, 19, n),
    topLeft: sumRegion(0, 14, 0, 14),
    topRight: sumRegion(14, n, 0, 14),
    middleLeft: sumRegion(0, 14, 7, 21),
    middleRight: sumRegion(14, n, 7, 21),
    bottomLeft: sumRegion(0, 14, 14, n),
    bottomRight: sumRegion(14, n, 14, n),
    topLongest,
    bottomLongest,
    leftLongest,
    rightLongest,
    boxW,
    boxH,
    aspect: boxH ? boxW / boxH : 0,
    total
  }
}

async function imageInkValues(file, mode) {
  const image = await loadImage(file)
  const canvas = createCanvas(28, 28)
  const context = canvas.getContext('2d')
  context.drawImage(image, 0, 0, 28, 28)
  const data = context.getImageData(0, 0, 28, 28).data
  const luminance = []
  for (let i = 0; i < 28 * 28; i += 1) {
    const alpha = data[i * 4 + 3] / 255
    luminance.push(((data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3 / 255) * alpha)
  }
  if (mode === 'model') return Float32Array.from(luminance)

  const mean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length
  const variance = luminance.reduce((sum, value) => sum + (value - mean) ** 2, 0) / luminance.length
  const std = Math.sqrt(variance)
  const cutoff = Math.max(0, mean - Math.max(0.08, std * 0.65))
  return Float32Array.from(luminance.map((value) => {
    if (value >= cutoff) return 0
    return Math.min(1, (cutoff - value) / Math.max(0.04, cutoff))
  }))
}

async function imageFeatures(file, mode) {
  try {
    const values = await imageInkValues(file, mode)
    return featureSet(values, mode === 'model' ? 0.22 : 0.18)
  } catch {
    return null
  }
}

async function enrichItem(item) {
  return {
    ...item,
    modelFeatures: await imageFeatures(item.modelInputPath, 'model'),
    rawFeatures: await imageFeatures(item.rawPath, 'raw')
  }
}

async function readSg3Items(runDir) {
  const score = await readJson(path.join(runDir, 'truth-score.json'))
  const replayRows = await readJson(path.join(runDir, 'rows.json'))
  const replayByFile = new Map(replayRows.map((row) => [path.basename(row.file), row]))
  const items = []
  for (const row of score.rows || []) {
    const replayRow = replayByFile.get(row.file)
    if (!replayRow?.id) continue
    const debugDir = path.join(runDir, 'debug', replayRow.id)
    const debug = await readJson(path.join(debugDir, 'ocr-debug.json'))
    const predictions = debug.predictions || []
    for (const prediction of predictions.filter((pred) => predictionQuestionNum(pred) === row.questionNum)) {
      const slot = predictionDigitIndex(prediction)
      const truthDigit = asAnswer(row.truth)[slot] || ''
      items.push({
        dataset: 'sg3-current-9-photo',
        sheet: row.file,
        questionNum: row.questionNum,
        slot,
        truthDigit,
        predictedDigit: asAnswer(prediction.digit),
        answerTruth: asAnswer(row.truth),
        answerPredicted: asAnswer(row.predicted),
        answerKey: asAnswer(row.answerKey),
        confidence: Number(prediction.confidence) || 0,
        topGap: Number(prediction.topGap) || 0,
        p1: topConfidence(prediction, 1),
        p4: topConfidence(prediction, 4),
        reviewNeeded: prediction.reviewNeeded === true,
        reason: prediction.preprocessReviewReason || prediction.forcedReviewReason || '',
        robustOverride: prediction.robustOverride || '',
        rawPath: path.join(debugDir, `raw-q${Number(prediction.id) + 1}.png`),
        modelInputPath: path.join(debugDir, `model-input-q${Number(prediction.id) + 1}.png`)
      })
    }
  }
  return Promise.all(items.map(enrichItem))
}

async function readOlderItems(olderRoot) {
  const cases = ['addition', 'subtraction', 'mixed']
  const items = []
  for (const caseName of cases) {
    const caseDir = path.join(olderRoot, caseName)
    try {
      const summary = await readJson(path.join(caseDir, 'summary.json'))
      const rows = await readJson(path.join(caseDir, 'rows.json'))
      for (const row of rows) {
        if (!row?.ok || !row?.id) continue
        const debugDir = path.join(caseDir, 'debug', row.id)
        const debug = await readJson(path.join(debugDir, 'ocr-debug.json'))
        const predictions = debug.predictions || row.predictions || []
        const expectedAnswers = (summary.expectedDigits || []).map(asAnswer)
        for (const prediction of predictions) {
          const questionNum = predictionQuestionNum(prediction)
          const slot = predictionDigitIndex(prediction)
          const answerTruth = expectedAnswers[questionNum - 1] || ''
          const truthDigit = answerTruth[slot] || ''
          items.push({
            dataset: `older-20260601-${caseName}`,
            sheet: row.id,
            questionNum,
            slot,
            truthDigit,
            predictedDigit: asAnswer(prediction.digit),
            answerTruth,
            answerPredicted: predictedAnswerForQuestion(predictions, questionNum),
            answerKey: '',
            confidence: Number(prediction.confidence) || 0,
            topGap: Number(prediction.topGap) || 0,
            p1: topConfidence(prediction, 1),
            p4: topConfidence(prediction, 4),
            reviewNeeded: prediction.reviewNeeded === true,
            reason: prediction.preprocessReviewReason || prediction.forcedReviewReason || '',
            robustOverride: prediction.robustOverride || '',
            rawPath: path.join(debugDir, `raw-q${Number(prediction.id) + 1}.png`),
            modelInputPath: path.join(debugDir, `model-input-q${Number(prediction.id) + 1}.png`)
          })
        }
      }
    } catch {
      // Older labeled evidence is optional.
    }
  }
  return Promise.all(items.map(enrichItem))
}

const rules = [
  {
    id: 'right-slot-p4-runnerup-18',
    label: 'Right-slot 1 with p4 >= 18%',
    test: (item) => item.slot === 1 && item.predictedDigit === '1' && item.p4 >= 0.18
  },
  {
    id: 'right-slot-p4-heavy-model',
    label: 'Right-slot p4 >= 18%, model total >= 85, bottom >= 20',
    test: (item) =>
      item.slot === 1 &&
      item.predictedDigit === '1' &&
      item.p4 >= 0.18 &&
      (item.modelFeatures?.total || 0) >= 85 &&
      (item.modelFeatures?.bottom || 0) >= 20
  },
  {
    id: 'right-slot-p4-heavy-left-run',
    label: 'Right-slot p4 >= 18%, heavy model, left run >= 8',
    test: (item) =>
      item.slot === 1 &&
      item.predictedDigit === '1' &&
      item.p4 >= 0.18 &&
      (item.modelFeatures?.total || 0) >= 85 &&
      (item.modelFeatures?.bottom || 0) >= 20 &&
      (item.modelFeatures?.leftLongest || 0) >= 8
  },
  {
    id: 'any-slot-p4-heavy-model',
    label: 'Any-slot 1 with p4 >= 15%, model total >= 90',
    test: (item) =>
      item.predictedDigit === '1' &&
      item.p4 >= 0.15 &&
      (item.modelFeatures?.total || 0) >= 90
  },
  {
    id: 'slot-split-14-left-heavy-right-4',
    label: 'Predicted 14, left slot heavy/right-shifted, right slot 4',
    test: (item, allItems) => {
      if (item.slot !== 0 || item.predictedDigit !== '1' || item.answerPredicted !== '14') return false
      const partner = allItems.find((candidate) =>
        candidate.dataset === item.dataset &&
        candidate.sheet === item.sheet &&
        candidate.questionNum === item.questionNum &&
        candidate.slot === 1
      )
      return Boolean(
        partner?.predictedDigit === '4' &&
        (item.modelFeatures?.centerX || 0) >= 13.5 &&
        (item.modelFeatures?.rightLongest || 0) >= 12
      )
    }
  },
  {
    id: 'left-slot-right-shifted-run',
    label: 'Left-slot 1, right-shifted run',
    test: (item) =>
      item.slot === 0 &&
      item.predictedDigit === '1' &&
      (item.modelFeatures?.centerX || 0) >= 13.5 &&
      (item.modelFeatures?.rightLongest || 0) >= 12
  },
  {
    id: 'left-slot-sparse-right-shifted-run',
    label: 'Left-slot 1, sparse right-shifted run',
    test: (item) =>
      item.slot === 0 &&
      item.predictedDigit === '1' &&
      (item.modelFeatures?.centerX || 0) >= 13.5 &&
      (item.modelFeatures?.rightLongest || 0) >= 12 &&
      (item.modelFeatures?.total || 0) <= 45 &&
      (item.modelFeatures?.bottom || 0) <= 8
  }
]

function ruleStats(items) {
  const rescueUniverse = items.filter((item) => item.predictedDigit === '1' && (item.truthDigit === '1' || item.truthDigit === '4'))
  return rules.map((rule) => {
    const flagged = rescueUniverse.filter((item) => rule.test(item, items))
    const truePositives = flagged.filter((item) => item.truthDigit === '4')
    const falsePositives = flagged.filter((item) => item.truthDigit === '1')
    const missed = rescueUniverse.filter((item) => item.truthDigit === '4' && !rule.test(item, items))
    return {
      id: rule.id,
      label: rule.label,
      flagged: flagged.length,
      truePositive4s: truePositives.length,
      falsePositive1s: falsePositives.length,
      missed4s: missed.length,
      precision: flagged.length ? truePositives.length / flagged.length : null,
      recall: truePositives.length + missed.length ? truePositives.length / (truePositives.length + missed.length) : null,
      truePositiveExamples: truePositives.slice(0, 8).map(shortItem),
      falsePositiveExamples: falsePositives.slice(0, 8).map(shortItem),
      missedExamples: missed.slice(0, 8).map(shortItem)
    }
  })
}

function shortItem(item) {
  return {
    dataset: item.dataset,
    sheet: item.sheet,
    questionNum: item.questionNum,
    slot: item.slot,
    truthDigit: item.truthDigit,
    predictedDigit: item.predictedDigit,
    answerTruth: item.answerTruth,
    answerPredicted: item.answerPredicted,
    confidence: item.confidence,
    p4: item.p4,
    modelTotal: item.modelFeatures?.total ?? null,
    modelCenterX: item.modelFeatures?.centerX ?? null,
    modelCenterY: item.modelFeatures?.centerY ?? null,
    modelTop: item.modelFeatures?.top ?? null,
    modelMiddle: item.modelFeatures?.middle ?? null,
    modelBottom: item.modelFeatures?.bottom ?? null,
    modelLeftLongest: item.modelFeatures?.leftLongest ?? null,
    modelRightLongest: item.modelFeatures?.rightLongest ?? null,
    rawTotal: item.rawFeatures?.total ?? null,
    rawCenterX: item.rawFeatures?.centerX ?? null,
    rawCenterY: item.rawFeatures?.centerY ?? null,
    rawLeftLongest: item.rawFeatures?.leftLongest ?? null,
    rawRightLongest: item.rawFeatures?.rightLongest ?? null,
    rawPath: item.rawPath,
    modelInputPath: item.modelInputPath
  }
}

function confusionSummary(items) {
  const byDataset = new Map()
  for (const item of items.filter((entry) => entry.truthDigit === '1' || entry.truthDigit === '4')) {
    if (!byDataset.has(item.dataset)) {
      byDataset.set(item.dataset, {
        dataset: item.dataset,
        total: 0,
        truth1: 0,
        truth4: 0,
        truth4Pred1: 0,
        truth1Pred4: 0,
        truth4Correct: 0,
        truth1Correct: 0
      })
    }
    const bucket = byDataset.get(item.dataset)
    bucket.total += 1
    if (item.truthDigit === '1') {
      bucket.truth1 += 1
      if (item.predictedDigit === '1') bucket.truth1Correct += 1
      if (item.predictedDigit === '4') bucket.truth1Pred4 += 1
    }
    if (item.truthDigit === '4') {
      bucket.truth4 += 1
      if (item.predictedDigit === '4') bucket.truth4Correct += 1
      if (item.predictedDigit === '1') bucket.truth4Pred1 += 1
    }
  }
  return Array.from(byDataset.values()).sort((a, b) => a.dataset.localeCompare(b.dataset))
}

function featureLine(item) {
  const m = item.modelFeatures || {}
  const r = item.rawFeatures || {}
  return [
    item.dataset,
    item.sheet,
    item.questionNum,
    item.slot,
    item.answerTruth,
    item.answerPredicted,
    item.truthDigit,
    item.predictedDigit,
    pct(item.confidence),
    pct(item.p4),
    fmt(m.total),
    fmt(m.centerX),
    fmt(m.centerY),
    fmt(m.top),
    fmt(m.middle),
    fmt(m.bottom),
    m.leftLongest ?? 'n/a',
    m.rightLongest ?? 'n/a',
    fmt(r.total),
    fmt(r.centerX),
    fmt(r.centerY),
    r.leftLongest ?? 'n/a',
    r.rightLongest ?? 'n/a'
  ]
}

function markdown(report) {
  const lines = []
  lines.push('# Four Vs One Crop Analysis')
  lines.push('')
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- SG3 run: \`${report.sg3Run}\``)
  lines.push(`- Older labeled root: \`${report.olderRoot}\``)
  lines.push(`- Total digit slots loaded: ${report.totalItems}`)
  lines.push(`- Focus digit slots loaded: ${report.focusItems}`)
  lines.push('')
  lines.push('## Dataset Summary')
  lines.push('')
  lines.push('| Dataset | 1/4 Slots | Truth 1 | Truth 4 | 4 Read As 1 | 1 Read As 4 | Correct 4s | Correct 1s |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|---:|')
  for (const row of report.confusions) {
    lines.push(`| ${row.dataset} | ${row.total} | ${row.truth1} | ${row.truth4} | ${row.truth4Pred1} | ${row.truth1Pred4} | ${row.truth4Correct} | ${row.truth1Correct} |`)
  }
  lines.push('')
  lines.push('## Candidate 1->4 Rescue Rules')
  lines.push('')
  lines.push('| Rule | Flagged | True 4s Caught | False 1s Hit | Missed 4->1 | Precision | Recall |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|')
  for (const row of report.rules) {
    lines.push(`| ${row.label} | ${row.flagged} | ${row.truePositive4s} | ${row.falsePositive1s} | ${row.missed4s} | ${pct(row.precision)} | ${pct(row.recall)} |`)
  }
  lines.push('')
  lines.push('## Current And Older 4->1 Cases')
  lines.push('')
  lines.push('| Dataset | Sheet | Q | Slot | Truth Ans | Pred Ans | Truth | Pred | Conf | p4 | Model Total | Cx | Cy | Top | Mid | Bottom | LRun | RRun | Raw Total | Raw Cx | Raw Cy | Raw LRun | Raw RRun |')
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const item of report.truth4Pred1Rows) {
    lines.push(`| ${featureLine(item).join(' | ')} |`)
  }
  lines.push('')
  lines.push('## Nearest-Looking True 1s')
  lines.push('')
  lines.push('These are true `1`s that can confuse simple shape rules because they have either high model ink, non-trivial p4, or long left/right runs.')
  lines.push('')
  lines.push('| Dataset | Sheet | Q | Slot | Truth Ans | Pred Ans | Truth | Pred | Conf | p4 | Model Total | Cx | Cy | Top | Mid | Bottom | LRun | RRun | Raw Total | Raw Cx | Raw Cy | Raw LRun | Raw RRun |')
  lines.push('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|')
  for (const item of report.nearTrue1Rows) {
    lines.push(`| ${featureLine(item).join(' | ')} |`)
  }
  lines.push('')
  lines.push('## Interpretation')
  lines.push('')
  lines.push('- The current SG3 set has two `4 -> 1` misses. The older labeled set adds more `4 -> 1` examples, especially from the older mixed sheet, but those were produced under an older model/config.')
  lines.push('- The tested shape/probability rules either miss one of the hard `4`s or hit real `1`s. That means a broad production `1 -> 4` rescue is not justified yet.')
  lines.push('- `2-Photo-2.jpg Q5` remains mostly a slot-split/crop issue: the left `4` is reduced to a vertical stroke in the model input.')
  lines.push('- `3-Photo-3.jpg Q9` is a better preprocessing candidate because `4` is present as a runner-up, but similar-looking true `1`s exist.')
  return `${lines.join('\n')}\n`
}

const opts = parseArgs(process.argv.slice(2))
const sg3Items = await readSg3Items(opts.sg3Run)
const olderItems = await readOlderItems(opts.olderRoot)
const items = sg3Items.concat(olderItems)
const focus = items.filter((item) => item.truthDigit === '1' || item.truthDigit === '4')
const truth4Pred1Rows = focus.filter((item) => item.truthDigit === '4' && item.predictedDigit === '1')
const nearTrue1Rows = focus
  .filter((item) => item.truthDigit === '1' && item.predictedDigit === '1')
  .sort((a, b) => (
    (b.p4 - a.p4) ||
    ((b.modelFeatures?.total || 0) - (a.modelFeatures?.total || 0)) ||
    ((b.modelFeatures?.leftLongest || 0) - (a.modelFeatures?.leftLongest || 0))
  ))
  .slice(0, 16)

const report = {
  generatedAt: new Date().toISOString(),
  sg3Run: opts.sg3Run,
  olderRoot: opts.olderRoot,
  totalItems: items.length,
  focusItems: focus.length,
  confusions: confusionSummary(items),
  rules: ruleStats(items),
  truth4Pred1Rows: truth4Pred1Rows.map(shortItem),
  nearTrue1Rows: nearTrue1Rows.map(shortItem),
  focusRows: focus.map(shortItem)
}

await fs.mkdir(opts.outDir, { recursive: true })
await fs.writeFile(path.join(opts.outDir, 'four-vs-one-report.json'), JSON.stringify(report, null, 2))
await fs.writeFile(path.join(opts.outDir, 'four-vs-one-report.md'), markdown({
  ...report,
  truth4Pred1Rows,
  nearTrue1Rows
}))

console.log(JSON.stringify({
  outDir: opts.outDir,
  totalItems: report.totalItems,
  focusItems: report.focusItems,
  confusions: report.confusions,
  rules: report.rules.map((row) => ({
    id: row.id,
    flagged: row.flagged,
    truePositive4s: row.truePositive4s,
    falsePositive1s: row.falsePositive1s,
    missed4s: row.missed4s,
    precision: row.precision,
    recall: row.recall
  }))
}, null, 2))
