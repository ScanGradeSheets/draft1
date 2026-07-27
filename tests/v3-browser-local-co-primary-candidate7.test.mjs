import assert from 'node:assert/strict'
import test from 'node:test'

import {
  browserLocalCoPrimaryCandidate7Decision,
} from '../src/v3/browser-local-co-primary-candidate7.js'

test('complete chain catches a historical accepted mismatch before presentation', () => {
  const result = browserLocalCoPrimaryCandidate7Decision({
    initiallyAutomatic: true,
    candidateDecision: { automatic: true, read: '16' },
    browser: { read: '16' },
    scout: { read: '11', probability: 0.9 },
    stitched: { read: '16', probability: 0.98 },
    continuous: { read: '19', probability: 0.97 },
    uniform: { read: '10', probability: 0.96 },
    routeReasons: [
      'high-support-scout-conflict',
      'accepted-override-retains-material-rival',
    ],
    highRiskMismatchReview: true,
  })
  assert.equal(result.decision.automatic, false)
  assert.equal(
    result.decision.reason,
    'unresolved-accepted-high-support-conflict',
  )
})

test('complete chain never reverses a strict demotion of an accepted browser read', () => {
  const result = browserLocalCoPrimaryCandidate7Decision({
    initiallyAutomatic: true,
    candidateDecision: { automatic: false, read: '04' },
    browser: { read: '04' },
    scout: { read: '1', probability: 0.5 },
    stitched: { read: '9', probability: 0.999 },
    continuous: { read: '9', probability: 0.999 },
    uniform: { read: '9', probability: 0.999 },
    highRiskMismatchReview: true,
  })
  assert.equal(result.decision.automatic, false)
  assert.equal(result.decision.read, '04')
  assert.equal(
    result.decision.reason,
    'strict-accepted-browser-replacement-veto',
  )
  assert.equal(result.decision.preAcceptance, true)
  assert.equal(result.answerKeyUsed, false)
})

test('complete chain permits exact high-confidence optional-slot contraction', () => {
  const result = browserLocalCoPrimaryCandidate7Decision({
    initiallyAutomatic: true,
    candidateDecision: { automatic: false, read: '51' },
    browser: { read: '51' },
    scout: { read: '5', probability: 0.99 },
    stitched: { read: '5', probability: 0.99 },
    continuous: { read: '5', probability: 0.99 },
    uniform: { read: '5', probability: 0.99 },
    optionalSlotIndices: [1],
  })
  assert.equal(result.decision.automatic, true)
  assert.equal(result.decision.read, '5')
})

test('optional-slot contraction stays yellow when a grayscale view is weak', () => {
  const result = browserLocalCoPrimaryCandidate7Decision({
    initiallyAutomatic: true,
    candidateDecision: { automatic: false, read: '01' },
    browser: { read: '01' },
    scout: { read: '6', probability: 0.99 },
    stitched: { read: '6', probability: 0.99 },
    continuous: { read: '6', probability: 0.74 },
    uniform: { read: '6', probability: 0.83 },
    optionalSlotIndices: [0],
  })
  assert.equal(result.decision.automatic, false)
  assert.equal(result.decision.read, '01')
})

test('place-value 1/4 conflict remains yellow despite exact correlated agreement', () => {
  const result = browserLocalCoPrimaryCandidate7Decision({
    initiallyAutomatic: true,
    candidateDecision: {
      automatic: false,
      read: '17',
      reason: 'unresolved-place-value-one-four',
    },
    browser: { read: '17' },
    scout: { read: '17', probability: 0.99 },
    stitched: { read: '17', probability: 0.99 },
    continuous: { read: '17', probability: 0.99 },
    uniform: { read: '17', probability: 0.99 },
    routeReasons: ['place-value-leading-one-has-four-rival'],
  })
  assert.equal(result.decision.automatic, false)
  assert.equal(result.decision.read, '17')
  assert.equal(result.decision.reason, 'unresolved-place-value-one-four')
})

test('complete chain can choose a corroborated replacement for an original yellow', () => {
  const result = browserLocalCoPrimaryCandidate7Decision({
    initiallyAutomatic: false,
    candidateDecision: { automatic: false, read: '04' },
    browser: { read: '04' },
    scout: { read: '9', probability: 0.999 },
    stitched: { read: '9', probability: 0.999 },
    continuous: { read: '9', probability: 0.999 },
    uniform: { read: '9', probability: 0.999 },
  })
  assert.equal(result.decision.automatic, true)
  assert.equal(result.decision.read, '9')
  assert.equal(result.decision.preAcceptance, true)
  assert.equal(result.answerKeyUsed, false)
})

test('truth-shaped fields fail closed through the complete chain', () => {
  const result = browserLocalCoPrimaryCandidate7Decision({
    initiallyAutomatic: false,
    candidateDecision: { automatic: false, read: '1' },
    browser: { read: '1' },
    stitched: { read: '9', probability: 0.99 },
    truth: '9',
  })
  assert.equal(result.decision.automatic, false)
  assert.equal(result.decision.reason, 'answer-key-shaped-field-rejected')
})
