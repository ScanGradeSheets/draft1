import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  buildTeacherScoreInkPlan,
  buildTeacherScoreStrokePlan,
  teacherScoreSmoothPathD,
} from '../src/v3/teacher-score-plan.js'
import { TEACHER_GREEN_PEN_PASSES } from '../src/v3/teacher-ink-style.js'

test('score animation and finished ink share one deterministic stroke plan', () => {
  const options = {
    text: '8/8',
    centerX: 720,
    y: 1180,
    fontSize: 76,
    seed: 9123,
  }
  const first = buildTeacherScoreStrokePlan(options)
  const second = buildTeacherScoreStrokePlan(options)

  assert.deepEqual(first, second)
  assert.equal(first.strokes.filter((stroke) => stroke.char === '8').length, 2)
  assert.ok(first.strokes.every((stroke) => stroke.d === teacherScoreSmoothPathD(stroke.points)))
  assert.ok(first.strokes.every((stroke) => stroke.d.includes(' Q ')), 'the SVG reveal follows the same smooth curve as Canvas')
})

test('score strokes are strictly sequential and never reveal a later stroke early', () => {
  const plan = buildTeacherScoreStrokePlan({
    text: '4/8',
    centerX: 500,
    y: 800,
    fontSize: 72,
    seed: 9002,
  })

  for (let index = 1; index < plan.strokes.length; index += 1) {
    const previous = plan.strokes[index - 1]
    const current = plan.strokes[index]
    assert.ok(
      current.delayMs >= previous.delayMs + previous.durationMs,
      `stroke ${index} must wait for stroke ${index - 1} to finish`,
    )
  }
  assert.equal(
    plan.durationMs,
    plan.strokes.at(-1).delayMs + plan.strokes.at(-1).durationMs,
  )
})

test('felt-pen passes preserve human stroke timing and final geometry', () => {
  const plan = buildTeacherScoreStrokePlan({
    text: '8/8',
    centerX: 500,
    y: 800,
    fontSize: 72,
    seed: 9002,
  })
  const ink = buildTeacherScoreInkPlan(plan, TEACHER_GREEN_PEN_PASSES)

  assert.equal(ink.length, plan.strokes.length * TEACHER_GREEN_PEN_PASSES.length)
  plan.strokes.forEach((stroke, logicalStrokeIndex) => {
    const passes = ink.filter((item) => item.logicalStrokeIndex === logicalStrokeIndex)
    assert.equal(passes.length, TEACHER_GREEN_PEN_PASSES.length)
    assert.ok(passes.every((item) => item.delayMs === stroke.delayMs))
    assert.ok(passes.every((item) => item.durationMs === stroke.durationMs))
    assert.ok(passes.every((item) => item.d === teacherScoreSmoothPathD(item.points)))
  })
  assert.deepEqual(
    [...new Map(ink.map((stroke) => [stroke.charIndex, stroke.char])).values()],
    ['8', '/', '8'],
    'the first 8 completes before the slash and second 8 begin',
  )
})

test('CameraCapture draws live score ink directly instead of revealing a completed score through a mask', () => {
  const source = fs.readFileSync(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')
  const calls = source.match(/buildTeacherScoreStrokePlan\s*\(/g) || []
  assert.equal(calls.length, 2, 'one call builds the reveal and one call draws the final score')
  assert.match(source, /progressive-score-ink/)
  assert.doesNotMatch(source, /progressive-score-mask/)
  assert.match(source, /buildTeacherScoreInkPlan\s*\(/)
  assert.doesNotMatch(source, /const scoreGlyphs\s*=/)
  assert.doesNotMatch(source, /const scoreGlyphAlternates\s*=/)
})
