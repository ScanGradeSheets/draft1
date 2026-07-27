import { TEACHER_SCORE_EIGHT_STROKES } from './teacher-score-strokes.js'

// One stroke alphabet drives both the saved Canvas ink and the SVG reveal
// mask. Keeping this in one place prevents an animated digit from changing
// shape when the completed annotation replaces it.
export const TEACHER_SCORE_GLYPHS = Object.freeze({
  '0': [[[-0.04, -0.43], [-0.2, -0.38], [-0.3, -0.22], [-0.31, 0], [-0.26, 0.24], [-0.11, 0.4], [0.08, 0.42], [0.24, 0.29], [0.31, 0.05], [0.27, -0.22], [0.12, -0.39], [-0.04, -0.43]]],
  '1': [[[-0.16, -0.22], [0.03, -0.39], [0.02, 0.39]], [[-0.12, 0.4], [0.18, 0.39]]],
  '2': [[[-0.23, -0.27], [-0.08, -0.42], [0.14, -0.4], [0.28, -0.24], [0.18, -0.04], [-0.12, 0.18], [-0.25, 0.39], [0.28, 0.38]]],
  '3': [[[-0.22, -0.32], [-0.03, -0.43], [0.2, -0.32], [0.1, -0.08], [-0.04, -0.01], [0.15, 0.04], [0.25, 0.25], [0.05, 0.42], [-0.22, 0.32]]],
  '4': [[[0.18, -0.42], [-0.23, 0.1], [0.25, 0.08]], [[0.16, -0.39], [0.13, 0.42]]],
  '5': [[[0.24, -0.39], [-0.17, -0.38], [-0.22, -0.05], [-0.04, -0.11], [0.19, -0.02], [0.26, 0.23], [0.07, 0.41], [-0.22, 0.33]]],
  '6': [[[0.18, -0.34], [-0.05, -0.39], [-0.25, -0.12], [-0.22, 0.21], [0, 0.43], [0.25, 0.27], [0.2, 0.04], [-0.03, -0.03], [-0.21, 0.12]]],
  '7': [[[-0.25, -0.36], [0.29, -0.37], [0.02, 0.05], [-0.13, 0.43]]],
  '8': TEACHER_SCORE_EIGHT_STROKES,
  '9': [[[0.19, 0.38], [0.12, 0.03], [0.24, -0.23], [0.04, -0.42], [-0.19, -0.34], [-0.24, -0.1], [-0.04, 0.05], [0.16, -0.02]]],
  '/': [[[0.2, -0.44], [-0.18, 0.46]]],
})

function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function jitter(seed, amount) {
  return (seededUnit(seed) - 0.5) * 2 * amount
}

export function teacherScoreSmoothPathD(points) {
  if (!Array.isArray(points) || points.length < 2) return ''
  const commands = [`M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`]
  for (let index = 1; index < points.length - 1; index += 1) {
    const midX = (points[index][0] + points[index + 1][0]) / 2
    const midY = (points[index][1] + points[index + 1][1]) / 2
    commands.push(`Q ${points[index][0].toFixed(2)} ${points[index][1].toFixed(2)} ${midX.toFixed(2)} ${midY.toFixed(2)}`)
  }
  const last = points.at(-1)
  commands.push(`Q ${last[0].toFixed(2)} ${last[1].toFixed(2)} ${last[0].toFixed(2)} ${last[1].toFixed(2)}`)
  return commands.join(' ')
}

export function teacherScorePlacement({
  width,
  height,
  layout,
  questionRects = [],
}) {
  const pageWidth = Math.max(1, Number(width) || 1)
  const pageHeight = Math.max(1, Number(height) || 1)
  const rects = (Array.isArray(questionRects) ? questionRects : []).filter((rect) => (
    rect &&
    Number.isFinite(Number(rect.y)) &&
    Number.isFinite(Number(rect.h))
  ))
  const maxQuestionBottom = rects.length
    ? Math.max(...rects.map((rect) => Number(rect.y) + Number(rect.h)))
    : pageHeight * 0.56
  const qr = layout?.metadata?.qr_position
  const hasQr = qr && Number.isFinite(qr.x) && Number.isFinite(qr.y)
  const qrTop = hasQr ? qr.y * pageHeight : pageHeight * 0.8
  const qrRight = hasQr && Number.isFinite(qr.width)
    ? (qr.x + qr.width) * pageWidth
    : pageWidth * 0.57
  return Object.freeze({
    centerX: hasQr
      ? Math.min(pageWidth * 0.735, Math.max(qrRight + pageWidth * 0.075, pageWidth * 0.675))
      : pageWidth * 0.67,
    y: hasQr
      ? Math.min(qrTop - pageHeight * 0.025, Math.max(maxQuestionBottom + pageHeight * 0.09, qrTop - pageHeight * 0.045))
      : Math.min(pageHeight * 0.82, Math.max(maxQuestionBottom + pageHeight * 0.08, pageHeight * 0.59)),
    fontSize: Math.max(58, Math.min(96, pageWidth * 0.052)),
  })
}

