function questionNumbers(values = []) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(Number)
      .filter(Number.isFinite)
  )].sort((a, b) => a - b)
}

/**
 * Decide which questions may be animated while an asynchronous, key-blind
 * second-reader pass is still running.
 *
 * Pending work is fail-closed: if the reader has not declared its exact queue,
 * no answer is presented as settled. Once the queue is known, every question
 * outside that queue may animate while the reader works in the background.
 */
export function progressiveVerificationSchedule(shadow = null) {
  const status = String(shadow?.status || '')
  const pending = status === 'pending' || status === 'compact-ready'
  const queueDeclared = Array.isArray(shadow?.pendingReviewQuestionNums)
  const deferredQuestionNums = questionNumbers(shadow?.pendingReviewQuestionNums)

  return {
    status,
    pending,
    queueDeclared,
    deferredQuestionNums,
    mayAnimateSettledAnswers: !pending || queueDeclared,
  }
}

export function progressivePendingQuestionNumbers({
  yellowQuestionNums = [],
  suspiciousAcceptedQuestionNums = [],
} = {}) {
  return questionNumbers([
    ...yellowQuestionNums,
    ...suspiciousAcceptedQuestionNums,
  ])
}
