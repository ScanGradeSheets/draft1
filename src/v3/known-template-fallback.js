function finiteNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

/**
 * A missing QR must not make a known ScanGrade sheet universally yellow when
 * the printed title and the physical answer-box pattern independently identify
 * the same template. This gate does not inspect handwriting or the answer key.
 */
export function trustedKnownTemplateFallback({
  titleMatch,
  assignments = [],
  expectedBoxCount = 0,
  expectedFrameGroups = [],
} = {}) {
  if (titleMatch?.accepted !== true || !titleMatch?.layoutId) return false
  const score = finiteNumber(titleMatch.score)
  const gap = finiteNumber(titleMatch.gap)
  if (score == null || gap == null || score < 0.28 || gap < 0.018) return false

  const expected = Math.max(1, Number(expectedBoxCount) || 0)
  const mapped = (Array.isArray(assignments) ? assignments : [])
    .filter((assignment) => assignment?.id != null && assignment?.rect)
  if (mapped.length < expected) return false
  if (new Set(mapped.map((assignment) => String(assignment.id))).size < expected) return false

  const validRect = (assignment) => {
    const rect = assignment.rect || {}
    return finiteNumber(rect.x) != null &&
      finiteNumber(rect.y) != null &&
      finiteNumber(rect.w) > 0 &&
      finiteNumber(rect.h) > 0
  }
  const physicallyRegistered = (assignment) => (
    assignment?.rect?.trustedPhysicalDigitBox === true ||
    assignment?.rect?.trustedPhysicalAnswerFrame === true
  )
  if (!mapped.slice(0, expected).every(validRect)) return false
  if (mapped.slice(0, expected).every(physicallyRegistered)) return true

  // Some layouts expose two logical digit slots inside one printed answer
  // frame. Older Safari can preserve the frame registration while only one
  // derived half carries the physical-trust flag. Accept that independent
  // evidence only when every expected logical slot is mapped, each question's
  // slots share the same detected parent frame, and that parent has at least
  // one physically trusted member. This never inspects handwriting or keys.
  const groups = Array.isArray(expectedFrameGroups) ? expectedFrameGroups : []
  if (!groups.length) return false
  const byId = new Map(mapped.map((assignment) => [String(assignment.id), assignment]))
  const expectedIds = groups.flat().map((id) => String(id))
  if (expectedIds.length !== expected || expectedIds.some((id) => !byId.has(id))) return false
  return groups.every((ids) => {
    const members = ids.map((id) => byId.get(String(id))).filter(Boolean)
    if (members.length !== ids.length || !members.every(validRect)) return false
    if (members.every(physicallyRegistered)) return true
    const parentIds = new Set(members
      .map((member) => String(member?.rect?.parentAnswerFrameId || ''))
      .filter(Boolean))
    return parentIds.size === 1 && members.some(physicallyRegistered)
  })
}
