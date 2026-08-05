import test from 'node:test'
import assert from 'node:assert/strict'

import {
  hasTeacherCorrections,
  mergeAsyncOcrPayloadPreservingTeacherState,
} from '../src/v3/async-ocr-result-install.js'

test('late OCR evidence cannot reopen a teacher-settled final answer', () => {
  const settled = {
    predictions: [
      { id: 'f-left', digit: 1, manualCorrected: true, reviewNeeded: false },
      { id: 'f-right', digit: 9, manualCorrected: true, reviewNeeded: false },
    ],
    questionCorrect: [true],
    questionReview: [false],
    questionScore: 1,
    questionReviewCount: 0,
    needsReview: [false, false],
    manualCorrections: { F: [1, 9] },
    answerGroups: [{ questionNum: 6, text: '19', reviewNeeded: false }],
    annotatedImageUrl: 'data:image/jpeg;base64,teacher-settled',
    v3Shadow: { status: 'pending' },
  }
  const staleAsyncPayload = {
    predictions: [
      { id: 'f-left', digit: 1, reviewNeeded: true },
      { id: 'f-right', digit: 9, reviewNeeded: true },
    ],
    questionCorrect: [false],
    questionReview: [true],
    questionScore: 0,
    questionReviewCount: 1,
    needsReview: [true, true],
    manualCorrections: {},
    answerGroups: [{ questionNum: 6, text: '19', reviewNeeded: true }],
    annotatedImageUrl: 'data:image/jpeg;base64,stale-yellow',
    v3Shadow: { status: 'complete', evidenceCount: 2 },
  }

  const merged = mergeAsyncOcrPayloadPreservingTeacherState(settled, staleAsyncPayload)

  assert.equal(hasTeacherCorrections(settled), true)
  assert.deepEqual(merged.predictions, settled.predictions)
  assert.deepEqual(merged.questionReview, [false])
  assert.equal(merged.questionScore, 1)
  assert.equal(merged.questionReviewCount, 0)
  assert.deepEqual(merged.manualCorrections, { F: [1, 9] })
  assert.equal(merged.annotatedImageUrl, settled.annotatedImageUrl)
  assert.deepEqual(merged.v3Shadow, staleAsyncPayload.v3Shadow)
})

test('async OCR payload replaces an untouched result normally', () => {
  const current = {
    predictions: [{ id: 'a', digit: 5, reviewNeeded: true }],
    questionReview: [true],
  }
  const incoming = {
    predictions: [{ id: 'a', digit: 5, reviewNeeded: false }],
    questionReview: [false],
    v3Shadow: { status: 'complete' },
  }

  assert.equal(hasTeacherCorrections(current), false)
  assert.deepEqual(mergeAsyncOcrPayloadPreservingTeacherState(current, incoming), incoming)
})
