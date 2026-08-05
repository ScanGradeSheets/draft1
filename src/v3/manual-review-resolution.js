function validCorrectedSlots(correction, slotCount) {
  const values = Array.isArray(correction?.correctedSlots) ? correction.correctedSlots : []
  return new Set(values.filter((index) => (
    Number.isInteger(index) && index >= 0 && index < slotCount
  )))
}

function groupIsTeacherConfirmed(group, predictionsById, manualCorrections, fallbackIndex) {
  const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
  if (!ids.length) return false
  const predictionsConfirmed = ids.every((id) => {
    const prediction = predictionsById.get(String(id))
    return prediction?.manualCorrected === true && prediction?.reviewNeeded !== true
  })
  if (predictionsConfirmed) return true

  const key = String(group?.question_num ?? fallbackIndex + 1)
  return validCorrectedSlots(manualCorrections?.[key], ids.length).size === ids.length
}

/**
 * Teacher confirmation is authoritative review evidence. Keep the question
 * flags and answer-card state in agreement so an old WebKit re-render cannot
 * recreate a completed final yellow question from stale derived state.
 */
export function reconcileManualReviewState({
  questionGroups = [],
  predictions = [],
  questionReview = [],
  answerGroups = [],
  questionCorrect = [],
  manualCorrections = {},
} = {}) {
  const predictionsById = new Map(
    predictions.map((prediction) => [String(prediction?.id), prediction]),
  )
  const review = Array.isArray(questionReview) ? [...questionReview] : questionReview
  const groups = Array.isArray(answerGroups)
    ? answerGroups.map((answerGroup) => ({ ...answerGroup }))
    : answerGroups

  questionGroups.forEach((group, index) => {
    if (!groupIsTeacherConfirmed(group, predictionsById, manualCorrections, index)) return
    if (Array.isArray(review)) review[index] = false
    if (Array.isArray(groups) && groups[index]) {
      groups[index] = {
        ...groups[index],
        reviewNeeded: false,
        manualCorrected: true,
        status: questionCorrect?.[index] === true ? 'correct' : 'incorrect',
      }
    }
  })

  return { questionReview: review, answerGroups: groups }
}

/**
 * A page-level OCR fallback is only a starting safety state. Once a teacher
 * has explicitly resolved every structured question, that stale fallback
 * must not keep the final question in review forever.
 */
export function resolvedPageReviewState({
  baseNeedsReview = false,
  predictions = [],
  questionGroups = [],
  questionCorrect = [],
  questionReview = [],
} = {}) {
  const predictionNeedsReview = predictions.some((prediction) => prediction?.reviewNeeded === true)
  const groupedStructureInvalid = questionGroups.length > 0 && !Array.isArray(questionCorrect)
  const groupedQuestionNeedsReview = Array.isArray(questionReview) && questionReview.some(Boolean)
  const hasStructuredReviewState = questionGroups.length > 0 && Array.isArray(questionReview)
  const unresolvedStructuredReview = predictionNeedsReview || groupedStructureInvalid || groupedQuestionNeedsReview
  const needsReview = unresolvedStructuredReview || (!hasStructuredReviewState && Boolean(baseNeedsReview))

  return {
    needsReview,
    forcedFallbackReviewReasonMayRemain: needsReview,
  }
}
