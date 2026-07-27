function normalizedDigit(value) {
  if (value === null || value === undefined || value === '') return null
  const digit = Number(value)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined
}

function normalizedResponse(response, slotCount) {
  const values = Array.isArray(response) ? response : response?.digits
  if (!Array.isArray(values) || values.length !== slotCount) return null
  const normalized = values.map(normalizedDigit)
  return normalized.some((digit) => digit === undefined) ? null : normalized
}

function responseKey(response) {
  return response.map((digit) => digit == null ? '_' : String(digit)).join(',')
}

/**
 * Returns every physical placement that represents the same numeric response.
 *
 * In a two-slot answer zone, a one-digit answer is the same response whether
 * the student writes it in the left or right box. Physical placement remains
 * available to the annotation layer; it is deliberately ignored only for the
 * semantic transcription/grading comparison.
 */
export function acceptedResponsesForSlotContract({
  answer,
  acceptedDigitResponses = [],
  slotCount = 1,
} = {}) {
  const count = Math.max(1, Number(slotCount) || 1)
  const configured = (Array.isArray(acceptedDigitResponses) ? acceptedDigitResponses : [])
    .map((response) => normalizedResponse(response, count))
    .filter(Boolean)

  const text = answer == null ? '' : String(answer).trim()
  const derived = []
  if (/^\d+$/.test(text)) {
    const digits = [...text].map(Number)
    if (count === 2 && digits.length === 1) {
      const digit = digits[0]
      derived.push([null, digit], [digit, null])
    } else if (digits.length === count) {
      derived.push(digits)
    } else if (digits.length < count) {
      derived.push(Array(count - digits.length).fill(null).concat(digits))
    }
  }

  const seen = new Set()
  return configured.concat(derived).filter((response) => {
    const key = responseKey(response)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function oneDigitMayUseEitherOfTwoSlots(group, slotCount = null) {
  const configuredSlotCount = Array.isArray(group?.accepted_digit_responses)
    ? group.accepted_digit_responses
      .map((response) => Array.isArray(response) ? response.length : response?.digits?.length)
      .find((count) => Number.isInteger(count) && count > 0)
    : 0
  const count = Number(slotCount) || Number(group?.guide_line?.slot_count) ||
    (Array.isArray(group?.digit_box_ids) ? group.digit_box_ids.length : 0) ||
    configuredSlotCount
  if (count !== 2) return false
  const responses = acceptedResponsesForSlotContract({
    answer: group?.answer,
    acceptedDigitResponses: group?.accepted_digit_responses,
    slotCount: count,
  })
  const placements = new Set()
  for (const response of responses) {
    const occupied = response
      .map((digit, index) => ({ digit, index }))
      .filter(({ digit }) => digit !== null)
    if (occupied.length === 1) placements.add(occupied[0].index)
  }
  return placements.has(0) && placements.has(1)
}
