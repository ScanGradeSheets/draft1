import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyBrowserLocalCoPrimarySafetyRepair,
} from '../src/v3/browser-local-co-primary-safety-repair.js'

const automatic = {
  automatic: true,
  read: '16',
  reason: 'preserve-frozen-control-automatic',
}

test('demotes an accepted high-support conflict without corroboration', () => {
  const decision = applyBrowserLocalCoPrimarySafetyRepair({
    baseDecision: automatic,
    initiallyAutomatic: true,
    highRiskMismatchReview: true,
    routeReasons: ['high-support-scout-conflict'],
    stitched: { read: '16' },
    continuous: { read: '19' },
    uniform: { read: '10' },
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '16')
  assert.equal(
    decision.reason,
    'unresolved-accepted-high-support-conflict',
  )
})

test('preserves an accepted conflict when an independent view corroborates it', () => {
  const decision = applyBrowserLocalCoPrimarySafetyRepair({
    baseDecision: automatic,
    initiallyAutomatic: true,
    highRiskMismatchReview: true,
    routeReasons: ['high-support-scout-conflict'],
    stitched: { read: '16' },
    continuous: { read: '16' },
    uniform: { read: '10' },
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '16')
})

test('demotes an original-yellow stitched promotion opposed by every other view', () => {
  const decision = applyBrowserLocalCoPrimarySafetyRepair({
    baseDecision: {
      automatic: true,
      read: '11',
      reason: 'near-certain-local-stitched-read',
    },
    initiallyAutomatic: false,
    browser: { read: '1' },
    scout: { read: '9' },
    stitched: { read: '11' },
    continuous: { read: '9' },
    uniform: { read: '9' },
  })
  assert.equal(decision.automatic, false)
  assert.equal(
    decision.reason,
    'unresolved-original-yellow-single-view-conflict',
  )
})

test('one independent corroborating view is sufficient for a stitched promotion', () => {
  const decision = applyBrowserLocalCoPrimarySafetyRepair({
    baseDecision: {
      automatic: true,
      read: '9',
      reason: 'near-certain-local-stitched-read',
    },
    initiallyAutomatic: false,
    browser: { read: '1' },
    scout: { read: '8' },
    stitched: { read: '9' },
    continuous: { read: '19' },
    uniform: { read: '9' },
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '9')
})

test('preserves an original yellow when browser and stitched readers agree', () => {
  const decision = applyBrowserLocalCoPrimarySafetyRepair({
    baseDecision: {
      automatic: true,
      read: '3',
      reason: 'near-certain-local-stitched-read',
    },
    initiallyAutomatic: false,
    browser: { read: '3' },
    scout: { read: '8' },
    stitched: { read: '3' },
    continuous: { read: '31' },
    uniform: { read: '31' },
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '3')
})

test('ordinary scout conflict is not treated as a high-risk accepted mismatch', () => {
  const decision = applyBrowserLocalCoPrimarySafetyRepair({
    baseDecision: automatic,
    initiallyAutomatic: true,
    highRiskMismatchReview: false,
    routeReasons: ['high-support-scout-conflict'],
    stitched: { read: '16' },
    continuous: { read: '19' },
    uniform: { read: '10' },
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '16')
})

test('never changes a transcription and rejects answer-key-shaped input', () => {
  const decision = applyBrowserLocalCoPrimarySafetyRepair({
    baseDecision: automatic,
    initiallyAutomatic: true,
    correctAnswer: '10',
    stitched: { read: '16' },
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.read, '16')
  assert.equal(decision.reason, 'answer-key-shaped-field-rejected')
})
