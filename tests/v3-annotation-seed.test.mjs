import test from 'node:test'
import assert from 'node:assert/strict'
import { annotationSeedForResult } from '../src/v3/annotation-seed.js'

const fixture = {
  layoutId: 'sg-g1-lw-08-number-bonds',
  annotationGeometry: {
    warpedW: 1440,
    warpedH: 1864,
    crops: [{ id: 0, questionNum: 1, cropRect: { x: 10.12345678, y: 20, w: 80, h: 90 } }],
  },
  predictions: [{ id: 0, questionNum: 1, digit: 9, reviewNeeded: false }],
}

test('identical annotation evidence always produces the same decorative mark seed', () => {
  assert.equal(annotationSeedForResult(fixture), annotationSeedForResult(structuredClone(fixture)))
})

test('a changed transcription produces a different decorative mark seed', () => {
  const changed = structuredClone(fixture)
  changed.predictions[0].digit = 4
  assert.notEqual(annotationSeedForResult(fixture), annotationSeedForResult(changed))
})
