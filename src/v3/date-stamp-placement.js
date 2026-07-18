function normalized(value) {
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number : null
}

const LAUNCH_DATE_ZONE = Object.freeze({ x: 0.695, y: 0.17, width: 0.175, height: 0.07 })
const LAUNCH_LAYOUT_IDS = new Set([
  'sg-g1-lw-01-add-1digit',
  'sg-g1-lw-02-add-2digit',
  'sg-g1-lw-03-sub-1digit',
  'sg-g1-lw-04-sub-2digit',
  'sg-g1-lw-05-mixed-20',
  'sg-g1-lw-06-ten-frames',
  'sg-g1-lw-07-dot-collections',
  'sg-g1-lw-08-number-bonds',
  'sg-g1-lw-09-number-patterns',
  'sg-g1-lw-10-place-value-50',
])

export function declaredDateStampRect(layout, width, height) {
  const layoutId = String(layout?.layout_id || layout?.id || '')
  const zone = layout?.metadata?.annotation_zones?.date_stamp ||
    (LAUNCH_LAYOUT_IDS.has(layoutId) ? LAUNCH_DATE_ZONE : null)
  const x = normalized(zone?.x)
  const y = normalized(zone?.y)
  const w = normalized(zone?.width)
  const h = normalized(zone?.height)
  const pageWidth = Number(width)
  const pageHeight = Number(height)
  if ([x, y, w, h].some((value) => value == null)) return null
  if (!(pageWidth > 0) || !(pageHeight > 0) || w <= 0 || h <= 0) return null
  if (x + w > 1 || y + h > 1) return null
  return {
    x: x * pageWidth,
    y: y * pageHeight,
    w: w * pageWidth,
    h: h * pageHeight,
  }
}

function seededUnit(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function dateStampSpecForLayout(layout, width, height, seed = 1, date = new Date()) {
  const rect = declaredDateStampRect(layout, width, height)
  if (!rect || !(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const text = `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`
  const stampSeed = Number.isFinite(Number(seed)) ? Number(seed) + 701 : 702
  const naturalFontSize = Math.max(36, Math.min(52, Number(width) * 0.026))
  const naturalSpacing = Math.max(2.2, naturalFontSize * 0.18)
  const naturalWidth = text.length * naturalFontSize * 0.62 + (text.length - 1) * naturalSpacing
  const fitScale = Math.min(1, (rect.w * 0.92) / naturalWidth, (rect.h * 0.65) / naturalFontSize)
  const fontSize = naturalFontSize * fitScale
  const spacing = naturalSpacing * fitScale
  const estimatedWidth = naturalWidth * fitScale
  if (fontSize < 22 || estimatedWidth > rect.w * 0.94) return null
  return {
    rect,
    text,
    fontSize,
    spacing,
    estimatedWidth,
    x: rect.x + Math.max(0, rect.w - estimatedWidth) * (0.45 + seededUnit(stampSeed + 5) * 0.35),
    y: rect.y + rect.h * (0.44 + seededUnit(stampSeed + 13) * 0.12),
    rotation: -0.052 + (seededUnit(stampSeed + 23) - 0.5) * 0.048,
    stampSeed,
  }
}
