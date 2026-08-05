function answerDigitCount(answer) {
  if (answer == null) return 0
  const text = String(answer).trim()
  return /^\d+$/.test(text) ? text.length : 0
}

function normalizedPredictionDigit(prediction) {
  if (!prediction || prediction.blank === true || prediction.empty === true) return null
  const digit = Number(prediction.digit)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined
}

/**
 * A manually confirmed blank is resolved evidence, not an unanswered review.
 * This distinction lets a teacher confirm one physical slot as blank while the
 * remaining written slots are still graded as the student's complete answer.
 */
export function requiredSlotsNeedReview({
  answer,
  predictions = [],
  hasAnswerTextOverride = false,
} = {}) {
  if (hasAnswerTextOverride) return false
  if (!Array.isArray(predictions) || predictions.length === 0) return true
  if (predictions.some((prediction) => !prediction)) return true
  if (predictions.every((prediction) => prediction.manualCorrected === true)) return false

  const expectedDigitCount = answerDigitCount(answer)
  if (expectedDigitCount < predictions.length) return false

  return predictions.some((prediction) => {
    if (prediction.manualCorrected === true) return false
    const digit = normalizedPredictionDigit(prediction)
    return digit === null || digit === undefined
  })
}

export function manuallyConfirmedAllSlots({ ids = [], predictions = [] } = {}) {
  if (!Array.isArray(ids) || ids.length === 0 || !Array.isArray(predictions)) return false
  const byId = new Map(predictions.map((prediction) => [String(prediction?.id), prediction]))
  return ids.every((id) => {
    const prediction = byId.get(String(id))
    return prediction?.manualCorrected === true && prediction?.reviewNeeded !== true
  })
}
