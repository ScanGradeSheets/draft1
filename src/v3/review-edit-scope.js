export function annotationRegionNeedsReview(region) {
  return Boolean(region?.reviewNeeded || region?.manualCorrected)
}

export function annotationRegionIsEditable(region, { readingsVisible = false } = {}) {
  return Boolean(region) && (readingsVisible || annotationRegionNeedsReview(region))
}

export function editableAnnotationRegions(regions, options = {}) {
  return (Array.isArray(regions) ? regions : [])
    .filter((region) => annotationRegionIsEditable(region, options))
}

export function correctionSlotForTappedRegion(region, {
  useWholeAnswer = false,
  fallbackSlotIndex = 0,
} = {}) {
  // A physical digit box selected by the teacher is authoritative. Whole-
  // answer review heuristics may choose a target only when the teacher tapped
  // a whole-answer region rather than a specific slot.
  if (Number.isInteger(region?.slotIndex) && region.slotIndex >= 0) {
    return region.slotIndex
  }
  if (useWholeAnswer) return null
  return Number.isInteger(fallbackSlotIndex) && fallbackSlotIndex >= 0
    ? fallbackSlotIndex
    : 0
}

/**
 * Chooses the scope used when the yellow-review flow advances automatically.
 * Once only one physical slot remains unresolved, that slot is authoritative;
 * reopening the whole answer would force the teacher to re-enter digits that
 * have already been confirmed.
 */
export function correctionScopeForReviewAdvance({
  reviewSlotIndexes = [],
  requestedSlotIndex = null,
  wholeAnswerEligible = false,
} = {}) {
  const unresolved = (Array.isArray(reviewSlotIndexes) ? reviewSlotIndexes : [])
    .filter((index) => Number.isInteger(index) && index >= 0)
  const selectedSlotIndex = unresolved.length === 1
    ? unresolved[0]
    : Number.isInteger(requestedSlotIndex) && requestedSlotIndex >= 0
      ? requestedSlotIndex
      : null
  return {
    useWholeAnswer: selectedSlotIndex == null && Boolean(wholeAnswerEligible),
    selectedSlotIndex,
  }
}
