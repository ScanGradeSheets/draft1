import { browserLocalCascadeDecision } from './browser-local-cascade.js'

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

function reader(value) {
  return {
    read: digits(value?.text ?? value?.read),
    probability: Number(
      value?.minTokenProbability ??
      value?.sequenceProbability ??
      value?.probability ??
      0,
    ),
  }
}

function containsForbiddenField(value) {
  if (!value || typeof value !== 'object') return false
  return FORBIDDEN_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(value, field))
}

/**
 * Research-only pre-acceptance coordinator.
 *
 * The frozen zero-known-error control is evaluated first, but neither its
 * result nor the whole-answer proposal has been shown to the user yet. An
 * existing control automatic is preserved. A control yellow may be accepted
 * from the larger grayscale reader only after the explicit key-blind vetoes
 * below. Nothing in this boundary may carry an answer key or handwriting truth.
 */
export function browserLocalCoPrimaryDecision(input = {}) {
  if (
    containsForbiddenField(input) ||
    containsForbiddenField(input.controlDecision) ||
    containsForbiddenField(input.browser) ||
    containsForbiddenField(input.stitched) ||
    containsForbiddenField(input.continuous) ||
    containsForbiddenField(input.scout) ||
    containsForbiddenField(input.uniform) ||
    containsForbiddenField(input.frame)
  ) {
    return {
      automatic: false,
      read: digits(input.controlDecision?.read ?? input.browser?.read),
      reason: 'answer-key-shaped-field-rejected',
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  const controlRead = digits(input.controlDecision?.read)
  if (input.controlDecision?.automatic === true && controlRead) {
    return {
      automatic: true,
      read: controlRead,
      reason: 'preserve-frozen-control-automatic',
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  const browser = reader(input.browser)
  const stitched = reader(input.stitched)
  const continuous = reader(input.continuous)
  const scout = reader(input.scout)
  const uniform = reader(input.uniform)
  const frame = reader(input.frame)
  const routeReasons = Array.isArray(input.routeReasons)
    ? input.routeReasons.map(String)
    : []

  if (input.blockingSafetyVeto === true) {
    return {
      automatic: false,
      read: controlRead || browser.read,
      reason: 'blocking-safety-veto',
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  const proposal = browserLocalCascadeDecision({
    currentAutomatic: false,
    currentRead: browser.read || controlRead,
    stitched,
    continuous,
    scout,
    layoutId: input.layoutId,
    optionalSlotIndices: input.optionalSlotIndices,
  })

  if (!proposal.automatic) {
    return {
      ...proposal,
      preAcceptance: true,
      changedAcceptedRead: false,
    }
  }

  // Candidate 1 vetoes are deliberately structural/evidence-only. They were
  // motivated by observed failure families and therefore remain retrospective
  // until a future packet falsifies them.
  const weakPrimaryProposal = stitched.probability < 0.9
  const unresolvedPlaceValueOneFour =
    routeReasons.includes('place-value-leading-one-has-four-rival')
  const unresolvedHighSupportConflict =
    routeReasons.includes('high-support-scout-conflict') &&
    stitched.read !== continuous.read
  const unresolvedHighRiskMismatch =
    input.highRiskMismatchReview === true &&
    (
      stitched.read !== continuous.read ||
      scout.read !== stitched.read ||
      input.layoutId === 'sg-g1-lw-09-number-patterns'
    )

  const vetoReason = weakPrimaryProposal
    ? 'weak-whole-answer-proposal'
    : unresolvedPlaceValueOneFour
      ? 'unresolved-place-value-one-four'
      : unresolvedHighSupportConflict
        ? 'unresolved-high-support-conflict'
        : unresolvedHighRiskMismatch
          ? 'unresolved-high-risk-mismatch'
          : ''

  // A vetoed proposal can be restored only by stable whole-answer agreement
  // across multiple preserved grayscale views. Stitched and continuous must
  // independently agree at >= 0.90, and either the uniform crop or a stable
  // three-frame consensus must corroborate the same complete answer. This
  // lane never overrides an explicit blocking safety veto.
  const stableWholeAnswerConsensus =
    stitched.read &&
    stitched.read === proposal.read &&
    stitched.read === continuous.read &&
    stitched.probability >= 0.9 &&
    continuous.probability >= 0.9 &&
    (
      uniform.read === stitched.read ||
      (
        input.frame?.threeOfThree === true &&
        frame.read === stitched.read
      )
    )

  if (vetoReason && stableWholeAnswerConsensus) {
    return {
      automatic: true,
      read: proposal.read,
      reason: `co-primary-multiview-consensus-after-${vetoReason}`,
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  if (vetoReason) {
    return {
      automatic: false,
      read: controlRead || browser.read,
      proposedRead: proposal.read,
      reason: vetoReason,
      preAcceptance: true,
      changedAcceptedRead: false,
      answerKeyUsed: false,
    }
  }

  return {
    automatic: true,
    read: proposal.read,
    reason: `co-primary-${proposal.reason}`,
    preAcceptance: true,
    changedAcceptedRead: false,
    answerKeyUsed: false,
  }
}
