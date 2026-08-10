const MAX_QR_DISTANCE = 0.08
const MIN_QR_DISTANCE_MARGIN = 0.18

export function selectDecisiveQrOrientation(candidates) {
  const ranked = (Array.isArray(candidates) ? candidates : [])
    .filter((candidate) => Number.isFinite(candidate?.qrDistance))
    .slice()
    .sort((a, b) => a.qrDistance - b.qrDistance)

  if (ranked.length < 2) return null
  if (ranked[0].qrDistance > MAX_QR_DISTANCE) return null
  if (ranked[1].qrDistance - ranked[0].qrDistance < MIN_QR_DISTANCE_MARGIN) return null
  return ranked[0]
}
