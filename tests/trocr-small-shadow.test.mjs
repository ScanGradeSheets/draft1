import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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

test('shadow may use same-origin private-tailnet models and clamps retained frames', () => {
  const location = {
    href: 'https://mac-mini.tail9a3379.ts.net/debug?v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongFrames=99',
    origin: 'https://mac-mini.tail9a3379.ts.net',
    hostname: 'mac-mini.tail9a3379.ts.net',
    search: '?v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongFrames=99',
  }
  const config = browserLocalStrongShadowConfig(location)
  assert.equal(config.enabled, true)
  assert.equal(config.frameCount, 3)
  assert.equal(config.encoderUrl, 'https://mac-mini.tail9a3379.ts.net/local-model-probe/models/encoder-fp32.onnx')
  assert.equal(config.decoderUrl, 'https://mac-mini.tail9a3379.ts.net/local-model-probe/models/decoder-int8.onnx')

  const publicLocation = {
    href: 'https://scangrade.io/debug?v3BrowserLocalStrongShadow=1',
    origin: 'https://scangrade.io',
    hostname: 'scangrade.io',
    search: '?v3BrowserLocalStrongShadow=1',
  }
  assert.equal(browserLocalStrongShadowConfig(publicLocation).enabled, false)
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

test('retained-frame strong shadow stays detached from grading and V3 promotion', () => {
  const source = readFileSync(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')
  const start = source.indexOf('// Experimental browser-local larger-grayscale reader.')
  const end = source.indexOf('const v3LargeModelUrl = optionalWholeAnswerReviewUrl()', start)
  assert.ok(start >= 0 && end > start)
  const block = source.slice(start, end)
  assert.equal(block.includes('hybridV3Enabled() &&'), false)
  assert.match(block, /allowWithoutReviewUrl: true/)
  assert.match(block, /status: browserLocalStrongConfig\.enabled \? 'waiting-for-manual-review'/)
  assert.match(block, /waitForManualReviewSettlement/)
  assert.match(block, /selectedItems: selectedShadowItems/)
  assert.match(block, /status: 'skipped-review-not-settled'/)
  assert.match(block, /requestBrowserLocalStrongPersistentShadow/)
  assert.ok((block.match(/resetBrowserLocalStrongPersistentShadow\(\)/g) || []).length >= 2)
  assert.match(block, /result\.affectsGrade = false/)
  assert.match(block, /result\.noUploads = true/)
  assert.equal(block.includes('ocrResult.value ='), false)

  const freezeSelected = block.indexOf('const selectedShadowItems = browserLocalStrongShadowItems(')
  const waitForReview = block.indexOf('const shadowItemsPromise = waitForManualReviewSettlement()')
  const strongInference = block.indexOf('requestBrowserLocalStrongPersistentShadow(')
  assert.ok(freezeSelected >= 0)
  assert.ok(waitForReview > freezeSelected)
  assert.ok(strongInference > waitForReview)
})

test('retained-frame strong shadow suppresses the other private safety reader', () => {
  const source = readFileSync(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')
  const strongConfig = source.indexOf('const browserLocalStrongConfig = browserLocalStrongShadowConfig()')
  const acceptedRuntime = source.indexOf('const acceptedSafetyRuntimeEnabled = !browserLocalStrongConfig.requested')
  const strongExecution = source.indexOf('browserLocalStrongConfig.requested &&', acceptedRuntime)

  assert.ok(strongConfig >= 0)
  assert.ok(acceptedRuntime > strongConfig)
  assert.ok(strongExecution > acceptedRuntime)
})
