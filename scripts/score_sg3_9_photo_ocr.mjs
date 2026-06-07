#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DEFAULT_SCORECARD = path.join(ROOT, 'docs', 'SG3_9_PHOTO_OCR_SCORECARD.json')
const DEFAULT_RUN_DIR = path.join(
  ROOT,
  'private-evidence',
  'sg3-9-photo-confidence-20260606',
  'baseline-588425b'
)

function parseArgs(argv) {
  const opts = {
    scorecard: DEFAULT_SCORECARD,
    runDir: DEFAULT_RUN_DIR,
    outDir: null
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--scorecard') {
      opts.scorecard = path.resolve(argv[++i])
    } else if (arg === '--run') {
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

function asAnswer(value) {
  return value == null ? '' : String(value).trim()
}

function topGap(prediction) {
  if (Number.isFinite(Number(prediction?.topGap))) return Number(prediction.topGap)
  const topK = Array.isArray(prediction?.topK) ? prediction.topK : []
  return topK.length >= 2
    ? (Number(topK[0]?.confidence) || 0) - (Number(topK[1]?.confidence) || 0)
    : 1
}

function predictionGroups(predictions) {
  const groups = new Map()
  for (const prediction of predictions || []) {
    const questionNum = Number(prediction?.questionNum)
    if (!Number.isInteger(questionNum) || questionNum < 1) continue
    if (!groups.has(questionNum)) groups.set(questionNum, [])
    groups.get(questionNum).push(prediction)
  }
  for (const predictionsForQuestion of groups.values()) {
    predictionsForQuestion.sort((a, b) => {
      const slotA = Number.isFinite(Number(a?.digitIndex)) ? Number(a.digitIndex) : Number(a?.id) || 0
      const slotB = Number.isFinite(Number(b?.digitIndex)) ? Number(b.digitIndex) : Number(b?.id) || 0
      return slotA - slotB
    })
  }
  return groups
}

function predictedAnswer(predictionsForQuestion) {
  return (predictionsForQuestion || [])
    .map((prediction) => prediction?.digit)
    .filter((digit) => digit !== undefined && digit !== null)
    .join('')
}

function groupReviewNeeded(debug, questionIndex, predictionsForQuestion) {
  const questionReview = Array.isArray(debug?.questionReview) ? debug.questionReview : null
  if (questionReview && typeof questionReview[questionIndex] === 'boolean') {
    return questionReview[questionIndex]
  }
  return (predictionsForQuestion || []).some((prediction) => prediction?.reviewNeeded === true)
}

function predictionStats(predictionsForQuestion) {
  const confidences = (predictionsForQuestion || [])
    .map((prediction) => Number(prediction?.confidence))
    .filter(Number.isFinite)
  const gaps = (predictionsForQuestion || [])
    .map(topGap)
    .filter(Number.isFinite)
  const reasons = (predictionsForQuestion || [])
    .map((prediction) => prediction?.preprocessReviewReason || prediction?.forcedReviewReason)
    .filter(Boolean)
  return {
    minConfidence: confidences.length ? Math.min(...confidences) : null,
    minTopGap: gaps.length ? Math.min(...gaps) : null,
    reviewReasons: Array.from(new Set(reasons))
  }
}

function digitScore(predicted, truth, confident) {
  const predictedDigits = asAnswer(predicted).split('')
  const truthDigits = asAnswer(truth).split('')
  const total = truthDigits.length
  let correct = 0
  for (let i = 0; i < truthDigits.length; i += 1) {
    if (predictedDigits[i] === truthDigits[i]) correct += 1
  }
  return {
    total,
    correct,
    confidentTotal: confident ? total : 0,
    confidentCorrect: confident ? correct : 0,
    confidentWrong: confident ? total - correct : 0
  }
}

async function readDebug(runDir, row) {
  if (!row?.id) return null
  const debugPath = path.join(runDir, 'debug', row.id, 'ocr-debug.json')
  try {
    return await readJson(debugPath)
  } catch {
    return null
  }
}

function summarize(rows) {
  const total = rows.length
  const confident = rows.filter((row) => row.confident).length
  const correct = rows.filter((row) => row.handwrittenCorrect).length
  const confidentCorrect = rows.filter((row) => row.confident && row.handwrittenCorrect).length
  const confidentWrong = rows.filter((row) => row.confident && !row.handwrittenCorrect).length
  const review = total - confident
  const answerKeyCorrect = rows.filter((row) => row.answerKeyCorrect).length
  const handwrittenMathWrong = rows.filter((row) => !row.truthMatchesAnswerKey).length
  const digitTotals = rows.reduce((acc, row) => {
    acc.total += row.digitScore.total
    acc.correct += row.digitScore.correct
    acc.confidentTotal += row.digitScore.confidentTotal
    acc.confidentCorrect += row.digitScore.confidentCorrect
    acc.confidentWrong += row.digitScore.confidentWrong
    return acc
  }, {
    total: 0,
    correct: 0,
    confidentTotal: 0,
    confidentCorrect: 0,
    confidentWrong: 0
  })
  return {
    answerSlotsTotal: total,
    confidentAnswerSlots: confident,
    reviewAnswerSlots: review,
    confidentReadCoverage: total ? confident / total : 0,
    handwrittenCorrectAnswerSlots: correct,
    handwrittenAccuracyAllSlots: total ? correct / total : 0,
    confidentCorrectAnswerSlots: confidentCorrect,
    confidentWrongAnswerSlots: confidentWrong,
    confidentAccuracy: confident ? confidentCorrect / confident : null,
    answerKeyCorrectSlots: answerKeyCorrect,
    answerKeyAccuracyAllSlots: total ? answerKeyCorrect / total : 0,
    handwrittenMathWrongSlots: handwrittenMathWrong,
    digitSlotsTotal: digitTotals.total,
    digitSlotsCorrect: digitTotals.correct,
    digitAccuracyAllSlots: digitTotals.total ? digitTotals.correct / digitTotals.total : 0,
    confidentDigitSlots: digitTotals.confidentTotal,
    confidentDigitSlotsCorrect: digitTotals.confidentCorrect,
    confidentDigitSlotsWrong: digitTotals.confidentWrong,
    confidentDigitAccuracy: digitTotals.confidentTotal ? digitTotals.confidentCorrect / digitTotals.confidentTotal : null
  }
}

function sheetSummaries(rows) {
  const byFile = new Map()
  for (const row of rows) {
    if (!byFile.has(row.file)) byFile.set(row.file, [])
    byFile.get(row.file).push(row)
  }
  return Array.from(byFile.entries()).map(([file, sheetRows]) => {
    const confident = sheetRows.filter((row) => row.confident).length
    const confidentWrong = sheetRows.filter((row) => row.confident && !row.handwrittenCorrect).length
    const correct = sheetRows.filter((row) => row.handwrittenCorrect).length
    return {
      file,
      templateId: sheetRows[0]?.templateId || null,
      predicted: sheetRows.map((row) => row.predicted).join(','),
      truth: sheetRows.map((row) => row.truth).join(','),
      confident,
      review: sheetRows.length - confident,
      correct,
      total: sheetRows.length,
      confidentWrong
    }
  })
}

function markdown(report) {
  const lines = []
  lines.push('# SG3 9-Photo OCR Truth Score')
  lines.push('')
  lines.push(`- Run: \`${report.runDir}\``)
  lines.push(`- Scorecard: \`${report.scorecard}\``)
  lines.push(`- Generated: ${report.generatedAt}`)
  lines.push(`- Answer confident coverage: ${report.summary.confidentAnswerSlots}/${report.summary.answerSlotsTotal} (${pct(report.summary.confidentReadCoverage)})`)
  lines.push(`- Confident answer accuracy vs handwriting: ${report.summary.confidentCorrectAnswerSlots}/${report.summary.confidentAnswerSlots} (${pct(report.summary.confidentAccuracy)})`)
  lines.push(`- Confident wrong answers: ${report.summary.confidentWrongAnswerSlots}`)
  lines.push(`- All-answer OCR accuracy vs handwriting: ${report.summary.handwrittenCorrectAnswerSlots}/${report.summary.answerSlotsTotal} (${pct(report.summary.handwrittenAccuracyAllSlots)})`)
  lines.push(`- Confident digit accuracy vs handwriting: ${report.summary.confidentDigitSlotsCorrect}/${report.summary.confidentDigitSlots} (${pct(report.summary.confidentDigitAccuracy)})`)
  lines.push(`- Handwritten answers that differ from answer key: ${report.summary.handwrittenMathWrongSlots}`)
  lines.push('')
  lines.push('| Sheet | OCR Correct | Confident | Review | Confident Wrong | Predictions | Notes |')
  lines.push('|---|---:|---:|---:|---:|---|---|')
  for (const sheet of report.sheets) {
    const notes = report.rows
      .filter((row) => row.file === sheet.file && (!row.handwrittenCorrect || row.reviewNeeded))
      .map((row) => {
        const state = row.reviewNeeded ? 'review' : 'confident'
        return `Q${row.questionNum} ${row.truth}->${row.predicted} ${state}`
      })
      .join('; ') || 'ok'
    lines.push(`| ${sheet.file} | ${sheet.correct}/${sheet.total} | ${sheet.confident}/${sheet.total} | ${sheet.review} | ${sheet.confidentWrong} | ${sheet.predicted} | ${notes} |`)
  }
  const exceptions = report.rows.filter((row) => row.reviewNeeded || !row.handwrittenCorrect)
  if (exceptions.length) {
    lines.push('')
    lines.push('| Sheet | Q | Truth | Predicted | Key | Confident | Handwriting Correct | Min Conf | Min Gap | Reasons |')
    lines.push('|---|---:|---:|---:|---:|---|---|---:|---:|---|')
    for (const row of exceptions) {
      lines.push([
        row.file,
        row.questionNum,
        row.truth,
        row.predicted,
        row.answerKey,
        row.confident ? 'yes' : 'no',
        row.handwrittenCorrect ? 'yes' : 'no',
        row.minConfidence == null ? 'n/a' : pct(row.minConfidence),
        row.minTopGap == null ? 'n/a' : pct(row.minTopGap),
        row.reviewReasons.join(', ') || '-'
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
    }
  }
  return `${lines.join('\n')}\n`
}

const opts = parseArgs(process.argv.slice(2))
const scorecard = await readJson(opts.scorecard)
const rows = await readJson(path.join(opts.runDir, 'rows.json'))
const rowsByFile = new Map(rows.map((row) => [path.basename(row.file), row]))
const templateAnswers = new Map(
  Object.entries(scorecard.templates || {}).map(([id, template]) => [
    id,
    (template.answer_key || []).map(asAnswer)
  ])
)

const scoredRows = []
for (const photo of scorecard.photos || []) {
  const file = path.basename(photo.file)
  const row = rowsByFile.get(file)
  const debug = await readDebug(opts.runDir, row)
  const predictions = debug?.predictions || row?.predictions || []
  const groups = predictionGroups(predictions)
  const truthAnswers = (photo.handwritten_truth || []).map(asAnswer)
  const keyAnswers = templateAnswers.get(photo.template_id) || []
  for (let i = 0; i < truthAnswers.length; i += 1) {
    const questionNum = i + 1
    const predictionsForQuestion = groups.get(questionNum) || []
    const predicted = predictedAnswer(predictionsForQuestion)
    const truth = truthAnswers[i]
    const answerKey = asAnswer(keyAnswers[i])
    const reviewNeeded = groupReviewNeeded(debug, i, predictionsForQuestion)
    const confident = predictionsForQuestion.length > 0 && !reviewNeeded
    const handwrittenCorrect = predicted === truth
    const answerKeyCorrect = predicted === answerKey
    const stats = predictionStats(predictionsForQuestion)
    scoredRows.push({
      file,
      templateId: photo.template_id,
      questionNum,
      truth,
      predicted,
      answerKey,
      truthMatchesAnswerKey: truth === answerKey,
      confident,
      reviewNeeded,
      handwrittenCorrect,
      answerKeyCorrect,
      minConfidence: stats.minConfidence,
      minTopGap: stats.minTopGap,
      reviewReasons: stats.reviewReasons,
      digitScore: digitScore(predicted, truth, confident)
    })
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  runDir: opts.runDir,
  scorecard: opts.scorecard,
  target: scorecard.target || null,
  summary: summarize(scoredRows),
  sheets: sheetSummaries(scoredRows),
  rows: scoredRows
}

report.targetResult = {
  confidentCoveragePass:
    report.summary.confidentReadCoverage >= Number(scorecard.target?.confident_read_coverage_min ?? 0.95),
  confidentWrongPass:
    report.summary.confidentWrongAnswerSlots <= Number(scorecard.target?.confident_wrong_max ?? 0),
  pass: false
}
report.targetResult.pass =
  report.targetResult.confidentCoveragePass && report.targetResult.confidentWrongPass

await fs.mkdir(opts.outDir, { recursive: true })
await fs.writeFile(path.join(opts.outDir, 'truth-score.json'), JSON.stringify(report, null, 2))
await fs.writeFile(path.join(opts.outDir, 'truth-score.md'), markdown(report))

console.log(JSON.stringify({
  runDir: report.runDir,
  answerCoverage: pct(report.summary.confidentReadCoverage),
  confidentAnswers: `${report.summary.confidentAnswerSlots}/${report.summary.answerSlotsTotal}`,
  confidentAccuracy: pct(report.summary.confidentAccuracy),
  confidentWrong: report.summary.confidentWrongAnswerSlots,
  allAnswerAccuracy: pct(report.summary.handwrittenAccuracyAllSlots),
  targetPass: report.targetResult.pass
}, null, 2))
