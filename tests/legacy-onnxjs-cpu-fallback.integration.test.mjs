import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

import onnxModule from 'onnxjs'

import { createDigitInferenceSession } from '../src/v3/digit-engine-provider.js'
import { createOnnxJsRuntime } from '../src/v3/legacy-onnxjs-runtime.js'

const primaryCompanion = new URL(
  '../public/models/worksheet-digit-tony-generalist-noaug-20260601-opset9-onnxjs.onnx',
  import.meta.url,
)

function unavailableRuntime(message) {
  return {
    InferenceSession: {
      async create() {
        throw new Error(message)
      },
    },
  }
}

test('a shipped opset-9 companion executes through real ONNX.js CPU after staged modern failures', async () => {
  const bytes = await readFile(primaryCompanion)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const runtime = createOnnxJsRuntime(onnxModule)
  const originalWarn = console.warn
  console.warn = () => {}
  let created
  try {
    created = await createDigitInferenceSession({
      buffer,
      wasmRuntime: unavailableRuntime('staged WASM unavailable'),
      webglRuntime: unavailableRuntime('staged ORT WebGL unavailable'),
      legacyRuntime: runtime,
    })
  } finally {
    console.warn = originalWarn
  }

  assert.equal(created.provider, 'onnxjs-cpu')
  assert.match(created.wasmError?.message || '', /staged WASM unavailable/)
  assert.match(created.webglError?.message || '', /staged ORT WebGL unavailable/)
  assert.ok(created.legacyWebglError, 'ONNX.js WebGL must fail before CPU is selected')

  const tensor = new runtime.Tensor('float32', new Float32Array(28 * 28), [1, 1, 28, 28])
  const outputs = await created.session.run({ [created.session.inputNames[0]]: tensor })
  const output = outputs[created.session.outputNames[0]]?.data
  assert.equal(created.session.inputNames[0], 'input')
  assert.equal(created.session.outputNames[0], 'output')
  assert.equal(output?.length, 10)
  assert.ok(Array.from(output).every(Number.isFinite))
})
