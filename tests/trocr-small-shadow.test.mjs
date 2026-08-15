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
  assert.equal(config.apply, false)

  const applying = browserLocalStrongShadowConfig({
    ...location,
    href: `${location.origin}/debug?v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongApply=1&v3BrowserLocalStrongFrames=3`,
    search: '?v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongApply=1&v3BrowserLocalStrongFrames=3',
  })
  assert.equal(applying.apply, true)

  const add2StitchedApplying = browserLocalStrongShadowConfig({
    ...location,
    href: `${location.origin}/debug?v3BrowserLocalStrongShadow=1&v3BrowserLocalAdd2StitchedApply=1&v3BrowserLocalStrongFrames=1`,
    search: '?v3BrowserLocalStrongShadow=1&v3BrowserLocalAdd2StitchedApply=1&v3BrowserLocalStrongFrames=1',
  })
  assert.equal(add2StitchedApplying.add2StitchedApply, true)
  assert.equal(add2StitchedApplying.apply, false)

  const publicLocation = {
    href: 'https://scangrade.io/debug?v3BrowserLocalStrongShadow=1',
    origin: 'https://scangrade.io',
    hostname: 'scangrade.io',
    search: '?v3BrowserLocalStrongShadow=1',
  }
  assert.equal(browserLocalStrongShadowConfig(publicLocation).enabled, false)

  const publicApplying = browserLocalStrongShadowConfig({
    ...publicLocation,
    href: 'https://scangrade.io/debug?v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongApply=1&v3BrowserLocalStrongFrames=3&v3BrowserLocalStrongEncoderUrl=https://models.test/e&v3BrowserLocalStrongDecoderUrl=https://models.test/d',
    search: '?v3BrowserLocalStrongShadow=1&v3BrowserLocalStrongApply=1&v3BrowserLocalStrongFrames=3&v3BrowserLocalStrongEncoderUrl=https://models.test/e&v3BrowserLocalStrongDecoderUrl=https://models.test/d',
  })
  assert.equal(publicApplying.enabled, true)
  assert.equal(publicApplying.apply, false)
  assert.equal(browserLocalStrongShadowConfig({
    ...publicLocation,
    href: 'https://scangrade.io/debug?v3BrowserLocalStrongShadow=1&v3BrowserLocalAdd2StitchedApply=1&v3BrowserLocalStrongFrames=1&v3BrowserLocalStrongEncoderUrl=https://models.test/e&v3BrowserLocalStrongDecoderUrl=https://models.test/d',
    search: '?v3BrowserLocalStrongShadow=1&v3BrowserLocalAdd2StitchedApply=1&v3BrowserLocalStrongFrames=1&v3BrowserLocalStrongEncoderUrl=https://models.test/e&v3BrowserLocalStrongDecoderUrl=https://models.test/d',
  }).add2StitchedApply, false)
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
  const start = source.indexOf('// Private browser-local larger-grayscale reader.')
  const end = source.indexOf('const v3LargeModelUrl = optionalWholeAnswerReviewUrl()', start)
  assert.ok(start >= 0 && end > start)
  const block = source.slice(start, end)
  const defaultStart = block.indexOf('const waitForManualReviewSettlement')
  assert.ok(defaultStart >= 0)
  const defaultBlock = block.slice(defaultStart)
  assert.equal(block.includes('hybridV3Enabled() &&'), false)
  assert.match(defaultBlock, /waitForManualReviewSettlement/)
  assert.match(block, /strongYellowApply \? 'pending' : 'waiting-for-manual-review'/)
  assert.match(block, /selectedItems: selectedShadowItems/)
  assert.match(defaultBlock, /status: 'skipped-review-not-settled'/)
  assert.match(defaultBlock, /requestBrowserLocalStrongPersistentShadow/)
  assert.match(defaultBlock, /result\.affectsGrade = false/)
  assert.match(defaultBlock, /result\.noUploads = true/)
  assert.equal(defaultBlock.includes('ocrResult.value ='), false)

  const freezeSelected = block.indexOf('const selectedShadowItems = browserLocalStrongShadowItems(')
  const waitForReview = defaultStart + defaultBlock.indexOf('const shadowItemsPromise = waitForManualReviewSettlement()')
  const strongInference = defaultStart + defaultBlock.indexOf('requestBrowserLocalStrongPersistentShadow(')
  assert.ok(freezeSelected >= 0)
  assert.ok(waitForReview > freezeSelected)
  assert.ok(strongInference > waitForReview)
})

test('private apply mode holds presentation and uses only the yellow 3-of-3 policy', () => {
  const source = readFileSync(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')
  assert.match(source, /const holdStrongYellowPresentation =/)
  assert.match(source, /browserLocalStrongConfig\.apply === true/)
  assert.match(source, /browserLocalStrongYellowDecisions\(\{/)
  assert.match(source, /: 'original-yellow-exact-three-of-three-min-0\.90'/)
  assert.match(source, /status: 'fail-open'/)
})

test('private add2 stitched apply mode is layout-gated and uses the frozen 0.999 policy', () => {
  const source = readFileSync(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')
  assert.match(source, /browserLocalStrongConfig\.add2StitchedApply === true/)
  assert.match(source, /ADD2_STITCHED_YELLOW_LAYOUT_ID/)
  assert.match(source, /browserLocalAdd2StitchedYellowDecisions\(\{/)
  assert.match(source, /policy: add2StitchedApply/)
  assert.match(source, /'add2-original-yellow-single-stitched-min-0\.999'/)
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
