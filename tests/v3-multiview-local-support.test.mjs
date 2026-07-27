import test from 'node:test'
import assert from 'node:assert/strict'
import { multiviewLocalSupportDecision } from '../src/v3/multiview-local-support.js'

function evidence(read = '14') {
  return {
    continuous: { read, minTokenProbability: 0.82 },
    stitched: { read, minTokenProbability: 0.73 },
    sequenceFrameConsensus: { text: read, count: 2, usableFrameCount: 3, tied: false },
    localCandidates: [
      { read: '16', probability: 0.64 },
      { read: '19', probability: 0.25 },
      { read, probability: 0.08 },
    ],
    slotCount: 2,
  }
}

test('promotes only an existing yellow with stable multi-view and local top-three support', () => {
  const result = multiviewLocalSupportDecision(evidence())
  assert.equal(result.promote, true)
  assert.equal(result.automaticText, '14')
  assert.equal(result.reason, 'strict-multiview-local-support')
  assert.equal(result.answerKeyUsed, false)
})

test('blocks the P05 17 to 12 conflict when stitched or the local model disagrees', () => {
  const result = multiviewLocalSupportDecision({
    ...evidence('12'),
    stitched: { read: '17', minTokenProbability: 0.99 },
    localCandidates: [{ read: '17', probability: 0.68 }, { read: '11', probability: 0.30 }, { read: '16', probability: 0.01 }],
  })
  assert.equal(result.promote, false)
  assert.equal(result.reason, 'strong-view-disagreement')
})

test('preserves nested ambiguity and top-level safety vetoes by default', () => {
  for (const extra of [
    { ambiguity: { detected: true, reasons: [{ reason: 'override-retained-material-rival' }] } },
    { ambiguity: { detected: true, reasons: [{ reason: 'model-families-disagree' }] } },
    { confidenceSafetyVetoed: true },
    { highRiskConflict: true },
  ]) {
    const result = multiviewLocalSupportDecision({ ...evidence(), ...extra })
    assert.equal(result.promote, false)
    assert.equal(result.reason, 'existing-safety-or-ambiguity-veto-dominates')
  }
})

test('keeps override-only clearance explicit and analysis-only', () => {
  const result = multiviewLocalSupportDecision({
    ...evidence('40'),
    ambiguity: { detected: true, reasons: [{ reason: 'override-retained-material-rival' }] },
    allowOverrideOnlyClearance: true,
  })
  assert.equal(result.promote, true)
  assert.equal(result.reason, 'analysis-only-override-clearance-multiview-local-support')
  assert.equal(result.evidence.overrideOnlyVetoCleared, true)

  const neverClearsPhysicalConflict = multiviewLocalSupportDecision({
    ...evidence('40'),
    ambiguity: { detected: true, reasons: [{ reason: 'answer-ink-may-be-clipped' }] },
    allowOverrideOnlyClearance: true,
  })
  assert.equal(neverClearsPhysicalConflict.promote, false)
})

test('blocks weak/rank-four local support, weak strong views, and overlong output', () => {
  assert.equal(multiviewLocalSupportDecision({
    ...evidence(),
    localCandidates: [{ read: '16', probability: .5 }, { read: '19', probability: .2 }, { read: '10', probability: .1 }, { read: '14', probability: .1 }],
  }).promote, false)
  assert.equal(multiviewLocalSupportDecision({
    ...evidence(), continuous: { read: '14', minTokenProbability: .29 },
  }).promote, false)
  assert.equal(multiviewLocalSupportDecision({
    ...evidence('1212'), slotCount: 2, localCandidates: [{ read: '1212', probability: .9 }],
  }).promote, false)
})

test('mathematical answer-key fields cannot influence the decision', () => {
  const a = multiviewLocalSupportDecision({ ...evidence(), answer: '14', answerKey: '14', truth: '14' })
  const b = multiviewLocalSupportDecision({ ...evidence(), answer: '99', answerKey: '99', truth: '99' })
  assert.deepEqual(a, b)
})
