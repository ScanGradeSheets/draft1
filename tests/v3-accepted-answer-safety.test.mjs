import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyAcceptedAnswerSafetyVetoes,
  acceptedAnswerSafetyDecision,
  acceptedAnswerSafetyRoute,
} from '../src/v3/accepted-answer-safety.js'

test('routes accepted browser reads only when a key-blind suspicion signal exists', () => {
  assert.equal(acceptedAnswerSafetyRoute({
    currentAutomatic: true,
    currentRead: '16',
    predictions: [{ digit: 1 }, { digit: 6 }],
  }).route, false)

  assert.equal(acceptedAnswerSafetyRoute({
    currentAutomatic: true,
    currentRead: '15',
    scout: { read: '16', sequenceProbability: 0.94 },
    predictions: [{ digit: 1 }, { digit: 5 }],
  }).route, true)
})

test('answer key and mathematical truth cannot change routing or safety', () => {
  const input = {
    currentAutomatic: true,
    currentRead: '15',
    scout: { read: '16', sequenceProbability: 0.94 },
    predictions: [{ digit: 1 }, { digit: 5 }],
  }
  assert.deepEqual(
    acceptedAnswerSafetyRoute({ ...input, answerKey: '16', truth: '16' }),
    acceptedAnswerSafetyRoute({ ...input, answerKey: '99', truth: '99' }),
  )

  const evidence = {
    routed: true,
    currentRead: '15',
    continuous: { read: '16', minTokenProbability: 0.8 },
    stitched: { read: '16', minTokenProbability: 0.7 },
    scout: { read: '16', sequenceProbability: 0.94 },
    slotCount: 2,
  }
  assert.deepEqual(
    acceptedAnswerSafetyDecision({ ...evidence, answerKey: '16', truth: '16' }),
    acceptedAnswerSafetyDecision({ ...evidence, answerKey: '99', truth: '99' }),
  )
})

test('two independent strong conflicts force review without auto-correcting', () => {
  const decision = acceptedAnswerSafetyDecision({
    routed: true,
    currentRead: '15',
    continuous: { read: '16', minTokenProbability: 0.8 },
    stitched: { read: '16', minTokenProbability: 0.7 },
    scout: { read: '16', sequenceProbability: 0.94 },
    slotCount: 2,
  })
  assert.equal(decision.veto, true)
  assert.equal(decision.requiresTeacherReview, true)
  assert.equal(decision.evidence.browserRead, '15')
  assert.equal('automaticText' in decision, false)
})

test('one weak disagreement does not veto an accepted answer', () => {
  const decision = acceptedAnswerSafetyDecision({
    routed: true,
    currentRead: '15',
    continuous: { read: '16', minTokenProbability: 0.5 },
    stitched: { read: '15', minTokenProbability: 0.9 },
    scout: { read: '15', sequenceProbability: 0.94 },
    slotCount: 2,
  })
  assert.equal(decision.veto, false)
})

test('high-support whole-slot disagreement makes a single-digit 6/8 ambiguity yellow', () => {
  const decision = acceptedAnswerSafetyDecision({
    routed: true,
    currentRead: '8',
    scout: { read: '6', sequenceProbability: 0.939 },
    predictions: [{ digit: 8, confidence: 0.995 }],
    slotCount: 1,
  })
  assert.equal(decision.veto, true)
  assert.equal(decision.requiresTeacherReview, true)
  assert.equal(
    decision.reason,
    'single-digit-six-eight-high-support-scout-conflict',
  )
  assert.equal(decision.evidence.browserRead, '8')
  assert.equal(decision.evidence.scoutRead, '6')
  assert.equal('automaticText' in decision, false)
})

