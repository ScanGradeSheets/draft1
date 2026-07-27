import { normalizeTranscription } from '../hybrid-recognition.js'

export const WRITER_PROFILE_POLICY_VERSION = 'writer-profile-review-only-1'

/**
 * Creates an in-memory, packet-scoped confirmation. It intentionally stores no
 * student name and grants no automatic-recognition authority.
 */
export function createWriterProfileConfirmation({
  packetScopeId,
  patternId,
  digit,
  teacherConfirmed = false,
} = {}) {
  const text = normalizeTranscription(digit)
  if (!packetScopeId || !patternId || !teacherConfirmed || text.length !== 1) return null
  return {
    policyVersion: WRITER_PROFILE_POLICY_VERSION,
    packetScopeId: String(packetScopeId),
    patternId: String(patternId),
    digit: text,
    teacherConfirmed: true,
    reviewOnly: true,
    automaticAuthority: false,
  }
}

/**
 * Reorders a yellow-answer suggestion only when a teacher-confirmed pattern
 * and a key-blind recognizer candidate agree inside the same packet scope.
 */
export function writerProfileReviewSuggestion({
  confirmation = null,
  packetScopeId = '',
  detectedPatternId = '',
  candidateRead = '',
  reviewNeeded = true,
} = {}) {
  const candidate = normalizeTranscription(candidateRead)
  if (
    reviewNeeded !== true ||
    confirmation?.teacherConfirmed !== true ||
    confirmation?.reviewOnly !== true ||
    confirmation?.automaticAuthority !== false ||
    String(confirmation?.packetScopeId || '') !== String(packetScopeId || '') ||
    String(confirmation?.patternId || '') !== String(detectedPatternId || '') ||
    candidate !== confirmation?.digit
  ) return null
  return {
    policyVersion: WRITER_PROFILE_POLICY_VERSION,
    text: candidate,
    source: 'teacher-confirmed-packet-writer-profile',
    reviewOnly: true,
    automatic: false,
    requiresTeacherConfirmation: true,
    answerKeyUsed: false,
  }
}
