import assert from 'node:assert/strict'
import test from 'node:test'

import { browserLocalStrongYellowDecisions } from '../src/v3/browser-local-strong-yellow.js'

const groups = [
  { questionNum: 1, answerText: '15', reviewNeeded: true },
  { questionNum: 2, answerText: '12', reviewNeeded: false },
]

function rows(reads, probabilities = [0.99, 0.98, 0.97]) {
  return reads.map((text, frameIndex) => ({
    questionNum: 1,
    frameIndex,
    status: 'complete',
    text,
    minTokenProbability: probabilities[frameIndex],
  }))
}

test('promotes only an original yellow with exact high-confidence 3-of-3 evidence', () => {
  const decisions = browserLocalStrongYellowDecisions({
    answerGroups: groups,
    predictions: [
      { questionNum: 1, digit: 1, reviewNeeded: false },
      { questionNum: 1, digit: 5, reviewNeeded: true },
      { questionNum: 2, digit: 1, reviewNeeded: false },
      { questionNum: 2, digit: 2, reviewNeeded: false },
    ],
    strongRows: [
      ...rows(['15', '15', '15']),
      ...rows(['19', '19', '19']).map((row) => ({ ...row, questionNum: 2 })),
    ],
  })
  assert.equal(decisions.length, 1)
  assert.equal(decisions[0].questionNum, 1)
  assert.equal(decisions[0].decision.automatic, true)
  assert.equal(decisions[0].decision.read, '15')
})

test('disagreement, sub-threshold confidence, and a safety veto remain yellow', () => {
  const cases = [
    {
      strongRows: rows(['15', '16', '15']),
      predictions: [{ questionNum: 1, digit: 5, reviewNeeded: true }],
    },
    {
      strongRows: rows(['15', '15', '15'], [0.99, 0.899999, 0.99]),
      predictions: [{ questionNum: 1, digit: 5, reviewNeeded: true }],
    },
    {
      strongRows: rows(['15', '15', '15']),
      predictions: [{ questionNum: 1, digit: 5, reviewNeeded: true, structuralReview: true }],
    },
  ]
  for (const input of cases) {
    const [decision] = browserLocalStrongYellowDecisions({
      answerGroups: groups,
      ...input,
    })
    assert.equal(decision.decision.automatic, false)
    assert.equal(decision.decision.read, '15')
  }
})
