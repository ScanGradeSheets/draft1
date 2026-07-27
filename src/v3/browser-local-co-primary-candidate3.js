import { browserLocalCoPrimaryDecision } from './browser-local-co-primary.js'

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
 * Candidate 3 adds one conservative lane to frozen Candidate 2:
 * exact unanimity across stitched, continuous, uniform, and a complete
 * three-distinct-frame consensus can overcome low single-view confidence.
 * It cannot override a blocking veto or an already accepted control read.
 */
export function browserLocalCoPrimaryCandidate3Decision(input = {}) {
  const candidate2 = browserLocalCoPrimaryDecision(input)
  if (
    candidate2.automatic ||
    candidate2.reason === 'answer-key-shaped-field-rejected' ||
    input.controlDecision?.automatic === true ||
    input.blockingSafetyVeto === true ||
    [input, input.stitched, input.continuous, input.uniform, input.frame]
      .some(containsForbiddenField)
  ) return candidate2

  const reads = [
    read(input.stitched),
    read(input.continuous),
    read(input.uniform),
    input.frame?.threeOfThree === true ? read(input.frame) : '',
  ]
  const unanimous = reads[0] && reads.every((value) => value === reads[0])
  if (!unanimous) return candidate2

  return {
    automatic: true,
    read: reads[0],
    reason: 'co-primary-four-view-unanimity',
    preAcceptance: true,
    changedAcceptedRead: false,
    answerKeyUsed: false,
  }
}
