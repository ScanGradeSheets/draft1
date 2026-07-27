function numericRead(value) {
  const text = String(value?.text ?? value?.read ?? '').trim()
  return /^\d{1,4}$/.test(text) ? text : ''
}

function probability(value) {
  return Number(
    value?.minTokenProbability ??
    value?.sequenceProbability ??
    value?.probability ??
    0,
  )
}

/**
 * Reduce retained-frame whole-answer reads to the exact Candidate 2 contract.
 *
 * Only three complete reads from three distinct physical frames are eligible.
 * They must agree exactly. Extra frames are deliberately ignored so capture
 * burst length cannot silently change the frozen three-frame policy.
 */
export function browserLocalThreeFrameConsensus(rows = []) {
  const byFrame = new Map()
  for (const row of rows) {
    const frameIndex = Number(row?.frameIndex)
    if (
      row?.status !== 'complete' ||
      !Number.isFinite(frameIndex) ||
      byFrame.has(frameIndex) ||
      !numericRead(row)
    ) continue
    byFrame.set(frameIndex, row)
    if (byFrame.size === 3) break
  }

  const selected = [...byFrame.values()]
  const reads = selected.map(numericRead)
  const unanimous = selected.length === 3 && new Set(reads).size === 1
  return {
    available: selected.length === 3,
    threeOfThree: unanimous,
    read: unanimous ? reads[0] : '',
    probability: unanimous
      ? Math.min(...selected.map(probability))
      : 0,
    frameIndices: selected.map((row) => Number(row.frameIndex)),
  }
}
