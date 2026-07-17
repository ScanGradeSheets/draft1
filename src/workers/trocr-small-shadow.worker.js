import * as ort from 'onnxruntime-web/wasm'
import { decodeNumericTrocrTokens, inferBlankOptionalSlots } from '../v3/trocr-number-tokens.js'

const SIZE = 384
const START_TOKEN = 2
const EOS_TOKEN = 2

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

async function recognize({ imageDataUrl, pixelValues, encoderUrl, decoderUrl, wasmPaths, contract = {}, forceNoSimd = false }) {
  ort.env.wasm.numThreads = 1
  ort.env.wasm.simd = !forceNoSimd && isWasmSimdSupported()
  ort.env.wasm.wasmPaths = wasmPaths
  const initStarted = performance.now()
  const [encoder, decoder] = await Promise.all([
    ort.InferenceSession.create(encoderUrl, { executionProviders: ['wasm'] }),
    ort.InferenceSession.create(decoderUrl, { executionProviders: ['wasm'] }),
  ])
  const initializationMs = performance.now() - initStarted
  const pixels = await imageTensor(imageDataUrl, pixelValues)
  const inferenceStarted = performance.now()
  const encoded = await encoder.run({ pixel_values: pixels })
  const tokens = [START_TOKEN]
  const tokenProbabilities = []
  for (let step = 0; step < 4; step += 1) {
    const ids = new BigInt64Array(tokens.map(BigInt))
    const decoded = await decoder.run({
      input_ids: new ort.Tensor('int64', ids, [1, tokens.length]),
      encoder_hidden_states: encoded.encoder_hidden_states,
    })
    const next = argmaxWithProbability(decoded.logits.data, tokens.length, decoded.logits.dims[2])
    tokens.push(next.token)
    tokenProbabilities.push(next.probability)
    if (next.token === EOS_TOKEN) break
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
    initializationMs,
    inferenceMs: performance.now() - inferenceStarted,
    wasmSimdEnabled: ort.env.wasm.simd === true,
    contract: {
      layoutFamily: String(contract.layoutFamily || 'unknown'),
      physicalSlotCount,
      maxHandwrittenDigits: maximumDigits,
      optionalSlotIndices: optionalSlots,
      blankOptionalSlots,
    },
  }
}

self.onmessage = async (event) => {
  const request = event.data || {}
  try {
    const result = await recognize(request)
    self.postMessage({ id: request.id, result })
  } catch (error) {
    self.postMessage({ id: request.id, error: String(error?.stack || error?.message || error) })
  }
}
