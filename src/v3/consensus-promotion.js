import { normalizeTranscription } from '../hybrid-recognition.js'
import { compactReviewCandidates } from './local-first-review.js'

export const CONSENSUS_PROMOTION_POLICY_VERSION = 'consensus-promotion-shadow-3'
export const CONSENSUS_REQUIRED_FRAMES = 3
export const CONSENSUS_MIN_FRAME_CONFIDENCE = 0.70
export const CONSENSUS_COMPACT_LIMIT = 2
export const CONSENSUS_MIN_COMPACT_JOINT_PROBABILITY = 0.05
export const CONSENSUS_MIN_SECOND_TO_FIRST_RATIO = 0.25
export const CONSENSUS_BROWSER_MAJORITY_SHARE = 0.85
export const CONSENSUS_BROWSER_SECONDARY_MIN_FRAME_CONFIDENCE = 0.98
export const CONSENSUS_BROWSER_SECONDARY_LIMIT = 2
export const CONSENSUS_BROWSER_SECONDARY_MIN_PROBABILITY = 0.05
export const CONSENSUS_REQUIRED_CORE_CROPS = 3
export const CONSENSUS_NEAR_CERTAIN_COMPACT_CONFLICT = 0.99
export const CORE_CROP_REVIEW_ELIGIBLE_REASONS = new Set([
  'whole-answer-compact-model-does-not-support-consensus',
  'whole-answer-compact-support-too-weak',
  'second-choice-compact-support-too-weak',
  'browser-preprocessing-stably-conflicts',
])
export const CONSENSUS_REVIEW_VETO_REASONS = new Set([
  'confidence-safety-veto-dominates',
  'handwriting-ambiguity-detected',
  'high-risk-browser-and-near-certain-compact-conflict',
])

export function coreCropReviewEligibleQuestionNums(decisions = []) {
  return decisions
    .filter((decision) =>
      CORE_CROP_REVIEW_ELIGIBLE_REASONS.has(decision?.reason) &&
      decision?.ambiguity?.detected !== true)
    .map((decision) => Number(decision?.questionNum))
    .filter(Number.isFinite)
}

/**
 * Questions whose displayed browser transcription must remain yellow. This is
 * deliberately key-blind: either a promotion safety rule fired, or the two
 * independent whole-answer readers agree with each other and disagree with
 * the browser. Weak frame stability may prevent auto-correction, but it must
 * not turn that known transcription dispute into a confident red math mark.
 */
export function consensusReviewVetoQuestionNums({ shadowDecisions = [], promotionDecisions = [] } = {}) {
  const questions = new Set()
  const successfullyPromoted = new Set((promotionDecisions || [])
    .filter((decision) => decision?.promote === true)
    .map((decision) => Number(decision?.questionNum))
    .filter(Number.isFinite))
  for (const decision of shadowDecisions || []) {
    const questionNum = Number(decision?.questionNum)
    // A successful promotion already passed the full consensus policy. Do not
    // re-yellow it merely because the same independent evidence disagreed with
    // the original browser read; that conflict is why the promotion exists.
    if (successfullyPromoted.has(questionNum)) continue
    const slot = normalizeTranscription(decision?.slotRead)
    const sequence = normalizeTranscription(decision?.sequenceRead)
    const compact = normalizeTranscription(decision?.compactRead)
    if (
      slot && sequence && compact &&
      sequence === compact && sequence !== slot
    ) questions.add(questionNum)
  }
  for (const decision of promotionDecisions || []) {
    if (decision?.promote !== true && CONSENSUS_REVIEW_VETO_REASONS.has(decision?.reason)) {
      questions.add(Number(decision.questionNum))
    }
  }
  return [...questions].filter(Number.isFinite).sort((a, b) => a - b)
}

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

