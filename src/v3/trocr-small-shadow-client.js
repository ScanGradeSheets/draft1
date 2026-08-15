export const BROWSER_LOCAL_STRONG_SHADOW_VERSION = 'trocr-matmul-int8-webkit-shadow-2'
export const BROWSER_LOCAL_STRONG_MODEL_IDENTITY = Object.freeze({
  encoderSha256: 'da158e8863477b81e2672dac48506333333edb599da711d0233e4fc578b9613a',
  decoderSha256: '8a4d066c5cd2fb6924665fc85a2945fb96c5e42cc6bac3feb7d17fa987f8edb3',
  encoderPrecision: 'fp32-patch-convolution-matmul-int8',
  decoderPrecision: 'int8',
  packageBytes: 64086224,
  approximateDownloadMiB: 61.1,
})

function shadowPublicUrl(path) {
  const base = import.meta.env?.BASE_URL || '/'
  return `${base.endsWith('/') ? base : `${base}/`}${String(path || '').replace(/^\//, '')}`
}

function deterministicBilinearRgb(source, sourceWidth, sourceHeight, targetSize) {
  const plane = targetSize * targetSize
  const pixels = new Float32Array(3 * plane)
  for (let y = 0; y < targetSize; y += 1) {
    const sourceY = Math.max(0, Math.min(
      sourceHeight - 1,
      ((y + 0.5) * sourceHeight / targetSize) - 0.5,
    ))
    const y0 = Math.floor(sourceY)
    const y1 = Math.min(sourceHeight - 1, y0 + 1)
    const fy = sourceY - y0
    for (let x = 0; x < targetSize; x += 1) {
      const sourceX = Math.max(0, Math.min(
        sourceWidth - 1,
        ((x + 0.5) * sourceWidth / targetSize) - 0.5,
      ))
      const x0 = Math.floor(sourceX)
      const x1 = Math.min(sourceWidth - 1, x0 + 1)
      const fx = sourceX - x0
      const topLeft = (y0 * sourceWidth + x0) * 4
      const topRight = (y0 * sourceWidth + x1) * 4
      const bottomLeft = (y1 * sourceWidth + x0) * 4
      const bottomRight = (y1 * sourceWidth + x1) * 4
      const target = y * targetSize + x
      for (let channel = 0; channel < 3; channel += 1) {
        const top = source[topLeft + channel] * (1 - fx) +
          source[topRight + channel] * fx
        const bottom = source[bottomLeft + channel] * (1 - fx) +
          source[bottomRight + channel] * fx
        pixels[channel * plane + target] =
          (top * (1 - fy) + bottom * fy) / 127.5 - 1
      }
    }
  }
  return pixels
}

async function preprocessShadowImage(imageDataUrl, { deterministicResize = false } = {}) {
  const size = 384
  const image = new Image()
  image.src = imageDataUrl
  if (typeof image.decode === 'function') await image.decode()
  else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject })
  if (deterministicResize) {
    const sourceWidth = Math.max(1, Number(image.naturalWidth || image.width))
    const sourceHeight = Math.max(1, Number(image.naturalHeight || image.height))
    const sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = sourceWidth
    sourceCanvas.height = sourceHeight
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
    sourceContext.drawImage(image, 0, 0)
    return deterministicBilinearRgb(
      sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data,
      sourceWidth,
      sourceHeight,
      size,
    )
  }
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

function sameOriginShadowUrls(locationLike) {
  const hostname = String(locationLike?.hostname || '')
  if (!hostname.endsWith('.ts.net')) return { encoderUrl: '', decoderUrl: '' }
  const origin = String(locationLike?.origin || '')
  return {
    encoderUrl: safeModelUrl(`${origin}/local-model-probe/models/encoder-fp32.onnx`, locationLike),
    decoderUrl: safeModelUrl(`${origin}/local-model-probe/models/decoder-int8.onnx`, locationLike),
  }
}

