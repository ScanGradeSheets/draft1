import assert from 'node:assert/strict'
import test from 'node:test'

import { browserLocalCoPrimaryPipelineDecision } from '../src/v3/browser-local-co-primary-pipeline.js'

test('preserves a strict automatic through both pre-acceptance stages', () => {
  const result = browserLocalCoPrimaryPipelineDecision({
    initiallyAutomatic: true,
    candidateDecision: { automatic: true, read: '12' },
    browser: { read: '12' },
    stitched: { read: '12', probability: 0.99 },
    continuous: { read: '12', probability: 0.99 },
  })
  assert.equal(result.controlDecision.automatic, true)
  assert.equal(result.decision.automatic, true)
  assert.equal(result.decision.read, '12')
})

test('an original yellow can clear through the frozen control', () => {
  const result = browserLocalCoPrimaryPipelineDecision({
    initiallyAutomatic: false,
    candidateDecision: { automatic: false, read: '91' },
    browser: { read: '91' },
    stitched: { read: '6', probability: 0.99 },
    continuous: { read: '6', probability: 0.99 },
    uniform: { complete: true, read: '6', probability: 0.99 },
    frame: { available: false },
    layoutId: 'sg-g1-lw-01-add-1digit',
  })
  assert.equal(result.controlDecision.automatic, true)
  assert.equal(result.controlDecision.read, '6')
  assert.equal(result.decision.automatic, true)
  assert.equal(result.decision.read, '6')
})

test('co-primary multiview evidence may resolve a control yellow before presentation', () => {
  const result = browserLocalCoPrimaryPipelineDecision({
    initiallyAutomatic: true,
    candidateDecision: { automatic: false, read: '11' },
    browser: { read: '11' },
    stitched: { read: '14', probability: 0.99 },
    continuous: { read: '14', probability: 0.98 },
    scout: { read: '16', probability: 0.86 },
    uniform: { complete: true, read: '14', probability: 0.95 },
    frame: { available: true, threeOfThree: true, read: '14', probability: 0.97 },
    highRiskMismatchReview: true,
    layoutId: 'sg-g1-lw-02-add-2digit',
  })
  assert.equal(result.controlDecision.automatic, false)
  assert.equal(result.decision.automatic, true)
  assert.equal(result.decision.read, '14')
  assert.equal(result.preAcceptance, true)
})

test('truth-shaped fields fail closed through the composed boundary', () => {
  const result = browserLocalCoPrimaryPipelineDecision({
    initiallyAutomatic: false,
    candidateDecision: { automatic: false, read: '1' },
    browser: { read: '1' },
    stitched: { read: '9', probability: 0.99 },
    continuous: { read: '9', probability: 0.99 },
    uniform: { read: '9', probability: 0.99 },
    truthText: '9',
  })
  assert.equal(result.decision.automatic, false)
  assert.equal(result.decision.reason, 'answer-key-shaped-field-rejected')
  const nested = browserLocalCoPrimaryPipelineDecision({
    initiallyAutomatic: false,
    candidateDecision: { automatic: false, read: '1', truthText: '9' },
    browser: { read: '1' },
    stitched: { read: '9', probability: 0.99 },
    continuous: { read: '9', probability: 0.99 },
  })
  assert.equal(nested.decision.automatic, false)
  assert.equal(nested.decision.reason, 'answer-key-shaped-field-rejected')
})
