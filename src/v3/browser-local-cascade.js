function digits(value) {
  const text = String(value ?? '').trim()
  return /^\d{1,4}$/.test(text) ? text : ''
}

function readerEvidence(value) {
  return {
    read: digits(value?.text ?? value?.read),
    probability: Number(value?.minTokenProbability ?? value?.sequenceProbability ?? value?.probability ?? 0),
  }
}

function terminalZeroNineConflict(left, right) {
  if (left.length < 2 || left.length !== right.length) return false
  if (left.slice(0, -1) !== right.slice(0, -1)) return false
  return new Set([left.at(-1), right.at(-1)]).size === 2 &&
    [left.at(-1), right.at(-1)].every((digit) => digit === '0' || digit === '9')
}

/**
 * Authoritative truth/key-blind decision used by the frozen browser-local
 * research frontier. Accepted browser reads may only be preserved or demoted
 * to review; they are never silently replaced. Existing yellow answers may be
 * promoted only by the explicit local evidence rules below.
 */
export function browserLocalCascadeDecision(input = {}) {
  if (
    'answerKey' in input ||
    'correctAnswer' in input ||
    'truth' in input ||
    'truthText' in input ||
    'mathematicalCorrectness' in input
  ) {
    return {
      automatic: false,
      read: digits(input.currentRead),
      reason: 'answer-key-shaped-field-rejected',
      changedExistingAutomaticRead: false,
      stitchedReaderCalls: 0,
      continuousReaderCalls: 0,
      answerKeyUsed: false,
    }
  }

  const browserRead = digits(input.currentRead)
  const stitched = readerEvidence(input.stitched)
  const continuous = readerEvidence(input.continuous)
  const scout = readerEvidence(input.scout)
  const routeReasons = Array.isArray(input.routeReasons)
    ? input.routeReasons.map(String)
    : []

  if (!browserRead) {
    return {
      automatic: false,
      read: '',
      reason: 'invalid-browser-read',
      changedExistingAutomaticRead: false,
      stitchedReaderCalls: 0,
      continuousReaderCalls: 0,
      answerKeyUsed: false,
    }
  }

  if (input.currentAutomatic === true) {
    const routeToStrongReader =
      (scout.read && scout.read !== browserRead) ||
      browserRead === '11' ||
      routeReasons.includes('place-value-leading-one-has-four-rival') ||
      input.highRiskMismatchReview === true
    if (!routeToStrongReader) {
      return {
        automatic: true,
        read: browserRead,
        reason: 'no-suspicious-accepted-answer-signal',
        changedExistingAutomaticRead: false,
        stitchedReaderCalls: 0,
        continuousReaderCalls: 0,
        answerKeyUsed: false,
      }
    }

    const unresolvedRepeatedOne =
      browserRead === '11' &&
      stitched.probability < 0.90
    const unresolvedPlaceValueOneFour =
      routeReasons.includes('place-value-leading-one-has-four-rival')
    const unresolvedTerminalZeroNine =
      input.highRiskMismatchReview === true &&
      terminalZeroNineConflict(browserRead, scout.read)
    const unresolvedNumberPatternScoutConflict =
      input.highRiskMismatchReview === true &&
      input.layoutId === 'sg-g1-lw-09-number-patterns' &&
      Boolean(scout.read) &&
      scout.read !== browserRead
    const optionalSlotIndices = Array.isArray(input.optionalSlotIndices)
      ? input.optionalSlotIndices.map(Number)
      : []
    const unresolvedOptionalLeadingOne =
      optionalSlotIndices.includes(0) &&
      browserRead.startsWith('1') &&
      browserRead.length === scout.read.length + 1 &&
      browserRead.slice(1) === scout.read
    const stitchedAgreement = browserRead === stitched.read
    const needsContinuous =
      !unresolvedRepeatedOne &&
      !unresolvedPlaceValueOneFour &&
      !unresolvedTerminalZeroNine &&
      !unresolvedNumberPatternScoutConflict &&
      !unresolvedOptionalLeadingOne &&
      !stitchedAgreement
    const continuousAgreement =
      needsContinuous && browserRead === continuous.read
    const automatic =
      !unresolvedRepeatedOne &&
      !unresolvedPlaceValueOneFour &&
      !unresolvedTerminalZeroNine &&
      !unresolvedNumberPatternScoutConflict &&
      !unresolvedOptionalLeadingOne &&
      (stitchedAgreement || continuousAgreement)
    return {
      automatic,
      read: browserRead,
      reason: automatic
        ? 'browser-agrees-with-local-independent-view'
        : unresolvedRepeatedOne
          ? 'unresolved-repeated-one'
          : unresolvedPlaceValueOneFour
            ? 'unresolved-place-value-one-four'
            : unresolvedTerminalZeroNine
              ? 'unresolved-terminal-zero-nine'
              : unresolvedNumberPatternScoutConflict
                ? 'unresolved-number-pattern-scout-conflict'
                : unresolvedOptionalLeadingOne
                  ? 'unresolved-optional-leading-one'
            : continuousAgreement
              ? 'browser-agrees-with-continuous-fallback'
              : stitchedAgreement
                ? 'browser-agrees-with-local-independent-view'
                : 'local-reader-disagrees-with-browser',
      changedExistingAutomaticRead: false,
      stitchedReaderCalls: 1,
      continuousReaderCalls: needsContinuous ? 1 : 0,
      answerKeyUsed: false,
    }
  }

  const scoutAgreement = stitched.read && stitched.read === scout.read
  const highConfidenceStitched = stitched.read && stitched.probability >= 0.98
  const numberBondNeedsUniform =
    input.layoutId === 'sg-g1-lw-08-number-bonds' &&
    stitched.read === '5'
  const needsContinuous =
    numberBondNeedsUniform || (!scoutAgreement && !highConfidenceStitched)
  const twoViewAgreement =
    needsContinuous &&
    stitched.read &&
    stitched.read === continuous.read &&
    continuous.probability >= 0.50
  const automatic = !numberBondNeedsUniform &&
    Boolean(twoViewAgreement || scoutAgreement || highConfidenceStitched)
  return {
    automatic,
    read: automatic ? stitched.read : browserRead,
    reason: numberBondNeedsUniform
      ? 'number-bond-requires-uniform-consensus'
      : twoViewAgreement
      ? 'two-local-views-agree'
      : scoutAgreement
        ? 'local-model-and-scout-agree'
        : highConfidenceStitched
          ? 'near-certain-local-stitched-read'
          : 'insufficient-local-agreement',
    changedExistingAutomaticRead: false,
    stitchedReaderCalls: 1,
    continuousReaderCalls: needsContinuous ? 1 : 0,
    answerKeyUsed: false,
  }
}
