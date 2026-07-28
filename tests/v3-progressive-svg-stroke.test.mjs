import test from 'node:test'
import assert from 'node:assert/strict'

import { startMeasuredProgressiveStroke } from '../src/v3/progressive-svg-stroke.js'

test('progressive pen reveal uses measured length, endpoint overrun, and a solid settled stroke', () => {
  const style = {}
  const listeners = new Map()
  const calls = []
  const animation = {
    addEventListener(type, callback) {
      listeners.set(type, callback)
    },
    cancel() {},
  }
  const element = {
    style,
    getTotalLength: () => 47.2,
    animate(keyframes, options) {
      calls.push({ keyframes, options })
      return animation
    },
  }

  assert.equal(
    startMeasuredProgressiveStroke(element, { durationMs: '270ms', delayMs: '300ms' }),
    animation,
  )
  assert.equal(style.animation, 'none')
  assert.equal(style.strokeDasharray, '50 50')
  assert.equal(style.strokeDashoffset, '50')
  assert.deepEqual(calls[0].keyframes, [
    { strokeDasharray: '50 50', strokeDashoffset: '50' },
    { strokeDasharray: '50 50', strokeDashoffset: '-2' },
  ])
  assert.equal(calls[0].options.duration, 270)
  assert.equal(calls[0].options.delay, 300)
  assert.equal(calls[0].options.fill, 'both')

  listeners.get('finish')()
  assert.equal(style.strokeDasharray, 'none')
  assert.equal(style.strokeDashoffset, '0')
})
