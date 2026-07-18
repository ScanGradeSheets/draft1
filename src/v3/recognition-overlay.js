function finiteBox(region) {
  const left = Number(region?.focusLeftPct ?? region?.leftPct)
  const top = Number(region?.focusTopPct ?? region?.topPct)
  const width = Number(region?.focusWidthPct ?? region?.widthPct)
  const height = Number(region?.focusHeightPct ?? region?.heightPct)
  return [left, top, width, height].every(Number.isFinite)
    ? { left, top, width, height }
    : null
}

function displayText(value) {
  return value === null || value === undefined || value === '' ? '_' : String(value)
}

function itemForBox(questionNum, suffix, text, box) {
  return {
    key: `recognition-${questionNum}-${suffix}`,
    text,
    style: {
      left: `${box.left + box.width / 2}%`,
      top: `${Math.max(1.5, box.top - 0.6)}%`,
    },
  }
}

export function recognitionOverlayItemsForAnswers(answerGroups = [], annotationRegions = []) {
  if (!Array.isArray(answerGroups) || !Array.isArray(annotationRegions)) return []
  return answerGroups.flatMap((group, groupIndex) => {
    const questionNum = Number(group?.questionNum ?? groupIndex + 1)
    const digits = Array.isArray(group?.displayDigits) ? group.displayDigits : []
    const regions = annotationRegions.filter((region) => Number(region?.questionNum) === questionNum)
    const slotRegions = regions
      .filter((region) => Number.isInteger(Number(region?.slotIndex)))
      .map((region) => ({ region, box: finiteBox(region), slotIndex: Number(region.slotIndex) }))
      .filter(({ box }) => box)
      .sort((a, b) => a.slotIndex - b.slotIndex)

    if (slotRegions.length > 0) {
      return slotRegions.map(({ box, slotIndex }) =>
        itemForBox(questionNum, `slot-${slotIndex}`, displayText(digits[slotIndex]), box)
      )
    }

    const boxes = regions.map(finiteBox).filter(Boolean)
    if (!boxes.length) return []
    const left = Math.min(...boxes.map((box) => box.left))
    const right = Math.max(...boxes.map((box) => box.left + box.width))
    const top = Math.min(...boxes.map((box) => box.top))
    const bottom = Math.max(...boxes.map((box) => box.top + box.height))
    return [itemForBox(
      questionNum,
      'answer',
      digits.map(displayText).join('') || '_',
      { left, top, width: right - left, height: bottom - top },
    )]
  })
}
