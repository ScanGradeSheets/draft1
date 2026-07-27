import { browserLocalCascadeDecision } from './browser-local-cascade.js'
import { evaluateUniformLocalConsensus } from './uniform-local-consensus.js'

const FORBIDDEN_CONTEXT_FIELDS = [
  'answerKey',
  'correctAnswer',
  'truth',
  'truthText',
  'mathematicalCorrectness',
]

function rejectedForForbiddenContext(input) {
  return FORBIDDEN_CONTEXT_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(input, field))
}

/**
 * One authoritative, key-blind decision engine for the browser-local research
 * candidate. It composes the routed scout/strong-reader cascade with the
 * narrow uniform-view yellow-rescue lane.
 *
 * Safety invariants:
 * - an initially automatic browser read may only be preserved or demoted;
 * - the uniform lane may rescue only answers that were already yellow;
 * - answer-key/truth-shaped inputs fail closed.
 */
export function browserLocalCandidateDecision(input = {}) {
  if (rejectedForForbiddenContext(input)) {
    return {
      automatic: false,
      read: String(input.currentRead ?? '').trim(),
      reason: 'answer-key-shaped-field-rejected',
      changedExistingAutomaticRead: false,
      stitchedReaderCalls: 0,
      continuousReaderCalls: 0,
      uniformReaderCalls: 0,
      answerKeyUsed: false,
    }
  }

  const initiallyAutomatic = input.currentAutomatic === true
  const cascade = browserLocalCascadeDecision({
    currentAutomatic: initiallyAutomatic,
    currentRead: input.currentRead,
    scout: input.scout,
    stitched: input.stitched,
    continuous: input.continuous,
    layoutId: input.layoutId,
    optionalSlotIndices: input.optionalSlotIndices,
    routeReasons: input.routeReasons,
    highRiskMismatchReview: input.highRiskMismatchReview,
  })

  // A second reader must never overturn a safety demotion of a browser answer
  // that had already been accepted. Uniform evidence is a yellow-rescue lane,
  // not an alternate way to clear a suspicious accepted answer.
  if (initiallyAutomatic || cascade.automatic) {
    return {
      ...cascade,
      uniformReaderCalls: 0,
    }
  }

  const uniformAvailable =
    input.uniform &&
    String(input.uniform.text ?? input.uniform.read ?? '').trim() !== ''
  if (!uniformAvailable) {
    return {
      ...cascade,
      uniformReaderCalls: input.uniformRequested === true ? 1 : 0,
    }
  }

  const uniform = evaluateUniformLocalConsensus({
    currentAutomatic: false,
    layoutId: input.layoutId,
    stitchedRead: input.stitched?.text ?? input.stitched?.read,
    continuousRead: input.continuous?.text ?? input.continuous?.read,
    continuousProbability:
      input.continuous?.minTokenProbability ??
      input.continuous?.sequenceProbability ??
      input.continuous?.probability,
    uniformRead: input.uniform?.text ?? input.uniform?.read,
    uniformProbability:
      input.uniform?.minTokenProbability ??
      input.uniform?.sequenceProbability ??
      input.uniform?.probability,
    blockingSafetyVeto: input.blockingSafetyVeto === true,
  })

  if (!uniform.automatic) {
    return {
      ...cascade,
      uniformReaderCalls: 1,
      uniformReason: uniform.reason,
    }
  }
  return {
    automatic: true,
    read: uniform.read,
    reason: uniform.reason,
    changedExistingAutomaticRead: false,
    stitchedReaderCalls: cascade.stitchedReaderCalls,
    continuousReaderCalls: cascade.continuousReaderCalls,
    uniformReaderCalls: 1,
    answerKeyUsed: false,
  }
}
