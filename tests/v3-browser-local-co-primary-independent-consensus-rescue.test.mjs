import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyIndependentConsensusRescue,
} from '../src/v3/browser-local-co-primary-independent-consensus-rescue.js'

const yellow = {
  automatic: false,
  read: '01',
  reason: 'unresolved-high-risk-mismatch',
}

test('rescues high-confidence continuous and uniform agreement with browser support', () => {
  const decision = applyIndependentConsensusRescue({
    baseDecision: yellow,
    browser: { read: '8' },
    scout: { read: '9' },
    stitched: { read: '6' },
    continuous: { read: '8', probability: 0.98 },
    uniform: { read: '8', probability: 0.97 },
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '8')
})

test('scout or stitched support may corroborate the two high-confidence views', () => {
  const scout = applyIndependentConsensusRescue({
    baseDecision: yellow,
    browser: { read: '11' },
    scout: { read: '14' },
    stitched: { read: '14' },
    continuous: { read: '14', probability: 0.99 },
    uniform: { read: '14', probability: 0.99 },
  })
  assert.equal(scout.automatic, true)
  assert.equal(scout.read, '14')
})

test('browser plus stitched opposition blocks a shared crop artifact', () => {
  const decision = applyIndependentConsensusRescue({
    baseDecision: yellow,
    browser: { read: '5' },
    scout: { read: '15' },
    stitched: { read: '5' },
    continuous: { read: '15', probability: 0.999 },
    uniform: { read: '15', probability: 0.987 },
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '01')
})

test('low confidence, missing independent support, and protected vetoes remain yellow', () => {
  const low = applyIndependentConsensusRescue({
    baseDecision: yellow,
    browser: { read: '8' },
    continuous: { read: '8', probability: 0.89 },
    uniform: { read: '8', probability: 0.99 },
  })
  const unsupported = applyIndependentConsensusRescue({
    baseDecision: yellow,
    browser: { read: '1' },
    scout: { read: '2' },
    stitched: { read: '3' },
    continuous: { read: '8', probability: 0.99 },
    uniform: { read: '8', probability: 0.99 },
  })
  const protectedVeto = applyIndependentConsensusRescue({
    baseDecision: {
      automatic: false,
      read: '17',
      reason: 'unresolved-place-value-one-four',
    },
    browser: { read: '47' },
    continuous: { read: '47', probability: 0.99 },
    uniform: { read: '47', probability: 0.99 },
  })
  assert.equal(low.automatic, false)
  assert.equal(unsupported.automatic, false)
  assert.equal(protectedVeto.automatic, false)
})

test('truth-shaped fields fail closed', () => {
  const decision = applyIndependentConsensusRescue({
    baseDecision: yellow,
    truthText: '8',
    browser: { read: '8' },
    continuous: { read: '8', probability: 0.99 },
    uniform: { read: '8', probability: 0.99 },
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.reason, 'answer-key-shaped-field-rejected')
})
