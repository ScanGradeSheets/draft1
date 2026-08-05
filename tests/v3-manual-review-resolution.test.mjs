import test from 'node:test'
import assert from 'node:assert/strict'
import { manualCorrectionContract } from '../src/v3/manual-correction-contract.js'
import { reconcileManualReviewState, resolvedPageReviewState } from '../src/v3/manual-review-resolution.js'
import { nextYellowReviewGroup } from '../src/v3/review-suggestion-display.js'

const answers = [[5], [8], [1, 2], [1, 3], [1, 6], [1, 9]]
const questionGroups = answers.map((_, index) => ({
  question_num: index + 1,
  digit_box_ids: [index * 2, index * 2 + 1],
}))

test('six whole-answer corrections settle in order and the final 19 cannot reopen yellow', () => {
  let predictions = questionGroups.flatMap((group) => group.digit_box_ids.map((id) => ({
    // Old Safari can deserialize worksheet ids and prediction ids with
    // different primitive types. Reproduce that exact legacy boundary.
    id: String(id),
    digit: null,
    blank: true,
    empty: true,
    reviewNeeded: true,
    manualCorrected: false,
  })))
  let questionReview = Array(answers.length).fill(true)
  let answerGroups = answers.map((_, index) => ({
    questionNum: index + 1,
    reviewNeeded: true,
    status: 'review',
  }))
  const questionCorrect = Array(answers.length).fill(true)
  const manualCorrections = {}

  answers.forEach((entered, groupIndex) => {
    const contract = manualCorrectionContract(entered, 2)
    const ids = questionGroups[groupIndex].digit_box_ids
    predictions = predictions.map((prediction) => {
      const slotIndex = ids.map(String).indexOf(String(prediction.id))
      if (slotIndex < 0) return prediction
      const digit = contract.correctionCells[slotIndex] ?? null
      return {
        ...prediction,
        digit,
        blank: digit === null,
        empty: digit === null,
        reviewNeeded: false,
        manualCorrected: true,
      }
    })
    manualCorrections[String(groupIndex + 1)] = {
      correctedSlots: [0, 1],
      text: contract.answerText,
    }

    ;({ questionReview, answerGroups } = reconcileManualReviewState({
      questionGroups,
      predictions,
      questionReview,
      answerGroups,
      questionCorrect,
      manualCorrections,
    }))

    assert.equal(questionReview[groupIndex], false)
    assert.equal(answerGroups[groupIndex].reviewNeeded, false)
    const next = nextYellowReviewGroup(answerGroups, questionReview, groupIndex + 1)
    assert.equal(next?.questionNum ?? null, groupIndex < answers.length - 1 ? groupIndex + 2 : null)
  })
})

test('a stale review flag cannot reopen a teacher-confirmed final group', () => {
  const next = nextYellowReviewGroup(
    [
      { questionNum: 1, reviewNeeded: false, manualCorrected: true },
      { questionNum: 2, reviewNeeded: false, manualCorrected: true },
    ],
    [false, true],
    2,
  )
  assert.equal(next, null)
})

test('a partial two-slot correction remains in review', () => {
  const predictions = [
    { id: 0, digit: 1, reviewNeeded: false, manualCorrected: true },
    { id: 1, digit: null, reviewNeeded: true, manualCorrected: false },
  ]
  const result = reconcileManualReviewState({
    questionGroups: [questionGroups[0]],
    predictions,
    questionReview: [true],
    answerGroups: [{ questionNum: 1, reviewNeeded: true, status: 'review' }],
    questionCorrect: [false],
    manualCorrections: { 1: { correctedSlots: [0] } },
  })
  assert.equal(result.questionReview[0], true)
  assert.equal(result.answerGroups[0].reviewNeeded, true)
})

test('teacher-confirmed structured page clears its original all-yellow fallback', () => {
  const state = resolvedPageReviewState({
    baseNeedsReview: true,
    predictions: [
      { id: 'a', reviewNeeded: false, manualCorrected: true },
      { id: 'b', reviewNeeded: false, manualCorrected: true },
    ],
    questionGroups: [
      { question_num: 1, digit_box_ids: ['a'] },
      { question_num: 2, digit_box_ids: ['b'] },
    ],
    questionCorrect: [true, true],
    questionReview: [false, false],
  })
  assert.equal(state.needsReview, false)
  assert.equal(state.forcedFallbackReviewReasonMayRemain, false)
})

test('partially confirmed fallback page remains in review', () => {
  const state = resolvedPageReviewState({
    baseNeedsReview: true,
    predictions: [
      { id: 'a', reviewNeeded: false, manualCorrected: true },
      { id: 'b', reviewNeeded: true },
    ],
    questionGroups: [
      { question_num: 1, digit_box_ids: ['a'] },
      { question_num: 2, digit_box_ids: ['b'] },
    ],
    questionCorrect: [true, false],
    questionReview: [false, true],
  })
  assert.equal(state.needsReview, true)
})

test('unstructured fallback remains in review', () => {
  const state = resolvedPageReviewState({
    baseNeedsReview: true,
    predictions: [],
    questionGroups: [],
    questionCorrect: [],
    questionReview: [],
  })
  assert.equal(state.needsReview, true)
})
