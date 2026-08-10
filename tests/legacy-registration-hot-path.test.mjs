import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/homography.js', import.meta.url), 'utf8')

test('answer-frame registration rejects impossible contours before pixel scans', () => {
  const start = source.indexOf('function detectAnswerBoxRects')
  const end = source.indexOf('function virtualDigitLineEraseOptions', start)
  const body = source.slice(start, end)
  const geometryGate = body.indexOf('if (!geometryPlausible)')
  const firstPixelScan = body.indexOf('const filledRatio = binaryFillRatio')

  assert.ok(start >= 0 && end > start)
  assert.ok(geometryGate >= 0)
  assert.ok(firstPixelScan > geometryGate)
  assert.match(source, /function singleChannelMatByteSource[\s\S]*cv\.HEAPU8/)
  assert.match(source, /source\.heap\[source\.offset \+ y \* source\.step \+ x\]/)
})

test('virtual digit cleanup variants share only their identical extraction prefix', () => {
  const start = source.indexOf('function buildProcessedCropTensors')
  const end = source.indexOf('function buildReviewSuggestionCropTensors', start)
  const body = source.slice(start, end)

  assert.match(body, /const sharedInkBase = isVirtualDigitBox[\s\S]*buildWorksheetInkBase\(crop\.image, baseOptions\)/)
  assert.match(body, /preprocessToMNISTCore\(crop\.image, false, baseOptions, sharedInkBase\)/)
  assert.equal((body.match(/}, sharedInkBase\)/g) || []).length, 3)
  assert.match(body, /name: 'gentle'[\s\S]*preprocessToMNISTCore\(crop\.image, false, \{[\s\S]*strictLineRemoval: false/)
})

test('Debug Scan statistics retain their finalized pixel count after prefix sharing', () => {
  const start = source.indexOf('function extractWorksheetInk')
  const end = source.indexOf('function getDisplayPixelSource', start)
  const body = source.slice(start, end)

  assert.match(body, /const total = width \* height;/)
  assert.match(body, /window\.__SCANGRADE_DEBUG_PREPROCESS_STATS\.push/)
  assert.match(body, /inkMean:[\s\S]*Math\.max\(1, ink\.length\)/)
})
