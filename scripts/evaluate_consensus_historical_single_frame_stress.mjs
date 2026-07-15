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
const OUT = 'private-evidence/reports/consensus-historical-single-frame-stress-20260714.json'

const historical = read('private-evidence/reports/v3-historical-fresh-replay-20260713-score-visual-audited.json')
const compact = read('private-evidence/reports/v3-local-candidates-existing-historical-20260714.json')
const safetyPages = read('private-evidence/reports/current-historical-confidence-safety-20260714/rows.json')
const corrections = read('private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/consensus-visual-audit-corrections-20260714.json')

if (historical.answerKeyUsedForRecognition !== false || historical.answerKeyUsedAsTruth !== false) {
  throw new Error('historical source does not preserve key-blind recognition and handwriting truth')
}
if (compact.answerKeyProvidedToModel !== false) throw new Error('historical compact source is not key-blind')

const correctionByKey = new Map(corrections.corrections.map((row) => [`${row.captureId}|${Number(row.questionNum)}`, row]))
const truthByKey = new Map(historical.rows.map((row) => [`${row.captureId}|${Number(row.questionNum)}`, row]))
const compactByKey = new Map(compact.rows.map((row) => [`${row.captureId}|${Number(row.questionNum)}`, row]))

function captureForSuffix(suffix, layoutId) {
  const matches = [...new Set(historical.rows
    .filter((row) => row.captureId.endsWith(suffix) && row.layoutId === layoutId)
    .map((row) => row.captureId))]
  if (matches.length !== 1) throw new Error(`expected one historical capture for ${suffix}|${layoutId}, found ${matches.length}`)
  return matches[0]
}

function summarize(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const current = scorable.filter((row) => row.currentAutomatic)
  const candidate = scorable.filter((row) => row.candidateAutomatic)
  const promotions = scorable.filter((row) => row.promoted)
  return {
    answers: rows.length,
    scorableAnswers: scorable.length,
    blankTruthAnswers: rows.length - scorable.length,
    currentAutomatic: current.length,
    currentCoveragePct: pct(current.length, scorable.length),
    currentAutomaticCorrect: current.filter((row) => row.currentCorrect).length,
    currentAutomaticWrong: current.filter((row) => !row.currentCorrect).length,
    surrogateCandidateAutomatic: candidate.length,
    surrogateCoveragePct: pct(candidate.length, scorable.length),
    surrogateAutomaticCorrect: candidate.filter((row) => row.candidateCorrect).length,
    surrogateAutomaticWrong: candidate.filter((row) => !row.candidateCorrect).length,
    surrogatePromotions: promotions.length,
    surrogateCorrectPromotions: promotions.filter((row) => row.candidateCorrect).length,
    surrogateWrongPromotions: promotions.filter((row) => !row.candidateCorrect).length,
  }
}

