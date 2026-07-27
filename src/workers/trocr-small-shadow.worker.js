import * as ort from 'onnxruntime-web/wasm'
import { decodeNumericTrocrTokens, inferBlankOptionalSlots } from '../v3/trocr-number-tokens.js'

const SIZE = 384
const START_TOKEN = 2
const EOS_TOKEN = 2
let cachedSessionKey = ''
let cachedSessionPromise = null

function isWasmSimdSupported() {
  if (typeof WebAssembly === 'undefined' || typeof WebAssembly.validate !== 'function') return false
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 30, 1, 28, 0,
      65, 0, 253, 15, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      253, 186, 1, 26, 11,
    ]))
  } catch {
    return false
  }
}

function argmaxWithProbability(logits, sequenceLength, vocabularySize) {
  const offset = (sequenceLength - 1) * vocabularySize
  let best = 0
  let bestValue = Number.NEGATIVE_INFINITY
  for (let index = 0; index < vocabularySize; index += 1) {
    const value = logits[offset + index]
    if (value > bestValue) { best = index; bestValue = value }
  }
  let sum = 0
  for (let index = 0; index < vocabularySize; index += 1) sum += Math.exp(logits[offset + index] - bestValue)
  return { token: best, probability: sum > 0 ? 1 / sum : 0 }
}

async function imageTensor(imageDataUrl, pixelValues = null) {
  if (pixelValues instanceof Float32Array && pixelValues.length === 3 * SIZE * SIZE) {
    return new ort.Tensor('float32', pixelValues, [1, 3, SIZE, SIZE])
  }
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    throw new Error('worker image decoding unavailable')
  }
  const response = await fetch(imageDataUrl)
  const bitmap = await createImageBitmap(await response.blob())
  try {
    const canvas = new OffscreenCanvas(SIZE, SIZE)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.fillStyle = '#fff'
    context.fillRect(0, 0, SIZE, SIZE)
    context.drawImage(bitmap, 0, 0, SIZE, SIZE)
    const rgba = context.getImageData(0, 0, SIZE, SIZE).data
    const plane = SIZE * SIZE
    const chw = new Float32Array(3 * plane)
    for (let pixel = 0; pixel < plane; pixel += 1) {
      const source = pixel * 4
      chw[pixel] = rgba[source] / 127.5 - 1
      chw[plane + pixel] = rgba[source + 1] / 127.5 - 1
      chw[2 * plane + pixel] = rgba[source + 2] / 127.5 - 1
    }
    return new ort.Tensor('float32', chw, [1, 3, SIZE, SIZE])
  } finally {
    bitmap.close?.()
  }
}

async function modelSessions({ encoderUrl, decoderUrl, wasmPaths, forceNoSimd }) {
  const simd = !forceNoSimd && isWasmSimdSupported()
  const key = JSON.stringify({ encoderUrl, decoderUrl, wasmPaths, simd })
  const reused = cachedSessionKey === key && cachedSessionPromise != null
  if (!reused) {
    ort.env.wasm.numThreads = 1
    ort.env.wasm.simd = simd
    ort.env.wasm.wasmPaths = wasmPaths
    cachedSessionKey = key
    cachedSessionPromise = (async () => {
      const started = performance.now()
      const [encoder, decoder] = await Promise.all([
        ort.InferenceSession.create(encoderUrl, { executionProviders: ['wasm'] }),
        ort.InferenceSession.create(decoderUrl, { executionProviders: ['wasm'] }),
      ])
      return { encoder, decoder, initializationMs: performance.now() - started }
    })().catch((error) => {
      cachedSessionKey = ''
      cachedSessionPromise = null
      throw error
    })
  }
  const sessions = await cachedSessionPromise
  return {
    ...sessions,
    initializationMs: reused ? 0 : sessions.initializationMs,
    sessionReused: reused,
  }
}

