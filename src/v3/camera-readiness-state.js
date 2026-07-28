const TRANSIENT_CAMERA_READINESS_PATTERNS = [
  /camera is still warming up/i,
  /camera not ready/i,
]

export function isTransientCameraReadinessError(value) {
  const message = String(value || '').trim()
  return TRANSIENT_CAMERA_READINESS_PATTERNS.some((pattern) => pattern.test(message))
}

export function shouldClearTransientCameraReadinessError({
  error,
  cameraReady = false,
  capturedImage = false,
  resultReady = false,
} = {}) {
  if (!isTransientCameraReadinessError(error)) return false
  return cameraReady === true || capturedImage === true || resultReady === true
}
