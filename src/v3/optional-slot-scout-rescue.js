const FORBIDDEN_FIELDS = [
  'answerKey',
  'correctAnswer',
  'truth',
  'truthText',
  'mathematicalCorrectness',
  'teacherCorrection',
]

const PROTECTED_REASONS = new Set([
  'answer-key-shaped-field-rejected',
  'blocking-safety-veto',
  'unresolved-place-value-one-four',
])

export const OPTIONAL_SLOT_SCOUT_MIN_PROBABILITY = 0.70

function containsForbiddenField(value) {
  if (!value || typeof value !== 'object') return false
  return FORBIDDEN_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(value, field))
}

function read(value) {
  const text = String(value?.text ?? value?.read ?? '').trim()
  return /^\d$/.test(text) ? text : ''
}

function probability(value) {
  return Number(
    value?.sequenceProbability ??
    value?.minTokenProbability ??
    value?.probability ??
    0,
  )
}

/**
 * Experimental, key-blind rescue for an answer that is still yellow after the
 * browser has established that exactly one of two interchangeable slots is
 * physically blank. It never changes an accepted answer and never consults an
 * expected mathematical value. The whole-answer scout is used only as an
 * independent reading of the one remaining written slot.
 */
export function applyOptionalSlotScoutRescue(input = {}) {
  const baseDecision = input.baseDecision || {
    automatic: false,
    read: '',
    reason: 'missing-base-decision',
  }
  if ([input, baseDecision, input.scout].some(containsForbiddenField)) {
    return {
      ...baseDecision,
      automatic: false,
      reason: 'answer-key-shaped-field-rejected',
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }
  if (
    baseDecision.automatic === true ||
    input.blockingSafetyVeto === true ||
    PROTECTED_REASONS.has(baseDecision.reason) ||
    input.optionalSlotContractVerified !== true ||
    !Array.isArray(input.optionalSlotIndices) ||
    input.optionalSlotIndices.length !== 1
  ) {
    return {
      ...baseDecision,
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  const scoutRead = read(input.scout)
  if (
    !scoutRead ||
    probability(input.scout) < OPTIONAL_SLOT_SCOUT_MIN_PROBABILITY
  ) {
    return {
      ...baseDecision,
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  return {
    automatic: true,
    read: scoutRead,
    reason: 'optional-slot-scout-single-digit',
    preAcceptance: true,
    changedAcceptedRead: false,
    answerKeyUsed: false,
  }
}
