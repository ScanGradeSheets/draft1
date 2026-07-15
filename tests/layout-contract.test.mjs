import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { maxHandwrittenDigitsForGroup, optionalDigitIndicesForGroup } from '../src/v3/layout-contract.js'

test('physical answer geometry does not cap the handwritten transcription length', () => {
  assert.equal(maxHandwrittenDigitsForGroup({ digit_box_ids: [4], max_handwritten_digits: 2 }), 2)
  assert.equal(maxHandwrittenDigitsForGroup({ digit_box_ids: [4] }), 1)
})

test('invalid contracts cannot shrink physical slots or expand beyond the bounded UI', () => {
  assert.equal(maxHandwrittenDigitsForGroup({ digit_box_ids: [1, 2], max_handwritten_digits: 1 }), 2)
  assert.equal(maxHandwrittenDigitsForGroup({ digit_box_ids: [1], max_handwritten_digits: 99 }), 1)
})

test('optional slots come from layout semantics and never the mathematical answer key', () => {
  const group = { digit_box_ids: [1, 2], answer: 6 }
  const boxes = [{ id: 1, expected_type: 'optional_blank_or_digit' }, { id: 2, expected_type: 'digit' }]
  assert.deepEqual(optionalDigitIndicesForGroup(group, boxes), [0])
  assert.deepEqual(optionalDigitIndicesForGroup({ ...group, answer: 99 }, boxes), [0])
})

test('the shipped number-bond layout stores handwriting length on question groups, not boxes', () => {
  const layout = JSON.parse(fs.readFileSync(new URL('../public/layouts/sg-g1-lw-08-number-bonds.json', import.meta.url)))
  assert.equal(layout.boxes.some((box) => box.max_handwritten_digits != null), false)
  assert.equal(layout.question_groups.every((group) => maxHandwrittenDigitsForGroup(group) === 2), true)
})
