import test from 'node:test'
import assert from 'node:assert/strict'
import { decodeNumericTrocrTokens, inferBlankOptionalSlots } from '../src/v3/trocr-number-tokens.js'
import { browserLocalStrongShadowConfig, requestBrowserLocalStrongShadow } from '../src/v3/trocr-small-shadow-client.js'

test('decodes known whole-number tokens without answer-key context', () => {
  assert.deepEqual(decodeNumericTrocrTokens([2, 3964, 2], { maximumDigits: 2 }), { text: '34', blank: false, valid: true })
  assert.deepEqual(decodeNumericTrocrTokens([2, 2], { maximumDigits: 2 }), { text: '', blank: true, valid: true })
})

test('rejects unknown tokens and answers outside the worksheet length contract', () => {
  assert.equal(decodeNumericTrocrTokens([2, 999999, 2], { maximumDigits: 2 }).valid, false)
  assert.equal(decodeNumericTrocrTokens([2, 3964, 331, 2], { maximumDigits: 2 }).valid, false)
})

test('explicitly assigns only worksheet-declared optional slots as blank', () => {
  assert.deepEqual(inferBlankOptionalSlots({ text: '7', valid: true, physicalSlotCount: 2, optionalSlotIndices: [0] }), [0])
  assert.deepEqual(inferBlankOptionalSlots({ text: '17', valid: true, physicalSlotCount: 1, optionalSlotIndices: [], blank: false }), [])
  assert.deepEqual(inferBlankOptionalSlots({ text: '7', valid: true, physicalSlotCount: 2, optionalSlotIndices: [] }), [])
  assert.deepEqual(inferBlankOptionalSlots({ text: '', valid: true, blank: true, physicalSlotCount: 2, optionalSlotIndices: [0, 1] }), [0, 1])
})

test('shadow requires explicit secure model URLs and never defaults on', () => {
  const off = browserLocalStrongShadowConfig({ href: 'https://example.test/app', search: '' })
  assert.equal(off.enabled, false)
  const insecure = browserLocalStrongShadowConfig({ href: 'https://example.test/app', search: '?v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongEncoderUrl=http://remote.test/e&v3BrowserLocalStrongDecoderUrl=http://remote.test/d' })
  assert.equal(insecure.enabled, false)
  const on = browserLocalStrongShadowConfig({ href: 'https://example.test/app', search: '?v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongEncoderUrl=https://models.test/e&v3BrowserLocalStrongDecoderUrl=https://models.test/d&v3BrowserLocalStrongLimit=99' })
  assert.equal(on.enabled, true)
  assert.equal(on.limit, 20)
  const noSimd = browserLocalStrongShadowConfig({ href: 'https://example.test/app', search: '?v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongEncoderUrl=https://models.test/e&v3BrowserLocalStrongDecoderUrl=https://models.test/d&v3BrowserLocalStrongNoSimd=1' })
  assert.equal(noSimd.forceNoSimd, true)
})

test('shadow is fail-open when browser workers are unavailable', async () => {
  const original = globalThis.Worker
  try {
    delete globalThis.Worker
    const result = await requestBrowserLocalStrongShadow([{ id: 'x', imageDataUrl: 'data:image/png;base64,' }], { enabled: true })
    assert.equal(result.status, 'unavailable')
    assert.equal(result.affectsGrade, false)
    assert.deepEqual(result.results, [])
  } finally {
    if (original) globalThis.Worker = original
  }
})
