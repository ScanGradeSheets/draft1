import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cellsForReviewText,
  compactReviewCandidates,
  compactSuggestionsByQuestion,
  localFirstReviewState,
} from '../src/v3/local-first-review.js'

test('compact candidates are key-blind review choices ranked by cross-frame support', () => {
  const rows = [
    { questionNum: 4, frameIndex: 0, read: '19', topCandidates: [
      { read: '19', jointProbability: .6, minComponentProbability: .7 },
      { read: '9', jointProbability: .2, minComponentProbability: .5 },
    ] },
    { questionNum: 4, frameIndex: 1, read: '9', topCandidates: [
      { read: '9', jointProbability: .7, minComponentProbability: .8 },
      { read: '19', jointProbability: .1, minComponentProbability: .4 },
    ] },
  ]
  assert.deepEqual(compactReviewCandidates(rows, { limit: 2 }).map((item) => item.text), ['9', '19'])
  assert.equal(compactReviewCandidates(rows)[0].reviewOnly, true)
})

test('compact choices never use answer-key-shaped fields', () => {
  const rows = [{ questionNum: 1, frameIndex: 0, read: '5', expected: '6', answer_key: ['6'] }]
  assert.deepEqual(compactReviewCandidates(rows).map((item) => item.text), ['5'])
})

test('question grouping and cell alignment support a single digit in a two-slot answer', () => {
  const grouped = compactSuggestionsByQuestion([
    { questionNum: 2, read: '12' },
    { questionNum: 3, read: '9' },
  ])
  assert.equal(grouped.get(2)[0].text, '12')
  assert.deepEqual(cellsForReviewText('9', 2), [null, 9])
  assert.equal(cellsForReviewText('123', 2), null)
})

test('strong inference remains deferred until explicitly requested', () => {
  const deferred = localFirstReviewState({ localChoices: [{ text: '9' }] })
  assert.equal(deferred.canRequestStrong, true)
  assert.equal(deferred.strongRequested, false)
  assert.equal(deferred.affectsAutomaticGrade, false)
  const loading = localFirstReviewState({ localChoices: [{ text: '9' }], strongStatus: 'loading' })
  assert.equal(loading.canRequestStrong, false)
  assert.equal(loading.strongRequested, true)
})
