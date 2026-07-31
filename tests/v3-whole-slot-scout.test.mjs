import assert from 'node:assert/strict'
import test from 'node:test'

import {
  decodeWholeSlotScout,
  wholeSlotScoutMetadata,
} from '../src/v3/whole-slot-scout.js'
import { wholeSlotScoutShadowConfig } from '../src/v3/whole-slot-scout-client.js'

test('encodes only structural slot and layout metadata', () => {
  assert.deepEqual(
    Array.from(wholeSlotScoutMetadata({ slotCount: 2, layoutFamily: 'number-bond' })),
    [0, 1, 0, 1, 0],
  )
  assert.deepEqual(
    Array.from(wholeSlotScoutMetadata({
      slotCount: 1,
      layoutFamily: 'row',
      answerKey: '9',
      truth: '4',
    })),
    [1, 0, 1, 0, 0],
  )
})

test('whole decoder respects physical slot count', () => {
  const logits = {
    length: new Float32Array([-2, 4]),
    tens: new Float32Array([0, 5, 0, 0, 0, 0, 0, 0, 0, 0]),
    ones: new Float32Array([0, 0, 5, 0, 0, 0, 0, 0, 0, 0]),
  }
  assert.equal(decodeWholeSlotScout({ ...logits, slotCount: 2 }).read, '12')
  assert.equal(decodeWholeSlotScout({ ...logits, slotCount: 1 }).read, '2')
})

test('active safety mode requests the scout and uses the old-device timeout', () => {
  const config = wholeSlotScoutShadowConfig({
    search: '?v3AcceptedSafety=1',
  })
  assert.equal(config.requested, true)
  assert.equal(config.enabled, true)
  assert.equal(config.apply, true)
  assert.equal(config.timeoutMs, 30000)
})

test('local replay can explicitly exercise the public narrow scope', () => {
  const config = wholeSlotScoutShadowConfig({
    hostname: '127.0.0.1',
    search: '?v3AcceptedSafety=1&v3AcceptedSafetyScope=six-eight-only',
  })
  assert.equal(config.apply, true)
  assert.equal(config.policyScope, 'six-eight-only')
})

test('narrow safety repair defaults on for public and private builds and can be disabled', () => {
  const privateConfig = wholeSlotScoutShadowConfig({
    hostname: 'mac-mini.tail9a3379.ts.net',
    search: '',
  })
  assert.equal(privateConfig.apply, true)
  assert.equal(privateConfig.policyScope, 'full')
  const publicConfig = wholeSlotScoutShadowConfig({
    hostname: 'scangrade.io',
    search: '',
  })
  assert.equal(publicConfig.apply, true)
  assert.equal(publicConfig.policyScope, 'six-eight-only')
  assert.match(publicConfig.modelUrl, /v3-whole-slot-scout\.onnx\?v=beta-15-56$/)
  const pagesConfig = wholeSlotScoutShadowConfig({
    hostname: 'ab5e380a.scangrade.pages.dev',
    search: '',
  })
  assert.equal(pagesConfig.apply, true)
  assert.equal(pagesConfig.policyScope, 'six-eight-only')
  assert.equal(wholeSlotScoutShadowConfig({
    hostname: 'mac-mini.tail9a3379.ts.net',
    search: '?v3AcceptedSafety=0',
  }).apply, false)
})
