import test from 'node:test'
import assert from 'node:assert/strict'

import {
  legacyCapturePreviewSize,
  legacyVisibleViewportStyle,
  needsLegacyCaptureViewport,
  visibleViewportSize,
} from '../src/v3/legacy-capture-viewport.js'

test('old Safari capture root is locked to the genuinely visible viewport', () => {
  assert.deepEqual(legacyVisibleViewportStyle({ height: 820.9 }), {
    height: '820px',
    minHeight: '820px',
    maxHeight: '820px',
  })
  assert.deepEqual(legacyVisibleViewportStyle(null), {})
})

test('old Safari preview fits entirely inside the visible viewport contract', () => {
  const size = legacyCapturePreviewSize({
    viewportWidth: 768,
    viewportHeight: 900,
    topOffset: 150,
  })
  assert.deepEqual(size, { width: 505, height: 654 })
  assert.ok(size.height <= 900 - 150 - 96)
  assert.ok(size.width <= 768 - 20)
  assert.ok(Math.abs((size.width / size.height) - (8.5 / 11)) < 0.002)
})

test('legacy capture compaction is explicitly scoped away from modern layouts', async () => {
  const appSource = await import('node:fs/promises')
    .then(({ readFile }) => readFile(new URL('../src/App.vue', import.meta.url), 'utf8'))
  const cameraSource = await import('node:fs/promises')
    .then(({ readFile }) => readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8'))

  assert.match(appSource, /'scan-grade--legacy-capture': showStudentCaptureUi && legacyStudentCaptureLayout/)
  assert.match(appSource, /\.scan-grade--legacy-capture \.brand-logo\s*\{[^}]*width:\s*30px;[^}]*height:\s*30px;/s)
  assert.match(appSource, /\.scan-grade--legacy-capture \.student-scan-bar\s*\{[^}]*height:\s*50px;/s)
  assert.match(cameraSource, /'camera-capture--legacy-viewport': legacyCaptureLayout/)
  assert.match(appSource, /\.scan-grade--student \.brand-logo\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s)
  assert.match(appSource, /\.student-scan-bar\s*\{[^}]*height:\s*60px;/s)
})

test('old Safari uses the smallest available viewport instead of its taller layout viewport', () => {
  assert.deepEqual(visibleViewportSize({
    innerWidth: 768,
    innerHeight: 820,
  }, {
    documentElement: { clientWidth: 768, clientHeight: 1004 },
  }), { width: 768, height: 820 })
})

test('legacy sizing is used only when dvh or aspect ratio is unavailable', () => {
  assert.equal(needsLegacyCaptureViewport(null), true)
  assert.equal(needsLegacyCaptureViewport({ supports: () => true }), false)
  assert.equal(needsLegacyCaptureViewport({
    supports: (property) => property !== 'height',
  }), true)
})