async function decodeEncodedAnswer(decoder, encoderHiddenStates, contract = {}) {
  const tokens = [START_TOKEN]
  const tokenProbabilities = []
  for (let step = 0; step < 4; step += 1) {
    const ids = new BigInt64Array(tokens.map(BigInt))
    const inputIds = new ort.Tensor('int64', ids, [1, tokens.length])
    let decoderOutputs = null
    try {
      decoderOutputs = await decoder.run({
        input_ids: inputIds,
        encoder_hidden_states: encoderHiddenStates,
      })
      const next = argmaxWithProbability(
        decoderOutputs.logits.data,
        tokens.length,
        decoderOutputs.logits.dims[2],
      )
      tokens.push(next.token)
      tokenProbabilities.push(next.probability)
      if (next.token === EOS_TOKEN) break
    } finally {
      inputIds.dispose?.()
      for (const tensor of Object.values(decoderOutputs || {})) tensor?.dispose?.()
    }
  }
  const maximumDigits = Math.min(4, Math.max(1, Number(contract.maxHandwrittenDigits) || 4))
  const decoded = decodeNumericTrocrTokens(tokens, { maximumDigits })
  const optionalSlots = Array.isArray(contract.optionalSlotIndices) ? contract.optionalSlotIndices : []
  const physicalSlotCount = Math.max(0, Number(contract.physicalSlotCount) || 0)
  const blankOptionalSlots = inferBlankOptionalSlots({
    ...decoded,
    physicalSlotCount,
    optionalSlotIndices: optionalSlots,
  })
  return {
    ...decoded,
    tokens,
    tokenProbabilities,
    minTokenProbability: tokenProbabilities.length ? Math.min(...tokenProbabilities) : 0,
    meanTokenProbability: tokenProbabilities.length
      ? tokenProbabilities.reduce((sum, value) => sum + value, 0) / tokenProbabilities.length
      : 0,
    contract: {
      layoutFamily: String(contract.layoutFamily || 'unknown'),
      physicalSlotCount,
      maxHandwrittenDigits: maximumDigits,
      optionalSlotIndices: optionalSlots,
      blankOptionalSlots,
    },
  }
}

async function recognize({ imageDataUrl, pixelValues, encoderUrl, decoderUrl, wasmPaths, contract = {}, forceNoSimd = false }) {
  const {
    encoder,
    decoder,
    initializationMs,
    sessionReused,
  } = await modelSessions({ encoderUrl, decoderUrl, wasmPaths, forceNoSimd })
  const pixels = await imageTensor(imageDataUrl, pixelValues)
  const inferenceStarted = performance.now()
  let encoded = null
  try {
    encoded = await encoder.run({ pixel_values: pixels })
    const decoded = await decodeEncodedAnswer(
      decoder,
      encoded.encoder_hidden_states,
      contract,
    )
    return {
      ...decoded,
      initializationMs,
      sessionReused,
      inferenceMs: performance.now() - inferenceStarted,
      wasmSimdEnabled: ort.env.wasm.simd === true,
    }
  } finally {
    pixels.dispose?.()
    for (const tensor of Object.values(encoded || {})) tensor?.dispose?.()
  }
}

async function recognizeBatch({
  pixelValuesBatch,
  batchSize,
  encoderUrl,
  decoderUrl,
  wasmPaths,
  contracts = [],
  forceNoSimd = false,
}) {
  const count = Math.max(1, Number(batchSize) || 1)
  if (
    !(pixelValuesBatch instanceof Float32Array) ||
    pixelValuesBatch.length !== count * 3 * SIZE * SIZE
  ) {
    throw new Error('invalid batch tensor')
  }
  const {
    encoder,
    decoder,
    initializationMs,
    sessionReused,
  } = await modelSessions({ encoderUrl, decoderUrl, wasmPaths, forceNoSimd })
  const pixels = new ort.Tensor(
    'float32',
    pixelValuesBatch,
    [count, 3, SIZE, SIZE],
  )
  const started = performance.now()
  let encoded = null
  try {
    encoded = await encoder.run({ pixel_values: pixels })
    const allHidden = encoded.encoder_hidden_states
    if (allHidden.dims[0] !== count || allHidden.data.length % count !== 0) {
      throw new Error('encoder batch output shape mismatch')
    }
    const rowLength = allHidden.data.length / count
    const rowDims = [1, ...allHidden.dims.slice(1)]
    const results = []
    for (let index = 0; index < count; index += 1) {
      const rowData = new Float32Array(rowLength)
      rowData.set(allHidden.data.subarray(index * rowLength, (index + 1) * rowLength))
      const rowHidden = new ort.Tensor('float32', rowData, rowDims)
      const rowStarted = performance.now()
      try {
        results.push({
          ...await decodeEncodedAnswer(
            decoder,
            rowHidden,
            contracts[index] || {},
          ),
          decoderMs: performance.now() - rowStarted,
        })
      } finally {
        rowHidden.dispose?.()
      }
    }
    return {
      results,
      initializationMs,
      sessionReused,
      inferenceMs: performance.now() - started,
      wasmSimdEnabled: ort.env.wasm.simd === true,
    }
  } finally {
    pixels.dispose?.()
    for (const tensor of Object.values(encoded || {})) tensor?.dispose?.()
  }
}

self.onmessage = async (event) => {
  const request = event.data || {}
  try {
    const result = request.batch === true
      ? await recognizeBatch(request)
      : await recognize(request)
    self.postMessage({ id: request.id, result })
  } catch (error) {
    self.postMessage({ id: request.id, error: String(error?.stack || error?.message || error) })
  }
}
