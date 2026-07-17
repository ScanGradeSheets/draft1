export const BROWSER_LOCAL_STRONG_SHADOW_VERSION = 'trocr-small-opened-final-shadow-1'
export const BROWSER_LOCAL_STRONG_MODEL_IDENTITY = Object.freeze({
  encoderSha256: '5813e469aa890a6997dc396e94451baa518be80977941aa8df0d8f2dce361fc2',
  decoderSha256: '8a4d066c5cd2fb6924665fc85a2945fb96c5e42cc6bac3feb7d17fa987f8edb3',
  encoderPrecision: 'fp16',
  decoderPrecision: 'int8',
  approximateDownloadMb: 84,
})

function shadowPublicUrl(path) {
  const base = import.meta.env?.BASE_URL || '/'
  return `${base.endsWith('/') ? base : `${base}/`}${String(path || '').replace(/^\//, '')}`
}

async function preprocessShadowImage(imageDataUrl) {
  const size = 384
  const image = new Image()
  image.src = imageDataUrl
  if (typeof image.decode === 'function') await image.decode()
  else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject })
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.imageSmoothingEnabled = true
  context.imageSmoothingQuality = 'high'
  context.fillStyle = '#fff'
  context.fillRect(0, 0, size, size)
  context.drawImage(image, 0, 0, size, size)
  const rgba = context.getImageData(0, 0, size, size).data
  const plane = size * size
  const pixels = new Float32Array(3 * plane)
  for (let pixel = 0; pixel < plane; pixel += 1) {
    const source = pixel * 4
    pixels[pixel] = rgba[source] / 127.5 - 1
    pixels[plane + pixel] = rgba[source + 1] / 127.5 - 1
    pixels[2 * plane + pixel] = rgba[source + 2] / 127.5 - 1
  }
  return pixels
}

function safeModelUrl(value, locationLike) {
  if (!value) return ''
  try {
    const url = new URL(value, locationLike?.href || 'https://localhost/')
    const local = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
    return url.protocol === 'https:' || (local && url.protocol === 'http:') ? url.toString() : ''
  } catch {
    return ''
  }
}

export function browserLocalStrongShadowConfig(locationLike = null) {
  const location = locationLike || (typeof window !== 'undefined' ? window.location : null)
  const params = new URLSearchParams(String(location?.search || ''))
  const enabled = ['1', 'true', 'yes'].includes(String(params.get('v3BrowserLocalStrongShadow') || '').toLowerCase())
  const encoderUrl = safeModelUrl(params.get('v3BrowserLocalStrongEncoderUrl'), location)
  const decoderUrl = safeModelUrl(params.get('v3BrowserLocalStrongDecoderUrl'), location)
  const limit = Math.min(20, Math.max(1, Number(params.get('v3BrowserLocalStrongLimit')) || 8))
  const timeoutMs = Math.min(90000, Math.max(5000, Number(params.get('v3BrowserLocalStrongTimeoutMs')) || 15000))
  const forceNoSimd = ['1', 'true', 'yes'].includes(String(params.get('v3BrowserLocalStrongNoSimd') || '').toLowerCase())
  return { enabled: enabled && !!encoderUrl && !!decoderUrl, requested: enabled, encoderUrl, decoderUrl, limit, timeoutMs, forceNoSimd }
}

async function runDisposableWorker(item, config) {
  let pixelValues
  try {
    // Decode on the page so Safari versions without OffscreenCanvas can still
    // use the worker. The 1.7 MB tensor is transferred, not copied.
    pixelValues = await preprocessShadowImage(item.imageDataUrl)
  } catch (error) {
    return { id: item.id, questionNum: item.questionNum, status: 'error', error: `image preprocessing failed: ${String(error?.message || error)}` }
  }
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../workers/trocr-small-shadow.worker.js', import.meta.url), { type: 'module' })
    const id = `trocr-shadow-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const finish = (result) => {
      clearTimeout(timeout)
      try { worker.terminate() } catch (_) {}
      resolve(result)
    }
    const timeout = setTimeout(() => finish({ id: item.id, questionNum: item.questionNum, status: 'timeout' }), config.timeoutMs)
    worker.onmessage = (event) => {
      const response = event.data || {}
      if (response.id !== id) return
      if (response.error) finish({ id: item.id, questionNum: item.questionNum, status: 'error', error: response.error })
      else finish({ id: item.id, questionNum: item.questionNum, status: 'complete', ...response.result })
    }
    worker.onerror = (event) => finish({ id: item.id, questionNum: item.questionNum, status: 'error', error: event?.message || 'worker failed' })
    worker.postMessage({
      id,
      pixelValues,
      encoderUrl: config.encoderUrl,
      decoderUrl: config.decoderUrl,
      contract: item.contract || {},
      forceNoSimd: config.forceNoSimd === true,
      wasmPaths: {
        'ort-wasm.wasm': shadowPublicUrl('ort-wasm-nosimd.wasm'),
        'ort-wasm-simd.wasm': shadowPublicUrl('ort-wasm-simd-1.17.wasm'),
      },
    }, [pixelValues.buffer])
  })
}

export async function requestBrowserLocalStrongShadow(items, config = browserLocalStrongShadowConfig()) {
  const started = performance.now()
  if (!config.enabled || typeof Worker !== 'function') {
    return { version: BROWSER_LOCAL_STRONG_SHADOW_VERSION, modelIdentity: BROWSER_LOCAL_STRONG_MODEL_IDENTITY, status: 'unavailable', affectsGrade: false, results: [] }
  }
  const selected = (items || []).filter((item) => item?.imageDataUrl).slice(0, config.limit)
  const results = []
  // ONNX Runtime Web session reuse has stalled in both Chromium and WebKit.
  // Run exactly one answer per worker, dispose it, and fail open on every error.
  for (const item of selected) results.push(await runDisposableWorker(item, config))
  return {
    version: BROWSER_LOCAL_STRONG_SHADOW_VERSION,
    modelIdentity: BROWSER_LOCAL_STRONG_MODEL_IDENTITY,
    status: 'complete',
    affectsGrade: false,
    requested: selected.length,
    completed: results.filter((row) => row.status === 'complete').length,
    elapsedMs: performance.now() - started,
    results,
  }
}