function automatic(text, evidence = {}, reason = 'independent-three-frame-and-compact-consensus') {
  return {
    policyVersion: CONSENSUS_PROMOTION_POLICY_VERSION,
    promote: true,
    automaticText: text,
    requiresTeacherReview: false,
    reason,
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

function exactCoreCropConsensus(consensus) {
  const text = normalizeTranscription(consensus?.text ?? consensus?.read)
  const count = Number(consensus?.count ?? consensus?.agreeingFrames)
  const usable = Number(consensus?.usableFrameCount ?? consensus?.usableCrops)
  const confidence = Number(consensus?.minConfidence)
  return Boolean(
    text &&
    consensus?.tied !== true &&
    count === CONSENSUS_REQUIRED_CORE_CROPS &&
    usable === CONSENSUS_REQUIRED_CORE_CROPS &&
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
 * Independent fallback evidence for cases where the compact 28x28 model loses
 * information visible in the larger grayscale crop. Every proposed character
 * must still appear in the browser model's own top two probabilities. Short
 * reads are right-aligned because a leading physical slot may be empty.
 */
export function browserSupportsProposedRead(proposedRead, predictions = []) {
  const proposed = normalizeTranscription(proposedRead)
  const ordered = [...(predictions || [])]
    .filter((prediction) => Number.isInteger(Number(prediction?.digitIndex)))
    .sort((a, b) => Number(a.digitIndex) - Number(b.digitIndex))
  if (!proposed || proposed.length > ordered.length) return false
  const aligned = ordered.slice(-proposed.length)
  return [...proposed].every((character, index) => {
    const probabilities = Array.isArray(aligned[index]?.probs) ? aligned[index].probs : []
    const choices = probabilities
      .map((probability, digit) => ({ digit, probability: Number(probability || 0) }))
      .sort((a, b) => b.probability - a.probability)
      .slice(0, CONSENSUS_BROWSER_SECONDARY_LIMIT)
    return choices.some((choice) =>
      choice.digit === Number(character) && choice.probability >= CONSENSUS_BROWSER_SECONDARY_MIN_PROBABILITY)
  })
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
  alternateSequenceFrameConsensus = null,
  coreCropConsensus = null,
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
  const alternateProposed = normalizeTranscription(
    alternateSequenceFrameConsensus?.text ?? alternateSequenceFrameConsensus?.read
  )
  const coreCropProposed = normalizeTranscription(coreCropConsensus?.text ?? coreCropConsensus?.read)
  const spatiallyStable = exactThreeFrameConsensus(alternateSequenceFrameConsensus) && alternateProposed === proposed
  // Repeated views from one model may replace weak compact support, but they
  // must never weaken an existing handwriting-ambiguity signal.
  const coreCropStable = exactCoreCropConsensus(coreCropConsensus) && coreCropProposed === proposed &&
    ambiguityDetected !== true && ambiguity?.detected !== true
  const ambiguityReasons = Array.isArray(ambiguity?.reasons) ? ambiguity.reasons : []
  const unconditionalAmbiguity = ambiguityReasons.some((item) =>
    item?.reason === 'model-families-disagree' ||
      item?.reason === 'answer-ink-may-be-clipped' ||
      item?.reason === 'override-retained-material-rival')
  if ((ambiguityDetected && !ambiguity) || unconditionalAmbiguity) {
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
  const compactTopChoice = compactChoices[0] || null
  const highRiskBrowserDisagreement = (currentPredictions || []).some((prediction) =>
    prediction?.highRiskPreprocessReview === true && prediction?.preprocessDisagreement === true)
  // P05's 17 -> 12 failure survived repeated grayscale crops, but the browser
  // itself marked the affected slot high-risk and the independent compact
  // whole-answer reader was nearly certain it was 17. That combination is a
  // veto, not another candidate-selection vote. It is intentionally narrower
  // than blocking all model-family disagreement, which would discard many
  // prospectively correct promotions.
  if (
    compactRankIndex < 0 &&
    highRiskBrowserDisagreement &&
    Number(compactTopChoice?.minComponentProbability || 0) >= CONSENSUS_NEAR_CERTAIN_COMPACT_CONFLICT
  ) {
    return review('high-risk-browser-and-near-certain-compact-conflict', {
      proposedRead: proposed,
      compactRead: compactTopChoice?.text || null,
      compactMinComponentProbability: Number(compactTopChoice?.minComponentProbability || 0),
    })
  }
  const browserSecondarySupport = Number(sequenceFrameConsensus?.minConfidence || 0) >= CONSENSUS_BROWSER_SECONDARY_MIN_FRAME_CONFIDENCE &&
    browserSupportsProposedRead(proposed, currentPredictions)
  if (compactRankIndex < 0 && !browserSecondarySupport && !spatiallyStable && !coreCropStable) {
    return review('whole-answer-compact-model-does-not-support-consensus', {
      proposedRead: proposed,
      compactChoices: compactChoices.map((choice) => choice.text),
    })
  }

  const compactChoice = compactRankIndex >= 0 ? compactChoices[compactRankIndex] : null
  const joint = Number(compactChoice?.bestJointProbability || 0)
  if (joint < CONSENSUS_MIN_COMPACT_JOINT_PROBABILITY && !browserSecondarySupport && !spatiallyStable && !coreCropStable) {
    return review('whole-answer-compact-support-too-weak', {
      proposedRead: proposed,
      compactRank: compactRankIndex + 1,
      compactJointProbability: joint,
    })
  }

  const topJoint = Number(compactChoices[0]?.bestJointProbability || 0)
  const relativeSupport = topJoint > 0 ? joint / topJoint : 0
  if (compactRankIndex > 0 && relativeSupport < CONSENSUS_MIN_SECOND_TO_FIRST_RATIO && !browserSecondarySupport && !spatiallyStable && !coreCropStable) {
    return review('second-choice-compact-support-too-weak', {
      proposedRead: proposed,
      compactRank: compactRankIndex + 1,
      compactJointProbability: joint,
      compactTopJointProbability: topJoint,
      compactRelativeSupport: relativeSupport,
    })
  }

  const stableBrowserConflict = browserHasStableConflictingEvidence(current, proposed, currentPredictions)
  if (stableBrowserConflict && !browserSecondarySupport && !coreCropStable) {
    return review('browser-preprocessing-stably-conflicts', { currentRead: current, proposedRead: proposed })
  }

  const compactFullySupported = compactRankIndex >= 0 &&
    joint >= CONSENSUS_MIN_COMPACT_JOINT_PROBABILITY &&
    (compactRankIndex === 0 || relativeSupport >= CONSENSUS_MIN_SECOND_TO_FIRST_RATIO)
  const usedSpatialStability = spatiallyStable && !compactFullySupported
  const usedCoreCropStability = !usedSpatialStability && coreCropStable && (!compactFullySupported || stableBrowserConflict)
  const usedBrowserSecondary = !usedSpatialStability && !usedCoreCropStability &&
    browserSecondarySupport && (!compactFullySupported || stableBrowserConflict)

  return automatic(proposed, {
    proposedRead: proposed,
    slotCount: Number(slotCount),
    agreeingFrames: CONSENSUS_REQUIRED_FRAMES,
    minFrameConfidence: Number(sequenceFrameConsensus.minConfidence),
    compactRank: compactRankIndex >= 0 ? compactRankIndex + 1 : null,
    compactJointProbability: joint,
    compactRelativeSupport: relativeSupport,
    alternateAgreeingFrames: spatiallyStable ? CONSENSUS_REQUIRED_FRAMES : null,
    alternateMinFrameConfidence: spatiallyStable ? Number(alternateSequenceFrameConsensus.minConfidence) : null,
    coreCropAgreeingReads: coreCropStable ? CONSENSUS_REQUIRED_CORE_CROPS : null,
    coreCropMinConfidence: coreCropStable ? Number(coreCropConsensus.minConfidence) : null,
    supportSource: usedSpatialStability
      ? 'six-read-two-crop-grayscale-stability'
      : usedCoreCropStability ? 'three-frame-plus-selected-three-crop-grayscale-stability'
      : usedBrowserSecondary ? 'three-frame-grayscale-plus-browser-top-two' : 'three-frame-grayscale-plus-compact',
  }, usedSpatialStability
    ? 'two-crop-six-read-grayscale-consensus'
    : usedCoreCropStability
      ? 'three-frame-plus-selected-three-crop-grayscale-consensus'
    : usedBrowserSecondary
      ? 'independent-three-frame-and-browser-secondary-consensus'
      : 'independent-three-frame-and-compact-consensus')
}
