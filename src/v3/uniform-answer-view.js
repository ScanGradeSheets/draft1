import { layoutBoxRect, unionRects } from './answer-zones.js'

function finite(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function median(values) {
  if (!values.length) return Number.POSITIVE_INFINITY
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

function combinationsOfThree(length) {
  const output = []
  for (let first = 0; first < length - 2; first += 1) {
    for (let second = first + 1; second < length - 1; second += 1) {
      for (let third = second + 1; third < length; third += 1) {
        output.push([first, second, third])
      }
    }
  }
  return output
}

function solveThreeByThree(matrix, values) {
  const rows = matrix.map((row, index) => [...row, values[index]])
  for (let column = 0; column < 3; column += 1) {
    let pivot = column
    for (let row = column + 1; row < 3; row += 1) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row
    }
    if (Math.abs(rows[pivot][column]) < 1e-10) return null
    ;[rows[column], rows[pivot]] = [rows[pivot], rows[column]]
    const divisor = rows[column][column]
    for (let item = column; item < 4; item += 1) rows[column][item] /= divisor
    for (let row = 0; row < 3; row += 1) {
      if (row === column) continue
      const factor = rows[row][column]
      for (let item = column; item < 4; item += 1) {
        rows[row][item] -= factor * rows[column][item]
      }
    }
  }
  return rows.map((row) => row[3])
}

function fitAffine(source, target, indices = source.map((_, index) => index)) {
  const normal = Array.from({ length: 3 }, () => Array(3).fill(0))
  const rhsX = Array(3).fill(0)
  const rhsY = Array(3).fill(0)
  for (const index of indices) {
    const basis = [1, source[index][0], source[index][1]]
    for (let row = 0; row < 3; row += 1) {
      rhsX[row] += basis[row] * target[index][0]
      rhsY[row] += basis[row] * target[index][1]
      for (let column = 0; column < 3; column += 1) {
        normal[row][column] += basis[row] * basis[column]
      }
    }
  }
  const x = solveThreeByThree(normal, rhsX)
  const y = solveThreeByThree(normal, rhsY)
  return x && y ? { x, y } : null
}

function applyAffine(coefficients, point) {
  const basis = [1, point[0], point[1]]
  return [
    basis.reduce((sum, value, index) => sum + value * coefficients.x[index], 0),
    basis.reduce((sum, value, index) => sum + value * coefficients.y[index], 0),
  ]
}

function residualsFor(coefficients, source, target) {
  return source.map((point, index) => {
    const predicted = applyAffine(coefficients, point)
    return Math.hypot(predicted[0] - target[index][0], predicted[1] - target[index][1])
  })
}

export function robustUniformAffine(source, target, pageDiagonal) {
  if (!Array.isArray(source) || source.length !== target?.length || source.length < 3) return null
  const threshold = Math.max(24, Number(pageDiagonal) * 0.022)
  let best = null
  for (const sample of combinationsOfThree(source.length)) {
    const coefficients = fitAffine(source, target, sample)
    if (!coefficients) continue
    const residuals = residualsFor(coefficients, source, target)
    const inliers = residuals.map((value) => value <= threshold)
    const inlierResiduals = residuals.filter((_, index) => inliers[index])
    const score = [inlierResiduals.length, -median(inlierResiduals)]
    if (
      !best ||
      score[0] > best.score[0] ||
      (score[0] === best.score[0] && score[1] > best.score[1])
    ) best = { score, inliers }
  }
  const initialInliers = best?.inliers || source.map(() => true)
  let coefficients = fitAffine(
    source,
    target,
    initialInliers.map((isInlier, index) => isInlier ? index : -1).filter((index) => index >= 0),
  )
  if (!coefficients) return null
  let residuals = residualsFor(coefficients, source, target)
  const inliers = residuals.map((value) => value <= threshold)
  coefficients = fitAffine(
    source,
    target,
    inliers.map((isInlier, index) => isInlier ? index : -1).filter((index) => index >= 0),
  ) || coefficients
  residuals = residualsFor(coefficients, source, target)
  return { coefficients, residuals, inliers: residuals.map((value) => value <= threshold), threshold }
}

export function expectedUniformAnswerRect(group, layout, width, height) {
  const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids.map(String) : []
  const boxById = new Map((layout?.boxes || []).map((box) => [String(box.id), box]))
  const rects = ids
    .map((id) => layoutBoxRect(boxById.get(id), layout, width, height))
    .filter(Boolean)
  const union = unionRects(rects)
  if (!union || !rects.length) return null
  const margin = Math.min(...rects.map((rect) => rect.h)) * 0.08
  return [
    union.x - margin,
    union.y - margin,
    union.x + union.w + margin,
    union.y + union.h + margin,
  ]
}

function center(rect) {
  return [(rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2]
}

function transformedRect(coefficients, rect, width, height) {
  const corners = [
    applyAffine(coefficients, [rect[0], rect[1]]),
    applyAffine(coefficients, [rect[2], rect[1]]),
    applyAffine(coefficients, [rect[0], rect[3]]),
    applyAffine(coefficients, [rect[2], rect[3]]),
  ]
  const xs = corners.map((point) => point[0])
  const ys = corners.map((point) => point[1])
  return [
    Math.max(0, Math.floor(Math.min(...xs))),
    Math.max(0, Math.floor(Math.min(...ys))),
    Math.min(width, Math.ceil(Math.max(...xs))),
    Math.min(height, Math.ceil(Math.max(...ys))),
  ]
}

function scaledRect(rect, sourceWidth, sourceHeight, width, height) {
  return [
    Math.round(rect[0] * sourceWidth / width),
    Math.round(rect[1] * sourceHeight / height),
    Math.round(rect[2] * sourceWidth / width),
    Math.round(rect[3] * sourceHeight / height),
  ]
}

/**
 * Build the exact truth/key-blind geometry contract used by the frozen
 * 93.6%-coverage research candidate. Observed zones may position the crop, but
 * neither OCR text nor an answer key can participate.
 */
export function uniformAnswerViewPlan({
  layout,
  zones,
  width,
  height,
  simpleWidth = width,
  simpleHeight = height,
} = {}) {
  if (!layout || !Array.isArray(zones) || zones.length < 3) return null
  const groupByQuestion = new Map((layout.question_groups || [])
    .map((group, index) => [Number(group?.question_num ?? index + 1), group]))
  const usable = zones
    .map((zone) => {
      const questionNum = Number(zone?.questionNum)
      const observed = zone?.rect
      const group = groupByQuestion.get(questionNum)
      const expected = expectedUniformAnswerRect(group, layout, width, height)
      if (
        !group ||
        !expected ||
        ![observed?.x, observed?.y, observed?.w, observed?.h].every((value) => finite(value) != null)
      ) return null
      return {
        questionNum,
        expected,
        observed: [
          Number(observed.x),
          Number(observed.y),
          Number(observed.x) + Number(observed.w),
          Number(observed.y) + Number(observed.h),
        ],
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.questionNum - b.questionNum)
  if (usable.length < 3) return null
  const fit = robustUniformAffine(
    usable.map((item) => center(item.expected)),
    usable.map((item) => center(item.observed)),
    Math.hypot(width, height),
  )
  if (!fit) return null
  return {
    version: 'uniform-answer-view-plan-1',
    answerKeyUsed: false,
    handwritingTruthUsed: false,
    threshold: fit.threshold,
    entries: usable.map((item, index) => {
      const referenceRect = transformedRect(fit.coefficients, item.expected, width, height)
      return {
        questionNum: item.questionNum,
        referenceRect,
        homographyRect: [...referenceRect],
        simpleRect: scaledRect(referenceRect, simpleWidth, simpleHeight, width, height),
        residual: fit.residuals[index],
        observedZoneIsAffineInlier: fit.inliers[index],
      }
    }),
  }
}

function maxMean(binary, width, x0, y0, x1, y1, axis) {
  let maximum = 0
  if (axis === 'row') {
    for (let y = y0; y < y1; y += 1) {
      let count = 0
      for (let x = x0; x < x1; x += 1) count += binary[y * width + x]
      maximum = Math.max(maximum, count / Math.max(1, x1 - x0))
    }
  } else {
    for (let x = x0; x < x1; x += 1) {
      let count = 0
      for (let y = y0; y < y1; y += 1) count += binary[y * width + x]
      maximum = Math.max(maximum, count / Math.max(1, y1 - y0))
    }
  }
  return maximum
}

export function uniformPrintedFrameScore(gray, width, height) {
  const values = Array.from(gray || [])
  if (values.length !== width * height || width < 8 || height < 8) {
    return { score: 0, sides: [0, 0, 0, 0], threshold: 0 }
  }
  const threshold = Math.min(135, median(values) - 38)
  const dark = Uint8Array.from(values, (value) => Number(value < threshold))
  const x0 = Math.max(0, Math.round(width * 0.08))
  const x1 = Math.min(width, Math.round(width * 0.92))
  const y0 = Math.max(0, Math.round(height * 0.08))
  const y1 = Math.min(height, Math.round(height * 0.92))
  const topEnd = Math.max(1, Math.round(height * 0.34))
  const bottomStart = Math.min(height - 1, Math.round(height * 0.66))
  const leftEnd = Math.max(1, Math.round(width * 0.34))
  const rightStart = Math.min(width - 1, Math.round(width * 0.66))
  const sides = [
    maxMean(dark, width, x0, 0, x1, topEnd, 'row'),
    maxMean(dark, width, rightStart, y0, width, y1, 'column'),
    maxMean(dark, width, x0, bottomStart, x1, height, 'row'),
    maxMean(dark, width, 0, y0, leftEnd, y1, 'column'),
  ]
  return {
    score: Math.min(...sides) * 0.72 + sides.reduce((sum, value) => sum + value, 0) / 4 * 0.28,
    sides,
    threshold,
  }
}

export function selectUniformAnswerView(simpleScore, homographyScore) {
  return Number(homographyScore?.score || 0) >= Number(simpleScore?.score || 0)
    ? 'clean-homography'
    : 'clean-simple-scale'
}
