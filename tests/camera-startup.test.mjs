import test from 'node:test'
import assert from 'node:assert/strict'

import {
  cameraConstraintCandidates,
  requestCameraStream,
} from '../src/v3/camera-startup.js'

test('camera candidates progressively relax constraints without making rear camera exact', () => {
  const candidates = cameraConstraintCandidates({ aspectRatio: true, resizeMode: true })
  assert.deepEqual(candidates.map((candidate) => candidate.name), [
    'preferred-rear',
    'simple-rear',
    'default-camera',
  ])
  assert.deepEqual(candidates[0].constraints.video.aspectRatio, { ideal: 4 / 3 })
  assert.deepEqual(candidates[0].constraints.video.resizeMode, { ideal: 'none' })
  assert.deepEqual(candidates[1].constraints.video.facingMode, { ideal: 'environment' })
  assert.equal(candidates[2].constraints.video, true)
})

test('uses preferred camera constraints when the modern API accepts them', async () => {
  const calls = []
  const stream = { id: 'preferred' }
  const navigatorLike = {
    mediaDevices: {
      getSupportedConstraints: () => ({ aspectRatio: true }),
      getUserMedia: async (constraints) => {
        calls.push(constraints)
        return stream
      },
    },
  }
  const result = await requestCameraStream(navigatorLike)
  assert.equal(result.stream, stream)
  assert.equal(result.mode, 'preferred-rear')
  assert.equal(calls.length, 1)
})

test('falls back to an unconstrained default camera on older WebKit', async () => {
  const calls = []
  const stream = { id: 'default' }
  const navigatorLike = {
    mediaDevices: {
      getSupportedConstraints: () => ({}),
      getUserMedia: async (constraints) => {
        calls.push(constraints)
        if (constraints.video !== true) throw new Error('unsupported constraints')
        return stream
      },
    },
  }
  const result = await requestCameraStream(navigatorLike)
  assert.equal(result.stream, stream)
  assert.equal(result.mode, 'default-camera')
  assert.equal(calls.length, 3)
  assert.equal(result.failures.length, 2)
})

test('supports the prefixed callback camera API used by very old Safari', async () => {
  const stream = { id: 'legacy' }
  const navigatorLike = {
    webkitGetUserMedia(constraints, resolve) {
      assert.deepEqual(constraints, { video: true, audio: false })
      resolve(stream)
    },
  }
  const result = await requestCameraStream(navigatorLike)
  assert.equal(result.stream, stream)
  assert.equal(result.mode, 'legacy-default-camera')
})

test('reports a real startup failure when every camera route fails', async () => {
  const navigatorLike = {
    mediaDevices: {
      getUserMedia: async () => {
        const error = new Error('denied')
        error.name = 'NotAllowedError'
        throw error
      },
    },
  }
  await assert.rejects(
    requestCameraStream(navigatorLike),
    (error) => error.name === 'NotAllowedError' && error.cameraStartupFailures.length === 3,
  )
})
