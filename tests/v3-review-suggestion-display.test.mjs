import test from 'node:test'
import assert from 'node:assert/strict'

import {
  displayedYellowQuestionNumbers,
  filterItemsToYellowQuestions,
  nextYellowReviewGroup,
  reviewSuggestionDisplayEligible,
  wholeAnswerReviewModeEligible,
  yellowQuestionNumbers,
} from '../src/v3/review-suggestion-display.js'

test('keeps the existing very-high-confidence single-frame review suggestion', () => {
  assert.equal(reviewSuggestionDisplayEligible({
    suggestion: { text: '14', minTokenProbability: 0.98 },
    frameConsensus: null,
    currentText: '11',
  }), true)
})

test('shows a lower-confidence suggestion only when at least two frames agree strongly enough', () => {
  assert.equal(reviewSuggestionDisplayEligible({
    suggestion: { text: '9', minTokenProbability: 0.88 },
    frameConsensus: { text: '9', count: 2, fraction: 2 / 3, minConfidence: 0.8 },
    currentText: '34',
    allowRelaxedMultiFrame: true,
  }), true)
  assert.equal(reviewSuggestionDisplayEligible({
    suggestion: { text: '9', minTokenProbability: 0.88 },
    frameConsensus: { text: '9', count: 1, fraction: 1 / 3, minConfidence: 0.99 },
    currentText: '34',
    allowRelaxedMultiFrame: true,
  }), false)
})

test('keeps relaxed multi-frame suggestions disabled for unvalidated layouts', () => {
  assert.equal(reviewSuggestionDisplayEligible({
    suggestion: { text: '39', minTokenProbability: 0.94 },
    frameConsensus: { text: '39', count: 3, fraction: 1, minConfidence: 0.94 },
    currentText: '37',
    allowRelaxedMultiFrame: false,
  }), false)
})

test('never adds a duplicate of the current browser transcription', () => {
  assert.equal(reviewSuggestionDisplayEligible({
    suggestion: { text: '9', minTokenProbability: 0.999 },
    frameConsensus: { text: '9', count: 3, fraction: 1, minConfidence: 0.99 },
    currentText: '9',
  }), false)
})

test('auto-advance skips confidently wrong red answers and visits only yellow answers', () => {
  const groups = [1, 2, 3, 4].map((questionNum) => ({ questionNum, reviewNeeded: questionNum !== 1 }))
  assert.equal(nextYellowReviewGroup(groups, [false, true, false, true], 2)?.questionNum, 4)
  assert.equal(nextYellowReviewGroup(groups, [false, true, false, true], 4)?.questionNum, 2)
  assert.equal(nextYellowReviewGroup(groups, [false, false, false, false], 2), null)
})

test('a validated whole-answer suggestion keeps a partially yellow two-digit answer in whole-answer review mode', () => {
  assert.equal(wholeAnswerReviewModeEligible({ slotCount: 2, reviewSlotCount: 1, hasWholeAnswerSuggestion: true }), true)
  assert.equal(wholeAnswerReviewModeEligible({ slotCount: 2, reviewSlotCount: 1, hasWholeAnswerSuggestion: false }), false)
  assert.equal(wholeAnswerReviewModeEligible({ slotCount: 1, reviewSlotCount: 1, hasWholeAnswerSuggestion: true }), false)
})

test('strong-model work is restricted to yellow questions without changing item content', () => {
  const groups = [1, 2, 3, 4].map((question_num) => ({ question_num }))
  const yellow = yellowQuestionNumbers(groups, [false, true, false, true])
  const items = groups.map((group) => ({ id: `q-${group.question_num}`, questionNum: group.question_num }))
  assert.deepEqual(yellow, [2, 4])
  assert.deepEqual(filterItemsToYellowQuestions(items, yellow), [items[1], items[3]])
})

test('yellow-only filtering keeps every retained frame for non-sequential question numbers', () => {
  const groups = [{ question_num: 2 }, { question_num: 7 }, { question_num: 11 }]
  const yellow = yellowQuestionNumbers(groups, [false, true, false])
  const items = [
    { id: 'q2-f0', questionNum: 2 },
    { id: 'q7-f0', questionNum: 7 },
    { id: 'q7-f1', questionNum: 7 },
    { id: 'q11-f0', questionNum: 11 },
  ]

  assert.deepEqual(yellow, [7])
  assert.deepEqual(filterItemsToYellowQuestions(items, yellow), [items[1], items[2]])
  assert.deepEqual(filterItemsToYellowQuestions(items, []), [])
})

test('background review preparation includes every question displayed yellow in the UI', () => {
  const questionGroups = [
    { question_num: 1 },
    { question_num: 2 },
    { question_num: 3 },
  ]
  assert.deepEqual(displayedYellowQuestionNumbers(
    questionGroups,
    [false, true, false],
    [
      { questionNum: 1, reviewNeeded: false },
      { questionNum: 2, reviewNeeded: true },
      { questionNum: 3, reviewNeeded: true },
    ],
  ), [2, 3])
})
