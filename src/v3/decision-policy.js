function cleanRead(value) {
  if (value == null) return null
  const text = String(value).trim()
  if (text === '' || text.toLowerCase() === 'blank') return ''
  return /^\d{1,4}$/.test(text) ? text : null
}

function probability(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0
}

export const V3_POLICY_VERSION = 'v3-shadow-2026-07-13.1'

/**
 * Key-blind conservative fusion. A recognized answer is accepted only when
 * independent architectures agree; repeated frames from one model do not
 * count as independent evidence.
 */
export function decideV3Answer(input = {}, policy = {}) {
  if ('answerKey' in input || 'expectedAnswer' in input || 'mathematicalAnswer' in input) {
    return { action: 'invalid', reason: 'answer-key-field-rejected', policyVersion: V3_POLICY_VERSION }
  }
  const thresholds = {
    slot: policy.slotConfidence ?? 0.88,
    sequence: policy.sequenceConfidence ?? 0.96,
    compact: policy.compactConfidence ?? 0.92,
    blank: policy.blankConfidence ?? 0.995,
    artifact: policy.maxArtifactProbability ?? 0.08,
  }
  const quality = input.quality || {}
  if (
    quality.usable === false ||
    (policy.enforceArtifactVeto === true && probability(quality.artifactProbability) > thresholds.artifact)
  ) {
    return { action: 'review', read: null, reason: 'unusable-or-artifact-risk', policyVersion: V3_POLICY_VERSION }
  }
  const slotRead = cleanRead(input.slot?.read)
  const sequenceRead = cleanRead(input.sequence?.read)
  const compactRead = cleanRead(input.compact?.read)
  const slotStrong = slotRead !== null && probability(input.slot?.confidence) >= thresholds.slot
  const sequenceStrong = sequenceRead !== null && probability(input.sequence?.confidence) >= thresholds.sequence
  const compactStrong = compactRead !== null && probability(input.compact?.confidence) >= thresholds.compact
  const blankStrong = input.blank?.isBlank === true && probability(input.blank?.confidence) >= thresholds.blank

  if (blankStrong) {
    if (slotStrong && sequenceStrong && slotRead === '' && sequenceRead === '') {
      return { action: 'accept', read: '', reason: 'independent-blank-agreement', policyVersion: V3_POLICY_VERSION }
    }
    return { action: 'review', read: null, reason: 'blank-not-independently-confirmed', policyVersion: V3_POLICY_VERSION }
  }
  const compactClear = policy.requireCompact !== true || (compactStrong && compactRead === slotRead)
  if (slotStrong && sequenceStrong && slotRead && slotRead === sequenceRead && compactClear) {
    return {
      action: 'accept', read: slotRead, reason: 'independent-architecture-agreement', policyVersion: V3_POLICY_VERSION,
      evidence: {
        slotConfidence: probability(input.slot.confidence), sequenceConfidence: probability(input.sequence.confidence),
        ...(policy.requireCompact === true ? { compactConfidence: probability(input.compact?.confidence) } : {}),
      },
    }
  }
  return {
    action: 'review', read: null,
    reason: slotRead !== null && sequenceRead !== null && slotRead !== sequenceRead
      ? 'independent-read-disagreement'
      : policy.requireCompact === true && compactRead !== null && compactRead !== slotRead
        ? 'compact-read-disagreement'
        : 'insufficient-independent-evidence',
    policyVersion: V3_POLICY_VERSION,
  }
}

export function summarizeFrameEvidence(frameAnswers = []) {
  const usable = frameAnswers.filter((frame) => frame?.quality?.usable !== false)
  const reads = new Map()
  for (const frame of usable) {
    const read = cleanRead(frame?.read)
    if (read === null) continue
    if (!reads.has(read)) reads.set(read, [])
    reads.get(read).push(frame)
  }
  const ranked = [...reads.entries()].sort((a, b) => b[1].length - a[1].length)
  const [read, frames] = ranked[0] || [null, []]
  return {
    read,
    agreeingFrames: frames.length,
    usableFrames: usable.length,
    unanimous: usable.length >= 2 && frames.length === usable.length,
    note: 'Frame repetition is correlated evidence and never substitutes for architecture agreement.',
  }
}
