import test from 'node:test'
import assert from 'node:assert/strict'

import {
  annotationRegionIsEditable,
  correctionScopeForReviewAdvance,
  correctionSlotForTappedRegion,
  editableAnnotationRegions,
} from '../src/v3/review-edit-scope.js'

const regions = [
  { key: 'a', reviewNeeded: false, manualCorrected: false },
  { key: 'b', reviewNeeded: true, manualCorrected: false },
  { key: 'c', reviewNeeded: false, manualCorrected: true },
]

test('normal review mode exposes only yellow or previously corrected answers', () => {
  assert.deepEqual(
    editableAnnotationRegions(regions, { readingsVisible: false }).map((region) => region.key),
    ['b', 'c'],
  )
})

test('one remaining yellow digit stays a physical-slot correction', () => {
  assert.deepEqual(
    correctionScopeForReviewAdvance({
      reviewSlotIndexes: [0],
      wholeAnswerEligible: true,
    }),
    { useWholeAnswer: false, selectedSlotIndex: 0 },
  )
  assert.deepEqual(
    correctionScopeForReviewAdvance({
      reviewSlotIndexes: [0, 1],
      wholeAnswerEligible: true,
    }),
    { useWholeAnswer: true, selectedSlotIndex: null },
  )
})

test('revealing readings makes every mapped answer editable', () => {
  assert.deepEqual(
    editableAnnotationRegions(regions, { readingsVisible: true }).map((region) => region.key),
    ['a', 'b', 'c'],
  )
  assert.equal(annotationRegionIsEditable(null, { readingsVisible: true }), false)
})

test('a directly tapped right digit remains the correction target', () => {
  assert.equal(
    correctionSlotForTappedRegion(
      { questionNum: 1, slotIndex: 1 },
      { useWholeAnswer: true, fallbackSlotIndex: 0 },
    ),
    1,
  )
  assert.equal(
    correctionSlotForTappedRegion(
      { questionNum: 1, slotIndex: null, wholeAnswer: true },
      { useWholeAnswer: true, fallbackSlotIndex: 0 },
    ),
    null,
  )
})
