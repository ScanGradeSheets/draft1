import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyMultifamilyFrameConsensusRescue,
} from '../src/v3/browser-local-co-primary-multifamily-frame-rescue.js'

const yellow = {
  automatic: false,
  read: '91',
  reason: 'unresolved-high-risk-mismatch',
}

test('rescues exact multi-family agreement with stable frames', () => {
  const decision = applyMultifamilyFrameConsensusRescue({
    baseDecision: yellow,
    browser: { read: '15' },
    scout: { read: '15' },
    stitched: { read: '15', probability: 0.99 },
    frame: {
      read: '15',
      probability: 0.98,
      threeOfThree: true,
    },
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '15')
})

test('a model disagreement or incomplete frames remain yellow', () => {
  const disagreement = applyMultifamilyFrameConsensusRescue({
    baseDecision: yellow,
    browser: { read: '15' },
    scout: { read: '14' },
    stitched: { read: '15', probability: 0.99 },
    frame: {
      read: '15',
      probability: 0.98,
      threeOfThree: true,
    },
  })
  const incomplete = applyMultifamilyFrameConsensusRescue({
    baseDecision: yellow,
    browser: { read: '15' },
    scout: { read: '15' },
    stitched: { read: '15', probability: 0.99 },
    frame: {
      read: '15',
      probability: 0.98,
      threeOfThree: false,
    },
  })
  assert.equal(disagreement.automatic, false)
  assert.equal(incomplete.automatic, false)
})

test('confidence floors and protected vetoes remain binding', () => {
  const weakFrame = applyMultifamilyFrameConsensusRescue({
    baseDecision: yellow,
    browser: { read: '15' },
    scout: { read: '15' },
    stitched: { read: '15', probability: 0.99 },
    frame: {
      read: '15',
      probability: 0.89,
      threeOfThree: true,
    },
  })
  const protectedVeto = applyMultifamilyFrameConsensusRescue({
    baseDecision: {
      automatic: false,
      read: '17',
      reason: 'unresolved-place-value-one-four',
    },
    browser: { read: '17' },
    scout: { read: '17' },
    stitched: { read: '17', probability: 0.99 },
    frame: {
      read: '17',
      probability: 0.99,
      threeOfThree: true,
    },
  })
  assert.equal(weakFrame.automatic, false)
  assert.equal(protectedVeto.automatic, false)
})

test('truth-shaped fields fail closed', () => {
  const decision = applyMultifamilyFrameConsensusRescue({
    baseDecision: yellow,
    correctAnswer: '15',
    browser: { read: '15' },
    scout: { read: '15' },
    stitched: { read: '15', probability: 0.99 },
    frame: {
      read: '15',
      probability: 0.99,
      threeOfThree: true,
    },
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.reason, 'answer-key-shaped-field-rejected')
})
