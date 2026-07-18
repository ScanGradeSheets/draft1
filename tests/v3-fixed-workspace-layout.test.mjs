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
  assert.match(appSource, /watch\(showStudentCaptureUi, setCaptureViewportLock/)
})

test('normal scans keep recognition on the sheet instead of expanding a result card', () => {
  assert.match(cameraSource, /showRecognitionOverlay && recognitionOverlayItems\.length/)
  assert.match(cameraSource, /studentMode && ocrResult && liveOcrDebugExportEnabled/)
})

test('landing and capture share one student header geometry', () => {
  assert.doesNotMatch(appSource, /header--capture/)
  assert.match(appSource, /\.scan-grade--student \.brand-logo \{\s*width: 44px;\s*height: 44px;/)
})
