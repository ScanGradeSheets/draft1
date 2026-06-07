#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DEFAULT_SG3_RUN = path.join(
  ROOT,
  'private-evidence',
  'sg3-9-photo-confidence-20260606',
  'candidate-four-from-one-rescues'
)
const DEFAULT_OLDER_ROOT = path.join(
  ROOT,
  'benchmarks',
  'uploaded_student_samples',
  'results-20260601-new3-handwriting-labels'
)
const DEFAULT_OUT_DIR = path.join(
  ROOT,
  'private-evidence',
  'sg3-9-photo-confidence-20260606',
  'review-reason-holdout'
)

function parseArgs(argv) {
  const opts = {
    sg3Run: DEFAULT_SG3_RUN,
    olderRoot: DEFAULT_OLDER_ROOT,
    outDir: DEFAULT_OUT_DIR
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

function asAnswer(value) {
  return value == null ? '' : String(value).trim()
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a'
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

function topGap(prediction) {
  if (Number.isFinite(Number(prediction?.topGap))) return Number(prediction.topGap)
  const topK = Array.isArray(prediction?.topK) ? prediction.topK : []
  return topK.length >= 2
    ? (Number(topK[0]?.confidence) || 0) - (Number(topK[1]?.confidence) || 0)
    : 1
}

function reasonKey(reasons) {
  return reasons.length ? reasons.join(' + ') : 'NO_RECORDED_DIGIT_REASON'
}

function predictionGroups(predictions) {
  const groups = new Map()
  for (const prediction of predictions || []) {
    const questionNum = predictionQuestionNum(prediction)
    if (!Number.isInteger(questionNum) || questionNum < 1) continue
    if (!groups.has(questionNum)) groups.set(questionNum, [])
    groups.get(questionNum).push(prediction)
  }
  for (const group of groups.values()) {
    group.sort((a, b) => predictionDigitIndex(a) - predictionDigitIndex(b))
  }
  return groups
}

function answerFromPredictions(predictions) {
  return (predictions || []).map((prediction) => asAnswer(prediction?.digit)).join('')
}

function statsForPredictions(debug, questionIndex, predictions) {
  const confidences = predictions
    .map((prediction) => Number(prediction?.confidence))
    .filter(Number.isFinite)
  const gaps = predictions.map(topGap).filter(Number.isFinite)
  const reasons = Array.from(new Set(predictions
    .map((prediction) => prediction?.preprocessReviewReason || prediction?.forcedReviewReason)
    .filter(Boolean)))
  const questionReview = Array.isArray(debug?.questionReview) ? debug.questionReview : null
  const reviewNeeded = questionReview && typeof questionReview[questionIndex] === 'boolean'
    ? questionReview[questionIndex]
    : predictions.some((prediction) => prediction?.reviewNeeded === true)
  return {
    reviewNeeded,
    minConfidence: confidences.length ? Math.min(...confidences) : null,
    minTopGap: gaps.length ? Math.min(...gaps) : null,
    reasons
  }
}

async function readSg3Rows(runDir) {
  const truth = await readJson(path.join(runDir, 'truth-score.json'))
  return (truth.rows || []).map((row) => ({
    dataset: 'sg3-current-9-photo',
    sheet: row.file,
    questionNum: row.questionNum,
    truth: asAnswer(row.truth),
    predicted: asAnswer(row.predicted),
    answerKey: asAnswer(row.answerKey),
    correct: row.handwrittenCorrect === true,
    reviewNeeded: row.reviewNeeded === true,
    confident: row.confident === true,
    reasons: row.reviewReasons || [],
    reasonKey: reasonKey(row.reviewReasons || []),
    minConfidence: row.minConfidence,
    minTopGap: row.minTopGap
  }))
}

async function readOlderRows(olderRoot) {
  const cases = ['addition', 'subtraction', 'mixed']
  const out = []
  for (const caseName of cases) {
    const caseDir = path.join(olderRoot, caseName)
    try {
      const summary = await readJson(path.join(caseDir, 'summary.json'))
      const rows = await readJson(path.join(caseDir, 'rows.json'))
      const expectedAnswers = (summary.expectedDigits || []).map(asAnswer)
      for (const row of rows) {
        if (!row?.ok || !row?.id) continue
        const debug = await readJson(path.join(caseDir, 'debug', row.id, 'ocr-debug.json'))
        const groups = predictionGroups(debug.predictions || row.predictions || [])
        for (let index = 0; index < expectedAnswers.length; index += 1) {
          const questionNum = index + 1
          const predictions = groups.get(questionNum) || []
          if (!predictions.length) continue
          const truth = expectedAnswers[index]
          const predicted = answerFromPredictions(predictions)
          const stats = statsForPredictions(debug, index, predictions)
          out.push({
            dataset: `older-20260601-${caseName}`,
            sheet: row.id,
            questionNum,
            truth,
            predicted,
            answerKey: '',
            correct: predicted === truth,
            reviewNeeded: stats.reviewNeeded,
            confident: !stats.reviewNeeded,
            reasons: stats.reasons,
            reasonKey: reasonKey(stats.reasons),
            minConfidence: stats.minConfidence,
            minTopGap: stats.minTopGap
          })
        }
      }
    } catch {
      // Older labeled evidence is optional in some checkouts.
    }
  }
  return out
}

function bucketRows(rows, keyFn) {
  const buckets = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        total: 0,
        correct: 0,
        wrong: 0,
        reviewed: 0,
        confident: 0,
        examples: []
      })
    }
    const bucket = buckets.get(key)
    bucket.total += 1
    if (row.correct) bucket.correct += 1
    else bucket.wrong += 1
    if (row.reviewNeeded) bucket.reviewed += 1
    else bucket.confident += 1
    if (bucket.examples.length < 8) {
      bucket.examples.push(`${row.dataset} ${row.sheet} Q${row.questionNum} ${row.truth}->${row.predicted}${row.reviewNeeded ? ' review' : ' confident'}`)
    }
  }
  return Array.from(buckets.values()).sort((a, b) => b.total - a.total || a.key.localeCompare(b.key))
}

