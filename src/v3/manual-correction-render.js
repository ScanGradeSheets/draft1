export function manualCorrectionDisplayCells(correction, correctedEntries = []) {
  if (!correction || !Array.isArray(correctedEntries)) return []
  if (correction.overflowSinglePhysicalBox === true && correctedEntries.length === 1) {
    const text = String(correction.text || '').replace(/\D/g, '')
    return text ? [text] : [correctedEntries[0]?.cell ?? null]
  }
  return correctedEntries.map((entry) => entry?.cell ?? null)
}

export function shouldAutoApplySingleDigitCorrection({ eventType, maxLength, text } = {}) {
  return eventType === 'input' && Number(maxLength) === 1 && /^\d$/.test(String(text || ''))
}