const rows = []
for (const safetyPage of safetyPages) {
  const suffix = safetyPage.id.replace(/-captured$/, '')
  const captureId = captureForSuffix(suffix, safetyPage.layoutId)
  const debugFile = path.join(ROOT, 'private-evidence/reports/current-historical-confidence-safety-20260714/debug', safetyPage.id, 'ocr-debug.json')
  const debug = JSON.parse(fs.readFileSync(debugFile, 'utf8'))
  const predictions = new Map((debug.predictions || []).map((prediction) => [Number(prediction.id), prediction]))
  const vetoQuestions = new Set((debug.confidenceClearanceVetoes || []).map((veto) => Number(veto.questionNum)))
  for (const group of debug.answerGroups || []) {
    const questionNum = Number(group.questionNum)
    const key = `${captureId}|${questionNum}`
    const source = truthByKey.get(key)
    const compactRow = compactByKey.get(key)
    if (!source) throw new Error(`missing historical truth join ${key}`)
    if (!compactRow && source.truth != null) throw new Error(`missing historical compact join ${key}`)
    const correction = correctionByKey.get(key)
    if (correction && digits(source.truth) !== digits(correction.from)) {
      throw new Error(`truth correction precondition failed for ${key}`)
    }
    const truth = digits(correction?.to ?? source.truth)
    const currentRead = digits(group.answerText)
    const currentAutomatic = group.reviewNeeded !== true
    const currentPredictions = (group.digitBoxIds || []).map((id) => predictions.get(Number(id))).filter(Boolean)
    const compactReads = [{
      questionNum,
      frameIndex: 0,
      read: compactRow?.candidates?.[0]?.read,
      topCandidates: compactRow?.candidates || [],
    }]
    const ambiguity = detectAnswerAmbiguity({ predictions: currentPredictions })
    // Historical captures retained one grayscale result, not three. Fabricating
    // three agreement fields here intentionally tests only all other gates. It
    // cannot validate the real three-frame requirement or justify promotion.
    const singleFrameSurrogate = source.largeRead && Number(source.largeMinConfidence) >= 0.70
      ? { text: source.largeRead, count: 3, usableFrameCount: 3, minConfidence: source.largeMinConfidence, tied: false }
      : null
    const decision = consensusPromotionDecision({
      currentRead,
      currentAutomatic,
      currentPredictions,
      confidenceSafetyVetoed: vetoQuestions.has(questionNum),
      sequenceFrameConsensus: singleFrameSurrogate,
      compactReads,
      slotCount: (group.digitBoxIds || []).length,
      ambiguity,
    })
    const promoted = !currentAutomatic && decision.promote
    const candidateRead = currentAutomatic ? currentRead : promoted ? decision.automaticText : null
    rows.push({
      captureId,
      split: source.split,
      layoutId: source.layoutId,
      layoutFamily: source.family,
      questionNum,
      truth,
      scorable: truth != null,
      truthCorrection: correction || source.truthCorrection || null,
      currentRead,
      currentAutomatic,
      currentCorrect: currentRead === truth,
      largeSingleFrameRead: digits(source.largeRead),
      largeSingleFrameMinConfidence: Number(source.largeMinConfidence || 0),
      compactCandidates: (compactRow?.candidates || []).slice(0, 2),
      confidenceSafetyVetoed: vetoQuestions.has(questionNum),
      ambiguity,
      promoted,
      promotionReason: decision.reason,
      promotionEvidence: decision.evidence,
      candidateRead,
      candidateAutomatic: candidateRead != null,
      candidateCorrect: candidateRead != null ? candidateRead === truth : null,
      debugFile: path.relative(ROOT, debugFile),
    })
  }
}

if (rows.length !== 582) throw new Error(`expected 582 historical answers, found ${rows.length}`)
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'historical single-frame stress only; not promotion evidence',
  answerKeyUsedForRecognition: false,
  answerKeyUsedAsHandwritingTruth: false,
  truthUsedOnlyForScoringAfterDecisions: true,
  limitations: [
    'Historical artifacts retained only one large grayscale recognition result per answer.',
    'The evaluator simulates 3-of-3 agreement solely to stress compact support, slot length, browser-conflict, and safety-veto gates.',
    'Any surviving error falsifies the policy; zero surviving errors does not validate cross-frame stability.',
  ],
  appliedTruthCorrections: corrections.corrections,
  overall: summarize(rows),
  byFamily: Object.fromEntries(['row', 'non-row'].map((family) => [family, summarize(rows.filter((row) => row.layoutFamily === family))])),
  bySplit: Object.fromEntries([...new Set(rows.map((row) => row.split))].sort().map((split) => [split, summarize(rows.filter((row) => row.split === split))])),
  rejectionReasons: Object.fromEntries([...new Set(rows.filter((row) => !row.currentAutomatic).map((row) => row.promotionReason))]
    .sort().map((reason) => [reason, rows.filter((row) => !row.currentAutomatic && row.promotionReason === reason).length])),
  wrongCandidateRows: rows.filter((row) => row.scorable && row.candidateAutomatic && !row.candidateCorrect),
  gates: {
    retainedDangerousFourToNineIsReview: rows.some((row) => row.captureId.includes('82a1269a') && row.questionNum === 4 && !row.candidateAutomatic),
    cleanFortyFiveToFifteenIsReview: rows.some((row) => row.captureId.includes('f331868e') && row.questionNum === 6 && !row.candidateAutomatic),
    zeroSurrogateAutomaticErrors: rows.every((row) => !row.scorable || !row.candidateAutomatic || row.candidateCorrect),
    productionChanged: false,
  },
  rows,
}

fs.writeFileSync(path.join(ROOT, OUT), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: OUT, overall: report.overall, byFamily: report.byFamily, bySplit: report.bySplit, rejectionReasons: report.rejectionReasons, wrongCandidateRows: report.wrongCandidateRows, gates: report.gates }, null, 2))
