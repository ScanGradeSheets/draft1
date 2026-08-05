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
  assert.deepEqual(size, { width: 465, height: 602 })
  assert.ok(size.height <= 900 - 150 - 148)
  assert.ok(size.width <= 768 - 20)
  assert.ok(Math.abs((size.width / size.height) - (8.5 / 11)) < 0.002)
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
