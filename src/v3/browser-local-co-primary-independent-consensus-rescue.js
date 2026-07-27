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
 * Candidate 6 rescue for a still-yellow pre-acceptance result.
 *
 * Continuous and uniform preserved-grayscale views must agree at >= 0.90 and
 * at least one independent source (browser digits, scout, stitched crop, or
 * complete three-frame consensus) must corroborate. If browser and stitched
 * agree on a different read, that opposition is a hard conflict veto.
 */
export function applyIndependentConsensusRescue(input = {}) {
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
      input.continuous,
      input.uniform,
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
    PROTECTED_REASONS.has(baseDecision.reason)
  ) {
    return {
      ...baseDecision,
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  const continuousRead = read(input.continuous)
  const uniformRead = read(input.uniform)
  if (
    !continuousRead ||
    continuousRead !== uniformRead ||
    probability(input.continuous) < 0.9 ||
    probability(input.uniform) < 0.9
  ) {
    return {
      ...baseDecision,
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  const browserRead = read(input.browser)
  const stitchedRead = read(input.stitched)
  const scoutRead = read(input.scout)
  const frameRead =
    input.frame?.threeOfThree === true ? read(input.frame) : ''
  const opposedByBrowserAndStitched =
    browserRead &&
    browserRead === stitchedRead &&
    browserRead !== continuousRead
  const independentlySupported = [
    browserRead,
    scoutRead,
    stitchedRead,
    frameRead,
  ].includes(continuousRead)

  if (opposedByBrowserAndStitched || !independentlySupported) {
    return {
      ...baseDecision,
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  return {
    automatic: true,
    read: continuousRead,
    reason: 'high-confidence-independent-consensus',
    preAcceptance: true,
    changedAcceptedRead: false,
    answerKeyUsed: false,
  }
}
