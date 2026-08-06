/**
 * Adapt ONNX.js' array/Map API to the small ONNX Runtime Web surface used by
 * ScanGrade's digit pipeline. This module is only loaded by legacy-browser
 * fallback code; modern browsers continue using ONNX Runtime Web directly.
 */
export function createOnnxJsRuntime(onnxModule) {
  const onnx = onnxModule?.default || onnxModule
  if (!onnx?.InferenceSession || !onnx?.Tensor) {
    throw new Error('ONNX.js runtime unavailable')
  }

  // The app constructs Tensor(type, data, dims), whereas ONNX.js uses
  // Tensor(data, type, dims). Returning the native object keeps its backend
  // checks and avoids copying the 28x28 input.
  class Tensor {
    constructor(type, data, dims) {
      return new onnx.Tensor(data, type, dims)
    }
  }

  const InferenceSession = {
    async create(buffer, options = {}) {
      // The old iPad can load ONNX.js but often cannot create a WebGL
      // context.  Keep WebGL as the default, while allowing the provider
      // selector to request ONNX.js' pure-JavaScript CPU backend.
      const executionProvider = options.executionProviders?.[0]
      const backendHint = options.backendHint || (executionProvider === 'cpu' ? 'cpu' : 'webgl')
      const native = new onnx.InferenceSession({ backendHint })
      await native.loadModel(new Uint8Array(buffer))
      // ONNX.js has used both `_graph` and `graph` for this internal graph
      // across its browser builds. Prefer the public-ish spelling when it is
      // available, while retaining compatibility with 0.1.8's `_graph`.
      const graph = native.session?._model?.graph || native.session?._model?._graph
      const inputNames = graph?.getInputNames?.() || []
      const outputNames = graph?.getOutputNames?.() || []
      if (!inputNames.length || !outputNames.length) {
        throw new Error('ONNX.js model has no input/output names')
      }
      return {
        inputNames,
        outputNames,
        async run(feeds) {
          const inputs = inputNames.map((name) => feeds[name])
          const result = await native.run(inputs)
          const output = {}
          if (result instanceof Map) {
            result.forEach((value, key) => { output[key] = value })
          } else {
            Object.assign(output, result || {})
          }
          // ONNX.js has returned output maps keyed by the graph's internal
          // name in some Safari builds, while ORT uses the declared graph
          // output name.  The digit pipeline only needs one output tensor;
          // alias the first value to the declared name so both runtimes have
          // the same stable surface.
          if (outputNames[0] && !output[outputNames[0]]) {
            const firstKey = Object.keys(output)[0]
            if (firstKey) output[outputNames[0]] = output[firstKey]
          }
          return output
        },
      }
    },
  }

  return { Tensor, InferenceSession }
}
