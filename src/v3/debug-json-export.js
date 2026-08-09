export function serializeDebugJson(data) {
  return JSON.stringify(data)
}

function legacyShareDebugJson(data) {
  const compact = { ...data }
  for (const key of [
    'capturedImageDataUrl',
    'markedSheetDataUrl',
    'warpedDataUrl',
  ]) {
    if (key in compact) compact[key] = null
  }
  for (const key of [
    'rawCropDataUrls',
    'modelInputDataUrls',
    'hybridBurstFrameDataUrls',
    'tensors',
  ]) {
    if (key in compact) compact[key] = []
  }
  return serializeDebugJson(compact)
}

export async function exportDebugJson(data, options = {}) {
  const {
    filename = `scangrade-live-ocr-debug-${Date.now()}.json`,
    navigatorLike = typeof navigator !== 'undefined' ? navigator : null,
    documentLike = typeof document !== 'undefined' ? document : null,
    urlLike = typeof URL !== 'undefined' ? URL : null,
    BlobCtor = typeof Blob !== 'undefined' ? Blob : null,
    FileCtor = typeof File !== 'undefined' ? File : null,
  } = options

  const json = serializeDebugJson(data)
  const blob = BlobCtor ? new BlobCtor([json], { type: 'application/json' }) : null

  if (blob && FileCtor && navigatorLike?.share && typeof navigatorLike.canShare === 'function') {
    const file = new FileCtor([blob], filename, { type: 'application/json' })
    const sharePayload = { files: [file], title: 'ScanGrade OCR debug JSON' }
    if (navigatorLike.canShare(sharePayload)) {
      await navigatorLike.share(sharePayload)
      return { method: 'share', filename }
    }
  }

  // iOS 12 exposes navigator.share but cannot share File objects and does not
  // expose navigator.canShare. Sending a file there silently shares only the
  // title. Share compact JSON text instead so the diagnostic trace survives.
  if (navigatorLike?.share) {
    await navigatorLike.share({
      title: 'ScanGrade OCR debug JSON',
      text: legacyShareDebugJson(data),
    })
    return { method: 'share-text', filename }
  }

  // Installed iOS web apps can silently ignore synthetic anchor downloads.
  // Copying is a reliable fallback when file sharing is unavailable.
  if (navigatorLike?.standalone === true && navigatorLike?.clipboard?.writeText) {
    await navigatorLike.clipboard.writeText(json)
    return { method: 'copy', filename }
  }

  if (blob && documentLike && urlLike?.createObjectURL) {
    const objectUrl = urlLike.createObjectURL(blob)
    try {
      const link = documentLike.createElement('a')
      link.download = filename
      link.href = objectUrl
      link.click()
      return { method: 'download', filename }
    } finally {
      // WebKit can start the download asynchronously. Revoke after its click
      // task has had a chance to consume the object URL.
      setTimeout(() => urlLike.revokeObjectURL(objectUrl), 1000)
    }
  }

  if (navigatorLike?.clipboard?.writeText) {
    await navigatorLike.clipboard.writeText(json)
    return { method: 'copy', filename }
  }

  throw new Error('This browser cannot export the debug file')
}

export async function copyDebugJson(data, navigatorLike = typeof navigator !== 'undefined' ? navigator : null) {
  if (!navigatorLike?.clipboard?.writeText) throw new Error('Clipboard access is unavailable')
  await navigatorLike.clipboard.writeText(serializeDebugJson(data))
  return { method: 'copy' }
}
