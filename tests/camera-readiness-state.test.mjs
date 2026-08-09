import test from 'node:test'
import assert from 'node:assert/strict'

import {
  isTransientCameraReadinessError,
  shouldClearTransientCameraReadinessError,
  shouldShowStudentCameraError,
} from '../src/v3/camera-readiness-state.js'

test('does not show a transient readiness warning over a recovering live viewfinder', () => {
  assert.equal(shouldShowStudentCameraError({
    error: 'Camera is still warming up. Try again.',
    streamActive: true,
    cameraReady: false,
  }), false)
  assert.equal(shouldShowStudentCameraError({
    error: 'Camera not ready. Try again.',
    streamActive: true,
    cameraReady: true,
  }), false)
})

test('still shows real camera and capture-quality failures', () => {
  assert.equal(shouldShowStudentCameraError({
    error: 'Camera access failed. Use file upload instead.',
    streamActive: false,
  }), true)
  assert.equal(shouldShowStudentCameraError({
    error: 'Image is still blurry. Hold steady and try again.',
    streamActive: true,
    cameraReady: true,
  }), true)
})

test('recognizes only transient camera-readiness warnings', () => {
  assert.equal(isTransientCameraReadinessError('Camera is still warming up. Try again.'), true)
  assert.equal(isTransientCameraReadinessError('Camera not ready. Try again.'), true)
  assert.equal(isTransientCameraReadinessError('Image is still blurry. Hold steady and try again.'), false)
  assert.equal(isTransientCameraReadinessError('Keep the ScanGrade QR code visible and try again.'), false)
  assert.equal(isTransientCameraReadinessError('Camera access failed. Use file upload instead.'), false)
})

test('clears a stale readiness warning once a drawable frame exists', () => {
  assert.equal(shouldClearTransientCameraReadinessError({
    error: 'Camera is still warming up. Try again.',
    cameraReady: false,
  }), false)
  assert.equal(shouldClearTransientCameraReadinessError({
    error: 'Camera is still warming up. Try again.',
    cameraReady: true,
  }), true)
})

test('successful capture or grading also clears a stale readiness warning', () => {
  assert.equal(shouldClearTransientCameraReadinessError({
    error: 'Camera not ready. Try again.',
    capturedImage: true,
  }), true)
  assert.equal(shouldClearTransientCameraReadinessError({
    error: 'Camera not ready. Try again.',
    resultReady: true,
  }), true)
})

test('does not clear real capture failures after readiness', () => {
  for (const message of [
    'Image is still blurry. Hold steady and try again.',
    'Keep the ScanGrade QR code visible and try again.',
    'Camera access failed. Use file upload instead.',
  ]) {
    assert.equal(shouldClearTransientCameraReadinessError({
      error: message,
      cameraReady: true,
      capturedImage: true,
      resultReady: true,
    }), false)
  }
})
