import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appSource = readFileSync(new URL('../src/App.vue', import.meta.url), 'utf8')
const cameraSource = readFileSync(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

test('debug results remain in the fixed worksheet view and export from the bottom bar', () => {
  assert.doesNotMatch(cameraSource, /class="student-answer-grid"/)
  assert.doesNotMatch(cameraSource, /Download model-input preview/)
  assert.match(appSource, /student-scan-bar--debug-result/)
  assert.match(appSource, /cameraRef\.value\.exportLiveOcrDebugJson\(\)/)
})

test('private strong-reader evidence cannot be exported before it finishes', () => {
  assert.match(cameraSource, /const debugComparisonPending = computed/)
  assert.match(cameraSource, /'waiting-for-manual-review'/)
  assert.match(cameraSource, /debugComparisonPending,/)
  assert.match(appSource, /:disabled="studentDebugExportBusy \|\| cameraRef\?\.debugComparisonPending"/)
  assert.match(appSource, /if \(cameraRef\.value\?\.debugComparisonPending\) return 'Finishing…'/)
})

test('private debug receiver setup accepts a URL fragment and immediately removes it', () => {
  assert.match(cameraSource, /fragmentParams = new URLSearchParams/)
  assert.match(cameraSource, /cleanUrl\.hash = ''/)
  assert.match(cameraSource, /DEBUG_UPLOAD_TOKEN_KEY/)
})
