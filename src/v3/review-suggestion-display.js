export const REVIEW_SUGGESTION_SINGLE_FRAME_MIN_CONFIDENCE = 0.98
export const STITCHED_REVIEW_SUGGESTION_MIN_CONFIDENCE = 0.99
export const REVIEW_SUGGESTION_MULTI_FRAME_MIN_CONFIDENCE = 0.8

export function reviewSuggestionDisplayEligible({ suggestion, frameConsensus, currentText, allowRelaxedMultiFrame = false }) {
  const text = String(suggestion?.text || '')
  if (!text || text === String(currentText || '')) return false
  const singleFrameThreshold = suggestion?.cropVariant === 'stitched-original-grayscale'
    ? STITCHED_REVIEW_SUGGESTION_MIN_CONFIDENCE
    : REVIEW_SUGGESTION_SINGLE_FRAME_MIN_CONFIDENCE
  if (Number(suggestion?.minTokenProbability || 0) >= singleFrameThreshold) {
    return true
  }
  return allowRelaxedMultiFrame
    && frameConsensus?.text === text
    && Number(frameConsensus?.count || 0) >= 2
    && Number(frameConsensus?.fraction || 0) >= (2 / 3)
    && Number(frameConsensus?.minConfidence || 0) >= REVIEW_SUGGESTION_MULTI_FRAME_MIN_CONFIDENCE
}

export function nextYellowReviewGroup(answerGroups, questionReview, currentQuestionNum) {
  const yellowQuestions = new Set((questionReview || [])
    .map((needsReview, index) => needsReview ? index + 1 : null)
    .filter(Number.isInteger))
  const groups = (answerGroups || []).filter((group) => yellowQuestions.has(Number(group?.questionNum)))
  return groups.find((group) => Number(group.questionNum) > Number(currentQuestionNum)) || groups[0] || null
}

export function wholeAnswerReviewModeEligible({ slotCount, reviewSlotCount, hasWholeAnswerSuggestion }) {
  const slots = Number(slotCount)
  const yellowSlots = Number(reviewSlotCount)
  if (slots <= 1) return false

  // When exactly one physical box is yellow, let the teacher correct only that
  // box. The application still merges the correction into—and regrades—the
  // complete answer atomically, so a slot edit cannot desynchronise the grade.
  // Whole-answer mode remains mandatory when more than one box is unresolved.
  return yellowSlots !== 1
}

export function yellowQuestionNumbers(questionGroups, questionReview) {
  return (questionGroups || [])
    .map((group, index) => questionReview?.[index] === true ? Number(group?.question_num ?? index + 1) : null)
    .filter(Number.isFinite)
}

export function displayedYellowQuestionNumbers(questionGroups, questionReview, answerGroups) {
  const output = new Set(yellowQuestionNumbers(questionGroups, questionReview))
  for (const group of answerGroups || []) {
    const questionNum = Number(group?.questionNum ?? group?.question_num)
    if (group?.reviewNeeded === true && Number.isFinite(questionNum)) output.add(questionNum)
  }
  return [...output].sort((a, b) => a - b)
}

export function filterItemsToYellowQuestions(items, questionNumbers) {
  const allowed = new Set((questionNumbers || []).map(Number).filter(Number.isFinite))
  return (items || []).filter((item) => allowed.has(Number(item?.questionNum)))
}
