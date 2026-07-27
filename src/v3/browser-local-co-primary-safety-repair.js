const FORBIDDEN_FIELDS = [
  'answerKey',
  'correctAnswer',
  'truth',
  'truthText',
  'mathematicalCorrectness',
  'teacherCorrection',
]

function containsForbiddenField(value) {
  if (!value || typeof value !== 'object') return false
  return FORBIDDEN_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(value, field))
}

function read(value) {
  const text = String(value?.text ?? value?.read ?? '').trim()
  return /^\d{1,4}$/.test(text) ? text : ''
}

function yellow(readText, reason, baseDecision) {
  return {
    ...baseDecision,
    automatic: false,
    read: readText,
    proposedRead: readText,
    reason,
    preAcceptance: true,
    changedAcceptedRead: false,
    answerKeyUsed: false,
  }
}

/**
 * Candidate 4 is a narrow, key-blind safety screen applied before presentation.
 *
 * It does not select a new transcription. It only withholds an otherwise
 * automatic result when either an accepted high-risk mismatch or a proposed
 * replacement of an original yellow has no independent corroboration from the
 * continuous crop, uniform crop, or a complete three-frame consensus.
 */
export function applyBrowserLocalCoPrimarySafetyRepair(input = {}) {
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
    return yellow(
      read(baseDecision),
      'answer-key-shaped-field-rejected',
      baseDecision,
    )
  }

  const proposedRead = read(baseDecision)
  if (baseDecision.automatic !== true || !proposedRead) {
    return {
      ...baseDecision,
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  if (input.blockingSafetyVeto === true) {
    return yellow(proposedRead, 'blocking-safety-veto', baseDecision)
  }

  const routeReasons = Array.isArray(input.routeReasons)
    ? input.routeReasons.map(String)
    : []
  const browserRead = read(input.browser)
  const stitchedRead = read(input.stitched)
  const scoutRead = read(input.scout)
  const corroboratingReads = [
    read(input.continuous),
    read(input.uniform),
    input.frame?.threeOfThree === true ? read(input.frame) : '',
  ].filter(Boolean)
  const hasIndependentCorroboration =
    corroboratingReads.includes(proposedRead)

  const acceptedHighSupportConflict =
    input.initiallyAutomatic === true &&
    input.highRiskMismatchReview === true &&
    routeReasons.includes('high-support-scout-conflict')
  const originalYellowSingleViewConflict =
    input.initiallyAutomatic !== true &&
    browserRead !== proposedRead &&
    stitchedRead === proposedRead &&
    Boolean(scoutRead) &&
    scoutRead !== proposedRead

  if (acceptedHighSupportConflict && !hasIndependentCorroboration) {
    return yellow(
      proposedRead,
      'unresolved-accepted-high-support-conflict',
      baseDecision,
    )
  }

  if (originalYellowSingleViewConflict && !hasIndependentCorroboration) {
    return yellow(
      proposedRead,
      'unresolved-original-yellow-single-view-conflict',
      baseDecision,
    )
  }

  return {
    ...baseDecision,
    preAcceptance: true,
    changedAcceptedRead: false,
    answerKeyUsed: false,
  }
}
