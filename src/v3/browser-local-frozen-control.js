import { evaluateUniformLocalConsensus } from './uniform-local-consensus.js'

const FORBIDDEN_FIELDS = [
  'answerKey',
  'correctAnswer',
  'truth',
  'truthText',
  'mathematicalCorrectness',
  'teacherCorrection',
]

function digits(value) {
  const text = String(value ?? '').trim()
  return /^\d{1,4}$/.test(text) ? text : ''
}

function containsForbiddenField(value) {
  if (!value || typeof value !== 'object') return false
  return FORBIDDEN_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(value, field))
}

/**
 * Production-shaped form of the frozen 267/345 zero-known-error control.
 *
 * It starts with the strict local candidate. Only answers that were already
 * yellow in the frozen browser predecessor may clear through the correlated
 * uniform/frame lanes. This module is key-blind and runs before presentation.
 */
export function browserLocalFrozenControlDecision(input = {}) {
  if (
    containsForbiddenField(input) ||
    containsForbiddenField(input.candidateDecision) ||
    containsForbiddenField(input.stitched) ||
    containsForbiddenField(input.continuous) ||
    containsForbiddenField(input.uniform) ||
    containsForbiddenField(input.frame)
  ) {
    return {
      automatic: false,
      read: digits(input.candidateDecision?.read ?? input.browserRead),
      reason: 'answer-key-shaped-field-rejected',
      answerKeyUsed: false,
      preAcceptance: true,
    }
  }

  const candidateRead = digits(input.candidateDecision?.read)
  if (input.candidateDecision?.automatic === true && candidateRead) {
    return {
      automatic: true,
      read: candidateRead,
      reason: 'preserve-exact-live-automatic',
      answerKeyUsed: false,
      preAcceptance: true,
    }
  }

  const eligible =
    input.initiallyAutomatic !== true &&
    input.blockingSafetyVeto !== true
  if (!eligible) {
    return {
      automatic: false,
      read: candidateRead || digits(input.browserRead),
      reason: input.blockingSafetyVeto === true
        ? 'blocking-safety-veto'
        : 'no-silent-replacement',
      answerKeyUsed: false,
      preAcceptance: true,
    }
  }

  const uniformComplete =
    input.uniform?.complete === true ||
    input.uniform?.valid === true ||
    Boolean(digits(input.uniform?.text ?? input.uniform?.read))
  const uniformDecision = uniformComplete
    ? evaluateUniformLocalConsensus({
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
        blockingSafetyVeto: false,
      })
    : { automatic: false, reason: 'uniform-unavailable' }

  const frameRead = digits(input.frame?.text ?? input.frame?.read)
  const frameProbability = Number(
    input.frame?.minTokenProbability ??
    input.frame?.sequenceProbability ??
    input.frame?.probability ??
    0,
  )
  const frameDecision =
    input.frame?.available === true &&
    input.frame?.threeOfThree === true &&
    frameRead &&
    frameProbability >= 0.9
      ? {
          automatic: true,
          read: frameRead,
          reason: 'three-frame-unanimous-original-yellow',
        }
      : { automatic: false, reason: 'frame-insufficient' }

  let selected = null
  if (uniformDecision.automatic && frameDecision.automatic) {
    if (uniformDecision.read === frameDecision.read) {
      selected = {
        automatic: true,
        read: uniformDecision.read,
        reason: 'uniform-and-frame-agree-original-yellow',
      }
    }
  } else if (uniformDecision.automatic) {
    selected = uniformDecision
  } else if (frameDecision.automatic) {
    selected = frameDecision
  }

  return {
    automatic: selected?.automatic === true,
    read: selected?.read || candidateRead || digits(input.browserRead),
    reason: selected?.reason || (
      uniformDecision.automatic && frameDecision.automatic
        ? 'uniform-frame-conflict'
        : 'insufficient-consensus'
    ),
    answerKeyUsed: false,
    preAcceptance: true,
  }
}
