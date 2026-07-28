import { fluorescentHighlighterGeometry } from './highlighter-stroke.js'

const X_STROKE_DURATION_MS = 270
const X_PEN_LIFT_PAUSE_MS = 160

function finite(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function seededUnit(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function jitter(seed, amount) {
  return (seededUnit(seed) - 0.5) * 2 * amount
}

function transformLocalPoints(cx, cy, size, points, angle, scaleX = 1, scaleY = 1) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return points.map(([px, py]) => {
    const sx = px * size * scaleX
    const sy = py * size * scaleY
    return [
      cx + sx * cos - sy * sin,
      cy + sx * sin + sy * cos,
    ]
  })
}

function indicatorAnchor(rect, seed, width, height) {
  const size = Math.max(30, Math.min(rect.h * 1.02, width * 0.058))
  let x = rect.x + rect.w + size * (0.48 + seededUnit(seed + 71) * 0.08) + jitter(seed + 79, size * 0.045)
  let y = rect.y + rect.h * (0.52 + jitter(seed + 73, 0.025)) + jitter(seed + 83, size * 0.025)
  const rightLimit = width - size * 0.72
  if (x > rightLimit) x = rightLimit + jitter(seed + 89, size * 0.025)
  y = Math.max(size * 0.65, Math.min(height - size * 0.65, y))
  return { x, y, size }
}

function pathData(points) {
  if (!Array.isArray(points) || points.length < 2) return ''
  return points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')
}

function teacherStrokePaths(status, rect, seed, width, height) {
  if (status === 'review') {
    const geometry = fluorescentHighlighterGeometry(rect, seed)
    return [{
      d: pathData(geometry.centerline),
      durationMs: 540,
      delayMs: 0,
    }]
  }
  const { x, y, size } = indicatorAnchor(rect, seed, width, height)
  if (status === 'correct') {
    const angle = jitter(seed + 101, 0.22)
    const scaleX = 0.86 + seededUnit(seed + 103) * 0.32
    const scaleY = 0.84 + seededUnit(seed + 107) * 0.28
    const points = transformLocalPoints(
      x,
      y,
      size,
      [
        [-0.4 + jitter(seed + 1, 0.03), 0.06 + jitter(seed + 2, 0.06)],
        [-0.25 + jitter(seed + 3, 0.04), 0.18 + jitter(seed + 4, 0.045)],
        [-0.11 + jitter(seed + 5, 0.04), 0.32 + jitter(seed + 6, 0.055)],
        [0.12 + jitter(seed + 7, 0.05), -0.01 + jitter(seed + 8, 0.04)],
        [0.48 + jitter(seed + 9, 0.055), -0.41 + jitter(seed + 10, 0.055)],
      ],
      angle,
      scaleX,
      scaleY,
    )
    // A teacher's checkmark is one uninterrupted left-to-right pen stroke.
    return [{ d: pathData(points), durationMs: 500, delayMs: 0 }]
  }

  const angle = jitter(seed + 131, 0.12)
  const first = transformLocalPoints(
    x,
    y,
    size,
    [
      [-0.35 + jitter(seed + 1, 0.035), -0.31 + jitter(seed + 2, 0.04)],
      [0.02 + jitter(seed + 3, 0.04), -0.01 + jitter(seed + 4, 0.03)],
      [0.29 + jitter(seed + 5, 0.04), 0.3 + jitter(seed + 6, 0.04)],
    ],
    angle,
  )
  const second = transformLocalPoints(
    x,
    y,
    size,
    [
      [0.3 + jitter(seed + 7, 0.04), -0.34 + jitter(seed + 8, 0.04)],
      [-0.02 + jitter(seed + 9, 0.035), 0.01 + jitter(seed + 10, 0.035)],
      [-0.32 + jitter(seed + 11, 0.04), 0.31 + jitter(seed + 12, 0.04)],
    ],
    angle + jitter(seed + 133, 0.05),
  )
  return [
    { d: pathData(first), durationMs: X_STROKE_DURATION_MS, delayMs: 0 },
    // Finish the top-left to bottom-right stroke before lifting the pen and
    // drawing the crossing top-right to bottom-left stroke.
    {
      d: pathData(second),
      durationMs: X_STROKE_DURATION_MS,
      delayMs: X_STROKE_DURATION_MS + X_PEN_LIFT_PAUSE_MS,
    },
  ]
}

function union(rects) {
  const valid = rects.filter(Boolean)
  if (!valid.length) return null
  const x0 = Math.min(...valid.map((rect) => rect.x))
  const y0 = Math.min(...valid.map((rect) => rect.y))
  const x1 = Math.max(...valid.map((rect) => rect.x + rect.w))
  const y1 = Math.max(...valid.map((rect) => rect.y + rect.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export function progressiveMarkingSteps(answerGroups = [], annotationRegions = [], dimensions = {}, options = {}) {
  const width = Math.max(1, finite(dimensions.width) || 1)
  const height = Math.max(1, finite(dimensions.height) || 1)
  const excludedQuestionNums = new Set(
    (Array.isArray(options?.excludedQuestionNums) ? options.excludedQuestionNums : [])
      .map(Number)
      .filter(Number.isFinite)
  )
  const excludeReview = options?.excludeReview === true
  const onlyQuestionNums = new Set(
    (Array.isArray(options?.onlyQuestionNums) ? options.onlyQuestionNums : [])
      .map(Number)
      .filter(Number.isFinite)
  )
  const revealAnswerQuestionNums = new Set(
    (Array.isArray(options?.revealAnswerQuestionNums) ? options.revealAnswerQuestionNums : [])
      .map(Number)
      .filter(Number.isFinite)
  )
  return answerGroups
    .map((group, groupIndex) => ({ group, groupIndex }))
    .filter(({ group }) => (
      (group?.status === 'correct' || group?.status === 'incorrect' || (!excludeReview && group?.status === 'review')) &&
      (group?.reviewNeeded !== true || group?.status === 'review') &&
      !excludedQuestionNums.has(Number(group?.questionNum)) &&
      (onlyQuestionNums.size === 0 || onlyQuestionNums.has(Number(group?.questionNum)))
    ))
    .map(({ group, groupIndex }) => {
      const questionNum = Number(group.questionNum)
      const allMatchingRegions = annotationRegions
        .filter((region) => Number(region?.questionNum) === questionNum)
      const reviewedRegions = group.status === 'review'
        ? allMatchingRegions.filter((region) => region?.reviewNeeded === true)
        : []
      const matchingRegions = reviewedRegions.length > 0 ? reviewedRegions : allMatchingRegions
      const rect = union(matchingRegions.map((region) => {
          const x = finite(region?.x)
          const y = finite(region?.y)
          const w = finite(region?.w)
          const h = finite(region?.h)
          return x == null || y == null || w == null || h == null ? null : { x, y, w, h }
        }))
      if (!rect) return null
      const focusRect = union(matchingRegions.map((region) => {
        const x = finite(region?.focusX)
        const y = finite(region?.focusY)
        const w = finite(region?.focusW)
        const h = finite(region?.focusH)
        return x == null || y == null || w == null || h == null ? null : { x, y, w, h }
      })) || rect
      const seed = (groupIndex + 1) * 131
      // The natural check/X is deliberately drawn just outside the answer box.
      // Give the reveal mask a small margin without allowing it to expose marks
      // belonging to another question.
      const padX = Math.min(width * 0.025, rect.h * 0.22)
      const padY = Math.min(height * 0.018, rect.h * 0.16)
      const x = Math.max(0, rect.x - padX)
      const y = Math.max(0, rect.y - padY)
      const right = Math.min(width, rect.x + rect.w + padX)
      const bottom = Math.min(height, rect.y + rect.h + padY)
      const markingStrokes = teacherStrokePaths(group.status, focusRect, seed, width, height)
      const revealAnswer = revealAnswerQuestionNums.has(questionNum)
      const answerRevealStroke = revealAnswer
        ? [{
            d: pathData([
              [focusRect.x - focusRect.w * 0.04, focusRect.y + focusRect.h * 0.5],
              [focusRect.x + focusRect.w * 1.04, focusRect.y + focusRect.h * 0.5],
            ]),
            width: Math.max(22, focusRect.h * 1.12),
            durationMs: 320,
            delayMs: 0,
          }]
        : []
      const delayedMarkingStrokes = revealAnswer
        ? markingStrokes.map((stroke) => ({ ...stroke, delayMs: stroke.delayMs + 260 }))
        : markingStrokes
      return {
        key: `mark-question-${questionNum}`,
        questionNum,
        status: group.status,
        seed,
        strokeWidth: group.status === 'review'
          ? Math.max(24, fluorescentHighlighterGeometry(focusRect, seed).width)
          : Math.max(12, indicatorAnchor(focusRect, seed, width, height).size * 0.3),
        strokes: [...answerRevealStroke, ...delayedMarkingStrokes],
        x,
        y,
        w: Math.max(1, right - x),
        h: Math.max(1, bottom - y),
      }
    })
    .filter(Boolean)
}
