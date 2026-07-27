function digits(value) {
  const text = String(value ?? '').trim()
  return /^\d{1,4}$/.test(text) ? text : ''
}

function probability(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

/**
 * Research-only, answer-key-blind yellow promotion lane.
 *
 * All inputs are recognizer/image evidence. Mathematical answers, correctness,
 * and handwriting-truth fields are deliberately rejected.
 */
export function evaluateUniformLocalConsensus(input = {}) {
  if (
    'answerKey' in input ||
    'correctAnswer' in input ||
    'truth' in input ||
    'truthText' in input
  ) {
    return { automatic: false, reason: 'answer-key-shaped-field-rejected' }
  }
  if (input.currentAutomatic === true) {
    return { automatic: false, reason: 'yellow-only-lane' }
  }
  if (input.blockingSafetyVeto === true) {
    return { automatic: false, reason: 'blocking-safety-veto' }
  }

  const stitched = digits(input.stitchedRead)
  const continuous = digits(input.continuousRead)
  const uniform = digits(input.uniformRead)
  if (!stitched || !continuous || !uniform) {
    return { automatic: false, reason: 'invalid-or-blank-reader-output' }
  }

  const uniformStrong = probability(input.uniformProbability) >= 0.9
  const continuousStrong = probability(input.continuousProbability) >= 0.9
  if (!uniformStrong || !continuousStrong || uniform !== continuous) {
    return { automatic: false, reason: 'uniform-continuous-agreement-insufficient' }
  }

  if (input.layoutId === 'sg-g1-lw-08-number-bonds') {
    return {
      automatic: true,
      read: uniform,
      reason: 'number-bond-uniform-continuous-high-confidence-agreement',
    }
  }
  if (stitched !== uniform) {
    return { automatic: false, reason: 'stitched-text-disagrees' }
  }
  return {
    automatic: true,
    read: uniform,
    reason: 'uniform-continuous-high-confidence-with-stitched-text-agreement',
  }
}
