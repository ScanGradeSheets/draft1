import test from 'node:test'
import assert from 'node:assert/strict'
import { applyConsensusPromotionsToPredictions } from '../src/v3/consensus-application.js'

const groups = [{ question_num: 1, answer: 12, digit_box_ids: [0, 1] }]

test('applies an authorized two-digit transcription without using the answer key', () => {
  const original = [
    { id: 0, digit: 9, reviewNeeded: true, correct: false },
    { id: 1, digit: 1, reviewNeeded: true, correct: false },
  ]
  const result = applyConsensusPromotionsToPredictions({
    questionGroups: groups,
    predictions: original,
    decisions: [{ questionNum: 1, promote: true, automaticText: '12', policyVersion: 'p1', reason: 'consensus' }],
  })
  assert.deepEqual(result.predictions.map((row) => row.digit), [1, 2])
  assert.deepEqual(result.predictions.map((row) => row.reviewNeeded), [false, false])
  assert.equal('correct' in result.predictions[0], false)
  assert.equal(original[0].digit, 9)
  assert.equal(result.answerKeyUsed, false)
})

test('right-aligns a one-digit answer in an optional two-slot zone', () => {
  const result = applyConsensusPromotionsToPredictions({
    questionGroups: groups,
    predictions: [{ id: 0, digit: 7 }, { id: 1, digit: 7 }],
    decisions: [{ questionNum: 1, promote: true, automaticText: '7' }],
  })
  assert.deepEqual(result.predictions.map((row) => row.digit), [null, 7])
  assert.deepEqual(result.predictions.map((row) => row.blank), [true, false])
})

test('retains a two-digit incorrect transcription written inside one physical box', () => {
  const result = applyConsensusPromotionsToPredictions({
    questionGroups: [{ question_num: 2, answer: 5, digit_box_ids: [4], max_handwritten_digits: 2 }],
    predictions: [{ id: 4, digit: 1, reviewNeeded: true, correct: false }],
    decisions: [{ questionNum: 2, promote: true, automaticText: '19', policyVersion: 'p1', reason: 'consensus' }],
  })
  assert.equal(result.applied.length, 1)
  assert.equal(result.predictions[0].answerTextOverride, '19')
  assert.equal(result.predictions[0].reviewNeeded, false)
  assert.equal(result.predictions[0].blank, false)
  assert.equal('correct' in result.predictions[0], false)
})

test('one physical box without an explicit larger contract still rejects two digits', () => {
  const result = applyConsensusPromotionsToPredictions({
    questionGroups: [{ question_num: 2, answer: 5, digit_box_ids: [4] }],
    predictions: [{ id: 4, digit: 1 }],
    decisions: [{ questionNum: 2, promote: true, automaticText: '19' }],
  })
  assert.equal(result.applied.length, 0)
  assert.equal(result.predictions[0].digit, 1)
})

test('ignores review decisions and overlong answers', () => {
  for (const decision of [
    { questionNum: 1, promote: false, automaticText: '12' },
    { questionNum: 1, promote: true, automaticText: '1212' },
  ]) {
    const result = applyConsensusPromotionsToPredictions({
      questionGroups: groups,
      predictions: [{ id: 0, digit: 9 }, { id: 1, digit: 9 }],
      decisions: [decision],
    })
    assert.deepEqual(result.predictions.map((row) => row.digit), [9, 9])
    assert.equal(result.applied.length, 0)
  }
})

test('answer-key-like changes do not affect application', () => {
  const base = {
    predictions: [{ id: 0, digit: 9 }, { id: 1, digit: 9 }],
    decisions: [{ questionNum: 1, promote: true, automaticText: '12' }],
  }
  const a = applyConsensusPromotionsToPredictions({ ...base, questionGroups: [{ ...groups[0], answer: 12 }] })
  const b = applyConsensusPromotionsToPredictions({ ...base, questionGroups: [{ ...groups[0], answer: 99 }] })
  assert.deepEqual(a, b)
})
