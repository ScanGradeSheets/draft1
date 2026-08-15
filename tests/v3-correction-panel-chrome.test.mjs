import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

test('correction entry is drawn on the sheet and uses a number-only custom keypad', () => {
  const templateEnd = source.indexOf('</template>')
  const template = source.slice(0, templateEnd)
  const focusStart = template.indexOf('class="on-sheet-correction-focus"')
  const keypadStart = template.indexOf('class="correction-keypad"')

  assert.ok(focusStart >= 0)
  assert.ok(keypadStart > focusStart)
  assert.ok(template.includes('correctionKeypadKeys'))
  assert.ok(template.includes('pressCorrectionKey(key)'))
  assert.match(template, /v-if="showCorrectionKeypad"/)
  assert.match(template, /:disabled="correctionKeypadSubmitting \|\| !activeCorrectionQuestion"/)
  assert.equal(template.includes('manualCorrectionInputRef'), false)
  assert.equal(template.includes('student-correction-panel--image'), false)
  assert.equal(template.includes('on-sheet-correction-label'), false)
  assert.match(source, /\.correction-keypad\s*\{[^}]*font-family:\s*'Lexend'/s)
  assert.match(source, /\.correction-keypad-key:disabled\s*\{[^}]*opacity:\s*1[^}]*-webkit-text-fill-color:\s*#1d1d1f/s)
  assert.match(source, /const activeCorrectionFocusStyle = computed\(\(\) => \{[\s\S]*focusLeftPct[\s\S]*focusTopPct[\s\S]*focusWidthPct[\s\S]*focusHeightPct[\s\S]*\}\)/)
  assert.match(source, /\.on-sheet-correction-focus\s*\{[^}]*background:\s*transparent/s)
  assert.match(source, /\.on-sheet-correction-focus\s*\{[^}]*border:\s*2px solid rgba\(36,\s*90,\s*164,\s*0\.72\)/s)
  assert.match(source, /\.on-sheet-correction-focus\s*\{[^}]*border-radius:\s*3px/s)
  assert.doesNotMatch(source, /\.on-sheet-correction-focus\s*\{[^}]*border-radius:\s*999px/s)
  assert.match(source, /\.on-sheet-correction-focus--entered\s*\{[^}]*border-color:\s*transparent[^}]*box-shadow:\s*none[^}]*animation:\s*none/s)
  assert.match(template, /class="on-sheet-correction-ink"/)
  assert.match(template, /:src="activeCorrectionInkPreviewUrl"/)
  assert.match(source, /\.on-sheet-correction-ink\s*\{[^}]*object-fit:\s*contain/s)
  assert.match(source, /\.on-sheet-correction-focus--entered\s*\{[^}]*background:\s*transparent/s)
  assert.match(template, /'on-sheet-correction-focus--entered': activeCorrectionEntryComplete/)
  assert.match(source, /correctionPendingSlotIndex\([\s\S]*manualCorrectionText\.value[\s\S]*activeCorrectionMaxLength\.value/)
  assert.match(source, /Number\(candidate\?\.slotIndex\) === pendingSlotIndex/)
  assert.match(template, /'on-sheet-correction-focus--committing': correctionKeypadSubmitting/)
  assert.match(source, /\.on-sheet-correction-focus\s*\{[^}]*animation:\s*correction-focus-breathe 1\.5s ease-in-out infinite/s)
  assert.match(source, /@keyframes correction-focus-breathe/)
  assert.match(source, /\.on-sheet-correction-focus--committing\s*\{[^}]*border-color:\s*transparent[^}]*box-shadow:\s*none[^}]*animation:\s*none/s)
  assert.doesNotMatch(source, /@keyframes correction-focus-release/)
  assert.doesNotMatch(template, /class="on-sheet-correction-entry"/)
})

test('a completed correction waits for its replacement mark before exposing the next yellow question', () => {
  const applyStart = source.indexOf('async function applyManualCorrectionCells')
  const applyEnd = source.indexOf('function clearAutoCaptureInterval', applyStart)
  const apply = source.slice(applyStart, applyEnd)
  const prepareAnimation = apply.indexOf('const correctionAnimationBaseUrl = await manualCorrectionAnimationBase')
  const preloadAnimation = apply.indexOf('await preloadCorrectionAnimationBase(correctionAnimationBaseUrl)')
  const settleResult = apply.indexOf('ocrResult.value = {\n      ...settledCorrectionState')
  const renderCorrection = apply.indexOf('annotatedImageUrl = await composeStudentAnnotatedImage')
  const correctionAnimation = apply.indexOf('startManualCorrectionAnimation(correctedQuestionNum, correctionAnimationBaseUrl)')
  const updateResult = apply.indexOf('ocrResult.value = nextResult', correctionAnimation)
  const awaitPaint = apply.indexOf('await waitForDisplayedCorrectionBase(correctionAnimationBaseUrl)', correctionAnimation)
  const cancelCurrent = apply.indexOf(
    'cancelCorrection({ preserveQueueTransition: Boolean(nextReviewGroup) })',
    correctionAnimation,
  )
  const legacyBranch = apply.indexOf('if (legacyStaticCorrection)', preloadAnimation)
  const legacyPaint = apply.indexOf('await waitForDisplayedCorrectionBase(correctionAnimationBaseUrl)', legacyBranch)
  const legacyOpenNext = apply.indexOf('openCorrectionByGroupSlot(nextReviewGroup)', legacyBranch)
  const preserveKeypad = apply.indexOf('correctionQueueTransitionActive.value = Boolean(nextReviewGroup)')

  assert.ok(prepareAnimation >= 0)
  assert.ok(settleResult >= 0)
  assert.ok(renderCorrection > settleResult)
  assert.ok(preloadAnimation > prepareAnimation)
  assert.ok(updateResult > prepareAnimation)
  assert.ok(updateResult >= 0)
  assert.ok(correctionAnimation > preloadAnimation)
  assert.ok(updateResult > correctionAnimation)
  assert.ok(awaitPaint > correctionAnimation)
  // The resolved review state remains authoritative immediately, but the next
  // yellow focus must not appear until advanceProgressiveMarking has drawn the
  // replacement mark for this correction.
  assert.ok(cancelCurrent > awaitPaint)
  assert.ok(legacyOpenNext > legacyPaint, 'iOS 12 may expose the next yellow only after the static replacement is painted')
  assert.ok(preserveKeypad >= 0, 'the keypad must remain mounted while the correction queue advances')
  assert.match(apply, /cancelCorrection\(\{ preserveQueueTransition: Boolean\(nextReviewGroup\) \}\)/)
})
