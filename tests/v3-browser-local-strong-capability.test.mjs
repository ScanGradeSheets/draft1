import test from 'node:test'
import assert from 'node:assert/strict'
import {
  browserLocalStrongTier,
  browserSupportsWasmSimd,
} from '../src/v3/browser-local-strong-capability.js'

test('SIMD detection fails closed when validation is unavailable or throws', () => {
  assert.equal(browserSupportsWasmSimd(null), false)
  assert.equal(browserSupportsWasmSimd(() => { throw new Error('unsupported') }), false)
  assert.equal(browserSupportsWasmSimd(() => true), true)
})

test('the embedded SIMD feature probe is a valid WebAssembly module here', () => {
  assert.equal(browserSupportsWasmSimd(WebAssembly.validate), true)
})

test('unsupported, low-memory, failed, and slow devices retain conservative OCR', () => {
  assert.equal(browserLocalStrongTier({ wasmSimdSupported: false }).enabled, false)
  assert.equal(browserLocalStrongTier({
    wasmSimdSupported: true,
    deviceMemoryGb: 2,
    loadStatus: 'complete',
    initializationMs: 300,
    firstInferenceMs: 600,
  }).reason, 'reported-device-memory-below-4gb')
  assert.equal(browserLocalStrongTier({
    wasmSimdSupported: true,
    loadStatus: 'error',
  }).reason, 'strong-reader-error')
  assert.equal(browserLocalStrongTier({
    wasmSimdSupported: true,
    loadStatus: 'complete',
    initializationMs: 500,
    firstInferenceMs: 3000,
  }).reason, 'strong-reader-too-slow')
})

test('a fast SIMD runtime enables one persistent local reader', () => {
  assert.deepEqual(browserLocalStrongTier({
    wasmSimdSupported: true,
    loadStatus: 'complete',
    initializationMs: 393,
    firstInferenceMs: 666,
  }), {
    enabled: true,
    tier: 'persistent-local-strong-reader',
    reason: 'simd-and-runtime-probe-pass',
    firstCheckMs: 1059,
  })
})
