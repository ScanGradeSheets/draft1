#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const REPLAY = path.join(ROOT, 'private-evidence/reports/current-historical-browser-replay-20260714/debug')
const TRUTH = path.join(ROOT, 'private-evidence/reports/v3-historical-fresh-replay-20260713-score-visual-audited.json')
const OUT = path.join(ROOT, 'private-evidence/reports/confidence-clearance-historical-current-replay-20260714.json')

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const truthRows = read(TRUTH).rows
const truthByKey = new Map(truthRows.map((row) => [`${row.captureId}|${Number(row.questionNum)}`, row]))
const localFirst = read(path.join(ROOT, 'private-evidence/reports/v3-local-first-historical-single-frame-20260714.json'))
const localByKey = new Map(localFirst.rows.map((row) => [`${row.captureId}|${Number(row.questionNum)}`, row]))

function finalDigit(prediction) {
  if (prediction?.blank === true || prediction?.empty === true || prediction?.digit == null) return null
  const value = Number(prediction.digit)
  return Number.isInteger(value) ? value : null
}

function minorityVoteConflict(prediction, { minShare = 0.52, minMargin = 0.05 } = {}) {
  const selected = finalDigit(prediction)
  const vote = prediction?.preprocessVoteSummary || {}
  if (selected == null || !vote.top || Number(vote.top.digit) === selected) return false
  return Number(vote.top.share || 0) >= minShare && Number(vote.margin || 0) >= minMargin
}

function dangerousBoxSafeClearance(prediction) {
  return prediction?.confidencePolicyCleared === true &&
    prediction?.preprocessDisagreement === true &&
    prediction?.confidencePolicyClearanceReason === 'validated-review-reason:box-safe-default' &&
    minorityVoteConflict(prediction)
}

function clearedMinorityVote(prediction) {
  return prediction?.confidencePolicyCleared === true &&
    prediction?.preprocessDisagreement === true &&
    minorityVoteConflict(prediction)
}

function majorityAlternativeRead(read, prediction) {
  const selected = finalDigit(prediction)
  const voteTop = prediction?.preprocessVoteSummary?.top
  const index = Number(prediction?.digitIndex)
  if (selected == null || !voteTop || !Number.isInteger(index)) return null
  const text = String(read || '')
  if (index < 0 || index >= text.length || text[index] !== String(selected)) return null
  return `${text.slice(0, index)}${Number(voteTop.digit)}${text.slice(index + 1)}`
}

