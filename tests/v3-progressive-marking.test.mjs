import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import {
  progressiveMarkingSteps,
  teacherIndicatorBounds,
} from '../src/v3/progressive-marking.js'
import {
  progressivePendingQuestionNumbers,
  progressiveVerificationSchedule,
} from '../src/v3/progressive-verification-scheduler.js'

const cameraSource = await readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

test('teacher indicator cleanup bounds stay inside the rendered sheet', () => {
  const bounds = teacherIndicatorBounds(
    { x: 250, y: 360, w: 62, h: 58 },
    131,
    { width: 800, height: 1100 },
  )
  assert.ok(bounds.x >= 0)
  assert.ok(bounds.y >= 0)
  assert.ok(bounds.x + bounds.w <= 800)
  assert.ok(bounds.y + bounds.h <= 1100)
  assert.ok(bounds.w > 62)
  assert.ok(bounds.h > 58)
})

test('the date stamp is withheld until the score is complete, then lands as the completion seal', () => {
  assert.match(
    cameraSource,
    /!progressiveDateStampRevealed\.value/,
  )
  assert.match(cameraSource, /v-if="scanningDateStampSpec"/)
  assert.match(cameraSource, /clip-path="url\(#completion-date-stamp-clip\)"/)
  assert.match(cameraSource, /:href="progressiveAnnotatedImage"/)
  const scoreReveal = cameraSource.indexOf('progressiveScoreRevealed.value = true')
  const dateReveal = cameraSource.indexOf('progressiveDateStampRevealed.value = true')
  assert.ok(scoreReveal >= 0)
  assert.ok(dateReveal > scoreReveal)
  assert.doesNotMatch(cameraSource, /scanningDateEarliestFinish/)
})

