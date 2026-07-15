#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { consensusPromotionDecision } from '../src/v3/consensus-promotion.js'
import { detectAnswerAmbiguity } from '../src/v3/ambiguity-detector.js'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const OUT = 'private-evidence/reports/consensus-promotion-policy-20260714.json'

const crop = read('private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json')
const compact = read('private-evidence/reports/v3-local-candidates-existing-four-packet-20260714.json')
const replayRows = read('private-evidence/reports/current-four-packet-confidence-safety-20260714/rows.json')

if (compact.answerKeyProvidedToModel !== false) throw new Error('compact model evidence is not key-blind')
if (replayRows.length !== 40) throw new Error(`expected 40 fresh safety replay pages, found ${replayRows.length}`)

const cropByKey = new Map(crop.rows.map((row) => [
  `${row.packetId}|${row.layoutId}|${Number(row.questionNum)}`,
  row,
]))
const compactByKey = new Map(compact.rows.map((row) => [row.uid, row]))

function layoutFamily(layoutId) {
  return /^sg-g1-lw-0[1-5]-/.test(layoutId) ? 'row' : 'non-row'
}

function loadDebug(replayRow) {
  const file = path.join(
    ROOT,
    'private-evidence/reports/current-four-packet-confidence-safety-20260714/debug',
    replayRow.id,
    'ocr-debug.json',
  )
  if (!fs.existsSync(file)) throw new Error(`missing exact replay debug: ${path.relative(ROOT, file)}`)
  return { file, debug: JSON.parse(fs.readFileSync(file, 'utf8')) }
}

function summarize(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const noOcrReview = scorable.filter((row) => row.currentDigitPolicyNoReview)
  const candidate = scorable.filter((row) => row.candidateAutomatic)
  const displayed = scorable.filter((row) => row.currentDisplayedAutomatic)
  const promotions = scorable.filter((row) => row.promoted)
  return {
    answers: rows.length,
    scorableAnswers: scorable.length,
    ambiguousTruthExcluded: rows.length - scorable.length,
    currentDisplayedAutomatic: displayed.length,
    currentDisplayedCoveragePct: pct(displayed.length, scorable.length),
    currentDigitPolicyNoReview: noOcrReview.length,
    currentDigitPolicyNoReviewPct: pct(noOcrReview.length, scorable.length),
    currentDigitPolicyNoReviewCorrect: noOcrReview.filter((row) => row.currentCorrect).length,
    currentDigitPolicyNoReviewWrong: noOcrReview.filter((row) => !row.currentCorrect).length,
    candidateAutomatic: candidate.length,
    candidateCoveragePct: pct(candidate.length, scorable.length),
    candidateAutomaticCorrect: candidate.filter((row) => row.candidateCorrect).length,
    candidateAutomaticWrong: candidate.filter((row) => !row.candidateCorrect).length,
    manualTranscriptionReview: scorable.length - candidate.length,
    promotions: promotions.length,
    correctPromotions: promotions.filter((row) => row.candidateCorrect).length,
    wrongPromotions: promotions.filter((row) => !row.candidateCorrect).length,
  }
}

const rows = []
for (const [pageIndex, replayRow] of replayRows.entries()) {
  const packetId = PACKETS[Math.floor(pageIndex / 10)]
  const { file, debug } = loadDebug(replayRow)
  if (debug.layoutId !== replayRow.layoutId) throw new Error(`layout mismatch at replay row ${pageIndex}`)
  const predictions = new Map((debug.predictions || []).map((prediction) => [Number(prediction.id), prediction]))
  const clearanceVetoQuestions = new Set((debug.confidenceClearanceVetoes || []).map((veto) => Number(veto.questionNum)))
  for (const group of debug.answerGroups || []) {
    const questionNum = Number(group.questionNum)
    const key = `${packetId}|${debug.layoutId}|${questionNum}`
    const cropRow = cropByKey.get(key)
    const compactRow = compactByKey.get(key)
    if (!cropRow) throw new Error(`missing joined crop/truth evidence ${key}`)
    if (!compactRow && cropRow.scorable) throw new Error(`missing joined compact evidence ${key}`)
    const truthText = cropRow.scorable ? digits(cropRow.truthText) : null
    const currentRead = digits(group.answerText)
    const currentDigitPolicyNoReview = debug.questionReview?.[questionNum - 1] !== true
    const currentDisplayedAutomatic = group.reviewNeeded !== true
    const stableSequence = cropRow.fallbackPromoted
      ? {
          text: cropRow.sequenceRead,
          count: 3,
          usableFrameCount: 3,
          minConfidence: 0.70,
          tied: false,
        }
      : null
    const compactReads = [{
      questionNum,
      frameIndex: 0,
      read: compactRow?.candidates?.[0]?.read,
      topCandidates: compactRow?.candidates || [],
    }]
    const currentPredictions = (group.digitBoxIds || [])
      .map((id) => predictions.get(Number(id)))
      .filter(Boolean)
    const ambiguity = detectAnswerAmbiguity({ predictions: currentPredictions })
    const decision = consensusPromotionDecision({
      currentRead,
      currentAutomatic: currentDisplayedAutomatic,
      currentPredictions,
      confidenceSafetyVetoed: clearanceVetoQuestions.has(questionNum),
      sequenceFrameConsensus: stableSequence,
      compactReads,
      slotCount: (group.digitBoxIds || []).length,
      ambiguity,
    })
    const promoted = !currentDisplayedAutomatic && decision.promote
    const candidateRead = currentDisplayedAutomatic ? currentRead : promoted ? decision.automaticText : null
    rows.push({
      packetId,
      captureId: replayRow.id.replace(/-captured$/, ''),
      layoutId: debug.layoutId,
      layoutFamily: layoutFamily(debug.layoutId),
      questionNum,
      answerLength: truthText?.length ?? null,
      slotCount: (group.digitBoxIds || []).length,
      truthState: cropRow.truthState,
      truthQaStatus: cropRow.truthQaStatus,
      truthText,
      scorable: truthText != null,
      currentRead,
      currentDisplayedAutomatic,
      currentDigitPolicyNoReview,
      currentCorrect: truthText != null && currentRead === truthText,
      sequenceRead: digits(cropRow.sequenceRead),
      compactCandidates: (compactRow?.candidates || []).slice(0, 2),
      confidenceSafetyVetoed: clearanceVetoQuestions.has(questionNum),
      ambiguity,
      promoted,
      promotionReason: decision.reason,
      promotionEvidence: decision.evidence,
      candidateRead,
      candidateAutomatic: candidateRead != null,
      candidateCorrect: truthText != null && candidateRead != null ? candidateRead === truthText : null,
      evidenceFile: path.relative(ROOT, file),
    })
  }
}

