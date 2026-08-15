import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import { needsLegacyStaticCorrectionTransition } from '../src/v3/legacy-correction-transition.js'

const cameraSource = await readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

test('only iOS 12 WebKit uses the static correction transition', () => {
  assert.equal(needsLegacyStaticCorrectionTransition({
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 12_5_4 like Mac OS X) AppleWebKit/605.1.15 Version/12.1.2 Mobile/15E148 Safari/604.1',
  }), true)
  assert.equal(needsLegacyStaticCorrectionTransition({
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_7 like Mac OS X) AppleWebKit/605.1.15 Version/15.6 Mobile Safari/604.1',
  }), false)
  assert.equal(needsLegacyStaticCorrectionTransition({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
  }), false)
})

test('iOS 12 keeps the live correction mounted until one predecoded settled frame is ready', () => {
  assert.match(cameraSource, /const legacyStaticCorrection = needsLegacyStaticCorrectionTransition/)
  assert.match(cameraSource, /if \(!legacyStaticCorrection\) \{[\s\S]*?ocrResult\.value = \{[\s\S]*?\.\.\.settledCorrectionState[\s\S]*?annotatedImageIncludesFinalScore:[\s\S]*?cancelCorrection\(\{ preserveQueueTransition: Boolean\(nextReviewGroup\) \}\)/)
  assert.match(cameraSource, /includeCompletedQuestionMark:\s*legacyStaticCorrection/)
  const preload = cameraSource.indexOf('await preloadCorrectionAnimationBase(correctionAnimationBaseUrl)')
  const legacyBranch = cameraSource.indexOf('if (legacyStaticCorrection)', preload)
  const installBase = cameraSource.indexOf('progressiveBaseImageOverride.value = correctionAnimationBaseUrl', legacyBranch)
  const installResult = cameraSource.indexOf('ocrResult.value = nextResult', legacyBranch)
  const closeEditor = cameraSource.indexOf(
    'cancelCorrection({ preserveQueueTransition: Boolean(nextReviewGroup) })',
    installResult,
  )
  assert.ok(preload >= 0 && legacyBranch > preload)
  assert.ok(installBase > legacyBranch)
  assert.ok(installResult > installBase)
  assert.ok(closeEditor > installResult)
})
