import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const cameraSource = await readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')
const pipelineSource = await readFile(new URL('../src/ocr-pipeline.js', import.meta.url), 'utf8')

test('legacy debug bundle records model init and each timed digit operation', () => {
  assert.match(cameraSource, /const digitEngineTrace = \{[\s\S]*operationTimeoutMs: DIGIT_ENGINE_OPERATION_TIMEOUT_MS/)
  assert.match(cameraSource, /onSettled\?\.\(\{[\s\S]*elapsedMs: Math\.round\(performance\.now\(\) - startedAt\)/)
  assert.match(cameraSource, /kind: 'preprocess-variants'/)
  assert.match(cameraSource, /kind: 'single-pass'/)
  assert.match(cameraSource, /kind: 'robust-check'/)
  assert.match(cameraSource, /digitEngineTrace: partialDebug\??\.digitEngineTrace \|\| null/)
})

test('legacy debug bundle records full OCR stage timing without changing stage behavior', () => {
  assert.match(cameraSource, /const ocrStageTrace = \[\{ stage: 'starting', atMs: 0, durationMs: null \}\]/)
  assert.match(cameraSource, /const setOcrStage = \(stage\) => \{[\s\S]*previous\.durationMs = Math\.max\(0, atMs - previous\.atMs\)/)
  assert.match(cameraSource, /setOcrStage\('initializing digit model'\)/)
  assert.match(cameraSource, /setOcrStage\('result ready'\)/)
  assert.match(cameraSource, /ocrStageTrace: partialDebug\.ocrStageTrace \|\| \[\]/)
  assert.match(cameraSource, /worksheetStageTrace: partialDebug\.worksheetStageTrace \|\| \[\]/)
})

test('CPU success retains the preceding ONNX.js WebGL failure in runtime debug metadata', () => {
  assert.match(pipelineSource, /legacyWebglFallbackError: created\.legacyWebglError\?\.message \|\| null/)
  assert.match(pipelineSource, /runtime\.legacyWebglFallbackError = primary\.legacyWebglFallbackError \|\| null/)
  assert.match(pipelineSource, /legacyWebglFallbackError: loaded\.legacyWebglFallbackError \|\| null/)
})
