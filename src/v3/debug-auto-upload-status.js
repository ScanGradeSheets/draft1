export function debugAutoUploadIsConfigured(config = {}) {
  return config?.autoUpload === true &&
    String(config?.url || '').trim().length > 0 &&
    String(config?.token || '').trim().length > 0
}

// Keep recovery copy free of receiver details or credentials. A 401 can come
// from the public proxy or after an upstream key rotation; reconnecting is the
// safe browser action in both cases.
export function debugAutoUploadFailure({ hasUrl = true, hasToken = true, status = null } = {}) {
  if (!hasUrl) {
    return {
      code: 'missing-upload-url',
      reconnect: false,
      message: 'Debug auto-save needs an upload URL',
    }
  }
  if (!hasToken) {
    return {
      code: 'missing-upload-key',
      reconnect: true,
      message: 'Debug auto-save needs a key. Tap Connect.',
    }
  }
  if (Number(status) === 401) {
    return {
      code: 'upload-key-rejected',
      reconnect: true,
      message: 'Debug auto-save key was rejected. Tap Connect to replace it.',
    }
  }
  if (Number(status) === 403) {
    return {
      code: 'upload-origin-rejected',
      reconnect: false,
      message: 'Debug auto-save was blocked by its receiver.',
    }
  }
  return {
    code: 'upload-failed',
    reconnect: false,
    message: status != null && Number.isFinite(Number(status))
      ? `Debug auto-save failed (${Number(status)})`
      : 'Debug auto-save failed. Try again.',
  }
}
