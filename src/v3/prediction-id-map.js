export function predictionIdKey(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function predictionMapById(predictions = []) {
  return new Map((predictions || []).map((prediction) => [
    predictionIdKey(prediction?.id),
    prediction,
  ]))
}

export function predictionIndexMapById(predictions = []) {
  return new Map((predictions || []).map((prediction, index) => [
    predictionIdKey(prediction?.id),
    index,
  ]))
}

// Layout JSON from old WebKit can preserve a numeric box id while a saved
// prediction has the equivalent string id.  Accept either a canonical map or
// a legacy raw-keyed map during the transition; callers should still create
// new maps with predictionMapById.
export function predictionForId(predictionById, id) {
  if (!predictionById || typeof predictionById.get !== 'function') return null
  const canonical = predictionIdKey(id)
  const normalized = predictionById.get(canonical)
  if (normalized != null) return normalized
  const direct = predictionById.get(id)
  if (direct != null) return direct
  // Support raw maps constructed before ID normalization without collapsing
  // meaningful string ids such as "001" into a different numeric key.
  const numeric = Number(canonical)
  if (Number.isFinite(numeric) && String(numeric) === canonical) {
    return predictionById.get(numeric) ?? null
  }
  return null
}
