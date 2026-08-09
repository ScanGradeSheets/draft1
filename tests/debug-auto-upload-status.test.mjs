import test from 'node:test'
import assert from 'node:assert/strict'

import {
  debugAutoUploadFailure,
  debugAutoUploadIsConfigured,
} from '../src/v3/debug-auto-upload-status.js'

test('auto-save is configured only when URL, key, and opt-in are all present', () => {
  assert.equal(debugAutoUploadIsConfigured({ autoUpload: true, url: 'https://example.test/', token: 'key' }), true)
  assert.equal(debugAutoUploadIsConfigured({ autoUpload: true, url: 'https://example.test/', token: '' }), false)
  assert.equal(debugAutoUploadIsConfigured({ autoUpload: false, url: 'https://example.test/', token: 'key' }), false)
})

test('missing key and 401 both provide a safe reconnect path', () => {
  assert.deepEqual(
    debugAutoUploadFailure({ hasUrl: true, hasToken: false }),
    {
      code: 'missing-upload-key',
      reconnect: true,
      message: 'Debug auto-save needs a key. Tap Connect.',
    },
  )
  assert.deepEqual(
    debugAutoUploadFailure({ hasUrl: true, hasToken: true, status: 401 }),
    {
      code: 'upload-key-rejected',
      reconnect: true,
      message: 'Debug auto-save key was rejected. Tap Connect to replace it.',
    },
  )
})

test('receiver rejection and ordinary failure do not expose server details', () => {
  assert.equal(debugAutoUploadFailure({ status: 403 }).message, 'Debug auto-save was blocked by its receiver.')
  assert.equal(debugAutoUploadFailure({ status: 502 }).message, 'Debug auto-save failed (502)')
  assert.equal(debugAutoUploadFailure().message, 'Debug auto-save failed. Try again.')
})
