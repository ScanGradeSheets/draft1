import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ADD2_STITCHED_YELLOW_MIN_PROBABILITY,
  browserLocalAdd2StitchedYellowDecisions,
} from '../src/v3/browser-local-strong-yellow.js'

const layoutId = 'sg-g1-lw-02-add-2digit'

function decide({
  group = { questionNum: 7, answerText: '18', reviewNeeded: true },
  prediction = { questionNum: 7, digit: 8, reviewNeeded: true },
  row = {},
  selectedLayoutId = layoutId,
} = {}) {
  return browserLocalAdd2StitchedYellowDecisions({
    layoutId: selectedLayoutId,
    answerGroups: [group],
    predictions: [prediction],
    strongRows: [{
      questionNum: 7,
      status: 'complete',
      cropVariant: 'stitched-original-grayscale',
      text: '18',
      valid: true,
      blank: false,
      minTokenProbability: ADD2_STITCHED_YELLOW_MIN_PROBABILITY,
      contract: { physicalSlotCount: 2, maxHandwrittenDigits: 2 },
      ...row,
    }],
  })[0]
}

test('promotes an original add2 yellow at the exact frozen 0.999 boundary', () => {
  const result = decide()
  assert.equal(result.decision.automatic, true)
  assert.equal(result.decision.read, '18')
  assert.equal(result.decision.answerKeyUsed, false)
})

test('known dangerous 18-to-14 replay at 0.998289 remains yellow', () => {
  const result = decide({
    row: { text: '14', minTokenProbability: 0.9982894306555333 },
  })
  assert.equal(result.decision.automatic, false)
  assert.equal(result.decision.read, '18')
})

test('other layouts and already automatic answers are ineligible', () => {
  const unsupported = decide({ selectedLayoutId: 'sg-g1-lw-04-sub-2digit' })
  assert.equal(unsupported.decision.automatic, false)

  const decisions = browserLocalAdd2StitchedYellowDecisions({
    layoutId,
    answerGroups: [{ questionNum: 7, answerText: '18', reviewNeeded: false }],
    predictions: [{ questionNum: 7, digit: 8, reviewNeeded: false }],
    strongRows: [],
  })
  assert.deepEqual(decisions, [])
})

test('safety vetoes and incomplete or malformed evidence fail open', () => {
  const cases = [
    { prediction: { questionNum: 7, structuralReview: true } },
    { row: { status: 'timeout' } },
    { row: { cropVariant: 'continuous-answer-zone' } },
    { row: { valid: false } },
    { row: { blank: true } },
    { row: { text: '1a' } },
    { row: { contract: { physicalSlotCount: 1, maxHandwrittenDigits: 2 } } },
    { row: { contract: { physicalSlotCount: 2, maxHandwrittenDigits: 1 } } },
  ]
  for (const input of cases) {
    assert.equal(decide(input).decision.automatic, false)
  }
})

test('duplicate stitched rows are ambiguous and fail open', () => {
  const rows = [0, 1].map(() => ({
    questionNum: 7,
    status: 'complete',
    cropVariant: 'stitched-original-grayscale',
    text: '18',
    valid: true,
    blank: false,
    minTokenProbability: 1,
    contract: { physicalSlotCount: 2, maxHandwrittenDigits: 2 },
  }))
  const [result] = browserLocalAdd2StitchedYellowDecisions({
    layoutId,
    answerGroups: [{ questionNum: 7, answerText: '18', reviewNeeded: true }],
    predictions: [{ questionNum: 7, reviewNeeded: true }],
    strongRows: rows,
  })
  assert.equal(result.decision.automatic, false)
})
