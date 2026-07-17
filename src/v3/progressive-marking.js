function finite(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
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
  return answerGroups
    .filter((group) => (
      (group?.status === 'correct' || group?.status === 'incorrect') &&
      group?.reviewNeeded !== true &&
      !excludedQuestionNums.has(Number(group?.questionNum))
    ))
    .map((group) => {
      const questionNum = Number(group.questionNum)
      const rect = union(annotationRegions
        .filter((region) => Number(region?.questionNum) === questionNum)
        .map((region) => {
          const x = finite(region?.x)
          const y = finite(region?.y)
          const w = finite(region?.w)
          const h = finite(region?.h)
          return x == null || y == null || w == null || h == null ? null : { x, y, w, h }
        }))
      if (!rect) return null
      // The natural check/X is deliberately drawn just outside the answer box.
      // Give the reveal mask a small margin without allowing it to expose marks
      // belonging to another question.
      const padX = Math.min(width * 0.025, rect.h * 0.22)
      const padY = Math.min(height * 0.018, rect.h * 0.16)
      const x = Math.max(0, rect.x - padX)
      const y = Math.max(0, rect.y - padY)
      const right = Math.min(width, rect.x + rect.w + padX)
      const bottom = Math.min(height, rect.y + rect.h + padY)
      return {
        key: `mark-question-${questionNum}`,
        questionNum,
        status: group.status,
        x,
        y,
        w: Math.max(1, right - x),
        h: Math.max(1, bottom - y),
      }
    })
    .filter(Boolean)
}
