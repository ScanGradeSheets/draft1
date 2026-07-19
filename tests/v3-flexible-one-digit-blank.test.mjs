import test from 'node:test'
import assert from 'node:assert/strict'
import {
  selectFlexibleOneDigitBlankSlots,
  supportsEitherSlotForOneDigit,
} from '../src/v3/flexible-one-digit-blank.js'

const flexibleGroup = {
  accepted_digit_responses: [
    { digits: [null, 8] },
    { digits: [8, null] },
    { digits: [0, 8] },
  ],
}

test('recognizes a two-box contract that permits one digit in either box', () => {
  assert.equal(supportsEitherSlotForOneDigit(flexibleGroup), true)
  assert.equal(supportsEitherSlotForOneDigit({ accepted_digit_responses: [{ digits: [1, 3] }] }), false)
})

test('clears only one artifact slot beside one independently strong digit', () => {
  const slots = [
    { slotIndex: 0, kind: 'strong-digit' },
    { slotIndex: 1, kind: 'blank-artifact' },
  ]
  const decision = selectFlexibleOneDigitBlankSlots(flexibleGroup, slots, {
    isWrittenDigit: (slot) => slot.kind === 'strong-digit',
    isBlankArtifact: (slot) => slot.kind === 'blank-artifact',
  })
  assert.equal(decision.matchedSlot.slotIndex, 0)
  assert.equal(decision.blankSlot.slotIndex, 1)
})

test('does not erase a possible second written digit or act on a two-digit contract', () => {
  const twoDigits = [
    { slotIndex: 0, kind: 'strong-digit' },
    { slotIndex: 1, kind: 'strong-digit' },
  ]
  const options = {
    isWrittenDigit: (slot) => slot.kind === 'strong-digit',
    isBlankArtifact: (slot) => slot.kind === 'blank-artifact',
  }
  assert.equal(selectFlexibleOneDigitBlankSlots(flexibleGroup, twoDigits, options), null)
  assert.equal(selectFlexibleOneDigitBlankSlots(
    { accepted_digit_responses: [{ digits: [1, 3] }] },
    [{ slotIndex: 0, kind: 'strong-digit' }, { slotIndex: 1, kind: 'blank-artifact' }],
    options,
  ), null)
})

test('clears an optional blank even when the written digit still needs review', () => {
  const slots = [
    { slotIndex: 0, kind: 'written-review' },
    { slotIndex: 1, kind: 'blank-artifact' },
  ]
  const decision = selectFlexibleOneDigitBlankSlots(flexibleGroup, slots, {
    isWrittenDigit: (slot) => slot.kind === 'written-review',
    isBlankArtifact: (slot) => slot.kind === 'blank-artifact',
  })

  assert.equal(decision?.matchedSlot.slotIndex, 0)
  assert.equal(decision?.blankSlot.slotIndex, 1)
})
