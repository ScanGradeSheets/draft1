import assert from 'node:assert/strict'
import test from 'node:test'

import { browserLocalCoPrimaryDecision } from '../src/v3/browser-local-co-primary.js'

const yellowControl = { automatic: false, read: '95' }

test('preserves a frozen control automatic before presentation', () => {
  const result = browserLocalCoPrimaryDecision({
    controlDecision: { automatic: true, read: '12' },
    browser: { read: '92' },
    stitched: { read: '13', probability: 0.999 },
    continuous: { read: '13', probability: 0.99 },
    scout: { read: '13', probability: 0.99 },
  })
  assert.equal(result.automatic, true)
  assert.equal(result.read, '12')
  assert.equal(result.preAcceptance, true)
  assert.equal(result.changedAcceptedRead, false)
})

test('promotes a control yellow from a strong co-primary proposal', () => {
  const result = browserLocalCoPrimaryDecision({
    controlDecision: yellowControl,
    browser: { read: '95' },
    stitched: { read: '12', probability: 0.999 },
    continuous: { read: '12', probability: 0.98 },
    scout: { read: '15', probability: 0.96 },
  })
  assert.equal(result.automatic, true)
  assert.equal(result.read, '12')
  assert.match(result.reason, /^co-primary-/)
})

test('weak or structurally conflicted proposals stay yellow', () => {
  const weak = browserLocalCoPrimaryDecision({
    controlDecision: yellowControl,
    browser: { read: '8' },
    stitched: { read: '6', probability: 0.54 },
    continuous: { read: '5', probability: 0.69 },
    scout: { read: '6', probability: 0.59 },
  })
  assert.equal(weak.automatic, false)
  assert.equal(weak.reason, 'weak-whole-answer-proposal')

  const placeValue = browserLocalCoPrimaryDecision({
    controlDecision: { automatic: false, read: '17' },
    browser: { read: '17' },
    stitched: { read: '17', probability: 0.94 },
    continuous: { read: '47', probability: 0.91 },
    scout: { read: '17', probability: 0.88 },
    routeReasons: ['place-value-leading-one-has-four-rival'],
  })
  assert.equal(placeValue.automatic, false)
  assert.equal(placeValue.reason, 'unresolved-place-value-one-four')
})

test('high-risk view conflicts remain yellow before acceptance', () => {
  const result = browserLocalCoPrimaryDecision({
    controlDecision: { automatic: false, read: '01' },
    browser: { read: '8' },
    stitched: { read: '6', probability: 0.997 },
    continuous: { read: '8', probability: 0.982 },
    scout: { read: '9', probability: 0.46 },
    highRiskMismatchReview: true,
  })
  assert.equal(result.automatic, false)
  assert.equal(result.proposedRead, '6')
  assert.equal(result.reason, 'unresolved-high-risk-mismatch')
})

test('restores a vetoed proposal only with stable multiview whole-answer consensus', () => {
  const result = browserLocalCoPrimaryDecision({
    controlDecision: { automatic: false, read: '11' },
    browser: { read: '11' },
    stitched: { read: '14', probability: 0.99 },
    continuous: { read: '14', probability: 0.98 },
    scout: { read: '16', probability: 0.86 },
    uniform: { read: '14', probability: 0.95 },
    frame: { read: '14', probability: 0.97, threeOfThree: true },
    layoutId: 'sg-g1-lw-02-add-2digit',
    highRiskMismatchReview: true,
  })
  assert.equal(result.automatic, true)
  assert.equal(result.read, '14')
  assert.match(result.reason, /multiview-consensus/)
})

test('two agreeing primary views without corroboration stay yellow', () => {
  const result = browserLocalCoPrimaryDecision({
    controlDecision: { automatic: false, read: '1' },
    browser: { read: '1' },
    stitched: { read: '5', probability: 0.99 },
    continuous: { read: '5', probability: 0.99 },
    scout: { read: '5', probability: 0.99 },
    uniform: { read: '9', probability: 0.99 },
    frame: { read: '9', probability: 0.99, threeOfThree: true },
    layoutId: 'sg-g1-lw-08-number-bonds',
    highRiskMismatchReview: true,
  })
  assert.equal(result.automatic, false)
  assert.equal(result.read, '1')
})

test('multiview consensus never overrides an explicit blocking safety veto', () => {
  const result = browserLocalCoPrimaryDecision({
    controlDecision: { automatic: false, read: '0' },
    browser: { read: '0' },
    stitched: { read: '9', probability: 0.99 },
    continuous: { read: '9', probability: 0.99 },
    uniform: { read: '9', probability: 0.99 },
    frame: { read: '9', probability: 0.99, threeOfThree: true },
    blockingSafetyVeto: true,
  })
  assert.equal(result.automatic, false)
  assert.equal(result.reason, 'blocking-safety-veto')
})

test('answer-key and truth-shaped fields fail closed at every boundary', () => {
  for (const input of [
    { truthText: '12' },
    { controlDecision: { automatic: false, read: '95', correctAnswer: '12' } },
    { stitched: { read: '12', teacherCorrection: '12' } },
  ]) {
    const result = browserLocalCoPrimaryDecision({
      controlDecision: yellowControl,
      browser: { read: '95' },
      stitched: { read: '12', probability: 0.999 },
      continuous: { read: '12', probability: 0.99 },
      scout: { read: '12', probability: 0.99 },
      ...input,
    })
    assert.equal(result.automatic, false)
    assert.equal(result.reason, 'answer-key-shaped-field-rejected')
    assert.equal(result.answerKeyUsed, false)
  }
})
