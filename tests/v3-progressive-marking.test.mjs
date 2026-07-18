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
  assert.equal(steps[0].strokes.length, 1, 'a checkmark must be one continuous pen stroke')
  assert.equal(steps[1].strokes.length, 2, 'an X must use two crossing pen strokes')
  assert.ok(steps.flatMap((step) => step.strokes).every((stroke) => /^M .+ L /.test(stroke.d)))
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

test('checkmark stroke travels continuously from left to right', () => {
  const [step] = progressiveMarkingSteps(
    [{ questionNum: 1, status: 'correct' }],
    [{ questionNum: 1, x: 20, y: 20, w: 40, h: 30, focusX: 25, focusY: 25, focusW: 30, focusH: 20 }],
    { width: 200, height: 120 },
  )
  const coordinates = [...step.strokes[0].d.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }))
  assert.ok(coordinates.length >= 5)
  assert.ok(coordinates.at(-1).x > coordinates[0].x)
  assert.equal(step.strokes[0].delayMs, 0)
})
