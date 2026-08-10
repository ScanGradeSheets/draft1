import assert from 'node:assert/strict'
import test from 'node:test'

import { summarizePreprocessDebugStats } from '../src/homography.js'

function legacySummary({ ink, luminance, connectedEdgeProtection, data, channels, total }) {
  const alphaValues = []
  if (channels >= 4) {
    for (let i = 0; i < total; i++) alphaValues.push(data[i * channels + 3])
  }
  return {
    connectedEdgeProtectedPixels: connectedEdgeProtection
      ? connectedEdgeProtection.reduce((sum, value) => sum + value, 0)
      : 0,
    inkMean: Array.from(ink).reduce((sum, value) => sum + value, 0) / Math.max(1, ink.length),
    inkMax: Math.max(...ink),
    luminanceMin: Math.min(...luminance),
    luminanceMax: Math.max(...luminance),
    alphaMin: alphaValues.length ? Math.min(...alphaValues) : null,
    alphaMax: alphaValues.length ? Math.max(...alphaValues) : null,
  }
}

test('allocation-free preprocess debug summary exactly matches legacy diagnostics', () => {
  const rgbaCase = {
    ink: new Float32Array([0, 0.125, 0.9000000357627869, 0.4]),
    luminance: new Float32Array([255, 127.25, 0, 63.5]),
    connectedEdgeProtection: new Uint8Array([0, 1, 1, 0]),
    data: new Uint8ClampedArray([
      255, 255, 255, 255,
      127, 127, 127, 192,
      0, 0, 0, 64,
      63, 63, 63, 0,
    ]),
    channels: 4,
    total: 4,
  }
  assert.deepEqual(summarizePreprocessDebugStats(rgbaCase), legacySummary(rgbaCase))

  const grayCase = {
    ink: new Float32Array([0.2, 0.8]),
    luminance: new Uint8Array([12, 244]),
    connectedEdgeProtection: null,
    data: new Uint8Array([12, 244]),
    channels: 1,
    total: 2,
  }
  assert.deepEqual(summarizePreprocessDebugStats(grayCase), legacySummary(grayCase))
})
