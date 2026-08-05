const TEACHER_AUTHORITATIVE_FIELDS = Object.freeze([
  'predictions',
  'digits',
  'confidences',
  'correct',
  'needsReview',
  'forcedFallbackReviewReason',
  'reviewOnlyFallback',
  'questionCorrect',
  'questionReview',
  'questionCount',
  'questionScore',
  'questionReviewCount',
  'answerGroups',
  'annotationRegions',
  'manualCorrections',
  'annotatedImageUrl',
])

export function hasTeacherCorrections(result) {
  if (!result || typeof result !== 'object') return false
  if (Object.keys(result.manualCorrections || {}).length > 0) return true
  return (result.predictions || []).some((prediction) => prediction?.manualCorrected === true)
}

export function mergeAsyncOcrPayloadPreservingTeacherState(current, incoming) {
  if (!incoming || typeof incoming !== 'object') return current
  if (!hasTeacherCorrections(current)) return { ...incoming }

  const merged = { ...incoming }
  for (const field of TEACHER_AUTHORITATIVE_FIELDS) {
    if (current?.[field] !== undefined) merged[field] = current[field]
  }
  return merged
}
