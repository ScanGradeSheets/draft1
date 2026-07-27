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

function containsForbiddenField(value) {
  if (!value || typeof value !== 'object') return false
  return FORBIDDEN_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(value, field))
}

function read(value) {
  const text = String(value?.text ?? value?.read ?? '').trim()
  return /^\d{1,4}$/.test(text) ? text : ''
}

function probability(value) {
  return Number(
    value?.minTokenProbability ??
    value?.sequenceProbability ??
    value?.probability ??
    0,
  )
}

/**
 * Candidate 7 rescue for a still-yellow pre-acceptance result.
 *
 * Browser digit OCR, the independent scout, stitched whole-answer OCR, and a
 * complete three-frame consensus must all agree. The stitched and frame reads
 * must each meet the existing 0.90 floor. Protected vetoes are never cleared.
 */
export function applyMultifamilyFrameConsensusRescue(input = {}) {
  const baseDecision = input.baseDecision || {
    automatic: false,
    read: '',
    reason: 'missing-base-decision',
  }
  if (
    [
      input,
      baseDecision,
      input.browser,
      input.scout,
      input.stitched,
      input.frame,
    ].some(containsForbiddenField)
  ) {
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
    input.frame?.threeOfThree !== true
  ) {
    return {
      ...baseDecision,
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  const reads = [
    read(input.browser),
    read(input.scout),
    read(input.stitched),
    read(input.frame),
  ]
  const unanimous = reads[0] && reads.every((value) => value === reads[0])
  if (
    !unanimous ||
    probability(input.stitched) < 0.9 ||
    probability(input.frame) < 0.9
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
    read: reads[0],
    reason: 'multifamily-three-frame-consensus',
    preAcceptance: true,
    changedAcceptedRead: false,
    answerKeyUsed: false,
  }
}
