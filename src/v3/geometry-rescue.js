import { answerZoneRect } from './answer-zones.js'

export const GEOMETRY_RESCUE_POLICY_VERSION = 'review-only-geometry-rescue-1'

function center(rect) {
  return [rect.x + rect.w / 2, rect.y + rect.h / 2]
}

function solve3(matrix, values) {
  const rows = matrix.map((row, index) => [...row, values[index]])
  for (let column = 0; column < 3; column += 1) {
    let pivot = column
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row
    }
    if (Math.abs(rows[pivot][column]) < 1e-8) return null
    ;[rows[column], rows[pivot]] = [rows[pivot], rows[column]]
    const divisor = rows[column][column]
    for (let item = column; item < 4; item += 1) rows[column][item] /= divisor
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue
      const factor = rows[row][column]
      for (let item = column; item < 4; item += 1) rows[row][item] -= factor * rows[column][item]
    }
  }
  return rows.map((row) => row[3])
}

function fitAffine(source, target, indexes) {
  const normal = Array.from({ length: 3 }, () => Array(3).fill(0))
  const rhsX = Array(3).fill(0)
  const rhsY = Array(3).fill(0)
  for (const index of indexes) {
    const basis = [1, source[index][0], source[index][1]]
    for (let row = 0; row < 3; row += 1) {
      rhsX[row] += basis[row] * target[index][0]
      rhsY[row] += basis[row] * target[index][1]
      for (let column = 0; column < 3; column += 1) normal[row][column] += basis[row] * basis[column]
    }
  }
  const x = solve3(normal, rhsX)
  const y = solve3(normal, rhsY)
  return x && y ? { x, y } : null
}

function transformPoint(affine, point) {
  const basis = [1, point[0], point[1]]
  return [
    affine.x.reduce((sum, value, index) => sum + value * basis[index], 0),
    affine.y.reduce((sum, value, index) => sum + value * basis[index], 0),
  ]
}

function residuals(affine, source, target) {
  return source.map((point, index) => {
    const transformed = transformPoint(affine, point)
    return Math.hypot(transformed[0] - target[index][0], transformed[1] - target[index][1])
  })
}

function combinationsOfThree(count) {
  const output = []
  for (let a = 0; a < count - 2; a += 1) {
    for (let b = a + 1; b < count - 1; b += 1) {
      for (let c = b + 1; c < count; c += 1) output.push([a, b, c])
    }
  }
  return output
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : Infinity
}

function transformRect(affine, rect, width, height) {
  const points = [
    [rect.x, rect.y], [rect.x + rect.w, rect.y],
    [rect.x, rect.y + rect.h], [rect.x + rect.w, rect.y + rect.h],
  ].map((point) => transformPoint(affine, point))
  const xs = points.map((point) => point[0])
  const ys = points.map((point) => point[1])
  const x0 = Math.max(0, Math.floor(Math.min(...xs)))
  const y0 = Math.max(0, Math.floor(Math.min(...ys)))
  const x1 = Math.min(width, Math.ceil(Math.max(...xs)))
  const y1 = Math.min(height, Math.ceil(Math.max(...ys)))
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null
}

/**
 * Identify one demonstrably misplaced answer zone using only page geometry.
 * The result is review-only and contains no answer text or key information.
 */
export function geometryRescuePlan({ layout, zones, width, height } = {}) {
  const pageWidth = Number(width)
  const pageHeight = Number(height)
  if (!layout || !Number.isFinite(pageWidth) || !Number.isFinite(pageHeight)) return null
  const zoneByQuestion = new Map((zones || []).map((zone) => [Number(zone?.questionNum), zone]))
  const rows = (layout.question_groups || []).map((group) => {
    const questionNum = Number(group?.question_num)
    const zone = zoneByQuestion.get(questionNum)
    const expected = answerZoneRect(group, layout, { width: pageWidth, height: pageHeight, geometrySource: 'layout' })
    const observed = zone?.rect
    return expected && observed ? { questionNum, expected, observed } : null
  }).filter(Boolean)
  if (rows.length < 4) return null
  const source = rows.map((row) => center(row.expected))
  const target = rows.map((row) => center(row.observed))
  const threshold = Math.max(24, Math.hypot(pageWidth, pageHeight) * 0.022)
  let best = null
  for (const sample of combinationsOfThree(rows.length)) {
    const affine = fitAffine(source, target, sample)
    if (!affine) continue
    const errors = residuals(affine, source, target)
    const inliers = errors.map((error) => error <= threshold)
    const count = inliers.filter(Boolean).length
    const score = [count, -median(errors.filter((_error, index) => inliers[index]))]
    if (!best || score[0] > best.score[0] || (score[0] === best.score[0] && score[1] > best.score[1])) {
      best = { score, inliers }
    }
  }
  if (!best || best.inliers.filter(Boolean).length < rows.length - 1) return null
  const inlierIndexes = best.inliers.map((value, index) => value ? index : -1).filter((index) => index >= 0)
  const affine = fitAffine(source, target, inlierIndexes)
  if (!affine) return null
  const errors = residuals(affine, source, target)
  const outliers = rows.filter((_row, index) => !best.inliers[index] && errors[index] > threshold)
  if (outliers.length !== 1) return null
  const row = outliers[0]
  const index = rows.indexOf(row)
  const rect = transformRect(affine, row.expected, pageWidth, pageHeight)
  if (!rect) return null
  return {
    policyVersion: GEOMETRY_RESCUE_POLICY_VERSION,
    affectsGrade: false,
    questionNum: row.questionNum,
    rect,
    residual: errors[index],
    threshold,
    inlierCount: inlierIndexes.length,
    zoneCount: rows.length,
  }
}
