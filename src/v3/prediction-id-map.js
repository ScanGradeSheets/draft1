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
