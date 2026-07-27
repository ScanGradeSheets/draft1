import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createWriterProfileConfirmation,
  writerProfileReviewSuggestion,
} from '../src/v3/writer-profile-review.js'

test('creates only an explicit teacher-confirmed packet-scoped pattern', () => {
  assert.equal(createWriterProfileConfirmation({ packetScopeId: 'P05', patternId: 'p-like-9', digit: 9 }), null)
  const confirmation = createWriterProfileConfirmation({
    packetScopeId: 'P05', patternId: 'p-like-9', digit: 9, teacherConfirmed: true,
  })
  assert.equal(confirmation.digit, '9')
  assert.equal(confirmation.reviewOnly, true)
  assert.equal(confirmation.automaticAuthority, false)
  assert.equal('studentName' in confirmation, false)
})

test('same-packet confirmed reversal may reorder a yellow review suggestion but never auto-accept', () => {
  const confirmation = createWriterProfileConfirmation({
    packetScopeId: 'P05', patternId: 'p-like-9', digit: 9, teacherConfirmed: true,
  })
  const suggestion = writerProfileReviewSuggestion({
    confirmation,
    packetScopeId: 'P05',
    detectedPatternId: 'p-like-9',
    candidateRead: '9',
    reviewNeeded: true,
  })
  assert.equal(suggestion.text, '9')
  assert.equal(suggestion.reviewOnly, true)
  assert.equal(suggestion.automatic, false)
  assert.equal(suggestion.requiresTeacherConfirmation, true)
})

test('profile cannot cross packets, override a non-yellow answer, or contradict the recognizer', () => {
  const confirmation = createWriterProfileConfirmation({
    packetScopeId: 'P05', patternId: 'p-like-9', digit: 9, teacherConfirmed: true,
  })
  for (const input of [
    { packetScopeId: 'P08', detectedPatternId: 'p-like-9', candidateRead: '9', reviewNeeded: true },
    { packetScopeId: 'P05', detectedPatternId: 'p-like-9', candidateRead: '8', reviewNeeded: true },
    { packetScopeId: 'P05', detectedPatternId: 'ordinary-9', candidateRead: '9', reviewNeeded: true },
    { packetScopeId: 'P05', detectedPatternId: 'p-like-9', candidateRead: '9', reviewNeeded: false },
  ]) assert.equal(writerProfileReviewSuggestion({ confirmation, ...input }), null)
})

test('answer-key-shaped fields cannot grant profile authority', () => {
  const confirmation = createWriterProfileConfirmation({
    packetScopeId: 'P05', patternId: 'p-like-9', digit: 9, teacherConfirmed: true,
    answerKey: '9',
  })
  const a = writerProfileReviewSuggestion({
    confirmation, packetScopeId: 'P05', detectedPatternId: 'p-like-9', candidateRead: '9', reviewNeeded: true,
    answerKey: '9',
  })
  const b = writerProfileReviewSuggestion({
    confirmation, packetScopeId: 'P05', detectedPatternId: 'p-like-9', candidateRead: '9', reviewNeeded: true,
    answerKey: '1',
  })
  assert.deepEqual(a, b)
  assert.equal(a.answerKeyUsed, false)
})
