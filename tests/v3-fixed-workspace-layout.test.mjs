import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')
const cameraSource = await readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

test('capture stage precedes the reachable bottom action bar', () => {
  const cameraStart = appSource.indexOf('<CameraCapture')
  const barStart = appSource.indexOf('class="student-scan-bar"')
  assert.ok(cameraStart >= 0)
  assert.ok(barStart > cameraStart)
  assert.match(appSource, /scan-grade--capture[\s\S]*overflow: hidden/)
  assert.match(appSource, /body\.scan-grade-capture-lock[\s\S]*position: fixed/)
  assert.match(appSource, /watch\(showStudentCaptureUi, \(active\) => \{[\s\S]*setCaptureViewportLock\(active\)[\s\S]*updateLegacyStudentViewport\(\)/)
})

test('normal scans keep recognition on the sheet instead of expanding a result card', () => {
  assert.match(cameraSource, /showRecognitionOverlay && recognitionOverlayItems\.length/)
  assert.doesNotMatch(cameraSource, /class="student-result"/)
  assert.match(appSource, /ocrResult && studentDebugMode/)
  assert.match(appSource, /@click="exportStudentDebug"/)
})

test('result navigation uses one centered mirrored-chevron geometry and a matching back arrow', () => {
  const backButton = appSource.indexOf('aria-label="Back to ScanGrade home"')
  const stageBranch = appSource.indexOf('<div v-if="studentScanStage"')
  assert.ok(backButton >= 0 && backButton < stageBranch, 'back control must remain outside the stage/result branch')
  assert.match(appSource, /class="student-back-icon"/)
  assert.match(appSource, /points="16,3 7,12 16,21"/)
  assert.match(appSource, /showRecognitionOverlay \? '4,10 12,2 20,10' : '4,10 12,18 20,10'/)
  assert.match(appSource, /\.student-reading-chevron\s*\{[^}]*stroke-width:\s*1\.7;/s)
  assert.match(appSource, /\.student-back-icon\s*\{[^}]*stroke-width:\s*2\.15;/s)
  assert.match(appSource, /\.student-scan-grading\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*8px;/s)
  assert.match(appSource, /\.student-recognition-toggle\s*\{[^}]*position:\s*absolute;[^}]*left:\s*50%;[^}]*top:\s*50%;[^}]*transform:\s*translate\(-50%, -50%\)/s)
  assert.match(appSource, /\.student-scan-actions\s*\{[^}]*grid-column:\s*3;/s)
  assert.match(appSource, /\.student-scan-bar--debug-result:not\(\.student-scan-bar--grading\) \.student-scan-actions\s*\{[^}]*grid-column:\s*4;/s)
})

test('landing has a centered hero header while capture keeps the compact fixed header', () => {
  assert.doesNotMatch(appSource, /header--capture/)
  assert.match(appSource, /\.scan-grade--student \.brand-logo \{\s*width: 44px;\s*height: 44px;/)
  assert.match(appSource, /'scan-grade--landing': isStudentMode && studentView === 'landing'/)
  assert.match(appSource, /\.scan-grade--student\.scan-grade--landing\s*\{[^}]*justify-content:\s*center/s)
  assert.match(appSource, /\.scan-grade--student\.scan-grade--landing \.brand-logo\s*\{[^}]*width:\s*68px;[^}]*height:\s*68px/s)
  assert.match(appSource, /\.scan-grade--student\.scan-grade--landing \.header h1\s*\{[^}]*font-size:\s*30px/s)
})

test('modern capture spacing moves the brand and bottom bar inward without changing the legacy viewport', () => {
  assert.match(
    appSource,
    /\.scan-grade--capture:not\(\.scan-grade--legacy-capture\)\s*\{[^}]*padding-top:\s*calc\(max\(6px, env\(safe-area-inset-top, 0px\)\) \+ 8px\);[^}]*padding-bottom:\s*calc\(max\(6px, env\(safe-area-inset-bottom, 0px\)\) \+ 8px\);/s,
  )
  assert.match(appSource, /\.scan-grade--legacy-capture\s*\{[^}]*padding:\s*12px 8px 3px;/s)
})
