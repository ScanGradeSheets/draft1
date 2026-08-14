import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../scripts/browser-probes/trocr-small.html', import.meta.url), 'utf8')
const serverSource = await readFile(new URL('../scripts/browser-probes/serve_trocr_small_probe.mjs', import.meta.url), 'utf8')

test('physical-device probe records cached-session reuse and model transfer timing', () => {
  assert.match(source, /var residentSessions = null/)
  assert.match(source, /sessionReused: true/)
  assert.match(source, /modelInitializationMs/)
  assert.match(source, /encoderResource/)
  assert.match(source, /decoderResource/)
  assert.match(source, /memoryBefore/)
  assert.match(source, /memoryAfter/)
})

test('physical-device probe contains a deliberately missing local-asset recovery check', () => {
  assert.match(source, /Test load-failure recovery/)
  assert.match(source, /decoder-int8\.missing\.onnx/)
  assert.match(source, /expectedFailureObserved/)
  assert.match(source, /await run\(8, recovery\)/)
  assert.match(source, /noUploads: true/)
})

test('physical shadow activation can expose models without exposing sample routes', () => {
  assert.match(serverSource, /SG_TROCR_MODELS_ONLY/)
  assert.match(serverSource, /if \(!modelsOnly\) routes\.set\('\/sample\.png'/)
  assert.match(serverSource, /if \(!modelsOnly && !file && request\.url\.startsWith\('\/samples\/'\)\)/)
  assert.match(serverSource, /if \(!modelsOnly && !file && request\.url\.startsWith\('\/manifest\/'\)\)/)
})