function simulate(rows, id, label, predicate) {
  const current = rows.filter((row) => row.confident)
  const promoted = rows.filter((row) => row.reviewNeeded && predicate(row))
  const next = current.concat(promoted)
  const wrong = next.filter((row) => !row.correct)
  return {
    id,
    label,
    total: rows.length,
    promoted: promoted.length,
    promotedWrong: promoted.filter((row) => !row.correct).length,
    confident: next.length,
    confidentWrong: wrong.length,
    coverage: rows.length ? next.length / rows.length : 0,
    accuracy: next.length ? (next.length - wrong.length) / next.length : null,
    wrongExamples: wrong.slice(0, 12).map((row) => ({
      dataset: row.dataset,
      sheet: row.sheet,
      questionNum: row.questionNum,
      truth: row.truth,
      predicted: row.predicted,
      reasonKey: row.reasonKey,
      minConfidence: row.minConfidence,
      minTopGap: row.minTopGap
    }))
  }
}

function markdown(report) {
  const lines = []
  lines.push('# Review Reason Holdout Analysis')
  lines.push('')
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- SG3 run: \`${report.sg3Run}\``)
  lines.push(`- Older root: \`${report.olderRoot}\``)
  lines.push(`- Rows loaded: ${report.rowsLoaded}`)
  lines.push('')
  lines.push('## Dataset Summary')
  lines.push('')
  lines.push('| Dataset | Rows | Correct | Wrong | Reviewed | Confident |')
  lines.push('|---|---:|---:|---:|---:|---:|')
  for (const row of report.datasetBuckets) {
    lines.push(`| ${row.key} | ${row.total} | ${row.correct} | ${row.wrong} | ${row.reviewed} | ${row.confident} |`)
  }
  lines.push('')
  lines.push('## Review Reason Buckets')
  lines.push('')
  lines.push('| Reason | Rows | Correct | Wrong | Reviewed | Confident | Examples |')
  lines.push('|---|---:|---:|---:|---:|---:|---|')
  for (const row of report.reasonBuckets) {
    lines.push(`| ${row.key} | ${row.total} | ${row.correct} | ${row.wrong} | ${row.reviewed} | ${row.confident} | ${row.examples.join('; ')} |`)
  }
  lines.push('')
  lines.push('## Policy Simulations')
  lines.push('')
  lines.push('| Policy | Promoted | Promoted Wrong | Confident | Confident Wrong | Coverage | Accuracy |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|')
  for (const row of report.simulations) {
    lines.push(`| ${row.label} | ${row.promoted} | ${row.promotedWrong} | ${row.confident}/${row.total} | ${row.confidentWrong} | ${pct(row.coverage)} | ${pct(row.accuracy)} |`)
  }
  lines.push('')
  lines.push('## Interpretation')
  lines.push('')
  lines.push('- SG3 exact-reason safety is useful evidence, but older labeled runs show whether those reason names were ever attached to wrong OCR answers in previous app/model states.')
  lines.push('- Do not promote a review reason globally if this report shows wrong examples for that reason without a stronger production-side signal.')
  return `${lines.join('\n')}\n`
}

