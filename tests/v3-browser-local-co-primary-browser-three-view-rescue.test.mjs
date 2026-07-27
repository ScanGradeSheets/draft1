import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyBrowserThreeViewExactRescue,
} from '../src/v3/browser-local-co-primary-browser-three-view-rescue.js'

const yellow = {
  automatic: false,
  read: '11',
  reason: 'weak-whole-answer-proposal',
}

test('rescues exact browser plus three-view unanimity', () => {
  const decision = applyBrowserThreeViewExactRescue({
    baseDecision: yellow,
    browser: { read: '11' },
    stitched: { read: '11' },
    continuous: { read: '11' },
    uniform: { read: '11' },
  })
  assert.equal(decision.automatic, true)
  assert.equal(decision.read, '11')
  assert.equal(
    decision.reason,
    'browser-and-three-grayscale-views-unanimous',
  )
})

test('a browser or grayscale disagreement remains yellow', () => {
  const browserConflict = applyBrowserThreeViewExactRescue({
    baseDecision: yellow,
    browser: { read: '91' },
    stitched: { read: '5' },
    continuous: { read: '5' },
    uniform: { read: '5' },
  })
  const viewConflict = applyBrowserThreeViewExactRescue({
    baseDecision: yellow,
    browser: { read: '32' },
    stitched: { read: '32' },
    continuous: { read: '32' },
    uniform: { read: '30' },
  })
  assert.equal(browserConflict.automatic, false)
  assert.equal(viewConflict.automatic, false)
})

test('does not override another veto or a blocking safety veto', () => {
  const otherVeto = applyBrowserThreeViewExactRescue({
    baseDecision: {
      automatic: false,
      read: '11',
      reason: 'unresolved-place-value-one-four',
    },
    browser: { read: '11' },
    stitched: { read: '11' },
    continuous: { read: '11' },
    uniform: { read: '11' },
  })
  const blocked = applyBrowserThreeViewExactRescue({
    baseDecision: yellow,
    blockingSafetyVeto: true,
    browser: { read: '11' },
    stitched: { read: '11' },
    continuous: { read: '11' },
    uniform: { read: '11' },
  })
  assert.equal(otherVeto.automatic, false)
  assert.equal(blocked.automatic, false)
})

test('truth-shaped fields fail closed', () => {
  const decision = applyBrowserThreeViewExactRescue({
    baseDecision: yellow,
    truth: '11',
    browser: { read: '11' },
    stitched: { read: '11' },
    continuous: { read: '11' },
    uniform: { read: '11' },
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.reason, 'answer-key-shaped-field-rejected')
})
