export const WHOLE_SLOT_SCOUT_VERSION = 'whole-slot-scout-shadow-1'
export const WHOLE_SLOT_SCOUT_HEIGHT = 64
export const WHOLE_SLOT_SCOUT_SLOT_WIDTH = 96

function softmax(values = []) {
  const data = Array.from(values, Number)
  const maximum = Math.max(...data)
  const exponentials = data.map((value) => Math.exp(value - maximum))
  const total = exponentials.reduce((sum, value) => sum + value, 0)
  return exponentials.map((value) => total > 0 ? value / total : 0)
}

export function wholeSlotScoutMetadata({ slotCount = 1, layoutFamily = 'row' } = {}) {
  const slots = Number(slotCount) <= 1 ? 1 : 2
  const family = String(layoutFamily || '').toLowerCase()
  const row = family === 'row'
  const numberBond = family.includes('number-bond')
  return new Float32Array([
    slots === 1 ? 1 : 0,
    slots === 2 ? 1 : 0,
    row ? 1 : 0,
    numberBond ? 1 : 0,
    !row && !numberBond ? 1 : 0,
  ])
}

export function decodeWholeSlotScout({ length, tens, ones, slotCount = 1 } = {}) {
  const lengthProbability = softmax(length)
  const tensProbability = softmax(tens)
  const onesProbability = softmax(ones)
  const candidates = []
  for (let digit = 0; digit < 10; digit += 1) {
    candidates.push({
      read: String(digit),
      score: lengthProbability[0] * onesProbability[digit],
    })
  }
  if (Number(slotCount) > 1) {
    for (let left = 0; left < 10; left += 1) {
      for (let right = 0; right < 10; right += 1) {
        candidates.push({
          read: `${left}${right}`,
          score: lengthProbability[1] * tensProbability[left] * onesProbability[right],
        })
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  const total = candidates.reduce((sum, candidate) => sum + candidate.score, 0)
  return {
    read: candidates[0]?.read || null,
    sequenceProbability: total > 0 ? candidates[0].score / total : 0,
  }
}
