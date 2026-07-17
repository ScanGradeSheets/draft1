import assert from 'node:assert/strict'
import test from 'node:test'

import { frameDecodeWorkerSupported } from '../src/v3/frame-preparation.js'

test('frame decode worker remains optional outside a browser worker runtime', () => {
  assert.equal(frameDecodeWorkerSupported(), false)
})
