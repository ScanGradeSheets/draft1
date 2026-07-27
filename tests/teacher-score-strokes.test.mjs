import test from 'node:test'
import assert from 'node:assert/strict'

import { TEACHER_SCORE_EIGHT_STROKES } from '../src/v3/teacher-score-strokes.js'

test('the score 8 is one continuous figure-eight stroke', () => {
  assert.equal(TEACHER_SCORE_EIGHT_STROKES.length, 1)
  const points = TEACHER_SCORE_EIGHT_STROKES[0]
  assert.ok(points.length >= 12)
  assert.ok(points[0][1] < -0.4, 'a human starts the figure eight at the top')
  assert.ok(Math.abs(points[3][1]) < 0.03, 'the first diagonal crosses the centre')
  assert.ok(points[6][1] > 0.4, 'the same stroke reaches the bottom loop')
  assert.ok(Math.abs(points[9][1]) < 0.03, 'the return diagonal crosses the centre')
  assert.deepEqual(points[0], points.at(-1), 'the upper loop finishes where the pen began')
})
