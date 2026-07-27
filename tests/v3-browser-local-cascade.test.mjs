import test from 'node:test'
import assert from 'node:assert/strict'

import { browserLocalCascadeDecision } from '../src/v3/browser-local-cascade.js'

test('an ordinary accepted browser read stays automatic without a strong-reader call', () => {
  const decision = browserLocalCascadeDecision({
    currentAutomatic: true,
    currentRead: '14',
    scout: { read: '14', probability: 0.99 },
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '14')
  assert.equal(decision.stitchedReaderCalls, 0)
})

test('a suspicious accepted read may only be preserved or demoted, never replaced', () => {
  const decision = browserLocalCascadeDecision({
    currentAutomatic: true,
    currentRead: '39',
    scout: { read: '34', probability: 0.99 },
    stitched: { text: '34', minTokenProbability: 0.99 },
    continuous: { text: '34', minTokenProbability: 0.99 },
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '39')
  assert.equal(decision.changedExistingAutomaticRead, false)
})

test('an existing yellow can clear through explicit local agreement', () => {
  const decision = browserLocalCascadeDecision({
    currentAutomatic: false,
    currentRead: '12',
    scout: { read: '17', probability: 0.96 },
    stitched: { text: '17', minTokenProbability: 0.95 },
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '17')
  assert.equal(decision.reason, 'local-model-and-scout-agree')
})

test('repeated 11 and place-value one/four ambiguity remain yellow', () => {
  const repeated = browserLocalCascadeDecision({
    currentAutomatic: true,
    currentRead: '11',
    stitched: { text: '11', minTokenProbability: 0.89 },
  })
  assert.equal(repeated.automatic, false)
  assert.equal(repeated.reason, 'unresolved-repeated-one')

  const placeValue = browserLocalCascadeDecision({
    currentAutomatic: true,
    currentRead: '17',
    routeReasons: ['place-value-leading-one-has-four-rival'],
    stitched: { text: '17', minTokenProbability: 1 },
  })
  assert.equal(placeValue.automatic, false)
  assert.equal(placeValue.reason, 'unresolved-place-value-one-four')
})

test('answer-key-shaped fields fail closed', () => {
  const decision = browserLocalCascadeDecision({
    currentAutomatic: false,
    currentRead: '4',
    stitched: { text: '9', minTokenProbability: 1 },
    scout: { read: '9', probability: 1 },
    answerKey: '9',
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.reason, 'answer-key-shaped-field-rejected')
  assert.equal(decision.answerKeyUsed, false)
})
