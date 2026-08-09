export function needsLegacyStaticCorrectionTransition(navigatorLike = null) {
  const userAgent = String(navigatorLike?.userAgent || '')
  return /\b(?:iPad|iPhone|iPod)\b/.test(userAgent) && /\bOS 12(?:_|\b)/.test(userAgent)
}
