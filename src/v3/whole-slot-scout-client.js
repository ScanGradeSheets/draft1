import {
  WHOLE_SLOT_SCOUT_HEIGHT,
  WHOLE_SLOT_SCOUT_SLOT_WIDTH,
  WHOLE_SLOT_SCOUT_VERSION,
  wholeSlotScoutMetadata,
} from './whole-slot-scout.js'

function publicUrl(path) {
  const base = import.meta.env?.BASE_URL || '/'
  return `${base.endsWith('/') ? base : `${base}/`}${String(path || '').replace(/^\//, '')}`
}

function fitImage(image, width) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = WHOLE_SLOT_SCOUT_HEIGHT
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const scale = Math.min(width / image.width, WHOLE_SLOT_SCOUT_HEIGHT / image.height)
  const drawWidth = Math.max(1, Math.round(image.width * scale))
  const drawHeight = Math.max(1, Math.round(image.height * scale))
  context.drawImage(
    image,
    Math.floor((width - drawWidth) / 2),
    Math.floor((WHOLE_SLOT_SCOUT_HEIGHT - drawHeight) / 2),
    drawWidth,
    drawHeight,
  )
  return canvas
}

function inkTensor(canvas) {
  const rgba = canvas.getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, canvas.width, canvas.height).data
  const data = new Float32Array(canvas.width * canvas.height)
  for (let pixel = 0; pixel < data.length; pixel += 1) {
    const offset = pixel * 4
    const grayscale = 0.299 * rgba[offset] + 0.587 * rgba[offset + 1] + 0.114 * rgba[offset + 2]
    data[pixel] = 1 - grayscale / 255
  }
  return data
}

async function loadImage(imageDataUrl) {
  const image = new Image()
  image.src = imageDataUrl
  if (typeof image.decode === 'function') await image.decode()
  else await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
  })
  return image
}

async function prepareItem(item) {
  const image = await loadImage(item.imageDataUrl)
  const slots = Number(item.slotCount) <= 1 ? 1 : 2
  const wholeCanvas = fitImage(image, WHOLE_SLOT_SCOUT_SLOT_WIDTH * 2)
  let left
  let right
  if (slots === 1) {
    left = new Float32Array(WHOLE_SLOT_SCOUT_SLOT_WIDTH * WHOLE_SLOT_SCOUT_HEIGHT)
    right = inkTensor(fitImage(image, WHOLE_SLOT_SCOUT_SLOT_WIDTH))
  } else {
    const context = wholeCanvas.getContext('2d', { willReadFrequently: true })
    const leftCanvas = document.createElement('canvas')
    const rightCanvas = document.createElement('canvas')
    leftCanvas.width = rightCanvas.width = WHOLE_SLOT_SCOUT_SLOT_WIDTH
    leftCanvas.height = rightCanvas.height = WHOLE_SLOT_SCOUT_HEIGHT
    leftCanvas.getContext('2d').putImageData(
      context.getImageData(0, 0, WHOLE_SLOT_SCOUT_SLOT_WIDTH, WHOLE_SLOT_SCOUT_HEIGHT),
      0,
      0,
    )
    rightCanvas.getContext('2d').putImageData(
      context.getImageData(
        WHOLE_SLOT_SCOUT_SLOT_WIDTH,
        0,
        WHOLE_SLOT_SCOUT_SLOT_WIDTH,
        WHOLE_SLOT_SCOUT_HEIGHT,
      ),
      0,
      0,
    )
    left = inkTensor(leftCanvas)
    right = inkTensor(rightCanvas)
  }
  return {
    id: item.id,
    questionNum: item.questionNum,
    slotCount: slots,
    whole: inkTensor(wholeCanvas),
    left,
    right,
    metadata: wholeSlotScoutMetadata({
      slotCount: slots,
      layoutFamily: item.layoutFamily,
    }),
  }
}

