import { normalizeTranscription } from '../hybrid-recognition.js'

export const ACCEPTED_ANSWER_SAFETY_POLICY_VERSION = 'accepted-answer-safety-shadow-2'
export const ACCEPTED_ANSWER_SCOUT_MIN_PROBABILITY = 0.90
export const ACCEPTED_ANSWER_SIX_EIGHT_SCOUT_MIN_PROBABILITY = 0.90
export const ACCEPTED_ANSWER_SECOND_CHOICE_MIN_PROBABILITY = 0.18
export const ACCEPTED_ANSWER_STRONG_HIGH_CONFIDENCE = 0.97
export const ACCEPTED_ANSWER_PLACE_VALUE_FOUR_RIVAL_MIN_PROBABILITY = 0.005

const digits = (value) => normalizeTranscription(value)

function topKProbabilityForDigit(prediction, digit) {
  const item = (prediction?.topK || []).find((candidate) =>
    Number(candidate?.digit) === Number(digit))
  return Number(item?.confidence || 0)
}

function maxSecondChoiceProbability(predictions = []) {
  return Math.max(0, ...predictions.map((prediction) =>
    Number(prediction?.topK?.[1]?.confidence || 0)))
}

/**
 * Key-blind routing only. A true result means an accepted browser read merits
 * an independent second-reader check; it does not itself make the answer
 * yellow. Truth and answer-key fields supplied by a caller are ignored.
 */
export function acceptedAnswerSafetyRoute({
  currentAutomatic = false,
  currentRead = null,
  predictions = [],
  scout = null,
  slotCount = null,
  layoutId = '',
  policyScope = 'full',
} = {}) {
  const browserRead = digits(currentRead)
  if (!currentAutomatic || !browserRead) {
    return {
      policyVersion: ACCEPTED_ANSWER_SAFETY_POLICY_VERSION,
      route: false,
      reason: 'not-an-accepted-browser-read',
      answerKeyUsed: false,
    }
  }

  const reasons = []
  if (predictions.some((prediction) =>
    prediction?.preprocessDisagreement === true ||
    prediction?.highRiskPreprocessReview === true)) {
    reasons.push('browser-preprocessing-risk')
  }

  const scoutRead = digits(scout?.text ?? scout?.read)
  const scoutProbability = Number(scout?.probability ?? scout?.sequenceProbability ?? 0)
  const sixEightScoutConflict = (
    Number(slotCount) === 1 &&
    (
      (browserRead === '6' && scoutRead === '8') ||
      (browserRead === '8' && scoutRead === '6')
    ) &&
    scoutProbability >= ACCEPTED_ANSWER_SIX_EIGHT_SCOUT_MIN_PROBABILITY
  )
  // A live prospective failure showed a clearly written single-slot 7 being
  // confidently accepted as 1. Until a representative 1/7 corpus supports a
  // narrower shape rule, preserve every isolated browser read of 1 but require
  // teacher review. This is transcription-only and never sees the answer key.
  const singleDigitOneRequiresReview = (
    Number(slotCount) === 1 && browserRead === '1'
  )
  if (policyScope === 'six-eight-only') {
    const publicSafetyConflict = sixEightScoutConflict || singleDigitOneRequiresReview
    const reason = singleDigitOneRequiresReview
      ? 'single-digit-one-seven-ambiguity'
      : sixEightScoutConflict
        ? 'single-digit-six-eight-high-support-scout-conflict'
        : 'no-public-critical-conflict'
    return {
      policyVersion: ACCEPTED_ANSWER_SAFETY_POLICY_VERSION,
      route: publicSafetyConflict,
      reason,
      reasons: publicSafetyConflict ? [reason] : [],
      answerKeyUsed: false,
      evidence: {
        browserRead,
        scoutRead,
        scoutProbability,
        slotCount: Number(slotCount) || null,
        singleDigitOneRequiresReview,
      },
    }
  }
  if (
    scoutRead &&
    scoutRead !== browserRead &&
    scoutProbability >= ACCEPTED_ANSWER_SCOUT_MIN_PROBABILITY
  ) reasons.push('high-support-scout-conflict')

  // Repeated 1s are a known Grade 1/2 ambiguity: open 4s, narrow 6s, and
  // overwritten digits can collapse to a pair of vertical strokes.
  if (browserRead === '11') reasons.push('repeated-one-shape')

  const secondChoiceProbability = maxSecondChoiceProbability(predictions)
  if (
    secondChoiceProbability >= ACCEPTED_ANSWER_SECOND_CHOICE_MIN_PROBABILITY &&
    predictions.some((prediction) =>
      prediction?.confidencePolicyCleared === true ||
      Boolean(prediction?.robustOverride))
  ) reasons.push('accepted-override-retains-material-rival')

  const leading = predictions
    .slice()
    .sort((a, b) => Number(a?.digitIndex || 0) - Number(b?.digitIndex || 0))[0]
  if (
    String(layoutId || '').includes('place-value') &&
    browserRead.startsWith('1') &&
    topKProbabilityForDigit(leading, 4) >= ACCEPTED_ANSWER_PLACE_VALUE_FOUR_RIVAL_MIN_PROBABILITY
  ) reasons.push('place-value-leading-one-has-four-rival')

  return {
    policyVersion: ACCEPTED_ANSWER_SAFETY_POLICY_VERSION,
    route: reasons.length > 0,
    reason: reasons[0] || 'no-suspicious-accepted-answer-signal',
    reasons,
    answerKeyUsed: false,
    evidence: {
      browserRead,
      scoutRead,
      scoutProbability,
      maxSecondChoiceProbability: secondChoiceProbability,
    },
  }
}

