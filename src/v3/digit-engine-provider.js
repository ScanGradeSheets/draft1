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
  let legacyWebglError = null
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

  const resolvedLegacyRuntime = legacyRuntime || await loadLegacyRuntime()
  const legacyBuffer = loadLegacyBuffer ? await loadLegacyBuffer() : buffer

  try {
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
    legacyWebglError = error
  }

  // WebGL is unavailable on some old Safari/iPad combinations even though
  // the ONNX.js CPU backend still works.  This is intentionally a final
  // fallback: it trades speed for availability and never changes the
  // answer/confidence policy.
  try {
    const session = await resolvedLegacyRuntime.InferenceSession.create(legacyBuffer, {
      executionProviders: ['cpu'],
    })
    return {
      session,
      runtime: resolvedLegacyRuntime,
      provider: 'onnxjs-cpu',
      wasmError,
      webglError,
      legacyWebglError,
      legacyBuffer,
    }
  } catch (error) {
    legacyError = error
    const wasmMessage = wasmError?.message || String(wasmError || 'not attempted')
    const webglMessage = webglError?.message || String(webglError || 'not attempted')
    const legacyWebglMessage = legacyWebglError?.message || String(legacyWebglError || 'not attempted')
    const legacyCpuMessage = legacyError?.message || String(legacyError)
    const failure = new Error(
      `Digit model engines unavailable (WASM: ${wasmMessage}; WebGL: ${webglMessage}; ONNX.js WebGL: ${legacyWebglMessage}; ONNX.js CPU: ${legacyCpuMessage})`,
    )
    failure.wasmError = wasmError
    failure.webglError = webglError
    failure.legacyWebglError = legacyWebglError
    failure.legacyError = legacyError
    throw failure
  }
}
