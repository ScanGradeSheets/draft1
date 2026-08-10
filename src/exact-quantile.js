function swap(values, left, right) {
  const value = values[left]
  values[left] = values[right]
  values[right] = value
}

function partition(values, left, right, pivotIndex) {
  const pivotValue = values[pivotIndex]
  swap(values, pivotIndex, right)
  let storeIndex = left
  for (let index = left; index < right; index += 1) {
    if (values[index] < pivotValue) {
      swap(values, storeIndex, index)
      storeIndex += 1
    }
  }
  swap(values, right, storeIndex)
  return storeIndex
}

function selectIndex(values, targetIndex) {
  let left = 0
  let right = values.length - 1
  while (left < right) {
    const pivotIndex = left + Math.floor((right - left) / 2)
    const nextPivot = partition(values, left, right, pivotIndex)
    if (nextPivot === targetIndex) return values[nextPivot]
    if (targetIndex < nextPivot) right = nextPivot - 1
    else left = nextPivot + 1
  }
  return values[left]
}

export function exactQuantile(values, q) {
  if (!values || values.length === 0) return 0
  const copy = Array.from(values)
  const targetIndex = Math.max(
    0,
    Math.min(copy.length - 1, Math.round((copy.length - 1) * q)),
  )
  return selectIndex(copy, targetIndex)
}
