function normalizedCell(value) {
  if (value === null || value === undefined || value === '') return null
  const digit = Number(value)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : null
}

/**
 * Maps teacher-entered cells onto physical worksheet slots without losing the
 * entered text. A one-box question may explicitly allow two handwritten digits;
 * in that case the full entered token remains attached to the one box.
 */
export function manualCorrectionContract(cells = [], physicalSlotCount = 1) {
  const count = Math.max(1, Number(physicalSlotCount) || 1)
  const entered = (Array.isArray(cells) ? cells : []).map(normalizedCell)
  const meaningful = entered.filter((cell) => cell !== null)
  const overflowSinglePhysicalBox = count === 1 && meaningful.length > 1
  if (overflowSinglePhysicalBox) {
    return {
      overflowSinglePhysicalBox: true,
      correctionCells: meaningful,
      answerText: meaningful.join(''),
    }
  }

  const correctionCells = entered.slice(-count)
  while (correctionCells.length < count) correctionCells.unshift(null)
  return {
    overflowSinglePhysicalBox: false,
    correctionCells,
    answerText: correctionCells.filter((cell) => cell !== null).join(''),
  }
}
