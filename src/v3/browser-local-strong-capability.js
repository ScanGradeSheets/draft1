const SIMD_PROBE = new Uint8Array([
  0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 30, 1, 28, 0,
  65, 0, 253, 15, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  253, 186, 1, 26, 11,
])

export function browserSupportsWasmSimd(validate = globalThis.WebAssembly?.validate) {
  if (typeof validate !== 'function') return false
  try {
    return validate(SIMD_PROBE)
  } catch (_) {
    return false
  }
}

/**
 * Conservative, answer-key-blind capability gate for the optional strong
 * browser-local reader. Unsupported or slow devices keep the existing OCR and
 * show review; they never receive a weaker confidence policy.
 */
export function browserLocalStrongTier({
  wasmSimdSupported,
  loadStatus = 'not-tested',
  initializationMs = null,
  firstInferenceMs = null,
  deviceMemoryGb = null,
  maximumFirstCheckMs = 2500,
} = {}) {
  if (wasmSimdSupported !== true) {
    return { enabled: false, tier: 'conservative-browser-ocr', reason: 'wasm-simd-unavailable' }
  }
  if (Number.isFinite(deviceMemoryGb) && deviceMemoryGb < 4) {
    return { enabled: false, tier: 'conservative-browser-ocr', reason: 'reported-device-memory-below-4gb' }
  }
  if (loadStatus === 'error' || loadStatus === 'timeout') {
    return { enabled: false, tier: 'conservative-browser-ocr', reason: `strong-reader-${loadStatus}` }
  }
  if (loadStatus !== 'complete') {
    return { enabled: false, tier: 'capability-probe-required', reason: 'strong-reader-not-yet-measured' }
  }
  const firstCheckMs = Number(initializationMs) + Number(firstInferenceMs)
  if (!Number.isFinite(firstCheckMs) || firstCheckMs > maximumFirstCheckMs) {
    return { enabled: false, tier: 'conservative-browser-ocr', reason: 'strong-reader-too-slow' }
  }
  return {
    enabled: true,
    tier: 'persistent-local-strong-reader',
    reason: 'simd-and-runtime-probe-pass',
    firstCheckMs,
  }
}
