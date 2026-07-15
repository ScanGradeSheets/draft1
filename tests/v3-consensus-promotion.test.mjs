import test from 'node:test'
import assert from 'node:assert/strict'
import {
  browserHasStableConflictingEvidence,
  consensusPromotionDecision,
} from '../src/v3/consensus-promotion.js'

function consensus(text = '12', overrides = {}) {
  return { text, count: 3, usableFrameCount: 3, minConfidence: 0.82, tied: false, ...overrides }
}

function compact(...rows) {
  return [{
    questionNum: 1,
    frameIndex: 0,
    read: rows[0]?.read,
    topCandidates: rows,
  }]
}

function prediction(index, digit, share = 0.90) {
  return {
    digitIndex: index,
    digit,
    preprocessVoteSummary: { top: { digit, share } },
  }
}

test('promotes exact three-frame grayscale consensus supported by compact top choice', () => {
  const result = consensusPromotionDecision({
    currentRead: '17',
    sequenceFrameConsensus: consensus('12'),
    compactReads: compact({ read: '12', jointProbability: 0.72, minComponentProbability: 0.80 }),
    slotCount: 2,
  })
  assert.equal(result.promote, true)
  assert.equal(result.automaticText, '12')
  assert.equal(result.answerKeyUsed, false)
})

test('allows a genuinely empty leading optional slot', () => {
  const result = consensusPromotionDecision({
    sequenceFrameConsensus: consensus('7'),
    compactReads: compact({ read: '7', jointProbability: 0.8, minComponentProbability: 0.8 }),
    slotCount: 2,
  })
  assert.equal(result.promote, true)
  assert.equal(result.automaticText, '7')
})

test('blocks duplicated or overlong answers such as 12 to 1212', () => {
  const result = consensusPromotionDecision({
    sequenceFrameConsensus: consensus('1212'),
    compactReads: compact({ read: '1212', jointProbability: 0.9, minComponentProbability: 0.9 }),
    slotCount: 2,
  })
  assert.equal(result.promote, false)
  assert.equal(result.reason, 'answer-length-exceeds-slot-metadata')
})

test('requires exactly three agreeing retained frames with sufficient minimum confidence', () => {
  for (const bad of [
    consensus('12', { count: 2 }),
    consensus('12', { usableFrameCount: 2 }),
    consensus('12', { minConfidence: 0.69 }),
    consensus('12', { tied: true }),
  ]) {
    assert.equal(consensusPromotionDecision({
      sequenceFrameConsensus: bad,
      compactReads: compact({ read: '12', jointProbability: 0.8, minComponentProbability: 0.8 }),
      slotCount: 2,
    }).promote, false)
  }
})

test('blocks the overwritten 34 to 39 case when compact does not contain 39', () => {
  const result = consensusPromotionDecision({
    currentRead: '34',
    sequenceFrameConsensus: consensus('39'),
    compactReads: compact(
      { read: '34', jointProbability: 0.7, minComponentProbability: 0.8 },
      { read: '38', jointProbability: 0.2, minComponentProbability: 0.5 },
    ),
    slotCount: 2,
  })
  assert.equal(result.promote, false)
  assert.equal(result.reason, 'whole-answer-compact-model-does-not-support-consensus')
})

test('blocks weak second-choice support but accepts material second-choice support', () => {
  const weak = consensusPromotionDecision({
    sequenceFrameConsensus: consensus('10'),
    compactReads: compact(
      { read: '16', jointProbability: 0.58, minComponentProbability: 0.7 },
      { read: '10', jointProbability: 0.123, minComponentProbability: 0.3 },
    ),
    slotCount: 2,
  })
  assert.equal(weak.promote, false)
  assert.equal(weak.reason, 'second-choice-compact-support-too-weak')

  const material = consensusPromotionDecision({
    sequenceFrameConsensus: consensus('10'),
    compactReads: compact(
      { read: '16', jointProbability: 0.58, minComponentProbability: 0.7 },
      { read: '10', jointProbability: 0.20, minComponentProbability: 0.4 },
    ),
    slotCount: 2,
  })
  assert.equal(material.promote, true)
})

test('stable browser preprocessing disagreement keeps the answer yellow', () => {
  const predictions = [prediction(0, 1), prediction(1, 9)]
  assert.equal(browserHasStableConflictingEvidence('19', '11', predictions), true)
  const result = consensusPromotionDecision({
    currentRead: '19',
    currentPredictions: predictions,
    sequenceFrameConsensus: consensus('11'),
    compactReads: compact({ read: '11', jointProbability: 0.85, minComponentProbability: 0.9 }),
    slotCount: 2,
  })
  assert.equal(result.promote, false)
  assert.equal(result.reason, 'browser-preprocessing-stably-conflicts')
})

test('ambiguity and confidence-safety vetoes dominate model agreement', () => {
  for (const veto of [
    { ambiguityDetected: true, expected: 'handwriting-ambiguity-detected' },
    { confidenceSafetyVetoed: true, expected: 'confidence-safety-veto-dominates' },
  ]) {
    const result = consensusPromotionDecision({
      ...veto,
      sequenceFrameConsensus: consensus('12'),
      compactReads: compact({ read: '12', jointProbability: 0.9, minComponentProbability: 0.9 }),
      slotCount: 2,
    })
    assert.equal(result.promote, false)
    assert.equal(result.reason, veto.expected)
  }
})

test('override ambiguity blocks models echoing the browser but not independent correction agreement', () => {
  const ambiguity = { detected: true, reasons: [{ reason: 'override-retained-material-rival' }] }
  const echoed = consensusPromotionDecision({
    currentRead: '11',
    ambiguity,
    sequenceFrameConsensus: consensus('11'),
    compactReads: compact({ read: '11', jointProbability: .8, minComponentProbability: .8 }),
    slotCount: 2,
  })
  assert.equal(echoed.promote, false)
  assert.equal(echoed.reason, 'handwriting-ambiguity-detected')

  const corrected = consensusPromotionDecision({
    currentRead: '13',
    ambiguity,
    sequenceFrameConsensus: consensus('12'),
    compactReads: compact({ read: '12', jointProbability: .8, minComponentProbability: .8 }),
    slotCount: 2,
  })
  assert.equal(corrected.promote, true)
})

test('mathematical answer keys cannot influence the decision', () => {
  const base = {
    currentRead: '17',
    sequenceFrameConsensus: consensus('12'),
    compactReads: compact({ read: '12', jointProbability: 0.72, minComponentProbability: 0.80 }),
    slotCount: 2,
  }
  const a = consensusPromotionDecision({ ...base, answer: 12, answerKey: '12' })
  const b = consensusPromotionDecision({ ...base, answer: 17, answerKey: '99' })
  assert.deepEqual(a, b)
})