export function buildTeacherScoreStrokePlan({
  text,
  centerX,
  y,
  fontSize,
  seed,
  strokeDurationMs = 360,
  strokeGapMs = 70,
  characterGapMs = 90,
}) {
  const chars = Array.from(String(text || ''))
  const size = Math.max(1, Number(fontSize) || 1)
  const planSeed = Number.isFinite(Number(seed)) ? Number(seed) : 1
  const advances = chars.map((char) => char === '/' ? size * 0.34 : size * 0.48)
  const spacing = size * 0.07
  let cursor = -(advances.reduce((sum, advance) => sum + advance, 0) + spacing * Math.max(0, chars.length - 1)) / 2
  const baseAngle = -0.11 + jitter(planSeed + 1, 0.045)
  const baseCos = Math.cos(baseAngle)
  const baseSin = Math.sin(baseAngle)
  const baseX = Number(centerX) + jitter(planSeed + 3, size * 0.14)
  const baseY = Number(y) + jitter(planSeed + 5, size * 0.08)
  const strokes = []
  let delayMs = 0

  chars.forEach((char, charIndex) => {
    const glyph = TEACHER_SCORE_GLYPHS[char] || []
    const charSeed = planSeed + charIndex * 53
    const advance = advances[charIndex]
    const charCenterX = cursor + advance / 2 + jitter(charSeed + 7, size * 0.045)
    const charCenterY = jitter(charSeed + 9, size * 0.055)
    const charAngle = jitter(charSeed + 11, 0.12)
    const charCos = Math.cos(charAngle)
    const charSin = Math.sin(charAngle)
    const scaleX = char === '/' ? 0.82 : 0.92 + seededUnit(charSeed + 13) * 0.18
    const scaleY = 0.9 + seededUnit(charSeed + 17) * 0.16
    const inkWidth = Math.max(3.5, size * (0.062 + seededUnit(charSeed + 23) * 0.022))

    glyph.forEach((segment, segmentIndex) => {
      // Segment-level offsets are part of the shared plan, rather than a
      // Canvas-only embellishment that the reveal mask cannot reproduce.
      const segmentX = charCenterX + jitter(charSeed + segmentIndex * 7, size * 0.01)
      const segmentY = charCenterY + jitter(charSeed + segmentIndex * 11, size * 0.012)
      const points = segment.map(([px, py]) => {
        const scaledX = px * size * scaleX
        const scaledY = py * size * scaleY
        const localX = segmentX + scaledX * charCos - scaledY * charSin
        const localY = segmentY + scaledX * charSin + scaledY * charCos
        return [
          baseX + localX * baseCos - localY * baseSin,
          baseY + localX * baseSin + localY * baseCos,
        ]
      })
      strokes.push({
        char,
        charIndex,
        segmentIndex,
        renderSeed: charSeed + segmentIndex * 101,
        points,
        d: teacherScoreSmoothPathD(points),
        inkWidth,
        durationMs: strokeDurationMs,
        delayMs,
      })
      delayMs += strokeDurationMs + strokeGapMs
    })
    if (glyph.length) delayMs += characterGapMs
    cursor += advance + spacing
  })

  return Object.freeze({
    text: chars.join(''),
    strokes: Object.freeze(strokes),
    durationMs: strokes.length
      ? strokes.at(-1).delayMs + strokes.at(-1).durationMs
      : 0,
  })
}

// Expand each human pen stroke into the same restrained felt-pen passes used
// by both the live SVG writer and the settled Canvas annotation. Animating the
// coloured paths themselves (instead of using a self-crossing path as a mask
// over an already-complete score) prevents later parts of an 8 from leaking
// into view before the virtual pen reaches them.
export function buildTeacherScoreInkPlan(scorePlan, passes) {
  const sourceStrokes = Array.isArray(scorePlan?.strokes) ? scorePlan.strokes : []
  const sourcePasses = Array.isArray(passes) ? passes : []
  return Object.freeze(sourceStrokes.flatMap((stroke, logicalStrokeIndex) =>
    sourcePasses.map((pass, passIndex) => {
      const spread = Number(pass?.spread) || 0
      const renderSeed = Number(stroke.renderSeed) || 1
      const points = stroke.points.map(([x, y], pointIndex) => [
        x + jitter(renderSeed + passIndex * 29 + pointIndex * 11, stroke.inkWidth * spread),
        y + jitter(renderSeed + passIndex * 31 + pointIndex * 13, stroke.inkWidth * spread),
      ])
      return Object.freeze({
        ...stroke,
        logicalStrokeIndex,
        passIndex,
        points: Object.freeze(points.map((point) => Object.freeze(point))),
        d: teacherScoreSmoothPathD(points),
        width: Math.max(1, stroke.inkWidth * (Number(pass?.widthScale) || 1)),
        opacity: Math.max(0, Math.min(1, Number(pass?.alpha) || 0)),
      })
    })
  ))
}
