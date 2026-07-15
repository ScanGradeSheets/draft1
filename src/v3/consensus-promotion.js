import { normalizeTranscription } from '../hybrid-recognition.js'
import { compactReviewCandidates } from './local-first-review.js'

export const CONSENSUS_PROMOTION_POLICY_VERSION = 'consensus-promotion-shadow-1'
export const CONSENSUS_REQUIRED_FRAMES = 3
export const CONSENSUS_MIN_FRAME_CONFIDENCE = 0.70
export const CONSENSUS_COMPACT_LIMIT = 2
export const CONSENSUS_MIN_COMPACT_JOINT_PROBABILITY = 0.05
export const CONSENSUS_MIN_SECOND_TO_FIRST_RATIO = 0.25
export const CONSENSUS_BROWSER_MAJORITY_SHARE = 0.85

function review(reason, evidence = {}) {
  return {
    policyVersion: CONSENSUS_PROMOTION_POLICY_VERSION,
    promote: false,
    automaticText: null,
    requiresTeacherReview: true,
    reason,
    answerKeyUsed: false,
    evidence,
  }
}

function automatic(text, evidence = {}) {
  return {
    policyVersion: CONSENSUS_PROMOTION_POLICY_VERSION,
    promote: true,
    automaticText: text,
    requiresTeacherReview: false,
    reason: 'independent-three-frame-and-compact-consensus',
    answerKeyUsed: false,
    evidence,
  }
}

function exactThreeFrameConsensus(consensus) {
  const text = normalizeTranscription(consensus?.text ?? consensus?.read)
  const count = Number(consensus?.count ?? consensus?.agreeingFrames)
  const usable = Number(consensus?.usableFrameCount ?? consensus?.usableFrames)
  const confidence = Number(consensus?.minConfidence)
  return Boolean(
    text &&
    consensus?.tied !== true &&
    count === CONSENSUS_REQUIRED_FRAMES &&
    usable === CONSENSUS_REQUIRED_FRAMES &&
    confidence >= CONSENSUS_MIN_FRAME_CONFIDENCE
  )
}

function slotCompatible(text, slotCount) {
  const normalized = normalizeTranscription(text)
  const count = Number(slotCount)
  if (!normalized || !Number.isInteger(count) || count < 1) return false
  // Fewer written digits are permitted because the left slot can be genuinely
  // empty. More digits are never permitted; this blocks 12 -> 1212 duplication.
  return normalized.length <= count
}

function predictionDigit(prediction) {
  if (prediction?.blank === true || prediction?.empty === true || prediction?.digit == null) return null
  const digit = Number(prediction.digit)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null
}

/**
 * True only when every character in the browser's current answer is backed by
 * its own preprocessing majority at >= 85%. This is agreement evidence, not
 * the browser model's raw confidence.
 */
export function browserHasStableConflictingEvidence(currentRead, proposedRead, predictions = []) {
  const current = normalizeTranscription(currentRead)
  const proposed = normalizeTranscription(proposedRead)
  if (!current || !proposed || current === proposed) return false
  const byIndex = new Map()
  for (const prediction of predictions || []) {
    const index = Number(prediction?.digitIndex)
    if (!Number.isInteger(index)) continue
    const selected = predictionDigit(prediction)
    const majority = Number(prediction?.preprocessVoteSummary?.top?.digit)
    const share = Number(prediction?.preprocessVoteSummary?.top?.share || 0)
    if (selected === Number(current[index]) && majority === selected && share >= CONSENSUS_BROWSER_MAJORITY_SHARE) {
      byIndex.set(index, true)
    }
  }
  return [...current].every((_, index) => byIndex.get(index) === true)
}

/**
 * Experimental, key-blind automatic-promotion gate. Truth and answer-key
 * values are intentionally absent from every decision. They may be present in
 * the caller's object, but are ignored and never copied into evidence.
 */
export function consensusPromotionDecision({
  currentRead = '',
  currentAutomatic = false,
  currentPredictions = [],
  confidenceSafetyVetoed = false,
  sequenceFrameConsensus = null,
  compactReads = [],
  slotCount = null,
  ambiguityDetected = false,
  ambiguity = null,
} = {}) {
  const current = normalizeTranscription(currentRead)
  if (currentAutomatic) return review('already-automatic-not-a-promotion-candidate', { currentRead: current })
  if (confidenceSafetyVetoed) return review('confidence-safety-veto-dominates')
  if (!exactThreeFrameConsensus(sequenceFrameConsensus)) return review('insufficient-three-frame-consensus')

  const proposed = normalizeTranscription(sequenceFrameConsensus?.text ?? sequenceFrameConsensus?.read)
  const ambiguityReasons = Array.isArray(ambiguity?.reasons) ? ambiguity.reasons : []
  const unconditionalAmbiguity = ambiguityReasons.some((item) =>
    item?.reason === 'model-families-disagree' || item?.reason === 'answer-ink-may-be-clipped')
  const echoedOverrideAmbiguity = proposed === current && ambiguityReasons.some((item) =>
    item?.reason === 'override-retained-material-rival')
  if ((ambiguityDetected && !ambiguity) || unconditionalAmbiguity || echoedOverrideAmbiguity) {
    return review('handwriting-ambiguity-detected', {
      currentRead: current,
      proposedRead: proposed,
      ambiguityReasons: ambiguityReasons.map((item) => item.reason),
    })
  }
  if (!slotCompatible(proposed, slotCount)) {
    return review('answer-length-exceeds-slot-metadata', { proposedRead: proposed, slotCount: Number(slotCount) })
  }

  const compactChoices = compactReviewCandidates(compactReads, { limit: CONSENSUS_COMPACT_LIMIT })
  const compactRankIndex = compactChoices.findIndex((choice) => choice.text === proposed)
  if (compactRankIndex < 0) {
    return review('whole-answer-compact-model-does-not-support-consensus', {
      proposedRead: proposed,
      compactChoices: compactChoices.map((choice) => choice.text),
    })
  }

  const compactChoice = compactChoices[compactRankIndex]
  const joint = Number(compactChoice?.bestJointProbability || 0)
  if (joint < CONSENSUS_MIN_COMPACT_JOINT_PROBABILITY) {
    return review('whole-answer-compact-support-too-weak', {
      proposedRead: proposed,
      compactRank: compactRankIndex + 1,
      compactJointProbability: joint,
    })
  }

  const topJoint = Number(compactChoices[0]?.bestJointProbability || 0)
  const relativeSupport = topJoint > 0 ? joint / topJoint : 0
  if (compactRankIndex > 0 && relativeSupport < CONSENSUS_MIN_SECOND_TO_FIRST_RATIO) {
    return review('second-choice-compact-support-too-weak', {
      proposedRead: proposed,
      compactRank: compactRankIndex + 1,
      compactJointProbability: joint,
      compactTopJointProbability: topJoint,
      compactRelativeSupport: relativeSupport,
    })
  }

  if (browserHasStableConflictingEvidence(current, proposed, currentPredictions)) {
    return review('browser-preprocessing-stably-conflicts', { currentRead: current, proposedRead: proposed })
  }

  return automatic(proposed, {
    proposedRead: proposed,
    slotCount: Number(slotCount),
    agreeingFrames: CONSENSUS_REQUIRED_FRAMES,
    minFrameConfidence: Number(sequenceFrameConsensus.minConfidence),
    compactRank: compactRankIndex + 1,
    compactJointProbability: joint,
    compactRelativeSupport: relativeSupport,
  })
}
