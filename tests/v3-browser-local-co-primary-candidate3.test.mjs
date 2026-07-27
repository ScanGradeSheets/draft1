import assert from 'node:assert/strict'
import test from 'node:test'

import { browserLocalCoPrimaryCandidate3Decision } from '../src/v3/browser-local-co-primary-candidate3.js'

const yellow = {
  controlDecision: { automatic: false, read: '49' },
  browser: { read: '49' },
  scout: { read: '14', probability: 0.7 },
  stitched: { read: '19', probability: 0.67 },
  continuous: { read: '19', probability: 0.94 },
  uniform: { read: '19', probability: 0.99 },
  frame: { available: true, threeOfThree: true, read: '19', probability: 0.44 },
  layoutId: 'sg-g1-lw-07-dot-collections',
}

test('four exact grayscale views may resolve a control yellow despite weak confidence', () => {
  const result = browserLocalCoPrimaryCandidate3Decision(yellow)
  assert.equal(result.automatic, true)
  assert.equal(result.read, '19')
  assert.equal(result.reason, 'co-primary-four-view-unanimity')
})

test('three-of-four agreement and a frame conflict remain yellow', () => {
  const result = browserLocalCoPrimaryCandidate3Decision({
    ...yellow,
    frame: { available: true, threeOfThree: true, read: '14', probability: 0.99 },
  })
  assert.equal(result.automatic, false)
})

test('blocking veto, accepted control, and truth-shaped fields dominate', () => {
  assert.equal(browserLocalCoPrimaryCandidate3Decision({
    ...yellow,
    blockingSafetyVeto: true,
  }).automatic, false)
  assert.equal(browserLocalCoPrimaryCandidate3Decision({
    ...yellow,
    controlDecision: { automatic: true, read: '49' },
  }).read, '49')
  assert.equal(browserLocalCoPrimaryCandidate3Decision({
    ...yellow,
    truthText: '19',
  }).automatic, false)
})
