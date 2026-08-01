import test from 'node:test'
import assert from 'node:assert/strict'

import {
  TEACHER_GREEN_INK,
  TEACHER_GREEN_PEN_PASSES,
  TEACHER_RED_INK,
  TEACHER_RED_INK_OPACITY,
  teacherScoreRevealMaskWidth,
} from '../src/v3/teacher-ink-style.js'

test('teacher checks and scores use the New Scan dark green and shared pen passes', () => {
  assert.equal(TEACHER_GREEN_INK, '#126c39')
  assert.equal(TEACHER_GREEN_PEN_PASSES.length, 4)
  assert.ok(TEACHER_GREEN_PEN_PASSES[0].widthScale > 1.5)
  assert.ok(TEACHER_GREEN_PEN_PASSES.at(-1).widthScale < 0.5)
})

test('incorrect marks use the approved balanced teacher red', () => {
  assert.equal(TEACHER_RED_INK, '#9a3a37')
  assert.equal(TEACHER_RED_INK_OPACITY, 0.94)
})

test('score reveal mask covers pen bleed without exposing neighbouring future strokes', () => {
  assert.equal(teacherScoreRevealMaskWidth(2), 8)
  assert.equal(teacherScoreRevealMaskWidth(5), 11)
  assert.ok(teacherScoreRevealMaskWidth(7) < 16)
  assert.equal(teacherScoreRevealMaskWidth(null), 8)
})
