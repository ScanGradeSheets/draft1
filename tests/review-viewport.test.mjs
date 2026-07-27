import test from 'node:test'
import assert from 'node:assert/strict'

import { correctionKeyboardScrollDelta } from '../src/v3/review-viewport.js'

test('an upper correction that is already visible does not move the worksheet', () => {
  assert.equal(correctionKeyboardScrollDelta({
    targetRect: { top: 90, bottom: 130 },
    panelRect: { bottom: 260 },
    viewportTop: 0,
    viewportHeight: 430,
  }), 0)
})

test('a lower correction moves only far enough to clear the keyboard', () => {
  assert.equal(correctionKeyboardScrollDelta({
    targetRect: { top: 310, bottom: 350 },
    panelRect: { bottom: 475 },
    viewportTop: 0,
    viewportHeight: 430,
  }), 127)
})

test('Safari suggestion strip is treated as obscured rather than visible space', () => {
  assert.equal(correctionKeyboardScrollDelta({
    targetRect: { top: 250, bottom: 290 },
    panelRect: { bottom: 390 },
    viewportTop: 0,
    viewportHeight: 430,
  }), 42)
})
