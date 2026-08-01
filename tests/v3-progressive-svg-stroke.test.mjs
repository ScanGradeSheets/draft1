import test from 'node:test'
import assert from 'node:assert/strict'

import {
  startMeasuredProgressiveStroke,
  startMeasuredProgressiveStrokeSequence,
} from '../src/v3/progressive-svg-stroke.js'

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
  assert.equal(style.strokeDasharray, '52 52')
  assert.equal(style.strokeDashoffset, '52')
  assert.equal(style.opacity, '0')
  assert.deepEqual(calls[0].keyframes, [
    { strokeDasharray: '52 52', strokeDashoffset: '52', opacity: '1' },
    { strokeDasharray: '52 52', strokeDashoffset: '-4', opacity: '1' },
  ])
  assert.equal(calls[0].options.duration, 270)
  assert.equal(calls[0].options.delay, 300)
  assert.equal(calls[0].options.fill, 'forwards')

  listeners.get('finish')()
  assert.equal(style.strokeDasharray, 'none')
  assert.equal(style.strokeDashoffset, '0')
  assert.equal(style.opacity, '1')
})

test('a crossing stroke cannot start until the preceding stroke actually finishes', async () => {
  const starts = []
  const completions = []
  const makeElement = (name, delay) => {
    const style = {
      '--progressive-stroke-duration': '20ms',
      '--progressive-stroke-delay': `${delay}ms`,
      getPropertyValue(property) {
        return this[property] || ''
      },
    }
    return {
      style,
      getAttribute: () => '12',
      getTotalLength: () => 40,
      animate() {
        starts.push(name)
        let resolveFinished
        const listeners = new Map()
        const finished = new Promise((resolve) => { resolveFinished = resolve })
        completions.push(() => {
          listeners.get('finish')?.()
          resolveFinished()
        })
        return {
          finished,
          addEventListener(type, callback) { listeners.set(type, callback) },
          cancel() {},
        }
      },
    }
  }
  const first = makeElement('first', 0)
  const second = makeElement('second', 20)
  const sequence = startMeasuredProgressiveStrokeSequence([first, second])

  await Promise.resolve()
  assert.deepEqual(starts, ['first'])
  assert.equal(second.style.opacity, '0')

  completions[0]()
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(starts, ['first', 'second'])

  completions[1]()
  await sequence.finished
  assert.equal(first.style.strokeDasharray, 'none')
  assert.equal(second.style.strokeDasharray, 'none')
})
