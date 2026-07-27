import { fluorescentHighlighterGeometry } from './highlighter-stroke.js'

export function manualCorrectionDisplayCells(correction, correctedEntries = []) {
  if (!correction || !Array.isArray(correctedEntries)) return []
  if (correction.overflowSinglePhysicalBox === true && correctedEntries.length === 1) {
    const text = String(correction.text || '').replace(/\D/g, '')
    return text ? [text] : [correctedEntries[0]?.cell ?? null]
  }
  return correctedEntries.map((entry) => entry?.cell ?? null)
}

export function manualCorrectionClearRect(rect, seed, dimensions = {}) {
  if (!rect) return null
  const width = Math.max(1, Number(dimensions.width) || 1)
  const height = Math.max(1, Number(dimensions.height) || 1)
  const geometry = fluorescentHighlighterGeometry(rect, seed)
  const points = Array.isArray(geometry?.polygon) ? geometry.polygon : []
  const xs = points.map((point) => Number(point?.[0])).filter(Number.isFinite)
  const ys = points.map((point) => Number(point?.[1])).filter(Number.isFinite)
  if (!xs.length || !ys.length) return null
  const marginX = Math.max(3, Number(rect.w) * 0.025)
  const marginY = Math.max(3, Number(rect.h) * 0.055)
  const x = Math.max(0, Math.floor(Math.min(...xs) - marginX))
  const y = Math.max(0, Math.floor(Math.min(...ys) - marginY))
  const right = Math.min(width, Math.ceil(Math.max(...xs) + marginX))
  const bottom = Math.min(height, Math.ceil(Math.max(...ys) + marginY))
  return {
    x,
    y,
    w: Math.max(1, right - x),
    h: Math.max(1, bottom - y),
  }
}

export function shouldAutoApplySingleDigitCorrection({
  eventType,
  maxLength,
  text,
} = {}) {
  const expectedLength = Number(maxLength)
  const entered = String(text || '')
  if (
    eventType !== 'input' ||
    !Number.isInteger(expectedLength) ||
    expectedLength < 1 ||
    !/^\d+$/.test(entered)
  ) return false
  // Submit only when the editor has received its complete answer. If both
  // physical slots are unresolved, the first key is merely the first digit
  // (for example 1 followed by 5); the second key completes and submits it.
  return entered.length === expectedLength
}
