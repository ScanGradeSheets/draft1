import { teacherScorePlacement } from './teacher-score-plan.js'

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

function rectanglesOverlap(a, b) {
  return !!(
    a &&
    b &&
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  )
}

export function qrCompletionExclusionRect(layout, width, height) {
  const qr = layout?.metadata?.qr_position
  const pageWidth = Number(width)
  const pageHeight = Number(height)
  if (
    !(pageWidth > 0) ||
    !(pageHeight > 0) ||
    !qr ||
    ![qr.x, qr.y, qr.width, qr.height].every((value) => Number.isFinite(Number(value)))
  ) return null
  // Include the QR quiet area, printed label, transform error and breathing
  // room. A completion stamp must never enter this visible footprint.
  const padX = pageWidth * 0.028
  const padTop = pageHeight * 0.018
  const padBottom = pageHeight * 0.025
  return {
    x: Number(qr.x) * pageWidth - padX,
    y: Number(qr.y) * pageHeight - padTop,
    w: Number(qr.width) * pageWidth + padX * 2,
    h: Number(qr.height) * pageHeight + padTop + padBottom,
  }
}

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

export function completionDateStampRect(layout, width, height, questionRects = []) {
  // Keep the original declared zone as the template opt-in/safety contract,
  // but place the completion stamp beside the QR and immediately below the
  // score—the point where the teacher's eye already rests.
  if (!declaredDateStampRect(layout, width, height)) return null
  const pageWidth = Number(width)
  const pageHeight = Number(height)
  if (!(pageWidth > 0) || !(pageHeight > 0)) return null
  const score = teacherScorePlacement({
    width: pageWidth,
    height: pageHeight,
    layout,
    questionRects,
  })
  const qrExclusion = qrCompletionExclusionRect(layout, pageWidth, pageHeight)
  const qrRight = qrExclusion
    ? qrExclusion.x + qrExclusion.w
    : pageWidth * 0.59
  const w = pageWidth * 0.205
  const h = pageHeight * 0.05
  const maxX = pageWidth - w - pageWidth * 0.025
  const x = Math.max(
    qrRight + pageWidth * 0.018,
    score.centerX - w * 0.38,
  )
  // A decorative completion seal is optional. If perspective leaves no safe
  // space beside the QR, omit it instead of drawing over the QR or score.
  if (x > maxX) return null
  const y = Math.min(
    pageHeight - h - pageHeight * 0.035,
    score.y + Math.max(score.fontSize * 0.95, pageHeight * 0.035),
  )
  const rect = { x, y, w, h }
  if (qrExclusion && rectanglesOverlap(rect, qrExclusion)) return null
  if (score.safetyRect && rectanglesOverlap(rect, score.safetyRect)) return null
  return rect
}

function seededUnit(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function dateStampSpecForLayout(
  layout,
  width,
  height,
  seed = 1,
  date = new Date(),
  questionRects = [],
) {
  const rect = completionDateStampRect(layout, width, height, questionRects)
  if (!rect || !(date instanceof Date) || Number.isNaN(date.getTime())) return null
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
  const text = `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`
  const stampSeed = Number.isFinite(Number(seed)) ? Number(seed) + 701 : 702
  const naturalFontSize = Math.max(40, Math.min(58, Number(width) * 0.029))
  const naturalSpacing = Math.max(2.2, naturalFontSize * 0.12)
  const naturalWidth = text.length * naturalFontSize * 0.53 + (text.length - 1) * naturalSpacing
  const fitScale = Math.min(1, (rect.w * 0.98) / naturalWidth, (rect.h * 0.72) / naturalFontSize)
  const fontSize = naturalFontSize * fitScale
  const spacing = naturalSpacing * fitScale
  const estimatedWidth = naturalWidth * fitScale
  if (fontSize < 22 || estimatedWidth > rect.w * 0.99) return null
  return {
    rect,
    text,
    fontSize,
    spacing,
    estimatedWidth,
    x: rect.x + Math.max(0, rect.w - estimatedWidth) * (0.18 + seededUnit(stampSeed + 5) * 0.72),
    y: rect.y + rect.h * (0.4 + seededUnit(stampSeed + 13) * 0.2),
    rotation: -0.046 + (seededUnit(stampSeed + 23) - 0.5) * 0.072,
    stampSeed,
  }
}
