import * as ort from 'onnxruntime-web/wasm'
import { decodeWholeSlotScout } from '../v3/whole-slot-scout.js'

let residentSession = null
let residentSessionKey = ''
let residentSessionPromise = null

async function getSession(request) {
  const key = JSON.stringify({ modelUrl: request.modelUrl, wasmPaths: request.wasmPaths })
  if (residentSession && residentSessionKey === key) {
    return { session: residentSession, initializationMs: 0, reused: true }
  }
  if (!residentSessionPromise || residentSessionKey !== key) {
    residentSessionKey = key
    residentSessionPromise = (async () => {
      if (residentSession) await residentSession.release?.()
      const started = performance.now()
      residentSession = await ort.InferenceSession.create(request.modelUrl, {
        executionProviders: ['wasm'],
      })
      return {
        session: residentSession,
        initializationMs: performance.now() - started,
        reused: false,
      }
    })().catch((error) => {
      residentSession = null
      residentSessionKey = ''
      residentSessionPromise = null
      throw error
    })
  }
  return residentSessionPromise
}

function concatenate(items, field, width) {
  const output = new Float32Array(items.length * width)
  items.forEach((item, index) => output.set(item[field], index * width))
  return output
}

async function run(request) {
  ort.env.wasm.numThreads = 1
  ort.env.wasm.wasmPaths = request.wasmPaths
  const { session, initializationMs, reused } = await getSession(request)
  const items = request.items || []
  if (!items.length) return { initializationMs, inferenceMs: 0, reused, results: [] }
  const inferenceStarted = performance.now()
  const batchSize = items.length
  const output = await session.run({
      whole: new ort.Tensor(
        'float32',
        concatenate(items, 'whole', 64 * 192),
        [batchSize, 1, 64, 192],
      ),
      left: new ort.Tensor(
        'float32',
        concatenate(items, 'left', 64 * 96),
        [batchSize, 1, 64, 96],
      ),
      right: new ort.Tensor(
        'float32',
        concatenate(items, 'right', 64 * 96),
        [batchSize, 1, 64, 96],
      ),
      metadata: new ort.Tensor(
        'float32',
        concatenate(items, 'metadata', 5),
        [batchSize, 5],
      ),
    })
  const inferenceMs = performance.now() - inferenceStarted
  const results = items.map((item, index) => ({
        id: item.id,
        questionNum: item.questionNum,
        ...decodeWholeSlotScout({
          length: output.length.data.slice(index * 2, index * 2 + 2),
          tens: output.tens.data.slice(index * 10, index * 10 + 10),
          ones: output.ones.data.slice(index * 10, index * 10 + 10),
          slotCount: item.slotCount,
        }),
        inferenceMs,
    }))
  return { initializationMs, inferenceMs, reused, results }
}

self.onmessage = async (event) => {
  const request = event.data || {}
  try {
    self.postMessage({ id: request.id, result: await run(request) })
  } catch (error) {
    self.postMessage({
      id: request.id,
      error: String(error?.stack || error?.message || error),
    })
  }
}
