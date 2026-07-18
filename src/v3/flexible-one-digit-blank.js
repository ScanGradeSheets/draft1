function responseCells(response) {
  return Array.isArray(response) ? response : response?.digits
}

function oneDigitPlacement(cells) {
  if (!Array.isArray(cells) || cells.length !== 2) return null
  const filled = cells
    .map((cell, slotIndex) => ({ cell, slotIndex }))
    .filter(({ cell }) => cell !== null && cell !== undefined && cell !== '')
  if (filled.length !== 1) return null
  return filled[0].slotIndex
}

/** This uses only the worksheet's placement contract, never the correct digit. */
export function supportsEitherSlotForOneDigit(group) {
  const placements = new Set(
    (group?.accepted_digit_responses || [])
      .map(responseCells)
      .map(oneDigitPlacement)
      .filter((slotIndex) => slotIndex != null),
  )
  return placements.has(0) && placements.has(1)
}

export function selectFlexibleOneDigitBlankSlots(
  group,
  slots,
  { isStrongDigit = () => false, isBlankArtifact = () => false } = {},
) {
  if (!supportsEitherSlotForOneDigit(group) || !Array.isArray(slots) || slots.length !== 2) return null
  const strongDigits = slots.filter(isStrongDigit)
  if (strongDigits.length !== 1) return null
  const matchedSlot = strongDigits[0]
  const blankSlot = slots.find((slot) => slot.slotIndex !== matchedSlot.slotIndex)
  if (!blankSlot || !isBlankArtifact(blankSlot)) return null
  return { matchedSlot, blankSlot }
}
