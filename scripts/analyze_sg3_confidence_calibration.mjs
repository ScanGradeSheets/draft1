#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DEFAULT_RUN_DIR = path.join(
  ROOT,
  'private-evidence',
  'sg3-9-photo-confidence-20260606',
  'candidate-shape-rescues'
)

function parseArgs(argv) {
  const opts = {
    runDir: DEFAULT_RUN_DIR,
    outDir: null
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--run') {
      opts.runDir = path.resolve(argv[++i])
    } else if (arg === '--out') {
      opts.outDir = path.resolve(argv[++i])
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  opts.outDir ||= opts.runDir
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a'
}

function basename(file) {
  return path.basename(String(file || ''))
}

function reasonKey(row) {
  return row.reviewReasons?.length
    ? row.reviewReasons.join(' + ')
    : 'NO_RECORDED_DIGIT_REASON'
}

function reasonFamily(row) {
  const reasons = row.reviewReasons || []
  if (!reasons.length) return 'No recorded digit reason'
  if (reasons.some((reason) => /shape|rescue/.test(reason))) return 'Rescue/shape override'
  if (reasons.some((reason) => /preprocess/.test(reason))) return 'Preprocess disagreement'
  if (reasons.some((reason) => /expected-edge|box-safe/.test(reason))) return 'Default/box-safe guard'
  return 'Other review guard'
}

function addBucket(map, key, row) {
  if (!map.has(key)) {
    map.set(key, {
      key,
      total: 0,
      handwrittenCorrect: 0,
      handwrittenWrong: 0,
      mathWrong: 0,
      examples: []
    })
  }
  const bucket = map.get(key)
  bucket.total += 1
  if (row.handwrittenCorrect) bucket.handwrittenCorrect += 1
  else bucket.handwrittenWrong += 1
  if (!row.truthMatchesAnswerKey) bucket.mathWrong += 1
  if (bucket.examples.length < 5) {
    bucket.examples.push(`${row.file} Q${row.questionNum} ${row.truth}->${row.predicted}`)
  }
}

function summarizeRows(rows) {
  const total = rows.length
  const correct = rows.filter((row) => row.handwrittenCorrect).length
  const wrong = total - correct
  return {
    total,
    handwrittenCorrect: correct,
    handwrittenWrong: wrong,
    mathWrong: rows.filter((row) => !row.truthMatchesAnswerKey).length,
    highSignalLowGate: rows.filter((row) => row.minConfidence >= 0.78 && row.minTopGap >= 0.08).length,
    moderateMismatchSignal: rows.filter((row) => row.minConfidence >= 0.74 && row.minTopGap >= 0.28).length
  }
}

function ruleSummary(report, id, label, predicate, notes) {
  const currentConfident = report.rows.filter((row) => row.confident)
  const reviewed = report.rows.filter((row) => row.reviewNeeded)
  const promoted = reviewed.filter(predicate)
  const nextConfident = currentConfident.concat(promoted)
  const wrong = nextConfident.filter((row) => !row.handwrittenCorrect)
  return {
    id,
    label,
    notes,
    promoted: promoted.length,
    promotedCorrect: promoted.filter((row) => row.handwrittenCorrect).length,
    promotedWrong: promoted.filter((row) => !row.handwrittenCorrect).length,
    confidentAnswers: nextConfident.length,
    confidentWrong: wrong.length,
    confidentCoverage: report.rows.length ? nextConfident.length / report.rows.length : 0,
    confidentAccuracy: nextConfident.length ? (nextConfident.length - wrong.length) / nextConfident.length : null,
    examples: promoted.slice(0, 12).map((row) => ({
      file: row.file,
      questionNum: row.questionNum,
      truth: row.truth,
      predicted: row.predicted,
      answerKey: row.answerKey,
      minConfidence: row.minConfidence,
      minTopGap: row.minTopGap,
      reasons: row.reviewReasons
    }))
  }
}

function noDangerousReason(reason, dangerousReasons) {
  return !dangerousReasons.has(reason)
}

function markdown(analysis) {
  const lines = []
  const reviewedCorrect = analysis.reviewed.handwrittenCorrect
  const reviewedTotal = analysis.reviewed.total
  const reviewedWrong = analysis.reviewed.handwrittenWrong
  const slackAfterWrong = Math.max(0, reviewedTotal - analysis.target.additionalNeeded)
  const ocrWrongReviewedRows = analysis.rows.filter((row) => row.reviewNeeded && !row.handwrittenCorrect)
  lines.push('# SG3 Confidence Calibration Analysis')
  lines.push('')
  lines.push(`- Run: \`${analysis.runDir}\``)
  lines.push(`- Generated: ${analysis.generatedAt}`)
  lines.push(`- Current confident answers: ${analysis.current.confidentAnswers}/${analysis.current.totalAnswers} (${pct(analysis.current.confidentCoverage)})`)
  lines.push(`- Current confident wrong answers: ${analysis.current.confidentWrong}`)
  lines.push(`- Current all-answer OCR accuracy: ${analysis.current.handwrittenCorrectAnswers}/${analysis.current.totalAnswers} (${pct(analysis.current.handwrittenAccuracy)})`)
  lines.push(`- Reviewed answers: ${analysis.reviewed.total}; reviewed but OCR-correct: ${analysis.reviewed.handwrittenCorrect}; reviewed and OCR-wrong: ${analysis.reviewed.handwrittenWrong}`)
  lines.push(`- To reach the 95% target on 90 answers, ScanGrade needs ${analysis.target.requiredConfidentAnswers} confident answers. That means promoting ${analysis.target.additionalNeeded} of the current ${analysis.reviewed.total} reviewed answers while leaving the ${analysis.reviewed.handwrittenWrong} OCR-wrong reviewed answers under review.`)
  lines.push('')
  lines.push('## Main Finding')
  lines.push('')
  lines.push(`Recognition is ahead of confidence. On this evidence set, ${reviewedCorrect} of the ${reviewedTotal} reviewed answer groups are actually read correctly, but the app only auto-trusts ${analysis.current.confidentAnswers} answers. The confidence policy has very little slack: ${analysis.target.additionalNeeded} of the reviewed answers must be promoted to hit ${pct(analysis.target.coverage)} coverage, leaving room for only ${slackAfterWrong} reviewed answers total.`)
  lines.push('')
  lines.push('## Review Families')
  lines.push('')
  lines.push('| Family | Reviewed | OCR Correct | OCR Wrong | Math-Wrong Student Answers | Examples |')
  lines.push('|---|---:|---:|---:|---:|---|')
  for (const bucket of analysis.reviewFamilies) {
    lines.push(`| ${bucket.key} | ${bucket.total} | ${bucket.handwrittenCorrect} | ${bucket.handwrittenWrong} | ${bucket.mathWrong} | ${bucket.examples.join('; ')} |`)
  }
  lines.push('')
  lines.push('## Exact Review Reasons')
  lines.push('')
  lines.push('| Reason | Reviewed | OCR Correct | OCR Wrong | Math-Wrong Student Answers | Examples |')
  lines.push('|---|---:|---:|---:|---:|---|')
  for (const bucket of analysis.reasonBuckets) {
    lines.push(`| ${bucket.key} | ${bucket.total} | ${bucket.handwrittenCorrect} | ${bucket.handwrittenWrong} | ${bucket.mathWrong} | ${bucket.examples.join('; ')} |`)
  }
  lines.push('')
  lines.push('## No-Reason Review Anatomy')
  lines.push('')
  lines.push('| Sheet | Q | Truth | Predicted | Key | OCR Correct | Cause | Min Conf | Min Gap |')
  lines.push('|---|---:|---:|---:|---:|---|---|---:|---:|')
  for (const row of analysis.noReasonRows) {
    lines.push(`| ${row.file} | ${row.questionNum} | ${row.truth} | ${row.predicted} | ${row.answerKey} | ${row.handwrittenCorrect ? 'yes' : 'no'} | ${row.reviewCause} | ${pct(row.minConfidence)} | ${pct(row.minTopGap)} |`)
  }
  lines.push('')
  lines.push('## Promotion Simulations')
  lines.push('')
  lines.push('| Policy | Promoted | Promoted Wrong | Confident Answers | Confident Wrong | Coverage | Accuracy | Notes |')
  lines.push('|---|---:|---:|---:|---:|---:|---:|---|')
  for (const simulation of analysis.simulations) {
    lines.push(`| ${simulation.label} | ${simulation.promoted} | ${simulation.promotedWrong} | ${simulation.confidentAnswers}/${analysis.current.totalAnswers} | ${simulation.confidentWrong} | ${pct(simulation.confidentCoverage)} | ${pct(simulation.confidentAccuracy)} | ${simulation.notes} |`)
  }
  lines.push('')
  lines.push('## Interpretation')
  lines.push('')
  if (ocrWrongReviewedRows.length) {
    lines.push(`- OCR-wrong reviewed answers are still caught by review: ${ocrWrongReviewedRows.map((row) => `\`${row.file} Q${row.questionNum} ${row.truth}->${row.predicted}\``).join(', ')}.`)
  } else {
    lines.push(`- No reviewed answers are OCR-wrong in this run; all ${reviewedTotal} review flags are caution/calibration flags rather than observed recognition failures.`)
  }
  lines.push('- The easiest safe production gain is probably not a broad confidence loosen. The current data suggests a smaller bug/definition split: OCR confidence and grading confidence are mixed together, especially for student answers that differ from the key.')
  lines.push('- A reason-family whitelist can lift confidence sharply on this set with zero observed confident wrongs, but it may trust low-probability rescue cases. That is evidence, not automatically a safe production policy.')
  lines.push(`- Hitting ${analysis.target.requiredConfidentAnswers}/${analysis.current.totalAnswers} confident answers requires stronger OCR-specific trust features, not just simple raw-threshold loosening.`)
  return `${lines.join('\n')}\n`
}

const opts = parseArgs(process.argv.slice(2))
const score = await readJson(path.join(opts.runDir, 'truth-score.json'))
const replayRows = await readJson(path.join(opts.runDir, 'rows.json'))
const replayByFile = new Map(replayRows.map((row) => [basename(row.file), row]))

const debugByFile = new Map()
for (const row of replayRows) {
  if (!row?.id) continue
  try {
    debugByFile.set(basename(row.file), await readJson(path.join(opts.runDir, 'debug', row.id, 'ocr-debug.json')))
  } catch {
    // The analysis can still use truth-score fields if a debug file is missing.
  }
}

const enrichedRows = score.rows.map((row) => {
  const debug = debugByFile.get(row.file)
  const predictions = (debug?.predictions || [])
    .filter((prediction) => Number(prediction?.questionNum) === Number(row.questionNum))
  const reviewedPredictions = predictions.filter((prediction) => prediction.reviewNeeded)
  let reviewCause = 'recorded-review-reason'
  if (row.reviewNeeded && !row.reviewReasons.length) {
    if (reviewedPredictions.some((prediction) => prediction.correct === false)) {
      reviewCause = 'answer-key-mismatch-auto-x-gate'
    } else if (reviewedPredictions.some((prediction) => prediction.correct === true)) {
      reviewCause = 'answer-key-match-auto-check-gate'
    } else {
      reviewCause = 'low-signal-or-missing-prediction'
    }
  }
  return {
    ...row,
    reviewReasonKey: reasonKey(row),
    reviewFamily: row.reviewNeeded ? reasonFamily(row) : 'Already confident',
    reviewCause,
    debugPredictions: predictions.map((prediction) => ({
      id: prediction.id,
      digitIndex: prediction.digitIndex,
      digit: prediction.digit,
      confidence: prediction.confidence,
      topGap: prediction.topGap,
      reviewNeeded: prediction.reviewNeeded,
      correct: prediction.correct,
      preprocessReviewReason: prediction.preprocessReviewReason || null,
      robustOverride: prediction.robustOverride || null
    })),
    replayId: replayByFile.get(row.file)?.id || null
  }
})

const reviewedRows = enrichedRows.filter((row) => row.reviewNeeded)
const exactReasonMap = new Map()
const familyMap = new Map()
for (const row of reviewedRows) {
  addBucket(exactReasonMap, row.reviewReasonKey, row)
  addBucket(familyMap, row.reviewFamily, row)
}

const reasonStats = Array.from(exactReasonMap.values())
const dangerousReasons = new Set(
  reasonStats
    .filter((bucket) => bucket.handwrittenWrong > 0)
    .map((bucket) => bucket.key)
)

const targetCoverage = Number(score.target?.confident_read_coverage_min ?? 0.95)
const requiredConfidentAnswers = Math.ceil(enrichedRows.length * targetCoverage)
const currentConfidentRows = enrichedRows.filter((row) => row.confident)

const analysis = {
  generatedAt: new Date().toISOString(),
  runDir: opts.runDir,
  rows: enrichedRows,
  current: {
    totalAnswers: enrichedRows.length,
    confidentAnswers: currentConfidentRows.length,
    confidentCoverage: enrichedRows.length ? currentConfidentRows.length / enrichedRows.length : 0,
    confidentWrong: currentConfidentRows.filter((row) => !row.handwrittenCorrect).length,
    handwrittenCorrectAnswers: enrichedRows.filter((row) => row.handwrittenCorrect).length,
    handwrittenAccuracy: enrichedRows.length
      ? enrichedRows.filter((row) => row.handwrittenCorrect).length / enrichedRows.length
      : 0
  },
  target: {
    coverage: targetCoverage,
    requiredConfidentAnswers,
    additionalNeeded: Math.max(0, requiredConfidentAnswers - currentConfidentRows.length)
  },
  reviewed: summarizeRows(reviewedRows),
  reviewFamilies: Array.from(familyMap.values()).sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)),
  reasonBuckets: reasonStats.sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)),
  noReasonRows: reviewedRows
    .filter((row) => row.reviewReasonKey === 'NO_RECORDED_DIGIT_REASON')
    .map((row) => ({
      file: row.file,
      questionNum: row.questionNum,
      truth: row.truth,
      predicted: row.predicted,
      answerKey: row.answerKey,
      handwrittenCorrect: row.handwrittenCorrect,
      truthMatchesAnswerKey: row.truthMatchesAnswerKey,
      minConfidence: row.minConfidence,
      minTopGap: row.minTopGap,
      reviewCause: row.reviewCause,
      debugPredictions: row.debugPredictions
    })),
  simulations: []
}

analysis.simulations.push(
  ruleSummary(score, 'current', 'Current policy', () => false, 'Baseline from app debug flags.'),
  ruleSummary(
    score,
    'high-signal-no-reason',
    'Promote high-signal no-reason reviews',
    (row) => row.reviewReasons.length === 0 && row.minConfidence >= 0.78 && row.minTopGap >= 0.08,
    'Targets review flags caused by grading gates, not explicit OCR rescue reasons.'
  ),
  ruleSummary(
    score,
    'moderate-auto-x-no-reason',
    'Promote moderate no-reason mismatches',
    (row) =>
      row.reviewReasons.length === 0 &&
      !row.answerKeyCorrect &&
      row.minConfidence >= 0.74 &&
      row.minTopGap >= 0.28,
    'Models a slightly looser auto-X gate for answer-key mismatches.'
  ),
  ruleSummary(
    score,
    'observed-safe-reason-families',
    'Promote observed-safe reason families',
    (row) => row.reviewReasons.length > 0 && noDangerousReason(reasonKey(row), dangerousReasons),
    'Evidence-only whitelist: every exact reason promoted here had zero OCR wrongs in this SG3 run.'
  ),
  ruleSummary(
    score,
    'observed-safe-plus-moderate-no-reason',
    'Observed-safe reasons + moderate no-reason',
    (row) =>
      (row.reviewReasons.length > 0 && noDangerousReason(reasonKey(row), dangerousReasons)) ||
      (
        row.reviewReasons.length === 0 &&
        !row.answerKeyCorrect &&
        row.minConfidence >= 0.74 &&
        row.minTopGap >= 0.28
      ),
    'Aggressive evidence pass; still one answer short of 95% on this set.'
  ),
  ruleSummary(
    score,
    'oracle-correct-reviewed',
    'Oracle: promote all reviewed OCR-correct',
    (row) => row.handwrittenCorrect,
    'Upper bound using handwritten truth labels; not available in production.'
  ),
  ruleSummary(
    score,
    'all-reviewed',
    'Promote all reviewed answers',
    () => true,
    'Shows the cost of dropping review gates completely.'
  )
)

await fs.mkdir(opts.outDir, { recursive: true })
await fs.writeFile(path.join(opts.outDir, 'confidence-calibration.json'), JSON.stringify(analysis, null, 2))
await fs.writeFile(path.join(opts.outDir, 'confidence-calibration.md'), markdown(analysis))

console.log(JSON.stringify({
  runDir: analysis.runDir,
  current: `${analysis.current.confidentAnswers}/${analysis.current.totalAnswers}`,
  reviewedCorrect: `${analysis.reviewed.handwrittenCorrect}/${analysis.reviewed.total}`,
  additionalNeeded: analysis.target.additionalNeeded,
  safestSimulation: analysis.simulations.find((simulation) => simulation.id === 'high-signal-no-reason'),
  target: `${analysis.target.requiredConfidentAnswers}/${analysis.current.totalAnswers}`
}, null, 2))
