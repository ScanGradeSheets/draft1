import test from 'node:test'
import assert from 'node:assert/strict'

import {
  acceptedResponsesForSlotContract,
  oneDigitMayUseEitherOfTwoSlots,
} from '../src/v3/answer-placement-contract.js'

test('one-digit answers in two printed boxes are accepted in either physical slot', () => {
  assert.deepEqual(
    acceptedResponsesForSlotContract({ answer: 9, slotCount: 2 }),
    [[null, 9], [9, null]],
  )
  assert.equal(oneDigitMayUseEitherOfTwoSlots({
    answer: 9,
    digit_box_ids: [10, 11],
  }), true)
})

test('the shared rule repairs incomplete worksheet placement metadata', () => {
  assert.deepEqual(
    acceptedResponsesForSlotContract({
      answer: 7,
      slotCount: 2,
      acceptedDigitResponses: [{ digits: [null, 7] }],
    }),
    [[null, 7], [7, null]],
  )
})

test('a leading zero is accepted only when a worksheet explicitly permits it', () => {
  assert.deepEqual(
    acceptedResponsesForSlotContract({
      answer: 9,
      slotCount: 2,
      acceptedDigitResponses: [{ digits: [0, 9] }],
    }),
    [[0, 9], [null, 9], [9, null]],
  )
})

test('two-digit answers still require both digits and preserve their order', () => {
  assert.deepEqual(
    acceptedResponsesForSlotContract({ answer: 14, slotCount: 2 }),
    [[1, 4]],
  )
  assert.equal(oneDigitMayUseEitherOfTwoSlots({
    answer: 14,
    digit_box_ids: [10, 11],
  }), false)
})
