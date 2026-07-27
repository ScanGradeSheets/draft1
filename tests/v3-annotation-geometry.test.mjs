import test from 'node:test'
import assert from 'node:assert/strict'

import {
  annotationLayoutReference,
  annotationRectForCrop,
  transformAnnotationCrop,
} from '../src/v3/annotation-geometry.js'

test('annotations follow a detected physical answer box before the template prediction', () => {
  const boxRect = { x: 101, y: 202, w: 80, h: 90 }
  const expectedRect = { x: 108, y: 209, w: 80, h: 90 }
  assert.equal(annotationRectForCrop({ boxRect, expectedRect }), boxRect)
})

test('annotations prefer the photographed box to a template placement estimate', () => {
  const boxRect = { x: 101, y: 202, w: 80, h: 90 }
  const layoutBoxRect = { x: 105, y: 208, w: 80, h: 90 }
  assert.equal(annotationRectForCrop({ boxRect, layoutBoxRect }), boxRect)
})

test('annotations reject a nearby number-bond shape mistaken for the answer box', () => {
  const boxRect = { x: 790, y: 520, w: 80, h: 90 }
  const layoutBoxRect = { x: 690, y: 445, w: 80, h: 90 }
  assert.equal(annotationRectForCrop({ boxRect, layoutBoxRect }), layoutBoxRect)
})

test('annotations reject an implausibly large detected region around bond lines', () => {
  const boxRect = { x: 650, y: 410, w: 210, h: 125 }
  const layoutBoxRect = { x: 690, y: 445, w: 80, h: 90 }
  assert.equal(annotationRectForCrop({ boxRect, layoutBoxRect }), layoutBoxRect)
})

test('annotations retain a modest photographed-page correction', () => {
  const boxRect = { x: 683, y: 438, w: 86, h: 96 }
  const layoutBoxRect = { x: 690, y: 445, w: 80, h: 90 }
  assert.equal(annotationRectForCrop({ boxRect, layoutBoxRect }), boxRect)
})

test('annotations reject a partially overlapping detected box shifted toward the neighbouring slot', () => {
  const boxRect = { x: 650, y: 445, w: 80, h: 90 }
  const layoutBoxRect = { x: 690, y: 445, w: 80, h: 90 }
  assert.equal(annotationRectForCrop({ boxRect, layoutBoxRect }), layoutBoxRect)
})

test('annotations reject a smaller but still visible vertical drift within the printed box', () => {
  const boxRect = { x: 690, y: 463, w: 80, h: 90 }
  const layoutBoxRect = { x: 690, y: 445, w: 80, h: 90 }
  assert.equal(annotationRectForCrop({ boxRect, layoutBoxRect }), layoutBoxRect)
})

test('annotations retain safe geometry fallbacks', () => {
  const expectedRect = { x: 12, y: 34, w: 56, h: 78 }
  assert.equal(annotationRectForCrop({ expectedRect }), expectedRect)
  assert.equal(annotationRectForCrop(null), null)
})

test('source-photo projection preserves the transformed layout box as the annotation safety anchor', () => {
  const crop = {
    id: 'answer-f',
    boxRect: { x: 730, y: 620, w: 80, h: 90 },
    expectedRect: { x: 426, y: 386, w: 78, h: 88 },
    refinedRect: { x: 720, y: 610, w: 82, h: 92 },
  }
  const layoutBoxRect = { x: 430, y: 390, w: 80, h: 90 }
  const transformRect = (rect) => ({
    x: rect.x * 0.8 + 12,
    y: rect.y * 0.75 + 18,
    w: rect.w * 0.8,
    h: rect.h * 0.75,
  })
  const transformed = transformAnnotationCrop(crop, transformRect, layoutBoxRect)
  const expectedLayoutRect = transformRect(crop.expectedRect)

  assert.deepEqual(transformed.layoutBoxRect, expectedLayoutRect)
  assert.deepEqual(annotationLayoutReference(transformed), expectedLayoutRect)
  assert.deepEqual(annotationRectForCrop(transformed), expectedLayoutRect)
})

test('page-registration geometry wins over a layout rectangle recomputed at a different canvas size', () => {
  const registeredRect = { x: 1074, y: 1339, w: 86, h: 107 }
  const independentlyScaledLayoutRect = { x: 1070, y: 1348, w: 89, h: 110 }
  const crop = {
    id: 10,
    expectedRect: registeredRect,
    layoutBoxRect: independentlyScaledLayoutRect,
  }

  assert.deepEqual(
    annotationLayoutReference(crop, independentlyScaledLayoutRect),
    registeredRect,
  )
  assert.deepEqual(annotationRectForCrop(crop), registeredRect)
})

test('a structurally trusted physical frame becomes the exact annotation anchor', () => {
  const physicalRect = { x: 468, y: 441, w: 33, h: 45 }
  const registeredRect = { x: 500, y: 441, w: 33, h: 45 }
  const crop = {
    id: 'right-column-e',
    annotationRect: physicalRect,
    annotationRectSource: 'trusted-physical-frame',
    expectedRect: registeredRect,
  }
  const transformed = transformAnnotationCrop(
    crop,
    (rect) => ({ ...rect }),
    registeredRect,
  )

  assert.deepEqual(annotationLayoutReference(transformed), physicalRect)
  assert.deepEqual(annotationRectForCrop(transformed), physicalRect)
  assert.equal(transformed.annotationRectSource, 'trusted-physical-frame')
})

test('source-photo annotations never reapply a local contour after projection', () => {
  const layoutBoxRect = { x: 410, y: 360, w: 62, h: 78 }
  const transformed = transformAnnotationCrop(
    {
      id: 'number-bond-a',
      boxRect: { x: 418, y: 369, w: 62, h: 78 },
    },
    (rect) => ({
      x: rect.x * 1.12 - rect.y * 0.08 + 24,
      y: rect.y * 0.86 + rect.x * 0.04 + 18,
      w: rect.w * 1.12,
      h: rect.h * 0.86,
    }),
    layoutBoxRect,
  )

  assert.equal(transformed.annotationSpace, 'source-photo')
  assert.deepEqual(annotationRectForCrop(transformed), transformed.layoutBoxRect)
})
