import { browserLocalCoPrimaryPipelineDecision } from './browser-local-co-primary-pipeline.js'

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
  return String(value?.text ?? value?.read ?? '').trim()
}

function hasCorroboratingRead(values) {
  const seen = new Set()
  for (const value of values.map(read).filter(Boolean)) {
    if (seen.has(value)) return true
    seen.add(value)
  }
  return false
}

/**
 * Staged evidence planner for the frozen Candidate 2 pipeline.
 *
 * The strict candidate, scout, and routed stitched evidence are expected to
 * exist before this planner runs. It requests only the additional evidence
 * needed to settle a still-yellow answer. A returned complete decision is safe
 * to present; an intermediate decision is never presentation authority.
 */
export function browserLocalCoPrimaryEvidencePlan(input = {}) {
  if (containsForbiddenField(input)) {
    return {
      status: 'complete',
      requests: [],
      result: browserLocalCoPrimaryPipelineDecision(input),
      failClosed: true,
    }
  }

  if (
    input.candidateDecision?.automatic !== true &&
    !read(input.stitched)
  ) {
    return {
      status: 'needs-evidence',
      requests: ['stitched'],
      result: null,
      failClosed: false,
    }
  }

  const current = browserLocalCoPrimaryPipelineDecision(input)
  if (
    current.decision.automatic ||
    input.blockingSafetyVeto === true ||
    input.candidateDecision?.automatic === true
  ) {
    return {
      status: 'complete',
      requests: [],
      result: current,
      failClosed: false,
    }
  }

  if (!read(input.continuous)) {
    return {
      status: 'needs-evidence',
      requests: ['continuous'],
      result: null,
      failClosed: false,
    }
  }

  if (!input.uniform || !read(input.uniform)) {
    return {
      status: 'needs-evidence',
      requests: ['uniform'],
      result: null,
      failClosed: false,
    }
  }

  const withUniform = browserLocalCoPrimaryPipelineDecision(input)
  if (withUniform.decision.automatic) {
    return {
      status: 'complete',
      requests: [],
      result: withUniform,
      failClosed: false,
    }
  }

  if (!input.frame || typeof input.frame.available !== 'boolean') {
    const frameCanOnlyCorroborate =
      hasCorroboratingRead([input.stitched, input.continuous, input.uniform]) ||
      input.layoutId === 'sg-g1-lw-08-number-bonds'

    if (!frameCanOnlyCorroborate) {
      return {
        status: 'complete',
        requests: [],
        result: browserLocalCoPrimaryPipelineDecision({
          ...input,
          frame: { available: false, threeOfThree: false },
        }),
        failClosed: false,
      }
    }

    return {
      status: 'needs-evidence',
      requests: ['frame'],
      result: null,
      failClosed: false,
    }
  }

  return {
    status: 'complete',
    requests: [],
    result: browserLocalCoPrimaryPipelineDecision(input),
    failClosed: false,
  }
}
