import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { progressiveMarkingSteps } from '../src/v3/progressive-marking.js'

const cameraSource = await readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

test('the scanning date remains mounted throughout progressive grading', () => {
  assert.match(
    cameraSource,
    /!processing\.value\s*&&\s*!progressiveMarkingActive\.value/,
  )
  assert.match(cameraSource, /v-if="scanningDateStampSpec"/)
})

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
  const steps = progressiveMarkingSteps(groups, regions, { width: 200, height: 300 }, { excludeReview: true })
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

test('an X draws top-left to bottom-right, then crosses only after the first stroke finishes', () => {
  const [step] = progressiveMarkingSteps(
    [{ questionNum: 1, status: 'incorrect' }],
    [{ questionNum: 1, x: 20, y: 20, w: 40, h: 30, focusX: 25, focusY: 25, focusW: 30, focusH: 20 }],
    { width: 200, height: 120 },
  )
  const coordinates = (stroke) => [...stroke.d.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
    .map((match) => ({ x: Number(match[1]), y: Number(match[2]) }))
  const first = coordinates(step.strokes[0])
  const second = coordinates(step.strokes[1])

  assert.ok(first.at(-1).x > first[0].x && first.at(-1).y > first[0].y)
  assert.ok(second.at(-1).x < second[0].x && second.at(-1).y > second[0].y)
  assert.ok(step.strokes[1].delayMs >= step.strokes[0].durationMs)
})

test('a settled review answer uses one left-to-right highlighter swipe', () => {
  const [step] = progressiveMarkingSteps(
    [{ questionNum: 2, status: 'review', reviewNeeded: true }],
    [{ questionNum: 2, x: 40, y: 30, w: 42, h: 24, focusX: 44, focusY: 34, focusW: 34, focusH: 16 }],
    { width: 200, height: 120 },
  )
  assert.equal(step.status, 'review')
  assert.equal(step.strokes.length, 1)
  assert.ok(step.strokeWidth >= 18)
  assert.ok(step.strokes[0].d.startsWith('M '))
})

test('a two-slot answer highlights only its uncertain slot, or both with one swipe when both are uncertain', () => {
  const dimensions = { width: 240, height: 120 }
  const group = [{ questionNum: 2, status: 'review', reviewNeeded: true }]
  const left = { questionNum: 2, slotIndex: 0, reviewNeeded: true, x: 40, y: 30, w: 42, h: 30, focusX: 44, focusY: 34, focusW: 34, focusH: 22 }
  const right = { questionNum: 2, slotIndex: 1, reviewNeeded: false, x: 82, y: 30, w: 42, h: 30, focusX: 86, focusY: 34, focusW: 34, focusH: 22 }
  const [singleSlot] = progressiveMarkingSteps(group, [left, right], dimensions)
  const singleXs = [...singleSlot.strokes[0].d.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]))
  assert.ok(Math.max(...singleXs) < right.focusX)

  const [bothSlots] = progressiveMarkingSteps(group, [left, { ...right, reviewNeeded: true }], dimensions)
  const bothXs = [...bothSlots.strokes[0].d.matchAll(/[ML] (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g)]
    .map((match) => Number(match[1]))
  assert.equal(bothSlots.strokes.length, 1)
  assert.ok(Math.min(...bothXs) < left.focusX)
  assert.ok(Math.max(...bothXs) > right.focusX + right.focusW)
})

test('a manual correction reveals the replacement answer before drawing its new mark', () => {
  const steps = progressiveMarkingSteps(
    [{ questionNum: 2, status: 'correct', reviewNeeded: false }],
    [{ questionNum: 2, x: 100, y: 80, w: 70, h: 42, focusX: 105, focusY: 85, focusW: 60, focusH: 32 }],
    { width: 500, height: 700 },
    { onlyQuestionNums: [2], revealAnswerQuestionNums: [2] },
  )
  assert.equal(steps.length, 1)
  assert.equal(steps[0].strokes.length, 2)
  assert.ok(steps[0].strokes[0].width > steps[0].strokeWidth)
  assert.equal(steps[0].strokes[0].delayMs, 0)
  assert.ok(steps[0].strokes[1].delayMs >= 260)
})

test('runtime manual correction keeps the settled black answer in its animation base', () => {
  assert.match(
    cameraSource,
    /manualCorrectionAnimationBase\(\s*previousAnnotatedImageUrl,\s*annotatedImageUrl,\s*correctedQuestionNum/,
  )
  assert.match(
    cameraSource,
    /context\.drawImage\(\s*completed,\s*clearRect\.x,[\s\S]*?clearRect\.h,\s*\)/,
  )
  assert.match(cameraSource, /revealAnswerQuestionNums:\s*\[\]/)
  assert.ok(
    cameraSource.indexOf('const correctionAnimationBaseUrl = await manualCorrectionAnimationBase') <
      cameraSource.indexOf('ocrResult.value = nextResult'),
    'the stable correction base must exist before the displayed result switches',
  )
})

test('grading pen strokes remain animated when the device requests reduced motion', () => {
  assert.equal(
    cameraSource.includes('prefers-reduced-motion'),
    false,
    'device motion settings must not silently replace the grading sequence with instant marks',
  )
  assert.match(cameraSource, /animation:\s*progressive-write-stroke/)
})
