import { crossFrameConsensus, normalizeTranscription } from '../hybrid-recognition.js'

export const LOCAL_FIRST_REVIEW_POLICY_VERSION = 'local-first-review-shadow-2'
export const LOCAL_FIRST_MAX_VISIBLE_CHOICES = 6
export const LOCAL_FIRST_MAX_COMPACT_CHOICES = 3

function probability(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0
}

function normalizedCandidate(candidate, fallbackRead = '') {
  const text = normalizeTranscription(candidate?.read ?? candidate?.text ?? fallbackRead)
  if (!text) return null
  return {
    text,
    jointProbability: probability(candidate?.jointProbability ?? candidate?.score),
    minComponentProbability: probability(candidate?.minComponentProbability),
  }
}

/**
 * Produce key-blind compact-model review choices from one or more retained
 * frames. These are choices only: no confidence value can make them automatic.
 */
export function compactReviewCandidates(results = [], { limit = LOCAL_FIRST_MAX_COMPACT_CHOICES } = {}) {
  const byText = new Map()
  for (const result of results || []) {
    const frameIndex = Number.isFinite(Number(result?.frameIndex)) ? Number(result.frameIndex) : null
    const candidates = Array.isArray(result?.topCandidates) && result.topCandidates.length
      ? result.topCandidates
      : [{
          read: result?.read,
          jointProbability: result?.meanComponentProbability,
          minComponentProbability: result?.minComponentProbability,
        }]
    for (const raw of candidates) {
      const candidate = normalizedCandidate(raw, result?.read)
      if (!candidate) continue
      if (!byText.has(candidate.text)) {
        byText.set(candidate.text, {
          text: candidate.text,
          source: 'key-blind-compact-model',
          reviewOnly: true,
          bestJointProbability: 0,
          minComponentProbability: 0,
          frameIndices: [],
          frameCount: 0,
        })
      }
      const record = byText.get(candidate.text)
      record.bestJointProbability = Math.max(record.bestJointProbability, candidate.jointProbability)
      record.minComponentProbability = Math.max(record.minComponentProbability, candidate.minComponentProbability)
      if (frameIndex !== null && !record.frameIndices.includes(frameIndex)) record.frameIndices.push(frameIndex)
      record.frameCount = record.frameIndices.length || Math.max(record.frameCount, 1)
    }
  }
  return [...byText.values()]
    .sort((a, b) =>
      b.frameCount - a.frameCount ||
      b.bestJointProbability - a.bestJointProbability ||
      b.minComponentProbability - a.minComponentProbability ||
      a.text.localeCompare(b.text)
    )
    .slice(0, Math.max(0, Number(limit) || 0))
}

export function compactSuggestionsByQuestion(results = [], options = {}) {
  const grouped = new Map()
  for (const result of results || []) {
    const questionNum = Number(result?.questionNum)
    if (!Number.isFinite(questionNum)) continue
    if (!grouped.has(questionNum)) grouped.set(questionNum, [])
    grouped.get(questionNum).push(result)
  }
  return new Map([...grouped.entries()].map(([questionNum, rows]) => [
    questionNum,
    compactReviewCandidates(rows, options),
  ]))
}

export function cellsForReviewText(text, slotCount) {
  const normalized = normalizeTranscription(text)
  const count = Math.max(1, Number(slotCount) || 1)
  if (!normalized || normalized.length > count) return null
  return Array(count - normalized.length).fill(null).concat([...normalized].map(Number))
}

export function localFirstReviewState({
  localChoices = [],
  strongStatus = 'deferred',
  strongChoices = [],
} = {}) {
  const local = (localChoices || []).filter((choice) => normalizeTranscription(choice?.text))
  const strong = (strongChoices || []).filter((choice) => normalizeTranscription(choice?.text))
  return {
    policyVersion: LOCAL_FIRST_REVIEW_POLICY_VERSION,
    localReady: local.length > 0,
    localChoiceCount: local.length,
    strongStatus,
    strongRequested: ['loading', 'complete', 'unavailable'].includes(strongStatus),
    strongChoiceCount: strong.length,
    canRequestStrong: strongStatus === 'deferred',
    answerKeyUsed: false,
    affectsAutomaticGrade: false,
  }
}

export function compactFrameConsensus(results = []) {
  return crossFrameConsensus((results || []).map((result) => ({
    frameIndex: result?.frameIndex,
    read: result?.read,
    confidence: result?.minComponentProbability,
  })))
}
