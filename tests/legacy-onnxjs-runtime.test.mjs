import test from 'node:test'
import assert from 'node:assert/strict'

import { createOnnxJsRuntime } from '../src/v3/legacy-onnxjs-runtime.js'

test('adapts ONNX.js Tensor constructor and Map output to the OCR runtime surface', async () => {
  const calls = { tensors: [], loaded: null, inputs: null }
  class FakeTensor {
    constructor(data, type, dims) {
      this.data = data
      this.type = type
      this.dims = dims
      calls.tensors.push(this)
    }
  }
  class FakeSession {
    constructor(options) {
      assert.deepEqual(options, { backendHint: 'webgl' })
      this.session = {
        _model: {
          _graph: {
            getInputNames: () => ['input'],
            getOutputNames: () => ['output'],
          },
        },
      }
    }

    async loadModel(buffer) {
      calls.loaded = buffer
    }

    async run(inputs) {
      calls.inputs = inputs
      return new Map([['output', { data: new Float32Array([0.25, 0.75]) }]])
    }
  }

  const runtime = createOnnxJsRuntime({ InferenceSession: FakeSession, Tensor: FakeTensor })
  const data = new Float32Array([1, 2])
  const tensor = new runtime.Tensor('float32', data, [1, 2])
  assert.equal(tensor.type, 'float32')
  assert.equal(tensor.data, data)
  assert.deepEqual(tensor.dims, [1, 2])

  const model = new Uint8Array([1, 2, 3]).buffer
  const session = await runtime.InferenceSession.create(model)
  assert.deepEqual(session.inputNames, ['input'])
  assert.deepEqual(session.outputNames, ['output'])
  assert.ok(calls.loaded instanceof Uint8Array)
  assert.deepEqual([...calls.loaded], [1, 2, 3])

  const output = await session.run({ input: tensor })
  assert.equal(output.output.data[1], 0.75)
  assert.deepEqual(calls.inputs, [tensor])
})

test('aliases an ONNX.js internal output key to the declared graph output', async () => {
  class FakeTensor {
    constructor(data, type, dims) {
      this.data = data
      this.type = type
      this.dims = dims
    }
  }
  class FakeSession {
    constructor() {
      this.session = {
        _model: {
          graph: {
            getInputNames: () => ['input'],
            getOutputNames: () => ['declared-output'],
          },
        },
      }
    }
    async loadModel() {}
    async run() {
      return new Map([['internal-output', { data: new Float32Array([1, 2, 3]) }]])
    }
  }
  const runtime = createOnnxJsRuntime({ InferenceSession: FakeSession, Tensor: FakeTensor })
  const session = await runtime.InferenceSession.create(new ArrayBuffer(1))
  const output = await session.run({ input: new FakeTensor(new Float32Array([1]), 'float32', [1]) })
  assert.equal(output['declared-output'], output['internal-output'])
})

test('passes the requested CPU backend through to ONNX.js', async () => {
  let backendHint = null
  class FakeTensor {
    constructor(data, type, dims) {
      this.data = data
      this.type = type
      this.dims = dims
    }
  }
  class FakeSession {
    constructor(options) {
      backendHint = options.backendHint
      this.session = {
        _model: {
          graph: {
            getInputNames: () => ['input'],
            getOutputNames: () => ['output'],
          },
        },
      }
    }
    async loadModel() {}
    async run() { return new Map([['output', { data: new Float32Array([1]) }]]) }
  }
  const runtime = createOnnxJsRuntime({ InferenceSession: FakeSession, Tensor: FakeTensor })
  await runtime.InferenceSession.create(new ArrayBuffer(1), { executionProviders: ['cpu'] })
  assert.equal(backendHint, 'cpu')
})

test('rejects a malformed ONNX.js module before touching the browser', () => {
  assert.throws(() => createOnnxJsRuntime({}), /ONNX\.js runtime unavailable/)
})
