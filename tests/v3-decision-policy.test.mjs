import assert from 'node:assert/strict'
import test from 'node:test'
import { decideV3Answer, summarizeFrameEvidence } from '../src/v3/decision-policy.js'
import { startAsyncV3Shadow } from '../src/v3/async-shadow-review.js'

test('accepts matching strong reads from independent architectures', () => {
  const result = decideV3Answer({
    slot: { read: '16', confidence: .94 }, sequence: { read: '16', confidence: .98 },
    blank: { isBlank: false, confidence: .99 }, quality: { usable: true, artifactProbability: .01 },
  })
  assert.equal(result.action, 'accept')
  assert.equal(result.read, '16')
})

test('disagreement always abstains even when both models are confident', () => {
  const result = decideV3Answer({
    slot: { read: '16', confidence: .99 }, sequence: { read: '14', confidence: .999 }, quality: { usable: true },
  })
  assert.equal(result.action, 'review')
  assert.equal(result.reason, 'independent-read-disagreement')
})

test('required compact reader can veto two-reader agreement', () => {
  const result = decideV3Answer({
    slot: { read: '16', confidence: .99 }, sequence: { read: '16', confidence: .999 },
    compact: { read: '14', confidence: .999 }, quality: { usable: true },
  }, { requireCompact: true })
  assert.equal(result.action, 'review')
  assert.equal(result.reason, 'compact-read-disagreement')
})

test('uncalibrated artifact evidence is advisory unless the policy explicitly enables its veto', () => {
  const input = {
    slot: { read: '7', confidence: .99 },
    sequence: { read: '7', confidence: .99 },
    quality: { usable: true, artifactProbability: .9 },
  }
  assert.equal(decideV3Answer(input).action, 'accept')
  assert.equal(decideV3Answer(input, { enforceArtifactVeto: true }).action, 'review')
})

test('rejects answer-key fields rather than allowing recognition leakage', () => {
  assert.equal(decideV3Answer({ answerKey: '16' }).action, 'invalid')
})

test('frame consensus remains correlated evidence', () => {
  const result = summarizeFrameEvidence([{ read: '7', quality: { usable: true } }, { read: '7', quality: { usable: true } }])
  assert.equal(result.unanimous, true)
  assert.match(result.note, /never substitutes/)
})

test('optional V3 work cannot block the local result', async () => {
  const local = { answer: '7' }
  const run = startAsyncV3Shadow({
    localResult: local,
    answers: [{ id: 'q1', slot: { read: '7', confidence: .95 }, quality: { usable: true } }],
    requestSequenceReads: async () => [{ id: 'q1', read: '7', confidence: .99 }],
  })
  assert.equal(run.localResult, local)
  const decisions = await run.shadow
  assert.equal(decisions[0].decision.action, 'accept')
})
