import test from 'node:test'
import assert from 'node:assert/strict'

import { progressiveMarkingSteps } from '../src/v3/progressive-marking.js'

test('progressive marking reveals only settled answers in worksheet order', () => {
  const groups = [
    { questionNum: 1, status: 'correct' },
    { questionNum: 2, status: 'review' },
    { questionNum: 3, status: 'incorrect' },
  ]
  const regions = [
    { questionNum: 1, x: 10, y: 20, w: 30, h: 40 },
    { questionNum: 2, x: 50, y: 20, w: 30, h: 40 },
    { questionNum: 3, x: 10, y: 80, w: 30, h: 40 },
  ]
  const steps = progressiveMarkingSteps(groups, regions, { width: 200, height: 300 })
  assert.deepEqual(steps.map((step) => [step.questionNum, step.status]), [[1, 'correct'], [3, 'incorrect']])
  assert.ok(steps.every((step) => step.x >= 0 && step.y >= 0 && step.w > 0 && step.h > 0))
})

test('progressive marking unions the physical slots for a whole answer', () => {
  const steps = progressiveMarkingSteps(
    [{ questionNum: 4, status: 'correct' }],
    [
      { questionNum: 4, x: 100, y: 50, w: 20, h: 30 },
      { questionNum: 4, x: 125, y: 50, w: 20, h: 30 },
    ],
    { width: 300, height: 400 },
  )
  assert.equal(steps.length, 1)
  assert.ok(steps[0].w > 45)
})

test('progressive marking excludes provisional and queued answers', () => {
  const steps = progressiveMarkingSteps(
    [
      { questionNum: 1, status: 'correct', reviewNeeded: false },
      { questionNum: 2, status: 'incorrect', reviewNeeded: true },
      { questionNum: 3, status: 'correct', reviewNeeded: false },
    ],
    [
      { questionNum: 1, x: 10, y: 10, w: 20, h: 20 },
      { questionNum: 2, x: 40, y: 10, w: 20, h: 20 },
      { questionNum: 3, x: 70, y: 10, w: 20, h: 20 },
    ],
    { width: 120, height: 80 },
    { excludedQuestionNums: [3] },
  )
  assert.deepEqual(steps.map((step) => step.questionNum), [1])
})
