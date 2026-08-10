import test from 'node:test'
import assert from 'node:assert/strict'

import { exactQuantile } from '../src/exact-quantile.js'

function sortedQuantile(values, q) {
  if (!values.length) return 0
  const sorted = Array.from(values).sort((a, b) => a - b)
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * q)))
  return sorted[index]
}

test('linear selection exactly matches the former sorted percentile', () => {
  let seed = 0x15_98_20_26
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return seed / 0x1_0000_0000
  }
  for (const length of [1, 2, 3, 17, 784, 14000]) {
    const values = Array.from({ length }, () => Math.fround(random() * 255))
    for (const q of [0, 0.05, 0.76, 0.82, 0.86, 0.90, 0.94, 1]) {
      assert.equal(exactQuantile(values, q), sortedQuantile(values, q))
    }
  }
})

test('duplicate values retain the exact ranked value', () => {
  const values = [9, 2, 2, 2, 7, 9, 1, 7, 7, 7]
  for (const q of [0.1, 0.5, 0.9]) {
    assert.equal(exactQuantile(values, q), sortedQuantile(values, q))
  }
})
