import test from 'node:test'
import assert from 'node:assert/strict'

import { acceptedResponsesForSlotContract } from '../src/v3/answer-placement-contract.js'
import {
  manuallyConfirmedAllSlots,
  requiredSlotsNeedReview,
} from '../src/v3/required-slot-review.js'
import { nextYellowReviewGroup } from '../src/v3/review-suggestion-display.js'

test('teacher-confirmed blank resolves only that slot and leaves the written answer gradeable', () => {
  const predictions = [
    { digit: 7, blank: false, empty: false, reviewNeeded: false },
    { digit: null, blank: true, empty: true, reviewNeeded: false, manualCorrected: true },
  ]

  assert.equal(requiredSlotsNeedReview({ answer: 34, predictions }), false)

  const accepted = acceptedResponsesForSlotContract({ answer: 34, slotCount: 2 })
  const writtenCells = [7, null]
  assert.equal(
    accepted.some((response) => response.every((cell, index) => cell === writtenCells[index])),
    false,
  )

  const answerGroups = [
    { questionNum: 1, status: 'incorrect' },
    { questionNum: 2, status: 'review' },
  ]
  assert.equal(nextYellowReviewGroup(answerGroups, [false, true], 1)?.questionNum, 2)
})

test('an unconfirmed required blank remains in teacher review', () => {
  assert.equal(requiredSlotsNeedReview({
    answer: 34,
    predictions: [
      { digit: 7, blank: false, empty: false, reviewNeeded: false },
      { digit: null, blank: true, empty: true, reviewNeeded: true },
    ],
  }), true)
})

test('a structurally optional blank does not require review', () => {
  assert.equal(requiredSlotsNeedReview({
    answer: 7,
    predictions: [
      { digit: 7, blank: false, empty: false, reviewNeeded: false },
      { digit: null, blank: true, empty: true, reviewNeeded: false },
    ],
  }), false)
})

test('a whole-answer correction settles after the teacher confirms every physical slot', () => {
  assert.equal(manuallyConfirmedAllSlots({
    ids: [10, 11],
    predictions: [
      { id: 10, digit: 1, manualCorrected: true, reviewNeeded: false },
      { id: 11, digit: 9, manualCorrected: true, reviewNeeded: false },
    ],
  }), true)
  assert.equal(manuallyConfirmedAllSlots({
    ids: [10, 11],
    predictions: [
      { id: 10, digit: 1, manualCorrected: true, reviewNeeded: false },
      { id: 11, digit: 9, manualCorrected: false, reviewNeeded: true },
    ],
  }), false)
})

test('the final two-slot answer stays unresolved after 1 and settles only after 19', () => {
  const ids = ['19-left', '19-right']
  const afterFirstDigit = [
    { id: '19-left', digit: 1, manualCorrected: true, reviewNeeded: false },
    { id: '19-right', digit: 9, manualCorrected: false, reviewNeeded: true },
  ]
  assert.equal(manuallyConfirmedAllSlots({ ids, predictions: afterFirstDigit }), false)

  const afterSecondDigit = afterFirstDigit.map((prediction) => (
    prediction.id === '19-right'
      ? { ...prediction, manualCorrected: true, reviewNeeded: false }
      : prediction
  ))
  assert.equal(manuallyConfirmedAllSlots({ ids, predictions: afterSecondDigit }), true)
})