function validForSlots(read, slotCount) {
  const text = digits(read)
  const slots = Number(slotCount)
  return Boolean(text && Number.isInteger(slots) && slots > 0 && text.length <= slots)
}

/**
 * Key-blind safety decision for a routed, already-accepted answer. It never
 * auto-corrects the browser read. It can only preserve that read or force
 * teacher review when independent recognition evidence materially conflicts.
 */
export function acceptedAnswerSafetyDecision({
  routed = false,
  currentRead = null,
  continuous = null,
  stitched = null,
  scout = null,
  predictions = [],
  slotCount = null,
  layoutId = '',
  policyScope = 'full',
} = {}) {
  const browserRead = digits(currentRead)
  if (!routed || !browserRead) {
    return {
      policyVersion: ACCEPTED_ANSWER_SAFETY_POLICY_VERSION,
      veto: false,
      requiresTeacherReview: false,
      reason: 'not-routed',
      answerKeyUsed: false,
    }
  }

  const continuousRead = digits(continuous?.text ?? continuous?.read)
  const stitchedRead = digits(stitched?.text ?? stitched?.read)
  const scoutRead = digits(scout?.text ?? scout?.read)
  const scoutProbability = Number(
    scout?.sequenceProbability ?? scout?.probability ?? 0)
  const continuousProbability = Number(
    continuous?.minTokenProbability ?? continuous?.probability ?? 0)
  const browserPreprocessingRisk = predictions.some((prediction) =>
    prediction?.preprocessDisagreement === true ||
    prediction?.highRiskPreprocessReview === true)
  const independentPairAgreement = Boolean(
    (continuousRead && continuousRead === stitchedRead) ||
    (continuousRead && continuousRead === scoutRead) ||
    (stitchedRead && stitchedRead === scoutRead))
  const retainsBrowserRead = (read) => Boolean(read && read.includes(browserRead))

  const bothStrongConflict = (
    continuousRead && stitchedRead &&
    continuousRead !== browserRead &&
    stitchedRead !== browserRead &&
    validForSlots(continuousRead, slotCount) &&
    validForSlots(stitchedRead, slotCount) &&
    (continuousRead === stitchedRead || browserRead === '11')
  )
  const allIndependentReadersConflict = (
    continuousRead && stitchedRead && scoutRead &&
    continuousRead !== browserRead &&
    stitchedRead !== browserRead &&
    scoutRead !== browserRead &&
    !retainsBrowserRead(continuousRead) &&
    !retainsBrowserRead(stitchedRead) &&
    !retainsBrowserRead(scoutRead) &&
    (browserPreprocessingRisk || independentPairAgreement)
  )
  const highConfidenceContinuousConflict = (
    continuousRead &&
    continuousRead !== browserRead &&
    validForSlots(continuousRead, slotCount) &&
    continuousProbability >= ACCEPTED_ANSWER_STRONG_HIGH_CONFIDENCE
  )
  const singleDigitSixEightScoutConflict = (
    Number(slotCount) === 1 &&
    (
      (browserRead === '6' && scoutRead === '8') ||
      (browserRead === '8' && scoutRead === '6')
    ) &&
    scoutProbability >= ACCEPTED_ANSWER_SIX_EIGHT_SCOUT_MIN_PROBABILITY
  )
  const singleDigitOneRequiresReview = (
    Number(slotCount) === 1 && browserRead === '1'
  )

  const leading = predictions
    .slice()
    .sort((a, b) => Number(a?.digitIndex || 0) - Number(b?.digitIndex || 0))[0]
  const unanimousSuspiciousOneFour = (
    String(layoutId || '').includes('place-value') &&
    browserRead.startsWith('1') &&
    continuousRead === browserRead &&
    stitchedRead === browserRead &&
    scoutRead === browserRead &&
    topKProbabilityForDigit(leading, 4) >= ACCEPTED_ANSWER_PLACE_VALUE_FOUR_RIVAL_MIN_PROBABILITY
  )

  const reasons = []
  if (policyScope !== 'six-eight-only') {
    if (bothStrongConflict) reasons.push('two-strong-views-conflict-with-browser')
    if (allIndependentReadersConflict) reasons.push('all-independent-readers-conflict-with-browser')
    if (highConfidenceContinuousConflict) reasons.push('near-certain-strong-reader-conflict')
  }
  if (singleDigitSixEightScoutConflict) {
    reasons.push('single-digit-six-eight-high-support-scout-conflict')
  }
  if (singleDigitOneRequiresReview) {
    reasons.push('single-digit-one-seven-ambiguity')
  }
  if (policyScope !== 'six-eight-only' && unanimousSuspiciousOneFour) {
    reasons.push('unresolved-place-value-one-four-ambiguity')
  }

  return {
    policyVersion: ACCEPTED_ANSWER_SAFETY_POLICY_VERSION,
    veto: reasons.length > 0,
    requiresTeacherReview: reasons.length > 0,
    reason: reasons[0] || 'second-reader-does-not-establish-conflict',
    reasons,
    answerKeyUsed: false,
    evidence: {
      browserRead,
      continuousRead,
      stitchedRead,
      scoutRead,
      scoutProbability,
      continuousProbability,
      browserPreprocessingRisk,
      independentPairAgreement,
      slotCount: Number(slotCount) || null,
      singleDigitOneRequiresReview,
    },
  }
}

/**
 * Applies completed safety vetoes to digit predictions. The original digit is
 * deliberately preserved; the only permitted grading change is automatic to
 * teacher review.
 */
export function applyAcceptedAnswerSafetyVetoes(predictions = [], decisions = []) {
  const vetoByQuestion = new Map((decisions || [])
    .filter((item) => item?.decision?.veto === true)
    .map((item) => [Number(item.questionNum), item.decision]))
  if (!vetoByQuestion.size) return { predictions, applied: [] }
  const applied = []
  const updated = (predictions || []).map((prediction) => {
    const questionNum = Number(prediction?.questionNum)
    const decision = vetoByQuestion.get(questionNum)
    if (!decision) return prediction
    if (!applied.some((item) => item.questionNum === questionNum)) {
      applied.push({
        questionNum,
        reason: decision.reason,
        preservedDigits: (predictions || [])
          .filter((item) => Number(item?.questionNum) === questionNum)
          .map((item) => item?.digit ?? null),
      })
    }
    return {
      ...prediction,
      reviewNeeded: true,
      acceptedAnswerSafetyVeto: true,
      reviewReason: prediction?.reviewReason || decision.reason,
    }
  })
  return { predictions: updated, applied }
}
