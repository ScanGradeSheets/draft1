import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildHybridAnswerDecision,
  crossFrameConsensus,
  normalizeTranscription,
  retainTopCaptureCandidates,
} from '../src/hybrid-recognition.js'

test('normalization accepts short digit strings and rejects oversized output', () => {
  assert.equal(normalizeTranscription(' 17 '), '17')
  assert.equal(normalizeTranscription('answer: 6'), '6')
  assert.equal(normalizeTranscription('12345'), '')
})

test('burst evidence retains only the strongest three candidates', () => {
  let retained = []
  const discarded = []
  for (const score of [4, 9, 2, 7, 10, 1, 8, 3]) {
    const result = retainTopCaptureCandidates(retained, { score }, 3)
    retained = result.retained
    discarded.push(...result.discarded)
  }
  assert.deepEqual(retained.map((row) => row.score), [10, 9, 8])
  assert.equal(discarded.length, 5)
})

test('cross-frame consensus requires two thirds without a tie', () => {
  const consensus = crossFrameConsensus([
    { frameIndex: 0, read: '17', minTokenProbability: 0.99 },
    { frameIndex: 1, read: '17', minTokenProbability: 0.98 },
    { frameIndex: 2, read: '11', minTokenProbability: 0.99 },
  ])
  assert.equal(consensus.text, '17')
  assert.equal(consensus.strong, true)
  assert.deepEqual(consensus.frameIndices, [0, 1])
})

test('current OCR remains first and automatic output is unchanged', () => {
  const decision = buildHybridAnswerDecision({
    currentText: '5',
    currentNeedsReview: false,
    currentConfidence: 0.94,
    wholeAnswer: { read: '6', minTokenProbability: 0.9999 },
    frameReads: [{ read: '6' }, { read: '6' }, { read: '6' }],
  })
  assert.equal(decision.choices[0].text, '5')
  assert.equal(decision.automaticText, '5')
  assert.equal(decision.requiresTeacherReview, false)
})

test('high confidence whole-answer output alone cannot promote yellow', () => {
  const decision = buildHybridAnswerDecision({
    currentText: '5',
    currentNeedsReview: true,
    wholeAnswer: { read: '6', minTokenProbability: 0.9999 },
  })
  assert.equal(decision.shadowPromotionEligible, false)
  assert.equal(decision.automaticText, null)
})

test('independent frame agreement is recorded only as a shadow promotion', () => {
  const decision = buildHybridAnswerDecision({
    currentText: '5',
    currentNeedsReview: true,
    wholeAnswer: { read: '6', minTokenProbability: 0.9999 },
    frameReads: [
      { frameIndex: 0, read: '6', minTokenProbability: 0.999 },
      { frameIndex: 1, read: '6', minTokenProbability: 0.998 },
      { frameIndex: 2, read: '5', minTokenProbability: 0.99 },
    ],
  })
  assert.equal(decision.shadowPromotionEligible, true)
  assert.equal(decision.shadowPromotionText, '6')
  assert.equal(decision.automaticText, null)
  assert.equal(decision.requiresTeacherReview, true)
  assert.equal(decision.answerKeyUsed, false)
})