const opts = parseArgs(process.argv.slice(2))
const sg3Rows = await readSg3Rows(opts.sg3Run)
const olderRows = await readOlderRows(opts.olderRoot)
const allRows = sg3Rows.concat(olderRows)
const sg3SafeReasonKeys = new Set(
  bucketRows(sg3Rows.filter((row) => row.reviewNeeded), (row) => row.reasonKey)
    .filter((bucket) => bucket.wrong === 0 && bucket.key !== 'NO_RECORDED_DIGIT_REASON')
    .map((bucket) => bucket.key)
)

const report = {
  generatedAt: new Date().toISOString(),
  sg3Run: opts.sg3Run,
  olderRoot: opts.olderRoot,
  rowsLoaded: allRows.length,
  datasetBuckets: bucketRows(allRows, (row) => row.dataset),
  reasonBuckets: bucketRows(allRows.filter((row) => row.reviewNeeded), (row) => row.reasonKey),
  simulations: [
    simulate(sg3Rows, 'sg3-safe-reasons-on-sg3', 'SG3 safe reasons on SG3', (row) => sg3SafeReasonKeys.has(row.reasonKey)),
    simulate(allRows, 'sg3-safe-reasons-all-evidence', 'SG3 safe reasons on all evidence', (row) => sg3SafeReasonKeys.has(row.reasonKey)),
    simulate(allRows, 'high-signal-no-reason-all-evidence', 'High-signal no-reason on all evidence', (row) => row.reasonKey === 'NO_RECORDED_DIGIT_REASON' && (row.minConfidence || 0) >= 0.78 && (row.minTopGap || 0) >= 0.08),
    simulate(allRows, 'moderate-no-reason-all-evidence', 'Moderate no-reason on all evidence', (row) => row.reasonKey === 'NO_RECORDED_DIGIT_REASON' && (row.minConfidence || 0) >= 0.74 && (row.minTopGap || 0) >= 0.28)
  ]
}

await fs.mkdir(opts.outDir, { recursive: true })
await fs.writeFile(path.join(opts.outDir, 'review-reason-holdout.json'), JSON.stringify(report, null, 2))
await fs.writeFile(path.join(opts.outDir, 'review-reason-holdout.md'), markdown(report))

console.log(JSON.stringify({
  outDir: opts.outDir,
  rowsLoaded: report.rowsLoaded,
  datasetBuckets: report.datasetBuckets,
  simulations: report.simulations.map((row) => ({
    id: row.id,
    promoted: row.promoted,
    promotedWrong: row.promotedWrong,
    confident: row.confident,
    confidentWrong: row.confidentWrong,
    coverage: row.coverage,
    accuracy: row.accuracy,
    wrongExamples: row.wrongExamples.slice(0, 4)
  }))
}, null, 2))
