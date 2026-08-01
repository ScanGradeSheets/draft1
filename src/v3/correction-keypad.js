export const CORRECTION_KEYPAD_KEYS = Object.freeze([
  '1', '2', '3', '4', '5', 'backspace',
  '6', '7', '8', '9', '0', '_',
])

export function correctionKeypadEntry(text, key, maxLength = 1) {
  const limit = Math.max(1, Number(maxLength) || 1)
  const current = String(text || '')
    .replace(/[^\d_]/g, '')
    .slice(0, limit)

  if (key === 'backspace') return current.slice(0, -1)
  if (!/^\d$/.test(String(key)) && key !== '_') return current
  if (current.length >= limit) return current
  return `${current}${key}`
}

export function correctionKeypadEntryComplete(text, maxLength = 1) {
  const limit = Math.max(1, Number(maxLength) || 1)
  return /^[\d_]+$/.test(String(text || '')) && String(text).length === limit
}

export function correctionPreviewCells(text, maxLength = 1) {
  const limit = Math.max(1, Number(maxLength) || 1)
  const entered = String(text || '')
    .replace(/[^\d_]/g, '')
    .slice(0, limit)
  return Array.from({ length: limit }, (_, index) => {
    const value = entered[index]
    return value && value !== '_' ? value : ''
  })
}

export function correctionPendingSlotIndex(text, maxLength = 1) {
  const limit = Math.max(1, Number(maxLength) || 1)
  const enteredLength = String(text || '')
    .replace(/[^\d_]/g, '')
    .slice(0, limit)
    .length
  return enteredLength > 0 && enteredLength < limit ? enteredLength : null
}
