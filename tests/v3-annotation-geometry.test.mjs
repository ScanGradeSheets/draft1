import test from 'node:test'
import assert from 'node:assert/strict'

import { annotationRectForCrop } from '../src/v3/annotation-geometry.js'

test('annotations follow a detected physical answer box before the template prediction', () => {
  const boxRect = { x: 101, y: 202, w: 80, h: 90 }
  const expectedRect = { x: 150, y: 260, w: 80, h: 90 }
  assert.equal(annotationRectForCrop({ boxRect, expectedRect }), boxRect)
})

test('annotations retain safe geometry fallbacks', () => {
  const expectedRect = { x: 12, y: 34, w: 56, h: 78 }
  assert.equal(annotationRectForCrop({ expectedRect }), expectedRect)
  assert.equal(annotationRectForCrop(null), null)
})
