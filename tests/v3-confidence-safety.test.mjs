import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyConfidenceSafetyVetoes,
  confidenceClearanceVetoes,
  confidenceSafetyCandidateQuestionNumbers,
  confidenceSafetyVetoes,
} from '../src/v3/confidence-safety.js'

function prediction({ selected = 9, majority = 4, share = 0.555, margin = 0.11, id = 6 } = {}) {
  return {
    id,
    questionNum: 4,
    digitIndex: 0,
    digit: selected,
    reviewNeeded: false,
    confidencePolicyCleared: true,
    confidencePolicyClearanceReason: 'validated-review-reason:box-safe-default',
    preprocessDisagreement: true,
    preprocessVoteSummary: { top: { digit: majority, share }, margin },
  }
}

const groups = [{ question_num: 4, answer: 9, digit_box_ids: [6, 7] }]
const answers = [{ questionNum: 4, answerText: '9', reviewNeeded: false }]

test('vetoes the historical 4-to-9 signature when compact confirms the majority alternative', () => {
  const predictions = [prediction(), { id: 7, questionNum: 4, digitIndex: 1, digit: null }]
  const compactReads = [{
    questionNum: 4,
    read: '44',
    topCandidates: [
      { read: '44', jointProbability: 0.368, minComponentProbability: 0.659 },
      { read: '4', jointProbability: 0.209, minComponentProbability: 0.272 },
    ],
  }]
  assert.deepEqual(confidenceSafetyCandidateQuestionNumbers(groups, predictions), [4])
  const vetoes = confidenceSafetyVetoes({ questionGroups: groups, answerGroups: answers, predictions, compactReads })
  assert.equal(vetoes.length, 1)
  assert.equal(vetoes[0].majorityAlternative, '4')
  assert.equal(vetoes[0].compactRank, 2)
  assert.equal(applyConfidenceSafetyVetoes(predictions, vetoes), 1)
  assert.equal(predictions[0].reviewNeeded, true)
  assert.equal(predictions[0].preprocessReviewReason, 'compact-confirmed-preprocess-majority-alternative')
})

test('browser-only clearance veto catches the dangerous path without model availability', () => {
  const predictions = [prediction()]
  const vetoes = confidenceClearanceVetoes(groups, predictions)
  assert.equal(vetoes.length, 1)
  assert.equal(vetoes[0].reason, 'weak-clearance-preprocess-majority-conflict')
  applyConfidenceSafetyVetoes(predictions, vetoes)
  assert.equal(predictions[0].reviewNeeded, true)
})

test('does not veto when compact supports the browser or a different alternative', () => {
  for (const compactRead of ['9', '7', '']) {
    const vetoes = confidenceSafetyVetoes({
      questionGroups: groups,
      answerGroups: answers,
      predictions: [prediction()],
      compactReads: compactRead ? [{ questionNum: 4, read: compactRead, minComponentProbability: 0.9, meanComponentProbability: 0.9 }] : [],
    })
    assert.equal(vetoes.length, 0)
  }
})

test('does not veto an ordinary high-confidence prediction or a weak majority', () => {
  const ordinary = { ...prediction(), confidencePolicyCleared: false, confidencePolicyClearanceReason: null }
  const weakMajority = prediction({ share: 0.51, margin: 0.02 })
  for (const candidate of [ordinary, weakMajority]) {
    assert.equal(confidenceSafetyVetoes({
      questionGroups: groups,
      answerGroups: answers,
      predictions: [candidate],
      compactReads: [{ questionNum: 4, read: '4', minComponentProbability: 0.9, meanComponentProbability: 0.9 }],
    }).length, 0)
  }
})

test('the veto is answer-key blind', () => {
  const inputs = {
    answerGroups: answers,
    predictions: [prediction()],
    compactReads: [{ questionNum: 4, read: '4', minComponentProbability: 0.9, meanComponentProbability: 0.9 }],
  }
  const correctKey = confidenceSafetyVetoes({
    ...inputs,
    questionGroups: [{ question_num: 4, answer: 9, digit_box_ids: [6] }],
  })
  const wrongKey = confidenceSafetyVetoes({
    ...inputs,
    questionGroups: [{ question_num: 4, answer: 2, digit_box_ids: [6] }],
  })
  assert.deepEqual(correctKey, wrongKey)
})

test('ignores a weak third-place majority alternative', () => {
  const vetoes = confidenceSafetyVetoes({
    questionGroups: groups,
    answerGroups: answers,
    predictions: [prediction()],
    compactReads: [{
      questionNum: 4,
      read: '7',
      topCandidates: [
        { read: '7', jointProbability: 0.90, minComponentProbability: 0.90 },
        { read: '8', jointProbability: 0.03, minComponentProbability: 0.03 },
        { read: '4', jointProbability: 0.02, minComponentProbability: 0.02 },
      ],
    }],
  })
  assert.equal(vetoes.length, 0)
})
