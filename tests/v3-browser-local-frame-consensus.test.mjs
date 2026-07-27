import assert from 'node:assert/strict'
import test from 'node:test'

import { browserLocalThreeFrameConsensus } from '../src/v3/browser-local-frame-consensus.js'

test('requires three complete, distinct, exactly agreeing frame reads', () => {
  assert.deepEqual(browserLocalThreeFrameConsensus([
    { status: 'complete', frameIndex: 1, text: '19', minTokenProbability: 0.97 },
    { status: 'complete', frameIndex: 2, text: '19', minTokenProbability: 0.94 },
    { status: 'complete', frameIndex: 3, text: '19', minTokenProbability: 0.96 },
  ]), {
    available: true,
    threeOfThree: true,
    read: '19',
    probability: 0.94,
    frameIndices: [1, 2, 3],
  })
})

test('conflict, duplicate frame, incomplete row, and fewer than three fail open', () => {
  const conflict = browserLocalThreeFrameConsensus([
    { status: 'complete', frameIndex: 1, text: '19', minTokenProbability: 0.99 },
    { status: 'complete', frameIndex: 2, text: '15', minTokenProbability: 0.99 },
    { status: 'complete', frameIndex: 3, text: '19', minTokenProbability: 0.99 },
  ])
  assert.equal(conflict.available, true)
  assert.equal(conflict.threeOfThree, false)
  assert.equal(conflict.read, '')

  const duplicate = browserLocalThreeFrameConsensus([
    { status: 'complete', frameIndex: 1, text: '9', minTokenProbability: 0.99 },
    { status: 'complete', frameIndex: 1, text: '9', minTokenProbability: 0.99 },
    { status: 'timeout', frameIndex: 2, text: '9', minTokenProbability: 0.99 },
    { status: 'complete', frameIndex: 3, text: '9', minTokenProbability: 0.99 },
  ])
  assert.equal(duplicate.available, false)
  assert.equal(duplicate.threeOfThree, false)
})

test('extra frames cannot change the first three-frame frozen result', () => {
  const result = browserLocalThreeFrameConsensus([
    { status: 'complete', frameIndex: 10, text: '6', minTokenProbability: 0.95 },
    { status: 'complete', frameIndex: 11, text: '6', minTokenProbability: 0.94 },
    { status: 'complete', frameIndex: 12, text: '6', minTokenProbability: 0.93 },
    { status: 'complete', frameIndex: 13, text: '8', minTokenProbability: 0.99 },
  ])
  assert.equal(result.threeOfThree, true)
  assert.equal(result.read, '6')
  assert.equal(result.probability, 0.93)
})
