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
  assert.equal(template.includes('manualCorrectionInputRef'), false)
  assert.equal(template.includes('student-correction-panel--image'), false)
  assert.equal(template.includes('on-sheet-correction-label'), false)
  assert.match(source, /\.correction-keypad\s*\{[^}]*font-family:\s*'Lexend'/s)
  assert.match(source, /const activeCorrectionFocusStyle = computed\(\(\) => \{[\s\S]*focusLeftPct[\s\S]*focusTopPct[\s\S]*focusWidthPct[\s\S]*focusHeightPct[\s\S]*\}\)/)
  assert.match(source, /\.on-sheet-correction-focus\s*\{[^}]*background:\s*transparent/s)
  assert.match(source, /\.on-sheet-correction-focus\s*\{[^}]*border:\s*2px solid rgba\(36,\s*90,\s*164,\s*0\.72\)/s)
  assert.match(source, /\.on-sheet-correction-focus--entered\s*\{[^}]*background:\s*rgba\(251,\s*250,\s*244,\s*0\.97\)/s)
  assert.match(template, /'on-sheet-correction-focus--entered': manualCorrectionText/)
  assert.match(source, /\.on-sheet-correction-entry\s*\{[^}]*color:\s*#171717/s)
})

test('a completed correction advances directly to the next yellow question', () => {
  const applyStart = source.indexOf('async function applyManualCorrectionCells')
  const applyEnd = source.indexOf('function clearAutoCaptureInterval', applyStart)
  const apply = source.slice(applyStart, applyEnd)
  const prepareAnimation = apply.indexOf('const correctionAnimationBaseUrl = await manualCorrectionAnimationBase')
  const updateResult = apply.indexOf('ocrResult.value = nextResult')
  const correctionAnimation = apply.indexOf('startManualCorrectionAnimation(correctedQuestionNum, correctionAnimationBaseUrl)')
  const findNext = apply.indexOf('nextYellowReviewGroup(')
  const openNext = apply.indexOf('openCorrectionByGroupSlot(nextReviewGroup)')
  const closeAtEnd = apply.indexOf('cancelCorrection()', openNext)

  assert.ok(prepareAnimation >= 0)
  assert.ok(updateResult > prepareAnimation)
  assert.ok(updateResult >= 0)
  assert.ok(correctionAnimation > updateResult)
  assert.ok(findNext > correctionAnimation)
  assert.ok(openNext > findNext)
  assert.ok(closeAtEnd > openNext)
})