export function wholeSlotScoutShadowConfig(locationLike = null) {
  const location = locationLike || (typeof window !== 'undefined' ? window.location : null)
  const params = new URLSearchParams(String(location?.search || ''))
  const shadowRequested = ['1', 'true', 'yes'].includes(
    String(params.get('v3AcceptedSafetyShadow') || '').toLowerCase())
  const applyOverride = String(params.get('v3AcceptedSafety') || '').toLowerCase()
  const applyDisabled = ['0', 'false', 'no', 'off'].includes(applyOverride)
  const hostname = String(location?.hostname || '').toLowerCase()
  const privateCandidateDefault = hostname.endsWith('.ts.net')
  const publicSafetyDefault = hostname === 'scangrade.io' ||
    hostname.endsWith('.scangrade.pages.dev')
  const requestedScope = String(params.get('v3AcceptedSafetyScope') || '').toLowerCase()
  const apply = !applyDisabled && (
    ['1', 'true', 'yes', 'on'].includes(applyOverride) ||
    privateCandidateDefault ||
    publicSafetyDefault
  )
  return {
    requested: shadowRequested || apply,
    enabled: shadowRequested || apply,
    apply,
    policyScope: requestedScope === 'six-eight-only' ||
      (publicSafetyDefault && !privateCandidateDefault)
      ? 'six-eight-only'
      : 'full',
    modelUrl: publicUrl('models/v3-whole-slot-scout.onnx'),
    timeoutMs: Math.min(30000, Math.max(
      3000,
      Number(params.get('v3AcceptedSafetyScoutTimeoutMs')) || 30000,
    )),
  }
}

let residentScoutWorker = null
let residentScoutSequence = 0

function resetResidentScoutWorker() {
  try { residentScoutWorker?.terminate() } catch (_) {}
  residentScoutWorker = null
}

function scoutWorker() {
  if (!residentScoutWorker) {
    residentScoutWorker = new Worker(
      new URL('../workers/whole-slot-scout.worker.js', import.meta.url),
      { type: 'module' },
    )
  }
  return residentScoutWorker
}

function runScoutWorker(items, config) {
  return new Promise((resolve) => {
    const worker = scoutWorker()
    const id = `whole-slot-scout-${Date.now()}-${residentScoutSequence += 1}`
    const finish = (value, reset = false) => {
      clearTimeout(timeout)
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      if (reset) resetResidentScoutWorker()
      resolve(value)
    }
    const onMessage = (event) => {
      const response = event.data || {}
      if (response.id !== id) return
      if (response.error) {
        finish({
          version: WHOLE_SLOT_SCOUT_VERSION,
          status: 'error',
          affectsGrade: false,
          error: response.error,
          results: [],
        }, true)
      } else {
        finish({
          version: WHOLE_SLOT_SCOUT_VERSION,
          status: 'complete',
          affectsGrade: false,
          ...response.result,
        })
      }
    }
    const onError = (event) => finish({
      version: WHOLE_SLOT_SCOUT_VERSION,
      status: 'error',
      affectsGrade: false,
      error: event?.message || 'whole-slot scout worker failed',
      results: [],
    }, true)
    const timeout = setTimeout(() => finish({
      version: WHOLE_SLOT_SCOUT_VERSION,
      status: 'timeout',
      affectsGrade: false,
      results: [],
    }, true), config.timeoutMs)
    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)
    const transfers = items.flatMap((item) => [
      item.whole.buffer,
      item.left.buffer,
      item.right.buffer,
      item.metadata.buffer,
    ])
    worker.postMessage({
      id,
      modelUrl: config.modelUrl,
      items,
      wasmPaths: {
        'ort-wasm.wasm': publicUrl('ort-wasm-nosimd.wasm'),
        'ort-wasm-simd.wasm': publicUrl('ort-wasm-simd-1.17.wasm'),
      },
    }, transfers)
  })
}

export async function warmWholeSlotScout(config = wholeSlotScoutShadowConfig()) {
  if (!config.enabled || typeof Worker !== 'function') return false
  const result = await runScoutWorker([], config)
  return result.status === 'complete'
}

export async function requestWholeSlotScout(items, config = wholeSlotScoutShadowConfig()) {
  if (!config.enabled || typeof Worker !== 'function') {
    return {
      version: WHOLE_SLOT_SCOUT_VERSION,
      status: 'unavailable',
      affectsGrade: false,
      results: [],
    }
  }
  const started = performance.now()
  const prepared = await Promise.all((items || [])
    .filter((item) => item?.imageDataUrl)
    .map(prepareItem))
  const result = await runScoutWorker(prepared, config)
  return { ...result, elapsedMs: performance.now() - started }
}
