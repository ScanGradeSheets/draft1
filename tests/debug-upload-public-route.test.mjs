import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/components/CameraCapture.vue', import.meta.url), 'utf8')

test('existing phones migrate from the private receiver to the restricted public upload route', () => {
  assert.match(source, /LEGACY_PRIVATE_DEBUG_UPLOAD_URL/)
  assert.match(source, /LEGACY_PUBLIC_DEBUG_UPLOAD_URL = 'https:\/\/hobbes-mac-mini\.tail9a3379\.ts\.net:8443\/'/)
  assert.match(source, /PUBLIC_DEBUG_UPLOAD_URL = 'https:\/\/hobbes-mac-mini\.tail415e0b\.ts\.net:8443\/'/)
  assert.match(source, /isLegacyPrivate \|\| isLegacyPublic/)
  assert.match(source, /function migrateDebugUploadUrl/)
  assert.match(source, /safeStorageSet\(DEBUG_UPLOAD_URL_KEY, storedUrl\)/)
})

test('debug uploads have a bounded wait and retain authenticated JSON requests', () => {
  assert.match(source, /DEBUG_UPLOAD_TIMEOUT_MS = 75_000/)
  assert.match(source, /X-ScanGrade-Debug-Token/)
  assert.match(source, /Promise\.race\(\[uploadRequest, timeoutRequest\]\)/)
  assert.match(source, /controller\?\.abort\(\)/)
  assert.match(source, /Upload timed out/)
})

test('legacy Safari retries upload without a CORS preflight and keeps the token out of the URL', () => {
  assert.match(source, /'Content-Type': 'text\/plain;charset=UTF-8'/)
  assert.match(source, /debugUploadToken:\s*debugUploadConfig\.token/)
  assert.match(source, /payload:\s*uploadPayload/)
  assert.doesNotMatch(source, /searchParams\.set\(['"]debugUploadToken/)
})
