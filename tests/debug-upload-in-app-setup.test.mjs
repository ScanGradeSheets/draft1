import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const cameraSource = await readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')
const appSource = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

test('an unconfigured installed app offers an in-app auto-save connection', () => {
  assert.match(cameraSource, /const debugAutoUploadConfigured = ref/)
  assert.match(cameraSource, /async function connectDebugAutoUpload/)
  assert.match(cameraSource, /Paste the private ScanGrade auto-save key or activation link/)
  assert.match(cameraSource, /safeStorageSet\(DEBUG_UPLOAD_TOKEN_KEY, token\)/)
  assert.match(appSource, /debugAutoUploadConfigured === false\) return 'Connect'/)
})

test('connecting after grading uploads the evidence already on screen', () => {
  assert.match(cameraSource, /if \(lastLiveOcrDebug\.value\)/)
  assert.match(cameraSource, /uploadLiveOcrDebug\(lastLiveOcrDebug\.value, 'connected-after-scan'\)/)
  assert.match(cameraSource, /return \{ ok: true, id: payload\?\.id \|\| null \}/)
})
