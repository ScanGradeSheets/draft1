import test from 'node:test'
import assert from 'node:assert/strict'

import { browserLocalCandidateDecision } from '../src/v3/browser-local-candidate.js'

test('uniform evidence cannot reverse a safety demotion of an accepted browser read', () => {
  const decision = browserLocalCandidateDecision({
    currentAutomatic: true,
    currentRead: '4',
    scout: { text: '9', probability: 0.99 },
    stitched: { text: '9', minTokenProbability: 0.99 },
    continuous: { text: '9', minTokenProbability: 0.99 },
    uniform: { text: '4', minTokenProbability: 0.999 },
    layoutId: 'sg-g1-lw-01-add-1digit',
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '4')
  assert.equal(decision.uniformReaderCalls, 0)
})

test('uniform consensus can rescue an answer that was already yellow', () => {
  const decision = browserLocalCandidateDecision({
    currentAutomatic: false,
    currentRead: '3',
    scout: { text: '3', probability: 0.8 },
    stitched: { text: '17', minTokenProbability: 0.59 },
    continuous: { text: '6', minTokenProbability: 0.94 },
    uniform: { text: '6', minTokenProbability: 0.99 },
    layoutId: 'sg-g1-lw-08-number-bonds',
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '6')
  assert.equal(decision.uniformReaderCalls, 1)
})

test('a blocking ambiguity veto keeps a yellow answer yellow', () => {
  const decision = browserLocalCandidateDecision({
    currentAutomatic: false,
    currentRead: '3',
    scout: { text: '3', probability: 0.8 },
    stitched: { text: '17', minTokenProbability: 0.59 },
    continuous: { text: '6', minTokenProbability: 0.94 },
    uniform: { text: '6', minTokenProbability: 0.99 },
    layoutId: 'sg-g1-lw-08-number-bonds',
    blockingSafetyVeto: true,
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '3')
  assert.equal(decision.uniformReason, 'blocking-safety-veto')
})

test('answer-key-shaped context fails closed', () => {
  const decision = browserLocalCandidateDecision({
    currentAutomatic: false,
    currentRead: '4',
    stitched: { text: '4', minTokenProbability: 0.999 },
    correctAnswer: '4',
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.reason, 'answer-key-shaped-field-rejected')
  assert.equal(decision.answerKeyUsed, false)
})

test('a high-risk terminal 0/9 conflict stays yellow even when larger views repeat the browser error', () => {
  const decision = browserLocalCandidateDecision({
    currentAutomatic: true,
    currentRead: '19',
    scout: { text: '10', minTokenProbability: 0.48 },
    stitched: { text: '19', minTokenProbability: 0.99 },
    continuous: { text: '19', minTokenProbability: 0.99 },
    highRiskMismatchReview: true,
    routeReasons: ['browser-preprocessing-risk'],
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '19')
  assert.equal(decision.reason, 'unresolved-terminal-zero-nine')
  assert.equal(decision.changedExistingAutomaticRead, false)
})

test('an ambiguous number-bond 5 cannot clear on scout and stitched agreement alone', () => {
  const decision = browserLocalCandidateDecision({
    currentAutomatic: false,
    currentRead: '1',
    scout: { text: '5', minTokenProbability: 0.99 },
    stitched: { text: '5', minTokenProbability: 0.99 },
    continuous: { text: '5', minTokenProbability: 0.99 },
    layoutId: 'sg-g1-lw-08-number-bonds',
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '1')
  assert.equal(decision.reason, 'number-bond-requires-uniform-consensus')
  assert.equal(decision.continuousReaderCalls, 1)
})

test('a high-risk number-pattern scout conflict cannot be cleared by one matching large view', () => {
  const decision = browserLocalCandidateDecision({
    currentAutomatic: true,
    currentRead: '32',
    scout: { text: '30', minTokenProbability: 0.69 },
    stitched: { text: '32', minTokenProbability: 0.99 },
    layoutId: 'sg-g1-lw-09-number-patterns',
    highRiskMismatchReview: true,
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '32')
  assert.equal(decision.reason, 'unresolved-number-pattern-scout-conflict')
})

test('an optional blank tens slot cannot be hallucinated as a leading 1', () => {
  const decision = browserLocalCandidateDecision({
    currentAutomatic: true,
    currentRead: '15',
    scout: { text: '5', minTokenProbability: 0.88 },
    stitched: { text: '15', minTokenProbability: 0.99 },
    continuous: { text: '15', minTokenProbability: 0.99 },
    optionalSlotIndices: [0],
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '15')
  assert.equal(decision.reason, 'unresolved-optional-leading-one')
})
