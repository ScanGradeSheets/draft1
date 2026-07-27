import assert from 'node:assert/strict'
import test from 'node:test'

import { browserLocalCoPrimaryEvidencePlan } from '../src/v3/browser-local-co-primary-planner.js'

const base = {
  initiallyAutomatic: false,
  candidateDecision: { automatic: false, read: '91' },
  browser: { read: '91' },
  scout: { read: '16', probability: 0.8 },
  layoutId: 'sg-g1-lw-02-add-2digit',
}

test('requests stitched first for an unresolved strict yellow', () => {
  const plan = browserLocalCoPrimaryEvidencePlan(base)
  assert.equal(plan.status, 'needs-evidence')
  assert.deepEqual(plan.requests, ['stitched'])
})

test('requests continuous and then uniform only while the answer remains yellow', () => {
  const continuous = browserLocalCoPrimaryEvidencePlan({
    ...base,
    stitched: { read: '14', probability: 0.91 },
  })
  assert.deepEqual(continuous.requests, ['continuous'])

  const uniform = browserLocalCoPrimaryEvidencePlan({
    ...base,
    stitched: { read: '14', probability: 0.91 },
    continuous: { read: '13', probability: 0.95 },
  })
  assert.deepEqual(uniform.requests, ['uniform'])
})

test('uniform corroboration completes without unnecessary frame work', () => {
  const plan = browserLocalCoPrimaryEvidencePlan({
    ...base,
    stitched: { read: '14', probability: 0.99 },
    continuous: { read: '14', probability: 0.98 },
    uniform: { read: '14', probability: 0.96, complete: true },
    highRiskMismatchReview: true,
  })
  assert.equal(plan.status, 'complete')
  assert.equal(plan.result.decision.automatic, true)
  assert.equal(plan.result.decision.read, '14')
})

test('skips frame when it cannot corroborate existing evidence and remains yellow', () => {
  const unresolved = {
    ...base,
    stitched: { read: '14', probability: 0.99 },
    continuous: { read: '13', probability: 0.98 },
    uniform: { read: '12', probability: 0.96, complete: true },
    highRiskMismatchReview: true,
  }
  const skipped = browserLocalCoPrimaryEvidencePlan(unresolved)
  assert.equal(skipped.status, 'complete')
  assert.deepEqual(skipped.requests, [])
  assert.equal(skipped.result.decision.automatic, false)
})

test('requests frame when it can corroborate a repeated read', () => {
  const unresolved = {
    ...base,
    stitched: { read: '14', probability: 0.89 },
    continuous: { read: '13', probability: 0.98 },
    uniform: { read: '14', probability: 0.96, complete: true },
    highRiskMismatchReview: true,
  }
  const needsFrame = browserLocalCoPrimaryEvidencePlan(unresolved)
  assert.deepEqual(needsFrame.requests, ['frame'])

  const complete = browserLocalCoPrimaryEvidencePlan({
    ...unresolved,
    frame: { available: false, threeOfThree: false },
  })
  assert.equal(complete.status, 'complete')
  assert.equal(complete.result.decision.automatic, false)
})

test('number bonds may request frame even without an existing repeated read', () => {
  const plan = browserLocalCoPrimaryEvidencePlan({
    ...base,
    layoutId: 'sg-g1-lw-08-number-bonds',
    stitched: { read: '14', probability: 0.99 },
    continuous: { read: '13', probability: 0.98 },
    uniform: { read: '12', probability: 0.96, complete: true },
    highRiskMismatchReview: true,
  })
  assert.deepEqual(plan.requests, ['frame'])
})

test('strict automatics and blocking vetoes never trigger extra model work', () => {
  const automatic = browserLocalCoPrimaryEvidencePlan({
    ...base,
    candidateDecision: { automatic: true, read: '12' },
    browser: { read: '12' },
  })
  assert.equal(automatic.status, 'complete')
  assert.deepEqual(automatic.requests, [])

  const blocked = browserLocalCoPrimaryEvidencePlan({
    ...base,
    stitched: { read: '14', probability: 0.99 },
    blockingSafetyVeto: true,
  })
  assert.equal(blocked.status, 'complete')
  assert.equal(blocked.result.decision.automatic, false)
})
