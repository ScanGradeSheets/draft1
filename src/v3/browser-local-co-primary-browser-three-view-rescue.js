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

/**
 * Candidate 5 adds one conservative rescue after the safety repair.
 *
 * A weak whole-answer proposal may clear only when the browser digit reader,
 * stitched answer view, continuous answer view, and uniform answer view all
 * emit the exact same complete transcription. No confidence threshold or
 * answer-key context is used.
 */
export function applyBrowserThreeViewExactRescue(input = {}) {
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
      input.stitched,
      input.continuous,
      input.uniform,
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
    baseDecision.reason !== 'weak-whole-answer-proposal'
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
    read(input.stitched),
    read(input.continuous),
    read(input.uniform),
  ]
  const unanimous = reads[0] && reads.every((value) => value === reads[0])
  if (!unanimous) {
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
    reason: 'browser-and-three-grayscale-views-unanimous',
    preAcceptance: true,
    changedAcceptedRead: false,
    answerKeyUsed: false,
  }
}
