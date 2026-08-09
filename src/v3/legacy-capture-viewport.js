const SHEET_ASPECT = 8.5 / 11

export function legacyCapturePreviewSize({
  viewportWidth,
  viewportHeight,
  topOffset = 0,
  bottomReserve = 96,
  horizontalGutter = 20,
} = {}) {
  const visibleWidth = Math.max(0, Number(viewportWidth) || 0)
  const visibleHeight = Math.max(0, Number(viewportHeight) || 0)
  const maxWidth = Math.max(0, visibleWidth - Math.max(0, Number(horizontalGutter) || 0))
  const maxHeight = Math.max(
    0,
    visibleHeight - Math.max(0, Number(topOffset) || 0) - Math.max(0, Number(bottomReserve) || 0),
  )
  if (maxWidth <= 0 || maxHeight <= 0) return null

  const height = Math.min(maxHeight, maxWidth / SHEET_ASPECT)
  const width = height * SHEET_ASPECT
  return {
    width: Math.max(1, Math.floor(width)),
    height: Math.max(1, Math.floor(height)),
  }
}

export function visibleViewportSize(windowLike = globalThis.window, documentLike = globalThis.document) {
  const documentElement = documentLike?.documentElement
  const widthCandidates = [
    windowLike?.innerWidth,
    documentElement?.clientWidth,
  ].map(Number).filter((value) => Number.isFinite(value) && value > 0)
  const heightCandidates = [
    windowLike?.innerHeight,
    documentElement?.clientHeight,
  ].map(Number).filter((value) => Number.isFinite(value) && value > 0)
  if (!widthCandidates.length || !heightCandidates.length) return null
  // Old Safari can temporarily report a layout viewport taller than the part
  // actually visible between its browser chrome. The smallest positive value
  // is the safe viewport for keeping both guidance and controls on screen.
  return {
    width: Math.min(...widthCandidates),
    height: Math.min(...heightCandidates),
  }
}

export function legacyVisibleViewportStyle(viewport) {
  const height = Math.floor(Number(viewport?.height) || 0)
  if (height <= 0) return {}
  const px = `${height}px`
  return {
    height: px,
    minHeight: px,
    maxHeight: px,
  }
}

export function needsLegacyCaptureViewport(css = globalThis.CSS) {
  if (!css || typeof css.supports !== 'function') return true
  return !css.supports('height', '100dvh') || !css.supports('aspect-ratio', '8.5 / 11')
}
