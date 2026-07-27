import {
  browserLocalCoPrimaryCandidate3Decision,
} from './browser-local-co-primary-candidate3.js'
import {
  browserLocalCoPrimaryPipelineDecision,
} from './browser-local-co-primary-pipeline.js'
import {
  applyBrowserLocalCoPrimarySafetyRepair,
} from './browser-local-co-primary-safety-repair.js'
import {
  applyBrowserThreeViewExactRescue,
} from './browser-local-co-primary-browser-three-view-rescue.js'
import {
  applyIndependentConsensusRescue,
} from './browser-local-co-primary-independent-consensus-rescue.js'
import {
  applyMultifamilyFrameConsensusRescue,
} from './browser-local-co-primary-multifamily-frame-rescue.js'

/**
 * Complete research Candidate 7 chain.
 *
 * Every stage runs before presentation, is key-blind, and receives only
 * inference-time evidence. The final result may preserve, demote, promote, or
 * replace a preliminary browser read, but it is the only decision authorized
 * for presentation.
 */
export function browserLocalCoPrimaryCandidate7Decision(input = {}) {
  const pipeline = browserLocalCoPrimaryPipelineDecision(input)
  const candidate3 = browserLocalCoPrimaryCandidate3Decision({
    ...input,
    controlDecision: pipeline.decision,
  })
  const safety = applyBrowserLocalCoPrimarySafetyRepair({
    ...input,
    baseDecision: candidate3,
  })
  const browserThreeView = applyBrowserThreeViewExactRescue({
    ...input,
    baseDecision: safety,
  })
  const independentConsensus = applyIndependentConsensusRescue({
    ...input,
    baseDecision: browserThreeView,
  })
  const proposedDecision = applyMultifamilyFrameConsensusRescue({
    ...input,
    baseDecision: independentConsensus,
  })
  const read = (value) => String(value?.text ?? value?.read ?? '').trim()
  const probability = (value) => Number(
    value?.minTokenProbability ??
    value?.sequenceProbability ??
    value?.probability ??
    0,
  )
  const browserRead = read(input.browser)
  const proposedRead = read(proposedDecision)
  const strictAcceptedDemotion =
    input.initiallyAutomatic === true &&
    input.candidateDecision?.automatic !== true
  const protectedStrictDemotion = new Set([
    'answer-key-shaped-field-rejected',
    'blocking-safety-veto',
    'unresolved-place-value-one-four',
  ]).has(input.candidateDecision?.reason)
  const exactOptionalSlotContraction =
    Array.isArray(input.optionalSlotIndices) &&
    input.optionalSlotIndices.length > 0 &&
    proposedRead.length > 0 &&
    proposedRead.length < browserRead.length &&
    [input.scout, input.stitched, input.continuous, input.uniform]
      .every((value) => read(value) === proposedRead) &&
    [input.stitched, input.continuous, input.uniform]
      .every((value) => probability(value) >= 0.9)
  const unsafeReplacementOfStrictDemotion =
    strictAcceptedDemotion &&
    proposedDecision.automatic === true &&
    proposedRead !== browserRead &&
    !exactOptionalSlotContraction
  // The larger reader may confirm the browser's accepted transcription, and
  // may remove a confidently empty optional slot. It may not otherwise replace
  // a read that the strict safety policy demoted. Live replay found correlated
  // crop families could agree on the same wrong replacement (18→14, 16→14,
  // and 8→6), while a high-confidence optional-slot contraction safely
  // recovers cases such as 51→5.
  const decision = unsafeReplacementOfStrictDemotion
    ? {
        ...input.candidateDecision,
        automatic: false,
        reason: 'strict-accepted-browser-replacement-veto',
        preAcceptance: true,
        changedAcceptedRead: false,
        answerKeyUsed: false,
      }
    : protectedStrictDemotion
      ? {
          ...input.candidateDecision,
          automatic: false,
          preAcceptance: true,
          changedAcceptedRead: false,
          answerKeyUsed: false,
        }
    : proposedDecision

  return {
    controlDecision: pipeline.controlDecision,
    pipelineDecision: pipeline.decision,
    candidate3Decision: candidate3,
    safetyDecision: safety,
    browserThreeViewDecision: browserThreeView,
    independentConsensusDecision: independentConsensus,
    decision,
    preAcceptance: true,
    answerKeyUsed: false,
  }
}
