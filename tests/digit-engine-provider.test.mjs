import test from 'node:test'
import assert from 'node:assert/strict'

import { createDigitInferenceSession } from '../src/v3/digit-engine-provider.js'

function runtime(name, implementation) {
  return {
    Tensor: class {},
    InferenceSession: { create: implementation },
    name,
  }
}

test('uses WASM without touching WebGL when WASM works', async () => {
  let webglCalls = 0
  const wasm = runtime('wasm', async () => ({ id: 'wasm-session' }))
  const webgl = runtime('webgl', async () => { webglCalls++; return { id: 'webgl-session' } })
  const result = await createDigitInferenceSession({ buffer: new ArrayBuffer(2), wasmRuntime: wasm, webglRuntime: webgl })
  assert.equal(result.provider, 'wasm')
  assert.equal(result.runtime, wasm)
  assert.equal(result.session.id, 'wasm-session')
  assert.equal(webglCalls, 0)
})

test('falls back to the same model through WebGL when WASM fails', async () => {
  const wasm = runtime('wasm', async () => { throw new Error('old Safari cannot compile WASM') })
  const companion = new ArrayBuffer(3)
  let receivedBuffer = null
  const webgl = runtime('webgl', async (buffer) => { receivedBuffer = buffer; return { id: 'webgl-session' } })
  let webglLoads = 0
  const result = await createDigitInferenceSession({
    buffer: new ArrayBuffer(2),
    wasmRuntime: wasm,
    loadWebglRuntime: async () => { webglLoads++; return webgl },
    loadWebglBuffer: async () => companion,
  })
  assert.equal(result.provider, 'webgl')
  assert.equal(result.runtime, webgl)
  assert.equal(result.session.id, 'webgl-session')
  assert.equal(webglLoads, 1)
  assert.equal(receivedBuffer, companion)
  assert.equal(result.webglBuffer, companion)
  assert.match(result.wasmError.message, /old Safari/)
})

test('retains the safe failure when neither local engine can run', async () => {
  const wasm = runtime('wasm', async () => { throw new Error('wasm failed') })
  const webgl = runtime('webgl', async () => { throw new Error('webgl failed') })
  await assert.rejects(
    createDigitInferenceSession({ buffer: new ArrayBuffer(2), wasmRuntime: wasm, webglRuntime: webgl }),
    /WASM: wasm failed; WebGL: webgl failed/,
  )
})

test('can force WebGL for an identical-input browser probe', async () => {
  let wasmCalls = 0
  const wasm = runtime('wasm', async () => { wasmCalls++; return { id: 'wasm-session' } })
  const webgl = runtime('webgl', async () => ({ id: 'webgl-session' }))
  const result = await createDigitInferenceSession({
    buffer: new ArrayBuffer(2),
    wasmRuntime: wasm,
    webglRuntime: webgl,
    forceWebgl: true,
  })
  assert.equal(result.provider, 'webgl')
  assert.equal(wasmCalls, 0)
})

test('falls back to the legacy ONNX.js WebGL adapter after WASM and ORT WebGL fail', async () => {
  const wasm = runtime('wasm', async () => { throw new Error('wasm unavailable') })
  const webgl = runtime('webgl', async () => { throw new Error('ORT WebGL unavailable') })
  const legacyBuffer = new ArrayBuffer(4)
  let legacyLoads = 0
  let receivedBuffer = null
  const legacy = runtime('onnxjs-webgl', async (buffer) => {
    receivedBuffer = buffer
    return { id: 'legacy-session' }
  })
  const result = await createDigitInferenceSession({
    buffer: new ArrayBuffer(2),
    wasmRuntime: wasm,
    webglRuntime: webgl,
    loadLegacyRuntime: async () => { legacyLoads += 1; return legacy },
    loadLegacyBuffer: async () => legacyBuffer,
  })
  assert.equal(result.provider, 'onnxjs-webgl')
  assert.equal(result.runtime, legacy)
  assert.equal(result.session.id, 'legacy-session')
  assert.equal(legacyLoads, 1)
  assert.equal(receivedBuffer, legacyBuffer)
  assert.match(result.wasmError.message, /wasm unavailable/)
  assert.match(result.webglError.message, /ORT WebGL unavailable/)
})

test('can force the legacy provider without attempting modern engines', async () => {
  let wasmCalls = 0
  let webglCalls = 0
  const wasm = runtime('wasm', async () => { wasmCalls += 1; return { id: 'wasm-session' } })
  const webgl = runtime('webgl', async () => { webglCalls += 1; return { id: 'webgl-session' } })
  const legacy = runtime('onnxjs-webgl', async () => ({ id: 'legacy-session' }))
  const result = await createDigitInferenceSession({
    buffer: new ArrayBuffer(2),
    wasmRuntime: wasm,
    webglRuntime: webgl,
    legacyRuntime: legacy,
    forceLegacy: true,
  })
  assert.equal(result.provider, 'onnxjs-webgl')
  assert.equal(result.session.id, 'legacy-session')
  assert.equal(wasmCalls, 0)
  assert.equal(webglCalls, 0)
})

test('falls back to the legacy ONNX.js CPU backend when legacy WebGL fails', async () => {
  const wasm = runtime('wasm', async () => { throw new Error('wasm unavailable') })
  const webgl = runtime('webgl', async () => { throw new Error('ORT WebGL unavailable') })
  const legacyBuffer = new ArrayBuffer(4)
  const providers = []
  const legacy = runtime('onnxjs', async (_buffer, options) => {
    providers.push(options.executionProviders[0])
    if (options.executionProviders[0] === 'webgl') throw new Error('legacy WebGL unavailable')
    return { id: 'legacy-cpu-session' }
  })
  const result = await createDigitInferenceSession({
    buffer: new ArrayBuffer(2),
    wasmRuntime: wasm,
    webglRuntime: webgl,
    legacyRuntime: legacy,
    loadLegacyBuffer: async () => legacyBuffer,
  })
  assert.equal(result.provider, 'onnxjs-cpu')
  assert.equal(result.runtime, legacy)
  assert.equal(result.session.id, 'legacy-cpu-session')
  assert.deepEqual(providers, ['webgl', 'cpu'])
  assert.equal(result.legacyBuffer, legacyBuffer)
  assert.match(result.legacyWebglError.message, /legacy WebGL unavailable/)
})

test('falls through when a provider initializes but fails its first real inference', async () => {
  const wasm = runtime('wasm', async () => { throw new Error('wasm unavailable') })
  const webgl = runtime('webgl', async () => ({ id: 'ort-webgl-session' }))
  const legacy = runtime('onnxjs', async (_buffer, options) => ({
    id: `onnxjs-${options.executionProviders[0]}-session`,
  }))
  const validated = []
  const result = await createDigitInferenceSession({
    buffer: new ArrayBuffer(2),
    wasmRuntime: wasm,
    webglRuntime: webgl,
    legacyRuntime: legacy,
    validateSession: async ({ provider }) => {
      validated.push(provider)
      if (provider === 'webgl') throw new Error('Unpacked shape is needed when using channels > 1')
      if (provider === 'onnxjs-webgl') throw new Error('legacy WebGL inference failed')
    },
  })
  assert.equal(result.provider, 'onnxjs-cpu')
  assert.deepEqual(validated, ['webgl', 'onnxjs-webgl', 'onnxjs-cpu'])
  assert.match(result.webglError.message, /Unpacked shape/)
  assert.match(result.legacyWebglError.message, /legacy WebGL inference failed/)
})
