import test from 'node:test'
import assert from 'node:assert/strict'

import { browserLocalCandidateRuntimeConfig } from '../src/v3/browser-local-candidate-runtime.js'

const base = {
  href: 'https://mac-mini.tail9a3379.ts.net/app',
  origin: 'https://mac-mini.tail9a3379.ts.net',
  hostname: 'mac-mini.tail9a3379.ts.net',
}

test('candidate is never enabled without its explicit private flag', () => {
  const config = browserLocalCandidateRuntimeConfig(
    { ...base, search: '' },
    { wasmSimdSupported: true, deviceMemoryGb: 8 },
  )
  assert.equal(config.requested, false)
  assert.equal(config.enabled, false)
  assert.equal(config.unavailableReason, 'not-requested')
})

test('explicit Tailscale probe uses same-origin HTTPS model assets', () => {
  const config = browserLocalCandidateRuntimeConfig(
    { ...base, search: '?v3BrowserLocalCandidate=1' },
    { wasmSimdSupported: true, deviceMemoryGb: null },
  )
  assert.equal(config.enabled, true)
  assert.equal(
    config.encoderUrl,
    'https://mac-mini.tail9a3379.ts.net/local-model-probe/models/encoder-fp32.onnx',
  )
  assert.equal(config.deterministicResize, true)
  assert.equal(config.noUploads, true)
  assert.equal(config.persistentMaxInferences, 40)
})

test('unsupported, low-memory, and insecure configurations fail closed', () => {
  const noSimd = browserLocalCandidateRuntimeConfig(
    { ...base, search: '?v3BrowserLocalCandidate=1' },
    { wasmSimdSupported: false, deviceMemoryGb: 8 },
  )
  assert.equal(noSimd.enabled, false)
  assert.equal(noSimd.unavailableReason, 'wasm-simd-unavailable')

  const lowMemory = browserLocalCandidateRuntimeConfig(
    { ...base, search: '?v3BrowserLocalCandidate=1' },
    { wasmSimdSupported: true, deviceMemoryGb: 2 },
  )
  assert.equal(lowMemory.enabled, false)
  assert.equal(lowMemory.unavailableReason, 'reported-device-memory-below-4gb')

  const publicLocation = {
    href: 'https://scangrade.io/',
    origin: 'https://scangrade.io',
    hostname: 'scangrade.io',
    search: '?v3BrowserLocalCandidate=1' +
      '&v3BrowserLocalCandidateEncoderUrl=http://unsafe.test/e.onnx' +
      '&v3BrowserLocalCandidateDecoderUrl=http://unsafe.test/d.onnx',
  }
  const insecure = browserLocalCandidateRuntimeConfig(
    publicLocation,
    { wasmSimdSupported: true, deviceMemoryGb: 8 },
  )
  assert.equal(insecure.enabled, false)
  assert.equal(insecure.unavailableReason, 'secure-model-urls-unavailable')
})
