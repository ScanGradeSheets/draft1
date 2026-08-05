import test from 'node:test'
import assert from 'node:assert/strict'

import { chooseBestEligibleCaptureCandidate } from '../src/v3/capture-candidate-selection.js'

const frame = (index, score, ok = true) => ({
  index,
  score,
  sampleSheetCheck: { ok },
})

test('the preserved trigger frame survives when every later frame contains user movement', () => {
  let best = chooseBestEligibleCaptureCandidate(null, frame(0, 500, true))
  best = chooseBestEligibleCaptureCandidate(best, frame(1, 900, false))
  best = chooseBestEligibleCaptureCandidate(best, frame(2, 950, false))
  assert.equal(best.index, 0)
})

test('a later sharper worksheet frame may improve the preserved trigger frame', () => {
  let best = chooseBestEligibleCaptureCandidate(null, frame(0, 500, true))
  best = chooseBestEligibleCaptureCandidate(best, frame(1, 700, true))
  assert.equal(best.index, 1)
})

test('an invalid first frame cannot become a capture candidate', () => {
  assert.equal(chooseBestEligibleCaptureCandidate(null, frame(0, 900, false)), null)
})
