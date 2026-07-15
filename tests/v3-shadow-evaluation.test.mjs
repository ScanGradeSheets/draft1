import assert from 'node:assert/strict'
import test from 'node:test'
import { buildV3ShadowDecisions, representativeFrameRead } from '../src/v3/shadow-evaluation.js'

test('representative read records multi-frame consensus without inventing independence', () => {
  const result = representativeFrameRead([
    { frameIndex: 0, text: '12', minTokenProbability: .98 },
    { frameIndex: 1, text: '12', minTokenProbability: .97 },
    { frameIndex: 2, text: '17', minTokenProbability: .99 },
  ])
  assert.equal(result.item.text, '12')
  assert.equal(result.consensus.text, '12')
  assert.equal(result.consensus.count, 2)
})

test('all-answer decisions require independent model agreement and remain key-blind', () => {
  const decisions = buildV3ShadowDecisions({
    questionGroups: [{ question_num: 1, digit_box_ids: ['a', 'b'] }],
    predictions: [
      { id: 'a', digit: 1, confidence: .99 },
      { id: 'b', digit: 2, confidence: .98 },
    ],
    sequenceReads: [
      { questionNum: 1, frameIndex: 0, text: '12', minTokenProbability: .99 },
      { questionNum: 1, frameIndex: 1, text: '12', minTokenProbability: .98 },
    ],
    compactReads: [{ questionNum: 1, frameIndex: 0, read: '12', minComponentProbability: .97 }],
    zones: [{ questionNum: 1, quality: { contrastRange: 80 }, blankArtifact: { artifactProbability: 0 } }],
    requireCompact: true,
  })
  assert.equal(decisions[0].decision.action, 'accept')
  assert.equal(decisions[0].decision.read, '12')
  assert.equal(decisions[0].sequenceFrameConsensus.count, 2)
})

test('answer-key fields are rejected at the shadow boundary', () => {
  assert.throws(() => buildV3ShadowDecisions({
    questionGroups: [{ question_num: 1, digit_box_ids: ['a'], expectedAnswer: '7' }],
  }), /answer-key fields are forbidden/)
})
