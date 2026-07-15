import test from 'node:test'
import assert from 'node:assert/strict'

import { evaluateFrozenProspective } from '../scripts/evaluate_v3_frozen_prospective.mjs'

const packetId = 'P03'
const layoutId = 'sg-g1-lw-06-ten-frames'
const plan = { seed: 'seed', selected: [{ packetId, role: 'development-2' }] }
const candidate = {
  name: 'test-candidate',
  prospectiveValidationPackets: [packetId],
  fallbackRule: {
    requiredUsableFrames: 3,
    requiredMatchingFrames: 3,
    tiesAllowed: false,
    minimumVisibleTokenConfidence: .7,
  },
}
const protocol = {
  expectedLayoutIds: [layoutId],
  requiredRetainedFrames: 3,
  expectedAnswerCount: 1,
  nonRowCoverageTargetPct: 82.5,
  maximumNonRowCoverageGapPoints: 5,
}

function truth(value = '6') {
  return {
    answerKeyUsedAsTruth: false,
    labels: [{
      packetId,
      layoutId,
      questionNum: 1,
      truthState: 'value',
      handwrittenTruth: value,
      qaStatus: 'verified',
      primaryLabeler: 'one',
      verificationLabeler: 'two',
    }],
  }
}

function sessions(read = '6', minConfidence = .9) {
  return [{
    sessionId: 'session-1',
    burstFrameCount: 3,
    successful: true,
    debug: {
      packetId,
      captureRole: 'development-2',
      capturePlanSeed: 'seed',
      layoutId,
      answerGroups: [{ questionNum: 1, answerText: '8', answer: 7, reviewNeeded: true }],
      v3AnswerZones: [{ questionNum: 1 }],
      v3Shadow: {
        status: 'complete',
        frameCount: 3,
        largeModelAvailable: true,
        decisions: [{
          questionNum: 1,
          sequenceRead: read,
          sequenceFrameConsensus: {
            text: read,
            usableFrameCount: 3,
            count: 3,
            tied: false,
            minConfidence,
          },
        }],
      },
    },
  }]
}

test('applies the frozen 3-of-3 key-blind fallback only to V2 review', () => {
  const report = evaluateFrozenProspective({ sessions: sessions(), truth: truth(), plan, candidate, protocol, packetId })
  assert.equal(report.integrity.valid, true)
  assert.equal(report.overall.fallbackPromoted, 1)
  assert.equal(report.overall.fallbackPromotedWrong, 0)
  assert.equal(report.byFamily['non-row'].frozenCoveragePct, 100)
  assert.equal(report.rows[0].studentMathCorrect, false)
})

test('records a confident transcription error rather than confusing it with math correctness', () => {
  const report = evaluateFrozenProspective({ sessions: sessions('5'), truth: truth('6'), plan, candidate, protocol, packetId })
  assert.equal(report.overall.fallbackPromotedWrong, 1)
  assert.equal(report.gate.zeroFallbackPromotionErrors, false)
  assert.equal(report.gate.productionPromotionEligible, false)
})

test('does not promote below the already-frozen confidence threshold', () => {
  const report = evaluateFrozenProspective({ sessions: sessions('6', .699), truth: truth(), plan, candidate, protocol, packetId })
  assert.equal(report.overall.fallbackPromoted, 0)
  assert.equal(report.overall.frozenAutomatic, 0)
})
