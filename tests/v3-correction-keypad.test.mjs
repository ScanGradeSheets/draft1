import test from 'node:test'
import assert from 'node:assert/strict'

import {
  CORRECTION_KEYPAD_KEYS,
  correctionKeypadEntry,
  correctionKeypadEntryComplete,
  correctionPreviewCells,
} from '../src/v3/correction-keypad.js'

test('the custom keypad contains digits, underscore blank, and delete without phone letters', () => {
  assert.deepEqual(CORRECTION_KEYPAD_KEYS, [
    '1', '2', '3', '4', '5', 'backspace',
    '6', '7', '8', '9', '0', '_',
  ])
})

test('single-slot digit and blank entries complete immediately', () => {
  assert.equal(correctionKeypadEntry('', '9', 1), '9')
  assert.equal(correctionKeypadEntry('', '_', 1), '_')
  assert.equal(correctionKeypadEntryComplete('9', 1), true)
  assert.equal(correctionKeypadEntryComplete('_', 1), true)
})

test('two-slot entries preserve explicit left and right blanks', () => {
  assert.equal(correctionKeypadEntry('', '_', 2), '_')
  assert.equal(correctionKeypadEntry('_', '9', 2), '_9')
  assert.equal(correctionKeypadEntry('9', '_', 2), '9_')
  assert.equal(correctionKeypadEntryComplete('_9', 2), true)
  assert.equal(correctionKeypadEntryComplete('9_', 2), true)
})

test('delete and length limits are deterministic', () => {
  assert.equal(correctionKeypadEntry('15', 'backspace', 2), '1')
  assert.equal(correctionKeypadEntry('15', '9', 2), '15')
  assert.equal(correctionKeypadEntry('1x', '5', 2), '15')
})

test('the correction preview preserves physical left-to-right slot placement', () => {
  assert.deepEqual(correctionPreviewCells('', 2), ['', ''])
  assert.deepEqual(correctionPreviewCells('2', 2), ['2', ''])
  assert.deepEqual(correctionPreviewCells('20', 2), ['2', '0'])
  assert.deepEqual(correctionPreviewCells('_9', 2), ['', '9'])
  assert.deepEqual(correctionPreviewCells('9_', 2), ['9', ''])
  assert.deepEqual(correctionPreviewCells('7', 1), ['7'])
})
