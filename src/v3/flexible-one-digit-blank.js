import { oneDigitMayUseEitherOfTwoSlots } from './answer-placement-contract.js'

/** This uses only the worksheet's placement contract, never the correct digit. */
export function supportsEitherSlotForOneDigit(group) {
  return oneDigitMayUseEitherOfTwoSlots(group)
}

export function selectFlexibleOneDigitBlankSlots(
  group,
  slots,
  { isWrittenDigit = () => false, isBlankArtifact = () => false } = {},
) {
  if (
    !Array.isArray(slots) ||
    slots.length !== 2 ||
    !oneDigitMayUseEitherOfTwoSlots(group, slots.length)
  ) return null
  const writtenDigits = slots.filter((slot) => isWrittenDigit(slot) && !isBlankArtifact(slot))
  if (writtenDigits.length !== 1) return null
  const matchedSlot = writtenDigits[0]
  const blankSlot = slots.find((slot) => slot.slotIndex !== matchedSlot.slotIndex)
  if (!blankSlot || !isBlankArtifact(blankSlot)) return null
  return { matchedSlot, blankSlot }
}