export function browserLocalStrongShadowConfig(locationLike = null) {
  const location = locationLike || (typeof window !== 'undefined' ? window.location : null)
  const params = new URLSearchParams(String(location?.search || ''))
  const enabled = ['1', 'true', 'yes'].includes(String(params.get('v3BrowserLocalStrongShadow') || '').toLowerCase())
  const applyRequested = ['1', 'true', 'yes'].includes(String(params.get('v3BrowserLocalStrongApply') || '').toLowerCase())
  const add2StitchedApplyRequested = ['1', 'true', 'yes'].includes(String(params.get('v3BrowserLocalAdd2StitchedApply') || '').toLowerCase())
  const privateTailnet = String(location?.hostname || '').endsWith('.ts.net')
  const defaults = enabled ? sameOriginShadowUrls(location) : { encoderUrl: '', decoderUrl: '' }
  const encoderUrl = safeModelUrl(params.get('v3BrowserLocalStrongEncoderUrl') || defaults.encoderUrl, location)
  const decoderUrl = safeModelUrl(params.get('v3BrowserLocalStrongDecoderUrl') || defaults.decoderUrl, location)
  const limit = Math.min(20, Math.max(1, Number(params.get('v3BrowserLocalStrongLimit')) || 8))
  const timeoutMs = Math.min(90000, Math.max(5000, Number(params.get('v3BrowserLocalStrongTimeoutMs')) || 15000))
  const frameCount = Math.min(3, Math.max(1, Math.floor(Number(params.get('v3BrowserLocalStrongFrames')) || 1)))
  const forceNoSimd = ['1', 'true', 'yes'].includes(String(params.get('v3BrowserLocalStrongNoSimd') || '').toLowerCase())
  const available = enabled && !!encoderUrl && !!decoderUrl
  return {
    enabled: available,
    requested: enabled,
    applyRequested,
    apply: available && applyRequested && privateTailnet && frameCount === 3,
    add2StitchedApplyRequested,
    add2StitchedApply: available && add2StitchedApplyRequested && privateTailnet && frameCount === 1,
    encoderUrl,
    decoderUrl,
    limit,
    timeoutMs,
    frameCount,
    forceNoSimd,
  }
}

