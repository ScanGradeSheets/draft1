import test from 'node:test'
import assert from 'node:assert/strict'

import { applyBrowserLocalCandidateToPredictions } from '../src/v3/browser-local-candidate-application.js'

test('accepted-answer demotion preserves the browser transcription', () => {
  const result = applyBrowserLocalCandidateToPredictions({
    questionGroups: [{ question_num: 1, digit_box_ids: [1] }],
    predictions: [{ id: 1, questionNum: 1, digit: 4, reviewNeeded: false }],
    decisions: [{
      questionNum: 1,
      initiallyAutomatic: true,
      currentRead: '4',
      decision: { automatic: false, read: '4', reason: 'independent-conflict' },
    }],
  })
  assert.equal(result.predictions[0].digit, 4)
  assert.equal(result.predictions[0].reviewNeeded, true)
  assert.equal(result.demoted.length, 1)
  assert.equal(result.promoted.length, 0)
})

test('an already-yellow answer can be promoted into its physical slots', () => {
  const result = applyBrowserLocalCandidateToPredictions({
    questionGroups: [{ question_num: 1, digit_box_ids: [1, 2] }],
    predictions: [
      { id: 1, questionNum: 1, digit: 1, reviewNeeded: true },
      { id: 2, questionNum: 1, digit: 5, reviewNeeded: true },
    ],
    decisions: [{
      questionNum: 1,
      initiallyAutomatic: false,
      currentRead: '15',
      decision: { automatic: true, read: '12', reason: 'independent-agreement' },
    }],
  })
  assert.deepEqual(result.predictions.map((row) => row.digit), [1, 2])
  assert.deepEqual(result.predictions.map((row) => row.reviewNeeded), [false, false])
  assert.equal(result.promoted.length, 1)
  assert.equal(result.answerKeyUsed, false)
})

test('a verified pre-acceptance replacement is applied before presentation', () => {
  const result = applyBrowserLocalCandidateToPredictions({
    questionGroups: [{ question_num: 1, digit_box_ids: [1, 2] }],
    predictions: [
      { id: 1, questionNum: 1, digit: 0, reviewNeeded: false },
      { id: 2, questionNum: 1, digit: 4, reviewNeeded: false },
    ],
    decisions: [{
      questionNum: 1,
      initiallyAutomatic: true,
      currentRead: '04',
      decision: {
        automatic: true,
        read: '9',
        reason: 'high-confidence-independent-consensus',
        preAcceptance: true,
      },
    }],
  })
  assert.deepEqual(result.predictions.map((row) => row.digit), [null, 9])
  assert.deepEqual(result.predictions.map((row) => row.reviewNeeded), [false, false])
  assert.equal(result.promoted.length, 0)
  assert.equal(result.replaced.length, 1)
  assert.equal(result.answerKeyUsed, false)
})

test('an accepted read cannot be replaced without explicit pre-acceptance authority', () => {
  const result = applyBrowserLocalCandidateToPredictions({
    questionGroups: [{ question_num: 1, digit_box_ids: [1] }],
    predictions: [{ id: 1, questionNum: 1, digit: 4, reviewNeeded: false }],
    decisions: [{
      questionNum: 1,
      initiallyAutomatic: true,
      currentRead: '4',
      decision: {
        automatic: true,
        read: '9',
        reason: 'untrusted-replacement',
        preAcceptance: false,
      },
    }],
  })
  assert.equal(result.predictions[0].digit, 4)
  assert.equal(result.replaced.length, 0)
})