const answerRows = []
for (const directory of fs.readdirSync(REPLAY)) {
  const file = path.join(REPLAY, directory, 'ocr-debug.json')
  if (!fs.existsSync(file)) continue
  const debug = read(file)
  const shortId = directory.split('-')[0]
  const matchingTruth = truthRows.filter((row) => row.captureId.endsWith(shortId))
  if (!matchingTruth.length) throw new Error(`no truth page for ${directory}`)
  const captureId = matchingTruth[0].captureId
  const predictionsByQuestion = new Map()
  for (const prediction of debug.predictions || []) {
    const questionNum = Number(prediction.questionNum)
    if (!predictionsByQuestion.has(questionNum)) predictionsByQuestion.set(questionNum, [])
    predictionsByQuestion.get(questionNum).push(prediction)
  }
  for (const [index, group] of (debug.answerGroups || []).entries()) {
    const questionNum = Number(group?.questionNum ?? index + 1)
    const truth = truthByKey.get(`${captureId}|${questionNum}`)
    if (!truth) throw new Error(`missing truth ${captureId} Q${questionNum}`)
    const predictions = predictionsByQuestion.get(questionNum) || []
    const scorable = truth.truth !== null && truth.truth !== undefined
    const readText = String(group.answerText || '').replace(/[^0-9]/g, '') || null
    const local = localByKey.get(`${captureId}|${questionNum}`)
    const compactRead = local?.compactChoices?.[0] == null ? null : String(local.compactChoices[0])
    const compactSupportsDangerousMajorityAlternative = predictions.some((prediction) =>
      dangerousBoxSafeClearance(prediction) &&
      compactRead != null &&
      majorityAlternativeRead(readText, prediction) === compactRead)
    answerRows.push({
      captureId,
      split: truth.split,
      layoutId: truth.layoutId,
      family: truth.family,
      questionNum,
      truth: scorable ? String(truth.truth) : null,
      scorable,
      read: readText,
      automatic: group.reviewNeeded !== true,
      correct: scorable ? readText === String(truth.truth) : readText === null,
      signals: {
        dangerousBoxSafeClearance: predictions.some(dangerousBoxSafeClearance),
        clearedMinorityVote: predictions.some(clearedMinorityVote),
        compactSupportsDangerousMajorityAlternative,
      },
      compactRead,
      predictions: predictions.map((prediction) => ({
        id: prediction.id,
        digitIndex: prediction.digitIndex,
        digit: finalDigit(prediction),
        confidence: prediction.confidence,
        reviewNeeded: prediction.reviewNeeded === true,
        robustOverride: prediction.robustOverride || null,
        clearance: prediction.confidencePolicyClearanceReason || null,
        preprocessDisagreement: prediction.preprocessDisagreement === true,
        vote: prediction.preprocessVoteSummary || null,
      })),
      evidenceFile: path.relative(ROOT, file),
    })
  }
}

if (answerRows.length !== 582) throw new Error(`expected 582 answers, found ${answerRows.length}`)

const policies = {
  current: () => false,
  dangerous_box_safe_clearance_veto: (row) => row.signals.dangerousBoxSafeClearance,
  compact_confirmed_majority_alternative_veto: (row) => row.signals.compactSupportsDangerousMajorityAlternative,
  all_cleared_minority_vote_veto: (row) => row.signals.clearedMinorityVote,
}

function summarize(rows, veto) {
  const scorable = rows.filter((row) => row.scorable)
  const baselineAutomatic = scorable.filter((row) => row.automatic)
  const automatic = baselineAutomatic.filter((row) => !veto(row))
  return {
    answers: scorable.length,
    baselineAutomatic: baselineAutomatic.length,
    automatic: automatic.length,
    coveragePct: Number((100 * automatic.length / Math.max(1, scorable.length)).toFixed(1)),
    correctAutomatic: automatic.filter((row) => row.correct).length,
    wrongAutomatic: automatic.filter((row) => !row.correct).length,
    vetoed: baselineAutomatic.filter(veto).length,
    vetoedCorrect: baselineAutomatic.filter((row) => veto(row) && row.correct).length,
    vetoedWrong: baselineAutomatic.filter((row) => veto(row) && !row.correct).length,
  }
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  scope: 'Fresh current-browser replay of 86 historical pages and 582 visually audited truth rows.',
  answerKeyUsedByCandidateVeto: false,
  limitations: [
    'This historical corpus influenced development and is not a prospective holdout.',
    'Historical captures contain only one frame, so burst stability is unavailable.',
  ],
  policies: Object.fromEntries(Object.entries(policies).map(([name, veto]) => [name, {
    overall: summarize(answerRows, veto),
    row: summarize(answerRows.filter((row) => row.family === 'row'), veto),
    nonRow: summarize(answerRows.filter((row) => row.family !== 'row'), veto),
    vetoedExamples: answerRows.filter((row) => row.automatic && veto(row)).map((row) => ({
      captureId: row.captureId,
      layoutId: row.layoutId,
      questionNum: row.questionNum,
      truth: row.truth,
      read: row.read,
      correct: row.correct,
    })),
  }])),
  automaticErrors: answerRows.filter((row) => row.scorable && row.automatic && !row.correct),
  answerRows,
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), policies: report.policies, automaticErrors: report.automaticErrors }, null, 2))
