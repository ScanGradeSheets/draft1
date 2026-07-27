import { browserLocalCoPrimaryDecision } from './browser-local-co-primary.js'
import { browserLocalFrozenControlDecision } from './browser-local-frozen-control.js'

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

/**
 * Complete key-blind pre-acceptance pipeline for Candidate 2.
 *
 * The returned control decision is exposed for replay/debugging, but neither
 * it nor the final decision may be presented until this function completes.
 */
export function browserLocalCoPrimaryPipelineDecision(input = {}) {
  if (containsForbiddenField(input)) {
    const rejected = {
      automatic: false,
      read: String(input.candidateDecision?.read ?? input.browser?.read ?? '').trim(),
      reason: 'answer-key-shaped-field-rejected',
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
    return {
      controlDecision: rejected,
      decision: rejected,
      preAcceptance: true,
      answerKeyUsed: false,
    }
  }
  const controlDecision = browserLocalFrozenControlDecision({
    candidateDecision: input.candidateDecision,
    initiallyAutomatic: input.initiallyAutomatic,
    browserRead: input.browser?.text ?? input.browser?.read,
    stitched: input.stitched,
    continuous: input.continuous,
    uniform: input.uniform,
    frame: input.frame,
    layoutId: input.layoutId,
    blockingSafetyVeto: input.blockingSafetyVeto,
  })
  if (controlDecision.reason === 'answer-key-shaped-field-rejected') {
    return {
      controlDecision,
      decision: {
        ...controlDecision,
        changedAcceptedRead: false,
      },
      preAcceptance: true,
      answerKeyUsed: false,
    }
  }
  const decision = browserLocalCoPrimaryDecision({
    controlDecision,
    browser: input.browser,
    stitched: input.stitched,
    continuous: input.continuous,
    scout: input.scout,
    uniform: input.uniform,
    frame: input.frame,
    layoutId: input.layoutId,
    optionalSlotIndices: input.optionalSlotIndices,
    blockingSafetyVeto: input.blockingSafetyVeto,
    routeReasons: input.routeReasons,
    highRiskMismatchReview: input.highRiskMismatchReview,
  })
  return {
    controlDecision,
    decision,
    preAcceptance: true,
    answerKeyUsed: false,
  }
}
