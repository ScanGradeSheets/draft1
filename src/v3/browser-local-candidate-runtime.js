import { browserSupportsWasmSimd } from './browser-local-strong-capability.js'

const TRUE_VALUES = new Set(['1', 'true', 'yes'])

function requestedValue(value) {
  return TRUE_VALUES.has(String(value || '').toLowerCase())
}

function safeHttpsUrl(value, locationLike) {
  if (!value) return ''
  try {
    const url = new URL(value, locationLike?.href || 'https://localhost/')
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    return url.protocol === 'https:' || (local && url.protocol === 'http:')
      ? url.toString()
      : ''
  } catch {
    return ''
  }
}

function sameOriginProbeUrls(locationLike) {
  const hostname = String(locationLike?.hostname || '')
  if (!hostname.endsWith('.ts.net')) return { encoderUrl: '', decoderUrl: '' }
  const origin = String(locationLike?.origin || '')
  return {
    encoderUrl: safeHttpsUrl(`${origin}/local-model-probe/models/encoder-fp32.onnx`, locationLike),
    decoderUrl: safeHttpsUrl(`${origin}/local-model-probe/models/decoder-int8.onnx`, locationLike),
  }
}

/**
 * Private, explicit runtime gate for the strict browser-local candidate.
 * Merely loading ScanGrade never downloads the 61.1 MiB model. Model URLs must
 * be HTTPS (or loopback HTTP), and no student image URL is created or uploaded.
 */
export function browserLocalCandidateRuntimeConfig(
  locationLike = typeof window !== 'undefined' ? window.location : null,
  {
    wasmSimdSupported = browserSupportsWasmSimd(),
    deviceMemoryGb = typeof navigator !== 'undefined' ? navigator.deviceMemory : null,
  } = {},
) {
  const params = new URLSearchParams(String(locationLike?.search || ''))
  const requested = requestedValue(params.get('v3BrowserLocalCandidate'))
  const defaults = requested ? sameOriginProbeUrls(locationLike) : {
    encoderUrl: '',
    decoderUrl: '',
  }
  const encoderUrl = safeHttpsUrl(
    params.get('v3BrowserLocalCandidateEncoderUrl') || defaults.encoderUrl,
    locationLike,
  )
  const decoderUrl = safeHttpsUrl(
    params.get('v3BrowserLocalCandidateDecoderUrl') || defaults.decoderUrl,
    locationLike,
  )
  const lowMemory = Number.isFinite(Number(deviceMemoryGb)) &&
    Number(deviceMemoryGb) > 0 &&
    Number(deviceMemoryGb) < 4
  const unavailableReason = !requested
    ? 'not-requested'
    : wasmSimdSupported !== true
      ? 'wasm-simd-unavailable'
      : lowMemory
        ? 'reported-device-memory-below-4gb'
        : !encoderUrl || !decoderUrl
          ? 'secure-model-urls-unavailable'
          : ''

  return {
    requested,
    enabled: unavailableReason === '',
    unavailableReason,
    encoderUrl,
    decoderUrl,
    limit: Math.min(
      50,
      Math.max(1, Number(params.get('v3BrowserLocalCandidateLimit')) || 24),
    ),
    timeoutMs: Math.min(
      60000,
      Math.max(3000, Number(params.get('v3BrowserLocalCandidateTimeoutMs')) || 15000),
    ),
    persistentIdleMs: Math.min(
      30 * 60 * 1000,
      Math.max(
        30 * 1000,
        Number(params.get('v3BrowserLocalCandidateIdleMs')) || 10 * 60 * 1000,
      ),
    ),
    persistentMaxInferences: Math.min(
      100,
      Math.max(
        8,
        Number(params.get('v3BrowserLocalCandidateMaxInferences')) || 40,
      ),
    ),
    deterministicResize: true,
    forceNoSimd: false,
    maximumFirstCheckMs: 2500,
    noUploads: true,
    affectsGradeOnlyAfterCapabilityProbe: true,
  }
}
