export async function createDigitInferenceSession({
  buffer,
  wasmRuntime,
  webglRuntime,
  loadWebglRuntime,
  loadWebglBuffer,
  legacyRuntime,
  loadLegacyRuntime,
  loadLegacyBuffer,
  forceWebgl = false,
  forceLegacy = false,
} = {}) {
  let wasmError = null
  let webglError = null

  if (!forceWebgl && !forceLegacy) {
    try {
      const session = await wasmRuntime.InferenceSession.create(buffer, {
        executionProviders: ['wasm'],
      })
      return { session, runtime: wasmRuntime, provider: 'wasm', wasmError: null }
    } catch (error) {
      wasmError = error
    }
  }

  if (!forceLegacy) {
    try {
      const resolvedWebglRuntime = webglRuntime || await loadWebglRuntime()
      const webglBuffer = loadWebglBuffer ? await loadWebglBuffer() : buffer
      const session = await resolvedWebglRuntime.InferenceSession.create(webglBuffer, {
        executionProviders: ['webgl'],
      })
      return { session, runtime: resolvedWebglRuntime, provider: 'webgl', wasmError, webglBuffer }
    } catch (error) {
      webglError = error
    }
  }

  let legacyError = null
  if (!legacyRuntime && typeof loadLegacyRuntime !== 'function') {
    const wasmMessage = wasmError?.message || String(wasmError || 'not attempted')
    const webglMessage = webglError?.message || String(webglError || 'not attempted')
    const error = new Error(
      `Digit model engines unavailable (WASM: ${wasmMessage}; WebGL: ${webglMessage})`,
    )
    error.wasmError = wasmError
    error.webglError = webglError
    throw error
  }

  try {
    const resolvedLegacyRuntime = legacyRuntime || await loadLegacyRuntime()
    const legacyBuffer = loadLegacyBuffer ? await loadLegacyBuffer() : buffer
    const session = await resolvedLegacyRuntime.InferenceSession.create(legacyBuffer, {
      executionProviders: ['webgl'],
    })
    return {
      session,
      runtime: resolvedLegacyRuntime,
      provider: 'onnxjs-webgl',
      wasmError,
      webglError,
      legacyBuffer,
    }
  } catch (error) {
    legacyError = error
    const wasmMessage = wasmError?.message || String(wasmError || 'not attempted')
    const webglMessage = webglError?.message || String(webglError || 'not attempted')
    const legacyMessage = legacyError?.message || String(legacyError)
    const failure = new Error(
      `Digit model engines unavailable (WASM: ${wasmMessage}; WebGL: ${webglMessage}; ONNX.js WebGL: ${legacyMessage})`,
    )
    failure.wasmError = wasmError
    failure.webglError = webglError
    failure.legacyError = legacyError
    throw failure
  }
}
