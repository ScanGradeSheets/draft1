import assert from 'node:assert/strict'
import test from 'node:test'

import { browserLocalFrozenControlDecision } from '../src/v3/browser-local-frozen-control.js'

function frame(read, probability, overrides = {}) {
  return {
    available: true,
    threeOfThree: true,
    text: read,
    minTokenProbability: probability,
    ...overrides,
  }
}

test('three-frame rescue is limited to original yellows at the frozen 0.90 boundary', () => {
  const accepted = browserLocalFrozenControlDecision({
    initiallyAutomatic: true,
    candidateDecision: { automatic: false, read: '15' },
    frame: frame('16', 0.999),
  })
  assert.equal(accepted.automatic, false)
  assert.equal(accepted.read, '15')
  assert.equal(accepted.reason, 'no-silent-replacement')

  const below = browserLocalFrozenControlDecision({
    initiallyAutomatic: false,
    candidateDecision: { automatic: false, read: '15' },
    frame: frame('16', 0.899999),
  })
  assert.equal(below.automatic, false)
  assert.equal(below.read, '15')

  const boundary = browserLocalFrozenControlDecision({
    initiallyAutomatic: false,
    candidateDecision: { automatic: false, read: '15' },
    frame: frame('16', 0.9),
  })
  assert.equal(boundary.automatic, true)
  assert.equal(boundary.read, '16')
  assert.equal(boundary.reason, 'three-frame-unanimous-original-yellow')
})

test('malformed, incomplete, conflicting, and vetoed frame evidence fails open', () => {
  const cases = [
    { frame: frame('1O', 0.999) },
    { frame: frame('16', 0.999, { available: false }) },
    { frame: frame('16', 0.999, { threeOfThree: false }) },
    { frame: frame('16', Number.NaN) },
    { frame: frame('16', 0.999), blockingSafetyVeto: true },
    {
      frame: frame('16', 0.999),
      stitched: { text: '17', minTokenProbability: 0.999 },
      continuous: { text: '17', minTokenProbability: 0.999 },
      uniform: { text: '17', minTokenProbability: 0.999, complete: true },
    },
  ]

  for (const evidence of cases) {
    const decision = browserLocalFrozenControlDecision({
      initiallyAutomatic: false,
      candidateDecision: { automatic: false, read: '15' },
      ...evidence,
    })
    assert.equal(decision.automatic, false)
    assert.equal(decision.read, '15')
  }
})

test('answer-key-shaped input cannot authorize a rescue', () => {
  for (const input of [
    { truthText: '16' },
    { frame: { ...frame('16', 0.999), correctAnswer: '16' } },
    { candidateDecision: { automatic: false, read: '15', answerKey: '16' } },
  ]) {
    const decision = browserLocalFrozenControlDecision({
      initiallyAutomatic: false,
      candidateDecision: { automatic: false, read: '15' },
      frame: frame('16', 0.999),
      ...input,
    })
    assert.equal(decision.automatic, false)
    assert.equal(decision.reason, 'answer-key-shaped-field-rejected')
    assert.equal(decision.answerKeyUsed, false)
  }
})

test('frame-only rescue exhaustively preserves its fail-open invariants', () => {
  const booleans = [false, true]
  const reads = ['', '1O', '16', '12345']
  const probabilities = [Number.NaN, 0, 0.899999, 0.9, 0.999]

  for (const initiallyAutomatic of booleans) {
    for (const blockingSafetyVeto of booleans) {
      for (const available of booleans) {
        for (const threeOfThree of booleans) {
          for (const read of reads) {
            for (const minTokenProbability of probabilities) {
              const decision = browserLocalFrozenControlDecision({
                initiallyAutomatic,
                blockingSafetyVeto,
                candidateDecision: { automatic: false, read: '15' },
                frame: {
                  available,
                  threeOfThree,
                  text: read,
                  minTokenProbability,
                },
              })
              const eligible =
                !initiallyAutomatic &&
                !blockingSafetyVeto &&
                available &&
                threeOfThree &&
                read === '16' &&
                minTokenProbability >= 0.9
              assert.equal(decision.automatic, eligible)
              assert.equal(decision.read, eligible ? '16' : '15')
            }
          }
        }
      }
    }
  }
})
