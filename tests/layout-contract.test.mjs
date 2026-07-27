import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { maxHandwrittenDigitsForGroup, optionalDigitIndicesForGroup } from '../src/v3/layout-contract.js'
import { correctionKeypadEntryComplete } from '../src/v3/correction-keypad.js'

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

test('the shipped number-bond correction length follows its printed one- and two-slot design', () => {
  const layout = JSON.parse(fs.readFileSync(new URL('../public/layouts/sg-g1-lw-08-number-bonds.json', import.meta.url)))
  assert.equal(layout.boxes.some((box) => box.max_handwritten_digits != null), false)
  assert.deepEqual(
    layout.question_groups.map((group) => maxHandwrittenDigitsForGroup(group)),
    [1, 1, 2, 1, 2, 1],
  )
  assert.deepEqual(
    layout.question_groups.map((group) => group.digit_box_ids.length),
    [1, 1, 2, 1, 2, 1],
  )
  assert.equal(
    correctionKeypadEntryComplete('9', maxHandwrittenDigitsForGroup(layout.question_groups[0])),
    true,
    'question A advances immediately after its one physical digit is entered',
  )
  assert.equal(
    correctionKeypadEntryComplete('1', maxHandwrittenDigitsForGroup(layout.question_groups[2])),
    false,
    'question C keeps waiting because its printed answer is genuinely divided into two slots',
  )
})
