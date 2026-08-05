export function cameraConstraintCandidates(supportedConstraints = {}) {
  const preferredVideo = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1440 },
  }
  if (supportedConstraints?.aspectRatio) {
    preferredVideo.aspectRatio = { ideal: 4 / 3 }
  }
  if (supportedConstraints?.resizeMode) {
    preferredVideo.resizeMode = { ideal: 'none' }
  }

  return [
    { name: 'preferred-rear', constraints: { video: preferredVideo, audio: false } },
    {
      name: 'simple-rear',
      constraints: { video: { facingMode: { ideal: 'environment' } }, audio: false },
    },
    { name: 'default-camera', constraints: { video: true, audio: false } },
  ]
}

function legacyGetUserMedia(navigatorLike, constraints) {
  const request =
    navigatorLike?.getUserMedia ||
    navigatorLike?.webkitGetUserMedia ||
    navigatorLike?.mozGetUserMedia
  if (typeof request !== 'function') return null
  return new Promise((resolve, reject) => {
    request.call(navigatorLike, constraints, resolve, reject)
  })
}

export async function requestCameraStream(navigatorLike) {
  const mediaDevices = navigatorLike?.mediaDevices
  const supported = mediaDevices?.getSupportedConstraints?.call(mediaDevices) || {}
  const candidates = cameraConstraintCandidates(supported)
  const failures = []

  if (typeof mediaDevices?.getUserMedia === 'function') {
    for (const candidate of candidates) {
      try {
        const stream = await mediaDevices.getUserMedia.call(mediaDevices, candidate.constraints)
        return { stream, mode: candidate.name, failures }
      } catch (error) {
        failures.push({ mode: candidate.name, error })
      }
    }
  }

  const legacyRequest = legacyGetUserMedia(navigatorLike, { video: true, audio: false })
  if (legacyRequest) {
    try {
      const stream = await legacyRequest
      return { stream, mode: 'legacy-default-camera', failures }
    } catch (error) {
      failures.push({ mode: 'legacy-default-camera', error })
    }
  }

  // Avoid Array.prototype.at: it is absent on the older Safari versions this
  // compatibility path is specifically intended to recover.
  const finalFailure = failures.length ? failures[failures.length - 1] : null
  const finalError = finalFailure?.error || new Error('Camera API is unavailable')
  finalError.cameraStartupFailures = failures.map(({ mode, error }) => ({
    mode,
    name: error?.name || null,
    message: error?.message || String(error || ''),
  }))
  throw finalError
}
