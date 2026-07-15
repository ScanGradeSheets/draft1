import assert from 'node:assert/strict'
import test from 'node:test'
import { compareDeterministicReplays } from '../scripts/compare_replay_determinism.mjs'

const sample = () => ({
  candidateIdentity: { digitSelectionPolicy: 'p1' },
  layoutId: 'layout-1',
  modelInputDataUrls: ['data:image/png;base64,AAAA'],
  predictions: [{ id: 1, questionNum: 1, digitIndex: 0, digit: 8, confidence: .8, probs: [.1, .1], topK: [{ digit: 8, confidence: .8 }] }],
})

test('identical retained inputs, probabilities, selection identity and digits are reproducible', () => {
  assert.equal(compareDeterministicReplays(sample(), sample()).ok, true)
})

test('same input with a different selected digit fails reproducibility', () => {
  const changed = sample()
  changed.predictions[0].digit = 3
  assert.equal(compareDeterministicReplays(sample(), changed).ok, false)
})

test('different candidate identity cannot be compared as an identical candidate', () => {
  const changed = sample()
  changed.candidateIdentity.digitSelectionPolicy = 'p2'
  assert.equal(compareDeterministicReplays(sample(), changed).ok, false)
})
