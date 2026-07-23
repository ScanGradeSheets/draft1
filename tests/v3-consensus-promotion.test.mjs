import test from 'node:test'
import assert from 'node:assert/strict'
import {
  browserHasStableConflictingEvidence,
  browserSupportsProposedRead,
  consensusPromotionDecision,
  consensusReviewVetoQuestionNums,
  coreCropReviewEligibleQuestionNums,
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

function probabilityPrediction(index, probabilities) {
  return { digitIndex: index, probs: probabilities }
}

test('routes only unresolved model-support vetoes to selected core-crop review', () => {
  const decisions = [
    { questionNum: 1, reason: 'whole-answer-compact-model-does-not-support-consensus' },
    { questionNum: 2, reason: 'whole-answer-compact-support-too-weak' },
    { questionNum: 3, reason: 'second-choice-compact-support-too-weak' },
    { questionNum: 4, reason: 'browser-preprocessing-stably-conflicts' },
    { questionNum: 5, reason: 'confidence-safety-veto-dominates' },
    { questionNum: 6, reason: 'handwriting-ambiguity-detected' },
    { questionNum: 7, reason: 'whole-answer-compact-support-too-weak', ambiguity: { detected: true } },
    { questionNum: 8, reason: 'already-automatic-not-a-promotion-candidate' },
    { questionNum: 'not-a-question', reason: 'whole-answer-compact-support-too-weak' },
  ]
  assert.deepEqual(coreCropReviewEligibleQuestionNums(decisions), [1, 2, 3, 4])
})

test('forces display review only for safety vetoes or two independent readers agreeing against browser', () => {
  const result = consensusReviewVetoQuestionNums({
    shadowDecisions: [
      { questionNum: 1, slotRead: '11', sequenceRead: '17', compactRead: '17', decision: { action: 'review' } },
      { questionNum: 2, slotRead: '19', sequenceRead: '17', compactRead: '14', decision: { action: 'review' } },
      { questionNum: 3, slotRead: '12', sequenceRead: '12', compactRead: '12', decision: { action: 'review' } },
      { questionNum: 7, slotRead: '15', sequenceRead: '16', compactRead: '16', decision: { action: 'automatic' } },
    ],
    promotionDecisions: [
      { questionNum: 4, promote: false, reason: 'high-risk-browser-and-near-certain-compact-conflict' },
      { questionNum: 5, promote: false, reason: 'insufficient-three-frame-consensus' },
      { questionNum: 6, promote: true, reason: 'independent-three-frame-and-compact-consensus' },
      { questionNum: 7, promote: true, reason: 'independent-three-frame-and-compact-consensus' },
    ],
  })
  assert.deepEqual(result, [1, 4])
})

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

test('high-confidence grayscale consensus may use browser top-two evidence when compact loses detail', () => {
  const predictions = [
    probabilityPrediction(0, [0.01, 0.70, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.23]),
    probabilityPrediction(1, [0.01, 0.01, 0.01, 0.01, 0.01, 0.90, 0.01, 0.01, 0.01, 0.03]),
  ]
  assert.equal(browserSupportsProposedRead('15', predictions), true)
  const result = consensusPromotionDecision({
    currentRead: '19',
    currentPredictions: predictions,
    sequenceFrameConsensus: consensus('15', { minConfidence: 0.995 }),
    compactReads: compact({ read: '19', jointProbability: 0.8, minComponentProbability: 0.8 }),
    slotCount: 2,
  })
  assert.equal(result.promote, true)
  assert.equal(result.automaticText, '15')
  assert.equal(result.reason, 'independent-three-frame-and-browser-secondary-consensus')
  assert.equal(result.evidence.supportSource, 'three-frame-grayscale-plus-browser-top-two')
})

test('P05 17 to 12 prospective error remains review when the browser retained 7 as a material rival', () => {
  const result = consensusPromotionDecision({
    currentRead: '11',
    currentPredictions: [
      probabilityPrediction(0, [0.02, 0.83, 0.01, 0.01, 0.10, 0.01, 0.01, 0.01, 0, 0.01]),
      probabilityPrediction(1, [0.05, 0.39, 0.22, 0, 0.02, 0.02, 0.06, 0.22, 0.01, 0.01]),
    ],
    sequenceFrameConsensus: consensus('12', { minConfidence: 0.993697 }),
    compactReads: compact({
      read: '17',
      jointProbability: 0.999916772,
      minComponentProbability: 0.999752223,
    }),
    slotCount: 2,
    ambiguity: { detected: true, reasons: [{ reason: 'override-retained-material-rival' }] },
  })
  assert.equal(result.promote, false)
  assert.equal(result.reason, 'handwriting-ambiguity-detected')
})

test('P05 replay 17 to 12 remains review through every crop lane despite ambiguity-run variance', () => {
  const result = consensusPromotionDecision({
    currentRead: '11',
    currentPredictions: [
      {
        ...probabilityPrediction(0, [0.01, 0.97, 0.01, 0.01, 0.01, 0, 0, 0, 0, 0]),
        preprocessDisagreement: false,
        highRiskPreprocessReview: false,
      },
      {
        ...probabilityPrediction(1, [0.01, 0.65, 0.04, 0.01, 0.01, 0.03, 0.16, 0.06, 0.02, 0.01]),
        preprocessDisagreement: true,
        highRiskPreprocessReview: true,
      },
    ],
    sequenceFrameConsensus: consensus('12', { minConfidence: 0.995842 }),
    coreCropConsensus: consensus('12', { minConfidence: 0.995842 }),
    compactReads: compact({
      read: '17',
      jointProbability: 0.99975032,
      minComponentProbability: 0.999752,
    }),
    slotCount: 2,
    ambiguity: { detected: false, reasons: [] },
  })
  assert.equal(result.promote, false)
  assert.equal(result.reason, 'high-risk-browser-and-near-certain-compact-conflict')
})

test('near-certain compact conflict alone does not erase stable grayscale evidence', () => {
  const result = consensusPromotionDecision({
    currentRead: '10',
    currentPredictions: [
      { ...probabilityPrediction(0, [0.01, 0.58, 0, 0, 0.17, 0, 0, 0, 0, 0]), preprocessDisagreement: false, highRiskPreprocessReview: false },
      { ...probabilityPrediction(1, [0.85, 0, 0, 0, 0, 0.05, 0, 0, 0, 0.04]), preprocessDisagreement: false, highRiskPreprocessReview: false },
    ],
    sequenceFrameConsensus: consensus('40', { minConfidence: 0.995 }),
    compactReads: compact({ read: '10', jointProbability: 0.999, minComponentProbability: 0.999 }),
    slotCount: 2,
  })
  assert.equal(result.promote, true)
  assert.equal(result.automaticText, '40')
})

test('two independently positioned crops may replace weak compact support only with six matching reads', () => {
  const result = consensusPromotionDecision({
    currentRead: '1',
    sequenceFrameConsensus: consensus('9', { minConfidence: 0.78 }),
    alternateSequenceFrameConsensus: consensus('9', { minConfidence: 0.96 }),
    compactReads: compact({ read: '6', jointProbability: 0.8, minComponentProbability: 0.8 }),
    slotCount: 2,
  })
  assert.equal(result.promote, true)
  assert.equal(result.reason, 'two-crop-six-read-grayscale-consensus')
  assert.equal(result.evidence.supportSource, 'six-read-two-crop-grayscale-stability')
})

test('alternate-crop disagreement or weak frame evidence cannot replace compact support', () => {
  for (const alternateSequenceFrameConsensus of [
    consensus('8', { minConfidence: 0.96 }),
    consensus('9', { count: 2, minConfidence: 0.96 }),
    consensus('9', { minConfidence: 0.69 }),
  ]) {
    const result = consensusPromotionDecision({
      currentRead: '1',
      sequenceFrameConsensus: consensus('9', { minConfidence: 0.78 }),
      alternateSequenceFrameConsensus,
      compactReads: compact({ read: '6', jointProbability: 0.8, minComponentProbability: 0.8 }),
      slotCount: 2,
    })
    assert.equal(result.promote, false)
  }
})

test('selected original, two-percent trim, and four-percent trim may replace a compact veto', () => {
  const result = consensusPromotionDecision({
    currentRead: '17',
    sequenceFrameConsensus: consensus('12', { minConfidence: 0.82 }),
    coreCropConsensus: consensus('12', { minConfidence: 0.79 }),
    compactReads: compact({ read: '17', jointProbability: 0.9, minComponentProbability: 0.9 }),
    slotCount: 2,
  })
  assert.equal(result.promote, true)
  assert.equal(result.automaticText, '12')
  assert.equal(result.reason, 'three-frame-plus-selected-three-crop-grayscale-consensus')
  assert.equal(result.evidence.supportSource, 'three-frame-plus-selected-three-crop-grayscale-stability')
})

test('selected crop stability cannot override an existing ambiguity signal', () => {
  const result = consensusPromotionDecision({
    currentRead: '13',
    sequenceFrameConsensus: consensus('15', { minConfidence: 0.90 }),
    coreCropConsensus: consensus('15', { minConfidence: 0.94 }),
    compactReads: compact({ read: '17', jointProbability: 0.9, minComponentProbability: 0.9 }),
    slotCount: 2,
    ambiguity: { detected: true, reasons: [{ reason: 'override-retained-material-rival' }] },
  })
  assert.equal(result.promote, false)
  assert.equal(result.reason, 'handwriting-ambiguity-detected')
})

test('selected crop disagreement blocks the overwritten 34 to 39 case', () => {
  for (const coreCropConsensus of [
    consensus('30', { minConfidence: 0.8 }),
    consensus('39', { count: 2, minConfidence: 0.9 }),
    consensus('39', { minConfidence: 0.69 }),
  ]) {
    const result = consensusPromotionDecision({
      currentRead: '37',
      sequenceFrameConsensus: consensus('39', { minConfidence: 0.94 }),
      coreCropConsensus,
      compactReads: compact({ read: '22', jointProbability: 0.9, minComponentProbability: 0.9 }),
      slotCount: 2,
    })
    assert.equal(result.promote, false)
    assert.equal(result.reason, 'whole-answer-compact-model-does-not-support-consensus')
  }
})

test('three selected crops can resolve a stable browser conflict but never a safety veto', () => {
  const evidence = {
    currentRead: '81',
    currentPredictions: [prediction(0, 8), prediction(1, 1)],
    sequenceFrameConsensus: consensus('8', { minConfidence: 0.99 }),
    coreCropConsensus: consensus('8', { minConfidence: 0.99 }),
    compactReads: compact({ read: '8', jointProbability: 0.9, minComponentProbability: 0.9 }),
    slotCount: 2,
  }
  const resolved = consensusPromotionDecision(evidence)
  assert.equal(resolved.promote, true)
  assert.equal(resolved.automaticText, '8')
  assert.equal(resolved.reason, 'three-frame-plus-selected-three-crop-grayscale-consensus')

  const vetoed = consensusPromotionDecision({ ...evidence, confidenceSafetyVetoed: true })
  assert.equal(vetoed.promote, false)
  assert.equal(vetoed.reason, 'confidence-safety-veto-dominates')
})

test('browser secondary evidence cannot rescue weak grayscale confidence or a third-choice digit', () => {
  const predictions = [
    probabilityPrediction(0, [0.01, 0.70, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.23]),
    probabilityPrediction(1, [0.40, 0.01, 0.01, 0.01, 0.01, 0.04, 0.01, 0.01, 0.01, 0.50]),
  ]
  assert.equal(browserSupportsProposedRead('15', predictions), false)
  for (const sequenceFrameConsensus of [
    consensus('15', { minConfidence: 0.97 }),
    consensus('15', { minConfidence: 0.995 }),
  ]) {
    const result = consensusPromotionDecision({
      currentPredictions: predictions,
      sequenceFrameConsensus,
      compactReads: compact({ read: '19', jointProbability: 0.8, minComponentProbability: 0.8 }),
      slotCount: 2,
    })
    assert.equal(result.promote, false)
  }
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

test('override ambiguity always blocks automatic promotion even when models propose a correction', () => {
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
  assert.equal(corrected.promote, false)
  assert.equal(corrected.reason, 'handwriting-ambiguity-detected')
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