async function runDisposableWorker(item, config) {
  const identity = {
    id: item.id,
    questionNum: item.questionNum,
    frameIndex: item.frameIndex ?? null,
    cropVariant: item.cropVariant ?? null,
  }
  let pixelValues
  try {
    // Decode on the page so Safari versions without OffscreenCanvas can still
    // use the worker. The 1.7 MB tensor is transferred, not copied.
    pixelValues = await preprocessShadowImage(item.imageDataUrl, config)
  } catch (error) {
    return { ...identity, status: 'error', error: `image preprocessing failed: ${String(error?.message || error)}` }
  }
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../workers/trocr-small-shadow.worker.js', import.meta.url), { type: 'module' })
    const id = `trocr-shadow-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const finish = (result) => {
      clearTimeout(timeout)
      try { worker.terminate() } catch (_) {}
      resolve(result)
    }
    const timeout = setTimeout(
      () => finish({ ...identity, status: 'timeout' }),
      config.timeoutMs,
    )
    worker.onmessage = (event) => {
      const response = event.data || {}
      if (response.id !== id) return
      if (response.error) finish({ ...identity, status: 'error', error: response.error })
      else finish({ ...identity, status: 'complete', ...response.result })
    }
    worker.onerror = (event) => finish({ ...identity, status: 'error', error: event?.message || 'worker failed' })
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

let residentWorker = null
let residentWorkerKey = ''
let residentWorkerSequence = 0
let residentWorkerIdleTimer = null
let residentWorkerQueue = Promise.resolve()
let residentWorkerCompletedInferences = 0

function persistentWorkerKey(config) {
  return JSON.stringify({
    encoderUrl: config.encoderUrl,
    decoderUrl: config.decoderUrl,
    forceNoSimd: config.forceNoSimd === true,
  })
}

export function resetBrowserLocalStrongPersistentShadow() {
  if (residentWorkerIdleTimer) clearTimeout(residentWorkerIdleTimer)
  residentWorkerIdleTimer = null
  try { residentWorker?.terminate() } catch (_) {}
  residentWorker = null
  residentWorkerKey = ''
  residentWorkerCompletedInferences = 0
}

function persistentWorker(config) {
  const key = persistentWorkerKey(config)
  if (residentWorker && residentWorkerKey !== key) {
    resetBrowserLocalStrongPersistentShadow()
  }
  if (!residentWorker) {
    residentWorker = new Worker(
      new URL('../workers/trocr-small-shadow.worker.js', import.meta.url),
      { type: 'module' },
    )
    residentWorkerKey = key
  }
  if (residentWorkerIdleTimer) clearTimeout(residentWorkerIdleTimer)
  residentWorkerIdleTimer = null
  return residentWorker
}

function schedulePersistentWorkerCleanup(config) {
  if (residentWorkerIdleTimer) clearTimeout(residentWorkerIdleTimer)
  const idleMs = Math.min(
    30 * 60 * 1000,
    Math.max(30 * 1000, Number(config.persistentIdleMs) || 5 * 60 * 1000),
  )
  residentWorkerIdleTimer = setTimeout(
    resetBrowserLocalStrongPersistentShadow,
    idleMs,
  )
}

async function runPersistentWorkerNow(items, config) {
  const worker = persistentWorker(config)
  const runOne = async (item) => {
    const identity = {
      id: item.id,
      questionNum: item.questionNum,
      frameIndex: item.frameIndex ?? null,
      cropVariant: item.cropVariant ?? null,
    }
    let pixelValues
    try {
      pixelValues = await preprocessShadowImage(item.imageDataUrl, config)
    } catch (error) {
      return {
        ...identity,
        status: 'error',
        error: `image preprocessing failed: ${String(error?.message || error)}`,
      }
    }
    return new Promise((resolve) => {
      const id = `trocr-persistent-${Date.now()}-${residentWorkerSequence += 1}`
      const finish = (result) => {
        clearTimeout(timeout)
        worker.removeEventListener('message', onMessage)
        worker.removeEventListener('error', onError)
        resolve(result)
      }
      const onMessage = (event) => {
        const response = event.data || {}
        if (response.id !== id) return
        if (response.error) {
          finish({ ...identity, status: 'error', error: response.error })
        } else {
          finish({ ...identity, status: 'complete', ...response.result })
        }
      }
      const onError = (event) => finish({
        ...identity,
        status: 'error',
        error: event?.message || 'worker failed',
      })
      const timeout = setTimeout(
        () => finish({ ...identity, status: 'timeout' }),
        config.timeoutMs,
      )
      worker.addEventListener('message', onMessage)
      worker.addEventListener('error', onError)
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

  const results = []
  for (const item of items) {
    const result = await runOne(item)
    results.push(result)
    // A stalled or failed resident session must fail open. Do not keep
    // feeding work into an unknown worker state or reuse it later.
    if (result.status !== 'complete') {
      resetBrowserLocalStrongPersistentShadow()
      break
    }
  }
  if (results.every((row) => row.status === 'complete')) {
    residentWorkerCompletedInferences += results.length
    const maximumResidentInferences = Math.min(
      100,
      Math.max(8, Number(config.persistentMaxInferences) || 40),
    )
    if (residentWorkerCompletedInferences >= maximumResidentInferences) {
      // WebKit does not always promptly reclaim WASM tensor memory. Bound the
      // lifetime of one model worker while still reusing it across worksheets.
      resetBrowserLocalStrongPersistentShadow()
    } else {
      schedulePersistentWorkerCleanup(config)
    }
  }
  return results
}

function runPersistentWorker(items, config) {
  const run = residentWorkerQueue.then(
    () => runPersistentWorkerNow(items, config),
    () => runPersistentWorkerNow(items, config),
  )
  residentWorkerQueue = run.catch(() => {})
  return run
}

async function runPersistentBatchWorkerNow(items, config) {
  const worker = persistentWorker(config)
  const selected = (items || []).filter((item) => item?.imageDataUrl)
  if (!selected.length) return []
  const pixelsPerItem = 3 * 384 * 384
  const pixelValuesBatch = new Float32Array(selected.length * pixelsPerItem)
  for (let index = 0; index < selected.length; index += 1) {
    const pixels = await preprocessShadowImage(selected[index].imageDataUrl, config)
    pixelValuesBatch.set(pixels, index * pixelsPerItem)
  }
  const identities = selected.map((item) => ({
    id: item.id,
    questionNum: item.questionNum,
    frameIndex: item.frameIndex ?? null,
    cropVariant: item.cropVariant ?? null,
  }))
  const response = await new Promise((resolve) => {
    const id = `trocr-persistent-batch-${Date.now()}-${residentWorkerSequence += 1}`
    const finish = (value) => {
      clearTimeout(timeout)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      resolve(value)
    }
    const onMessage = (event) => {
      const message = event.data || {}
      if (message.id !== id) return
      finish(message.error
        ? { error: message.error }
        : { result: message.result })
    }
    const onError = (event) => finish({
      error: event?.message || 'worker failed',
    })
    const timeout = setTimeout(
      () => finish({ error: 'batch timeout' }),
      Math.min(90000, config.timeoutMs * Math.max(1, selected.length)),
    )
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    worker.postMessage({
      id,
      batch: true,
      batchSize: selected.length,
      pixelValuesBatch,
      encoderUrl: config.encoderUrl,
      decoderUrl: config.decoderUrl,
      contracts: selected.map((item) => item.contract || {}),
      forceNoSimd: config.forceNoSimd === true,
      wasmPaths: {
        'ort-wasm.wasm': shadowPublicUrl('ort-wasm-nosimd.wasm'),
        'ort-wasm-simd.wasm': shadowPublicUrl('ort-wasm-simd-1.17.wasm'),
      },
    }, [pixelValuesBatch.buffer])
  })
  if (response.error || response.result?.results?.length !== selected.length) {
    resetBrowserLocalStrongPersistentShadow()
    return identities.map((identity) => ({
      ...identity,
      status: 'error',
      error: response.error || 'incomplete batch result',
    }))
  }
  residentWorkerCompletedInferences += selected.length
  schedulePersistentWorkerCleanup(config)
  return response.result.results.map((result, index) => ({
    ...identities[index],
    status: 'complete',
    ...result,
    batchSize: selected.length,
    batchInferenceMs: response.result.inferenceMs,
    initializationMs: response.result.initializationMs,
    sessionReused: response.result.sessionReused,
    wasmSimdEnabled: response.result.wasmSimdEnabled,
  }))
}

function runPersistentBatchWorker(items, config) {
  const run = residentWorkerQueue.then(
    () => runPersistentBatchWorkerNow(items, config),
    () => runPersistentBatchWorkerNow(items, config),
  )
  residentWorkerQueue = run.catch(() => {})
  return run
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

/**
 * Experimental resident-session path. It is intentionally separate from the
 * disposable production shadow control until sustained WebKit tests prove
 * exact read parity, bounded memory, and fail-open behavior.
 */
export async function requestBrowserLocalStrongPersistentShadow(
  items,
  config = browserLocalStrongShadowConfig(),
) {
  const started = performance.now()
  if (!config.enabled || typeof Worker !== 'function') {
    return {
      version: `${BROWSER_LOCAL_STRONG_SHADOW_VERSION}-persistent-experiment`,
      modelIdentity: BROWSER_LOCAL_STRONG_MODEL_IDENTITY,
      status: 'unavailable',
      affectsGrade: false,
      results: [],
    }
  }
  const selected = (items || []).filter((item) => item?.imageDataUrl).slice(0, config.limit)
  const results = await runPersistentWorker(selected, config)
  return {
    version: `${BROWSER_LOCAL_STRONG_SHADOW_VERSION}-persistent-experiment`,
    modelIdentity: BROWSER_LOCAL_STRONG_MODEL_IDENTITY,
    status: results.length === selected.length &&
      results.every((row) => row.status === 'complete') ? 'complete' : 'partial',
    affectsGrade: false,
    requested: selected.length,
    completed: results.filter((row) => row.status === 'complete').length,
    elapsedMs: performance.now() - started,
    results,
  }
}

/**
 * Experimental modern-device batch lane. It shares the same persistent
 * no-upload worker but encodes up to four answer views together. Callers must
 * verify exact read/probability parity before this can replace sequential
 * inference in any grade-affecting path.
 */
export async function requestBrowserLocalStrongPersistentBatchShadow(
  items,
  config = browserLocalStrongShadowConfig(),
) {
  const started = performance.now()
  if (!config.enabled || typeof Worker !== 'function') {
    return {
      version: `${BROWSER_LOCAL_STRONG_SHADOW_VERSION}-batch-experiment`,
      modelIdentity: BROWSER_LOCAL_STRONG_MODEL_IDENTITY,
      status: 'unavailable',
      affectsGrade: false,
      results: [],
    }
  }
  const maximumBatchSize = Math.min(
    4,
    Math.max(1, Number(config.maximumBatchSize) || 4),
  )
  const selected = (items || [])
    .filter((item) => item?.imageDataUrl)
    .slice(0, config.limit)
  const results = []
  for (let offset = 0; offset < selected.length; offset += maximumBatchSize) {
    results.push(...await runPersistentBatchWorker(
      selected.slice(offset, offset + maximumBatchSize),
      config,
    ))
    if (results[results.length - 1]?.status !== 'complete') break
  }
  return {
    version: `${BROWSER_LOCAL_STRONG_SHADOW_VERSION}-batch-experiment`,
    modelIdentity: BROWSER_LOCAL_STRONG_MODEL_IDENTITY,
    status: results.length === selected.length &&
      results.every((row) => row.status === 'complete') ? 'complete' : 'partial',
    affectsGrade: false,
    requested: selected.length,
    completed: results.filter((row) => row.status === 'complete').length,
    elapsedMs: performance.now() - started,
    results,
  }
}
