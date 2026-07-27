import { normalizeTranscription } from '../hybrid-recognition.js'

export const MULTIVIEW_LOCAL_SUPPORT_POLICY_VERSION = 'multiview-local-support-shadow-1'
export const MULTIVIEW_MIN_TROCR_PROBABILITY = 0.30
export const MULTIVIEW_LOCAL_RANK_LIMIT = 3
export const MULTIVIEW_LOCAL_PROBABILITY_FLOOR = 0.05

const HARD_REASONS = new Set([
  'confidence-safety-veto-dominates',
  'handwriting-ambiguity-detected',
  'high-risk-browser-and-near-certain-compact-conflict',
])

const HARD_AMBIGUITY_REASONS = new Set([
  'model-families-disagree',
  'answer-ink-may-be-clipped',
  'override-retained-material-rival',
])

function review(reason, evidence = {}) {
  return {
    policyVersion: MULTIVIEW_LOCAL_SUPPORT_POLICY_VERSION,
    promote: false,
    automaticText: null,
    requiresTeacherReview: true,
    reason,
    answerKeyUsed: false,
    evidence,
  }
}

function ambiguityReasons(ambiguity) {
  return (ambiguity?.reasons || [])
    .map((item) => String(item?.reason || ''))
    .filter(Boolean)
}

function hardVeto({ promotionReason, ambiguity, confidenceSafetyVetoed, highRiskConflict }) {
  if (confidenceSafetyVetoed || highRiskConflict || HARD_REASONS.has(promotionReason)) return true
  return ambiguityReasons(ambiguity).some((reason) => HARD_AMBIGUITY_REASONS.has(reason))
}

function overrideOnly({ promotionReason, ambiguity, confidenceSafetyVetoed, highRiskConflict }) {
  if (confidenceSafetyVetoed || highRiskConflict || HARD_REASONS.has(promotionReason)) return false
  const reasons = ambiguityReasons(ambiguity)
  return reasons.length === 1 && reasons[0] === 'override-retained-material-rival'
}

function localChoices(candidates = []) {
  return candidates
    .map((candidate) => ({
      text: normalizeTranscription(candidate?.text ?? candidate?.read),
      probability: Number(candidate?.probability ?? candidate?.sequenceProbability ?? 0),
    }))
    .filter((candidate) => candidate.text)
    .slice(0, MULTIVIEW_LOCAL_RANK_LIMIT)
}

/**
 * Development-only, key-blind selector. It consumes only recognition and
 * physical-layout evidence. Answer-key/truth fields supplied by a caller are
 * deliberately ignored.
 */
export function multiviewLocalSupportDecision({
  currentAutomatic = false,
  continuous = null,
  stitched = null,
  sequenceFrameConsensus = null,
  localCandidates = [],
  slotCount = null,
  promotionReason = '',
  ambiguity = null,
  confidenceSafetyVetoed = false,
  highRiskConflict = false,
  allowOverrideOnlyClearance = false,
} = {}) {
  if (currentAutomatic) return review('already-automatic-not-a-shadow-candidate')
  const continuousRead = normalizeTranscription(continuous?.text ?? continuous?.read)
  const stitchedRead = normalizeTranscription(stitched?.text ?? stitched?.read)
  const sequenceRead = normalizeTranscription(sequenceFrameConsensus?.text ?? sequenceFrameConsensus?.read)
  if (!continuousRead || continuousRead !== stitchedRead || continuousRead !== sequenceRead) {
    return review('strong-view-disagreement')
  }
  if (
    sequenceFrameConsensus?.tied === true ||
    Number(sequenceFrameConsensus?.count ?? sequenceFrameConsensus?.agreeingFrames) < 2
  ) return review('insufficient-frame-stability')
  const physicalSlots = Number(slotCount)
  if (!Number.isInteger(physicalSlots) || physicalSlots < 1 || continuousRead.length > physicalSlots) {
    return review('answer-length-exceeds-slot-metadata', { proposedRead: continuousRead, slotCount: physicalSlots })
  }
  if (
    Number(continuous?.minTokenProbability || 0) < MULTIVIEW_MIN_TROCR_PROBABILITY ||
    Number(stitched?.minTokenProbability || 0) < MULTIVIEW_MIN_TROCR_PROBABILITY
  ) return review('strong-view-support-too-weak')

  const choices = localChoices(localCandidates)
  const localRank = choices.findIndex((choice) =>
    choice.text === continuousRead && choice.probability >= MULTIVIEW_LOCAL_PROBABILITY_FLOOR)
  if (localRank < 0) return review('packet-held-out-local-model-does-not-support', {
    proposedRead: continuousRead,
    localChoices: choices.map((choice) => choice.text),
  })

  const vetoInput = { promotionReason, ambiguity, confidenceSafetyVetoed, highRiskConflict }
  const clearedOverrideOnly = allowOverrideOnlyClearance && overrideOnly(vetoInput)
  if (hardVeto(vetoInput) && !clearedOverrideOnly) {
    return review('existing-safety-or-ambiguity-veto-dominates', {
      proposedRead: continuousRead,
      ambiguityReasons: ambiguityReasons(ambiguity),
    })
  }

  return {
    policyVersion: MULTIVIEW_LOCAL_SUPPORT_POLICY_VERSION,
    promote: true,
    automaticText: continuousRead,
    requiresTeacherReview: false,
    reason: clearedOverrideOnly
      ? 'analysis-only-override-clearance-multiview-local-support'
      : 'strict-multiview-local-support',
    answerKeyUsed: false,
    evidence: {
      proposedRead: continuousRead,
      agreeingFrameCount: Number(sequenceFrameConsensus?.count ?? sequenceFrameConsensus?.agreeingFrames),
      localRank: localRank + 1,
      localProbability: choices[localRank].probability,
      overrideOnlyVetoCleared: clearedOverrideOnly,
    },
  }
}
