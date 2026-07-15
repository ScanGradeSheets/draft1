#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const read = (relative) => JSON.parse(fs.readFileSync(path.join(ROOT, relative), 'utf8'))
const overlay = read('private-evidence/reports/v3-crop-candidate-evaluation-20260714-final.json')
const recentCompact = read('private-evidence/reports/v3-local-candidates-existing-four-packet-20260714.json')
const historical = read('private-evidence/reports/v3-historical-fresh-replay-20260713-score-visual-audited.json')
const historicalCompact = read('private-evidence/reports/v3-local-candidates-existing-historical-20260714.json')

const recentCompactByKey = new Map(recentCompact.rows.map((row) => [row.uid, row]))
const promotions = overlay.rows.filter((row) => row.overlayPromoted)
const wrong = promotions.filter((row) => row.overlayCorrect === false)

function recentGate(topK, layoutOnly = null) {
  const vetoed = promotions.filter((row) => {
    if (layoutOnly && row.layoutId !== layoutOnly) return false
    const compact = recentCompactByKey.get(`${row.packetId}|${row.layoutId}|${row.questionNum}`)
    return !(compact?.candidates || []).slice(0, topK).some((candidate) => candidate.read === row.overlayRead)
  })
  const automatic = overlay.candidate.overall.automatic - vetoed.length
  const wrongRemoved = vetoed.filter((row) => row.overlayCorrect === false).length
  return {
    topK,
    layoutOnly,
    vetoed: vetoed.length,
    correctPromotionsLost: vetoed.filter((row) => row.overlayCorrect === true).length,
    automatic,
    coveragePct: Number((automatic / overlay.candidate.overall.scorableAnswers * 100).toFixed(1)),
    observedAutomaticWrong: overlay.candidate.overall.automaticWrong - wrongRemoved,
  }
}

const historicalCompactByKey = new Map(historicalCompact.rows.map((row) => [
  `${row.captureId}|${row.questionNum}`,
  row,
]))
const historicalAgreementErrors = historical.rows.filter((row) =>
  row.v2Automatic !== true
  && row.largeRead
  && row.largeRead === row.compactRead
  && row.largeCorrect === false
)
const historicalCleanPatternError = historicalAgreementErrors.find((row) =>
  row.captureId.includes('f331868e') && Number(row.questionNum) === 6
)
const historicalCleanPatternCandidates = historicalCompactByKey.get(
  `${historicalCleanPatternError?.captureId}|${historicalCleanPatternError?.questionNum}`,
)?.candidates || []

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  purpose: 'Test whether the 89.5% automatic overlay can be salvaged without hiding its observed error.',
  answerKeyUsedForRecognition: false,
  fourPacketOverlay: {
    scorableAnswers: overlay.candidate.overall.scorableAnswers,
    automatic: overlay.candidate.overall.automatic,
    coveragePct: overlay.candidate.overall.coveragePct,
    automaticCorrect: overlay.candidate.overall.automaticCorrect,
    automaticWrong: overlay.candidate.overall.automaticWrong,
    wrongRows: wrong,
  },
  errorAudit: {
    classification: 'overwritten/corrected handwriting; student appears to have formed a 9-like mark before writing a 4 over it',
    transcriptionTruthLabel: '34',
    modelRead: '39',
    browserRead: wrong[0]?.v2Read,
    compactRead: wrong[0]?.compactRead,
    automaticSafetyDisposition: 'review; understandable model output does not make an automatic 39 safe when the final intended mark may be 34',
    evidenceCrop: 'private-evidence/reports/v3-review-display-nonrow-safety-20260714/P09/debug/2080d9f1-captured/v3-zone-q1.png',
  },
  selectiveGates: {
    requireCompactTop2Everywhere: recentGate(2),
    requireCompactTop2OnNumberPatterns: recentGate(2, 'sg-g1-lw-09-number-patterns'),
  },
  historicalCounterexample: {
    description: 'Clean handwritten 45 on an older held-out number-pattern page; both recorded top reads said 15.',
    row: historicalCleanPatternError,
    compactTop5: historicalCleanPatternCandidates.slice(0, 5),
    truthInCompactTop2: historicalCleanPatternCandidates.slice(0, 2).some((candidate) => candidate.read === '45'),
    implication: 'Agreement alone is unsafe. The compact alternatives are useful for review: 45 is available as the second compact choice.',
    evidenceCrop: 'private-evidence/truth-labels/20260703-flex-duplicate-accepted/crops/2026-07-02_14-47-27-666-sg-g1-lw-09-number-patterns-f331868e-q06.png',
  },
  decision: {
    automaticPromotion: 'reject pending genuinely unseen validation',
    reviewUse: 'adopt experimentally',
    bestObservedSafetyVariant: 'number-pattern promotions require the strong read to appear in compact top two; 243/275 automatic (88.4%) and zero observed errors on the four recent packets',
    caveat: 'The selective gate was designed after inspecting failures and is not launch evidence. Keep it shadow-only until a new untouched packet block validates it.',
  },
}

const destination = path.join(ROOT, 'private-evidence/reports/v3-overlay-salvage-20260714.json')
fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ destination: path.relative(ROOT, destination), ...report }, null, 2))