test('6/8 scout veto stays narrow by confidence and physical slot contract', () => {
  for (const input of [
    { currentRead: '8', scout: { read: '6', sequenceProbability: 0.899 }, slotCount: 1 },
    { currentRead: '8', scout: { read: '6', sequenceProbability: 0.99 }, slotCount: 2 },
    { currentRead: '8', scout: { read: '9', sequenceProbability: 0.99 }, slotCount: 1 },
  ]) {
    assert.equal(acceptedAnswerSafetyDecision({
      routed: true,
      predictions: [{ digit: Number(input.currentRead) }],
      ...input,
    }).veto, false)
  }
})

test('public safety scope cannot activate broader experimental vetoes', () => {
  const route = acceptedAnswerSafetyRoute({
    currentAutomatic: true,
    currentRead: '15',
    scout: { read: '16', sequenceProbability: 0.99 },
    slotCount: 2,
    policyScope: 'six-eight-only',
  })
  assert.equal(route.route, false)

  const decision = acceptedAnswerSafetyDecision({
    routed: true,
    currentRead: '15',
    continuous: { read: '16', minTokenProbability: 0.99 },
    stitched: { read: '16', minTokenProbability: 0.99 },
    scout: { read: '16', sequenceProbability: 0.99 },
    slotCount: 2,
    policyScope: 'six-eight-only',
  })
  assert.equal(decision.veto, false)
})

test('overlong reader artifacts that retain the browser text do not manufacture a conflict', () => {
  const decision = acceptedAnswerSafetyDecision({
    routed: true,
    currentRead: '17',
    continuous: { read: '1712', minTokenProbability: 0.4 },
    stitched: { read: '177', minTokenProbability: 0.4 },
    scout: { read: '15', sequenceProbability: 0.8 },
    predictions: [{ preprocessDisagreement: true }],
    slotCount: 2,
  })
  assert.equal(decision.veto, false)
})

test('disagreeing strong views may veto repeated 11 when both are physically valid', () => {
  const decision = acceptedAnswerSafetyDecision({
    routed: true,
    currentRead: '11',
    continuous: { read: '14', minTokenProbability: 0.5 },
    stitched: { read: '17', minTokenProbability: 0.5 },
    scout: { read: '11', sequenceProbability: 0.9 },
    predictions: [],
    slotCount: 2,
  })
  assert.equal(decision.veto, true)
})

test('place-value one/four rival remains review-only even under reader unanimity', () => {
  const predictions = [{
    digitIndex: 0,
    digit: 1,
    topK: [
      { digit: 1, confidence: 0.968 },
      { digit: 4, confidence: 0.022 },
    ],
  }, {
    digitIndex: 1,
    digit: 7,
  }]
  const route = acceptedAnswerSafetyRoute({
    currentAutomatic: true,
    currentRead: '17',
    predictions,
    layoutId: 'sg-g1-lw-10-place-value-50',
  })
  assert.equal(route.route, true)
  const decision = acceptedAnswerSafetyDecision({
    routed: route.route,
    currentRead: '17',
    continuous: { read: '17', minTokenProbability: 0.79 },
    stitched: { read: '17', minTokenProbability: 0.64 },
    scout: { read: '17', sequenceProbability: 0.88 },
    predictions,
    slotCount: 2,
    layoutId: 'sg-g1-lw-10-place-value-50',
  })
  assert.equal(decision.veto, true)
  assert.equal(decision.reason, 'unresolved-place-value-one-four-ambiguity')
})

test('application preserves browser digits and only adds teacher review', () => {
  const result = applyAcceptedAnswerSafetyVetoes([
    { questionNum: 1, digit: 3, reviewNeeded: false },
    { questionNum: 2, digit: 8, reviewNeeded: false },
  ], [{
    questionNum: 1,
    decision: { veto: true, reason: 'two-strong-views-conflict-with-browser' },
  }])
  assert.deepEqual(result.predictions.map((item) => item.digit), [3, 8])
  assert.deepEqual(result.predictions.map((item) => item.reviewNeeded), [true, false])
  assert.deepEqual(result.applied, [{
    questionNum: 1,
    reason: 'two-strong-views-conflict-with-browser',
    preservedDigits: [3],
  }])
})
