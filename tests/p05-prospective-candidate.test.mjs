import test from 'node:test'
import assert from 'node:assert/strict'

import { scoreProspective } from '../scripts/score_p05_prospective_candidate.mjs'

const packetId = 'P05'
const layouts = Array.from({ length: 10 }, (_, index) =>
  `sg-g1-lw-${String(index + 1).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index]}`)
const protocol = {
  minimumIntegrity: { expectedAnswers: 10 },
  acceptance: {
    automaticCoverageMinimumPct: 85,
    rowAutomaticCoverageMinimumPct: 85,
    nonRowAutomaticCoverageMinimumPct: 80,
  },
}

function fixture({ wrong = false, duplicate = false } = {}) {
  const pageRows = layouts.map((layoutId, index) => ({ id: `page-${index}`, ok: true, layoutId }))
  if (duplicate) pageRows.push({ id: 'page-duplicate', ok: true })
  const debugByPage = new Map(pageRows.map((page, index) => {
    const layoutId = index < layouts.length ? layouts[index] : layouts[0]
    return [page.id, {
      packetId,
      layoutId,
      answerGroups: [{ questionNum: 1, answerText: wrong && index === 0 ? '8' : '6', reviewNeeded: false }],
      v3AnswerZones: [{ questionNum: 1 }],
      v3Shadow: {
        status: 'complete', frameCount: 3, consensusPromotionEnabled: true,
        consensusApplication: { applied: [] }, affectsGrade: false,
        decisions: [{ questionNum: 1, sequenceRead: '6' }],
      },
      annotationRegions: [{ questionNum: 1, reviewNeeded: false }],
      markedSheetDataUrl: 'data:image/png;base64,x',
    }]
  }))
  const truth = {
    answerKeyUsedAsTruth: false,
    labels: layouts.map((layoutId) => ({
      packetId, layoutId, questionNum: 1, truthState: 'value', handwrittenTruth: '6', qaStatus: 'verified',
      primaryLabeler: 'primary', verificationLabeler: 'verification',
    })),
  }
  const shadow = {
    answerKeyProvidedToModel: false,
    predictions: layouts.map((layoutId) => ({ uid: `${packetId}|${layoutId}|1`, read: '6' })),
  }
  return { packetId, pageRows, debugByPage, truth, shadow, protocol }
}

test('P05 scorer keeps transcription, math correctness, and shadow evidence separate', () => {
  const report = scoreProspective(fixture())
  assert.equal(report.issues.length, 0)
  assert.equal(report.overall.automatic, 10)
  assert.equal(report.overall.automaticWrong, 0)
  assert.equal(report.overall.shadowTop1Correct, 10)
  assert.equal(report.overall.shadowStrongAgreementCorrect, 10)
  assert.equal(report.gates.passed, true)
})

test('P05 scorer fails the hard gate on one confident transcription error', () => {
  const report = scoreProspective(fixture({ wrong: true }))
  assert.equal(report.overall.automaticWrong, 1)
  assert.equal(report.gates.zeroConfidentTranscriptionErrors, false)
  assert.equal(report.gates.passed, false)
})

test('P05 scorer rejects duplicate successful pages instead of choosing one', () => {
  const report = scoreProspective(fixture({ duplicate: true }))
  assert.match(report.issues.join('\n'), /has 2 successful pages/)
  assert.equal(report.gates.integrityValid, false)
  assert.equal(report.gates.passed, false)
})

test('P05 scorer accepts a complete page with zero applied promotions', () => {
  const report = scoreProspective(fixture())
  assert.doesNotMatch(report.issues.join('\n'), /did not affect grade|automatic candidate was disabled|grade-effect flag/)
  assert.equal(report.gates.integrityValid, true)
})

test('P05 scorer rejects a disabled automatic candidate even when the page completed', () => {
  const input = fixture()
  input.debugByPage.get('page-0').v3Shadow.consensusPromotionEnabled = false
  const report = scoreProspective(input)
  assert.match(report.issues.join('\n'), /automatic candidate was disabled/)
  assert.equal(report.gates.integrityValid, false)
})

test('P05 scorer accepts a resolved whole-answer annotation with a stale slot review flag', () => {
  const input = fixture()
  input.debugByPage.get('page-0').annotationRegions = [{
    questionNum: 1,
    reviewNeeded: true,
    questionReviewNeeded: false,
  }]
  const report = scoreProspective(input)
  assert.equal(report.rows.find((row) => row.pageId === 'page-0').annotationConsistent, true)
  assert.equal(report.gates.annotationAlignment, true)
})

test('P05 scorer rejects an automatic answer whose question remains marked for review', () => {
  const input = fixture()
  input.debugByPage.get('page-0').annotationRegions = [{
    questionNum: 1,
    reviewNeeded: true,
    questionReviewNeeded: true,
  }]
  const report = scoreProspective(input)
  assert.equal(report.rows.find((row) => row.pageId === 'page-0').annotationConsistent, false)
  assert.equal(report.gates.annotationAlignment, false)
})