test('the first yellow opens automatically after automatic marks settle without moving the worksheet', () => {
  const advanceStart = cameraSource.indexOf('function advanceProgressiveMarking()')
  const advanceEnd = cameraSource.indexOf('function resetProgressiveMarking()', advanceStart)
  const advance = cameraSource.slice(advanceStart, advanceEnd)
  assert.match(advance, /nextYellowReviewGroup\(/)
  assert.match(advance, /openCorrectionByGroupSlot\(nextReviewGroup\)/)
  assert.doesNotMatch(cameraSource, /scrollIntoView|scrollBy|scrollTo|visualViewport/)
})

test('manual correction digits use the lighter settled teacher-ink renderer', async () => {
  const correctionInkSource = await readFile(
    new URL('../src/v3/manual-correction-ink.js', import.meta.url),
    'utf8',
  )
  assert.match(correctionInkSource, /rect\.y \+ rect\.h \* 0\.53/)
  assert.match(correctionInkSource, /ctx\.font = `500 /)
  assert.match(correctionInkSource, /ctx\.globalAlpha = 0\.92/)
  assert.match(correctionInkSource, /ctx\.globalAlpha = 0\.1/)
})

test('camera startup controls and revealed readings share blue while viewfinder guidance stays dark', () => {
  assert.match(cameraSource, /v-if="!streamActive && !capturedImage && !isLoading"/)
  assert.match(cameraSource, /\.controls--student \.btn-primary\s*\{[^}]*background:\s*var\(--sg-interface-blue, #245aa4\)/s)
  assert.match(cameraSource, /\.overlay-frame--warming \.overlay-frame-text,[\s\S]*background:\s*rgba\(0, 0, 0, 0\.56\)/)
  assert.match(cameraSource, /\.overlay-frame--ready \.overlay-frame-text\s*\{[^}]*background:\s*rgba\(18, 108, 57, 0\.9\)/s)
  assert.match(cameraSource, /\.recognition-read-label\s*\{[^}]*color:\s*var\(--sg-interface-blue, #245aa4\)/s)
})

test('the completion date appears once at its final opacity with a stationary completion glow', () => {
  assert.doesNotMatch(cameraSource, /scanning-date-stamp-splash/)
  assert.doesNotMatch(cameraSource, /date-stamp-completion-splash/)
  assert.match(cameraSource, /\.scanning-date-stamp\s*\{[^}]*opacity:\s*1/s)
  assert.doesNotMatch(cameraSource, /@keyframes date-stamp-ink-land/)
  assert.doesNotMatch(cameraSource, /\.scanning-date-stamp\s*\{[^}]*animation:/s)
  assert.doesNotMatch(cameraSource, /\.scanning-date-stamp\s*\{[^}]*transform:/s)
  assert.match(cameraSource, /captured-image-wrap--completion-glow/)
  assert.match(cameraSource, /@keyframes worksheet-completion-glow/)
  assert.match(cameraSource, /worksheet-completion-glow 180ms/)
  assert.doesNotMatch(cameraSource, /worksheet-stamp-impact/)
  assert.doesNotMatch(cameraSource, /captured-image-wrap--stamp-impact/)
  assert.match(cameraSource, /window\.setTimeout\(advanceProgressiveMarking,\s*520\)/)
})

test('the final flattened worksheet is decoded before the live marking layers are retired', () => {
  assert.match(cameraSource, /await imageElementFromUrl\(finalAnnotatedImage\)/)
  assert.match(cameraSource, /progressiveBaseImageOverride\.value = finalAnnotatedImage[\s\S]*await nextTick\(\)[\s\S]*progressiveMarkingComplete\.value = true/)
  assert.doesNotMatch(cameraSource, /progressiveMarkingComplete\.value = true[\s\S]{0,180}progressiveBaseImageOverride\.value = ''/)
  assert.match(cameraSource, /: progressiveBaseImageOverride\.value\s*\? progressiveBaseImageOverride\.value/)
})

test('the final date stamp uses a viewfinder-green glow without moving the page or stamp ink', () => {
  assert.doesNotMatch(cameraSource, /scanning-date-paper-impression/)
  assert.doesNotMatch(cameraSource, /date-paper-compression/)
  assert.doesNotMatch(cameraSource, /completion-date-paper-impression/)
  assert.doesNotMatch(cameraSource, /scanning-date-stamp-splash|date-stamp-completion-splash/)
  assert.match(cameraSource, /border:\s*3px solid rgba\(18,\s*108,\s*57,\s*0\.96\)/)
  assert.doesNotMatch(cameraSource, /--stamp-impact-origin-x/)
  assert.doesNotMatch(cameraSource, /\.captured-image-wrap--completion-glow::after\s*\{[^}]*transform:/s)
})

test('the manual focus pulse follows the active answer at every page height', () => {
  assert.match(cameraSource, /v-if="activeCorrectionQuestion"[\s\S]*class="on-sheet-correction-focus"/)
  const focusStyleStart = cameraSource.indexOf('const activeCorrectionFocusStyle = computed')
  const focusStyleEnd = cameraSource.indexOf('const correctionKeypadKeys', focusStyleStart)
  const focusStyle = cameraSource.slice(focusStyleStart, focusStyleEnd)
  assert.match(focusStyle, /focusTopPct \?\? region\.topPct/)
  assert.doesNotMatch(focusStyle, /visualViewport|innerHeight|topPct\s*[<>]|focusTopPct\s*[<>]/)
  assert.match(cameraSource, /\.on-sheet-correction-focus\s*\{[^}]*animation:\s*correction-focus-breathe/s)
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
  assert.equal(
    (steps[1].strokes[1].d.match(/\bM\b/g) || []).length,
    1,
    'the second X stroke must remain one uninterrupted top-right-to-bottom-left path',
  )
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

test('the verifier queue combines existing yellows and suspicious accepted answers deterministically', () => {
  assert.deepEqual(
    progressivePendingQuestionNumbers({
      yellowQuestionNums: [5, 2, 5],
      suspiciousAcceptedQuestionNums: [4, 2, 7],
    }),
    [2, 4, 5, 7],
  )
})

test('settled answers may animate while a declared verifier queue remains pending', () => {
  assert.deepEqual(
    progressiveVerificationSchedule({
      status: 'pending',
      pendingReviewQuestionNums: [4, 2, 4],
    }),
    {
      status: 'pending',
      pending: true,
      queueDeclared: true,
      deferredQuestionNums: [2, 4],
      mayAnimateSettledAnswers: true,
    },
  )
})

test('an asynchronous verifier with an undeclared queue remains fail-closed', () => {
  assert.deepEqual(
    progressiveVerificationSchedule({ status: 'pending' }),
    {
      status: 'pending',
      pending: true,
      queueDeclared: false,
      deferredQuestionNums: [],
      mayAnimateSettledAnswers: false,
    },
  )
})

test('the runtime declares suspicious questions before starting background verification', () => {
  const pendingDeclaration = cameraSource.indexOf('pendingReviewQuestionNums: initialPendingReviewQuestionNums')
  const asyncStart = cameraSource.indexOf('const v3Run = startAsyncV3Shadow')
  assert.ok(pendingDeclaration >= 0)
  assert.ok(asyncStart > pendingDeclaration)
  assert.match(
    cameraSource,
    /excludedQuestionNums:\s*progressiveVerification\.value\.deferredQuestionNums/,
  )
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
  assert.equal(second.length, 3, 'the direct crossing stroke must match the final raster X path')
  assert.ok(step.inkWidth >= 3.2)
  assert.equal(step.strokes[0].durationMs, 200)
  assert.equal(step.strokes[1].durationMs, 200)
  assert.ok(
    step.strokes[1].delayMs >= step.strokes[0].durationMs + 120,
    'the second stroke must wait for the first stroke and a visible pen-lift pause',
  )
  assert.match(
    cameraSource,
    /const completeStepMs = Math\.max\([\s\S]*stroke\.delayMs[\s\S]*stroke\.durationMs[\s\S]*\+ 80/,
  )
  assert.match(cameraSource, /v-progressive-stroke-sequence/)
  assert.match(cameraSource, /directIncorrectProgressiveMarkingSteps/)
  assert.match(cameraSource, /step\.status !== 'incorrect'/)
  assert.match(cameraSource, /:stroke="TEACHER_RED_INK"/)
  assert.match(cameraSource, /:stroke-opacity="TEACHER_RED_INK_OPACITY"/)
  assert.match(cameraSource, /alpha: TEACHER_RED_INK_OPACITY, widthScale: 1, spread: 0/)
  assert.doesNotMatch(cameraSource, /\.progressive-direct-incorrect-ink\s*\{[^}]*opacity:/s)
  assert.doesNotMatch(cameraSource, /pathLength="(?:1|100)"/)
  assert.match(cameraSource, /startMeasuredProgressiveStrokeSequence/)
})

test('manual replacement cleanup encloses every pixel path of the old X', () => {
  const dimensions = { width: 800, height: 1100 }
  const focusRect = { x: 250, y: 360, w: 62, h: 58 }
  const seed = 131
  const [step] = progressiveMarkingSteps(
    [{ questionNum: 3, status: 'incorrect', reviewNeeded: false }],
    [{ questionNum: 3, x: 220, y: 330, w: 122, h: 118, focusX: focusRect.x, focusY: focusRect.y, focusW: focusRect.w, focusH: focusRect.h }],
    dimensions,
  )
  const bounds = teacherIndicatorBounds(focusRect, seed, dimensions)
  const coordinates = step.strokes.flatMap((stroke) =>
    Array.from(stroke.d.matchAll(/(?:M|L)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g))
      .map((match) => [Number(match[1]), Number(match[2])])
  )
  assert.ok(coordinates.length >= 6)
  for (const [x, y] of coordinates) {
    assert.ok(x >= bounds.x && x <= bounds.x + bounds.w)
    assert.ok(y >= bounds.y && y <= bounds.y + bounds.h)
  }
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
    /const completedPatchRect = includeCompletedQuestionMark[\s\S]*?context\.drawImage\(\s*completed,\s*completedPatchRect\.x,[\s\S]*?completedPatchRect\.h,\s*\)/,
  )
  assert.match(cameraSource, /revealAnswerQuestionNums:\s*\[\]/)
  assert.ok(
    cameraSource.indexOf('const correctionAnimationBaseUrl = await manualCorrectionAnimationBase') <
      cameraSource.indexOf('ocrResult.value = nextResult'),
    'the stable correction base must exist before the displayed result switches',
  )
  assert.match(cameraSource, /ref="displayedResultImageRef"/)
  assert.match(cameraSource, /await waitForDisplayedCorrectionBase\(correctionAnimationBaseUrl\)/)
  assert.match(cameraSource, /await preloadCorrectionAnimationBase\(correctionAnimationBaseUrl\)/)
  assert.ok(
    cameraSource.indexOf('await preloadCorrectionAnimationBase(correctionAnimationBaseUrl)') <
      cameraSource.indexOf('startManualCorrectionAnimation(correctedQuestionNum, correctionAnimationBaseUrl)'),
    'the stable correction base must be decoded before old WebKit switches frames',
  )
  assert.match(cameraSource, /async function waitForDisplayedCorrectionBase/)
  assert.match(cameraSource, /image\.addEventListener\('load',\s*finishAfterPaint/)
  assert.match(cameraSource, /requestAnimationFrame\(\(\) => window\.requestAnimationFrame\(resolve\)\)/)
})

test('a repeated manual correction removes the old question mark and score before drawing replacements', () => {
  assert.match(cameraSource, /function manualCorrectionQuestionRect\(questionNum, dimensions = \{\}\)/)
  assert.match(
    cameraSource,
    /const questionRect = manualCorrectionQuestionRect\(questionNum, \{ width, height \}\)[\s\S]*?context\.drawImage\(\s*clean,\s*questionRect\.x,/,
  )
  assert.match(
    cameraSource,
    /teacherIndicatorBounds\(focusRect, \(Math\.max\(0, groupIndex\) \+ 1\) \* 131, \{ width, height \}\)/,
  )
  assert.match(
    cameraSource,
    /const scoreRect = teacherScorePlacement\(\{[\s\S]*?\}\)\?\.safetyRect[\s\S]*?context\.drawImage\(\s*clean,\s*scoreRect\.x,/,
  )
  assert.ok(
    cameraSource.indexOf('const questionRect = manualCorrectionQuestionRect') <
      cameraSource.indexOf('context.drawImage(\n      completed,'),
    'old ink must be cleared before the corrected answer patch is copied',
  )
})

test('grading pen strokes remain animated when the device requests reduced motion', () => {
  assert.equal(
    cameraSource.includes('prefers-reduced-motion'),
    false,
    'device motion settings must not silently replace the grading sequence with instant marks',
  )
  assert.match(cameraSource, /startMeasuredProgressiveStroke/)
  assert.match(cameraSource, /v-progressive-stroke/)
})
