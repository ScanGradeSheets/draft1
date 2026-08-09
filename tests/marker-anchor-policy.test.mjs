import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { anchorsHaveConsistentMarkerScale } from '../src/homography.js'

const source = await readFile(new URL('../src/homography.js', import.meta.url), 'utf8')

test('rejects a tiny corner artifact beside three genuine worksheet markers', () => {
  const anchors = [
    { id: 'tl', width: 71, height: 73 },
    { id: 'tr', width: 7, height: 12 },
    { id: 'br', width: 72, height: 75 },
    { id: 'bl', width: 76, height: 76 },
  ]
  assert.equal(anchorsHaveConsistentMarkerScale(anchors), false)
})

test('accepts realistic marker scale variation under perspective', () => {
  const anchors = [
    { id: 'tl', width: 58, height: 61 },
    { id: 'tr', width: 65, height: 62 },
    { id: 'br', width: 79, height: 76 },
    { id: 'bl', width: 72, height: 75 },
  ]
  assert.equal(anchorsHaveConsistentMarkerScale(anchors), true)
})

test('fails closed when marker dimensions are unavailable', () => {
  assert.equal(anchorsHaveConsistentMarkerScale([
    { id: 'tl' },
    { id: 'tr' },
    { id: 'br' },
    { id: 'bl' },
  ]), false)
})

test('marker-scale consistency gates both corner-window acceptance paths', () => {
  assert.match(source, /anchorsHaveConsistentMarkerScale\(fullFrameCornerAnchors\)/)
  assert.match(source, /anchorsHaveConsistentMarkerScale\(localCornerWindowAnchors\)/)
})
