import test from 'node:test'
import assert from 'node:assert/strict'
import { evaluateUniformLocalConsensus } from '../src/v3/uniform-local-consensus.js'

test('promotes only an existing yellow with high uniform and continuous agreement', () => {
  assert.deepEqual(evaluateUniformLocalConsensus({
    currentAutomatic: false,
    layoutId: 'sg-g1-lw-07-dot-collections',
    stitchedRead: '12',
    continuousRead: '12',
    continuousProbability: 0.998,
    uniformRead: '12',
    uniformProbability: 0.967,
  }), {
    automatic: true,
    read: '12',
    reason: 'uniform-continuous-high-confidence-with-stitched-text-agreement',
  })
  assert.equal(evaluateUniformLocalConsensus({
    currentAutomatic: true,
    stitchedRead: '12',
    continuousRead: '12',
    continuousProbability: 1,
    uniformRead: '12',
    uniformProbability: 1,
  }).automatic, false)
})

test('complete-box disagreement blocks the reversed-nine and number-pattern traps', () => {
  assert.equal(evaluateUniformLocalConsensus({
    currentAutomatic: false,
    layoutId: 'sg-g1-lw-08-number-bonds',
    stitchedRead: '5',
    continuousRead: '5',
    continuousProbability: 0.992,
    uniformRead: '9',
    uniformProbability: 0.840,
  }).automatic, false)
  assert.equal(evaluateUniformLocalConsensus({
    currentAutomatic: false,
    layoutId: 'sg-g1-lw-09-number-patterns',
    stitchedRead: '32',
    continuousRead: '32',
    continuousProbability: 0.998,
    uniformRead: '30',
    uniformProbability: 0.935,
  }).automatic, false)
})

test('number bonds may use two complete high-confidence views after crop repair', () => {
  assert.deepEqual(evaluateUniformLocalConsensus({
    currentAutomatic: false,
    layoutId: 'sg-g1-lw-08-number-bonds',
    stitchedRead: '17',
    continuousRead: '6',
    continuousProbability: 0.944,
    uniformRead: '6',
    uniformProbability: 0.993,
  }), {
    automatic: true,
    read: '6',
    reason: 'number-bond-uniform-continuous-high-confidence-agreement',
  })
})

test('safety vetoes and answer-key-shaped fields always block the lane', () => {
  assert.equal(evaluateUniformLocalConsensus({
    currentAutomatic: false,
    blockingSafetyVeto: true,
    stitchedRead: '14',
    continuousRead: '14',
    continuousProbability: 1,
    uniformRead: '14',
    uniformProbability: 1,
  }).reason, 'blocking-safety-veto')
  assert.equal(evaluateUniformLocalConsensus({
    currentAutomatic: false,
    stitchedRead: '14',
    continuousRead: '14',
    continuousProbability: 1,
    uniformRead: '14',
    uniformProbability: 1,
    correctAnswer: '14',
  }).reason, 'answer-key-shaped-field-rejected')
})