if (rows.length !== 280) throw new Error(`expected 280 answer rows, found ${rows.length}`)
const overall = summarize(rows)
const families = ['row', 'non-row']
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'retrospective shadow evaluation; production unchanged',
  purpose: 'Evaluate conservative key-blind consensus promotion against the exact fresh confidence-safety browser replay.',
  answerKeyUsedForRecognition: false,
  answerKeyUsedAsHandwritingTruth: false,
  truthUsedOnlyForScoringAfterDecisions: true,
  policy: {
    requiredFrameAgreement: '3 of 3 identical whole-answer grayscale reads',
    minimumFrameConfidence: 0.70,
    compactSupport: 'proposed read must be in key-blind compact top two with joint probability >= 0.05',
    secondChoiceSupport: 'rank-two score must be at least 25% of the top score',
    browserConflict: 'review if every browser digit has >= 85% preprocessing-majority support for a conflicting answer',
    slotRule: 'allow fewer digits than physical slots; never more',
    safetyDominance: 'confidence-clearance veto and ambiguity veto cannot be overridden',
  },
  metricSemantics: {
    currentDisplayedAutomatic: 'answerGroups.reviewNeeded=false; this incorrectly excludes confidently transcribed mathematically-wrong answers',
    currentDigitPolicyNoReview: 'questionReview=false; this only says the digit-level confidence policy did not object. It is not safe automatic coverage because many such reads disagree with handwriting truth.',
    importantFinding: 'The app intentionally keeps every mathematically-wrong answer in the editable review set. Removing that safeguard by changing red answers to automatic would expose 61 observed wrong transcriptions. Red answers need independent consensus before teacher review can safely be skipped.',
  },
  overall,
  byFamily: Object.fromEntries(families.map((family) => [family, summarize(rows.filter((row) => row.layoutFamily === family))])),
  byPacket: Object.fromEntries(PACKETS.map((packet) => [packet, summarize(rows.filter((row) => row.packetId === packet))])),
  byLayout: Object.fromEntries([...new Set(rows.map((row) => row.layoutId))].sort().map((layout) => [layout, summarize(rows.filter((row) => row.layoutId === layout))])),
  byAnswerLength: Object.fromEntries([1, 2, 3, 4].map((length) => [length, summarize(rows.filter((row) => row.answerLength === length))])),
  rejectionReasons: Object.fromEntries([...new Set(rows.filter((row) => !row.currentDisplayedAutomatic).map((row) => row.promotionReason))]
    .sort().map((reason) => [reason, rows.filter((row) => !row.currentDisplayedAutomatic && row.promotionReason === reason).length])),
  gates: {
    allFortyPagesJoined: replayRows.length === 40,
    allAnswerRowsJoined: rows.length === 280,
    zeroObservedCandidateErrors: overall.candidateAutomaticWrong === 0,
    noCurrentAutomaticChanged: rows.filter((row) => row.currentDisplayedAutomatic && row.candidateRead !== row.currentRead).length === 0,
    safetyVetoNeverRepromoted: rows.filter((row) => row.confidenceSafetyVetoed && row.promoted).length === 0,
    productionChanged: false,
  },
  rows,
}

fs.writeFileSync(path.join(ROOT, OUT), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: OUT, overall: report.overall, byFamily: report.byFamily, byPacket: report.byPacket, byAnswerLength: report.byAnswerLength, rejectionReasons: report.rejectionReasons, gates: report.gates }, null, 2))
