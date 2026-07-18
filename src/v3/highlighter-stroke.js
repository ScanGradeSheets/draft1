function finite(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function seededUnit(seed) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function signed(seed, amount) {
  return (seededUnit(seed) - 0.5) * 2 * amount
}

export function fluorescentHighlighterGeometry(rect = {}, seed = 1) {
  const x = finite(rect.x)
  const y = finite(rect.y)
  const w = Math.max(1, finite(rect.w, 1))
  const h = Math.max(1, finite(rect.h, 1))
  const left = x - w * (0.01 + seededUnit(seed + 11) * 0.01)
  const right = x + w * (1.01 + seededUnit(seed + 13) * 0.01)
  const direction = seededUnit(seed + 17) < 0.5 ? -1 : 1
  const angle = direction * (0.018 + seededUnit(seed + 19) * 0.034)
  const center = y + h * (0.51 + signed(seed + 23, 0.018))
  const rise = Math.tan(angle) * (right - left)
  const centerline = [
    [left, center],
    [x + w * 0.31, center + rise * 0.31 + signed(seed + 29, h * 0.026)],
    [x + w * 0.68, center + rise * 0.68 + signed(seed + 31, h * 0.026)],
    [right, center + rise],
  ]
  const halfHeight = h * (0.455 + seededUnit(seed + 37) * 0.025)
  const capShear = h * (0.045 + seededUnit(seed + 41) * 0.035)
  const capDirection = angle < 0 ? -1 : 1
  const leftCapShear = capDirection * capShear * (0.96 + signed(seed + 39, 0.04))
  const rightCapShear = capDirection * capShear * (0.96 + signed(seed + 40, 0.04))
  const top = centerline.map(([px, py], index) => [
    px + (index === 0 ? -leftCapShear / 2 : index === centerline.length - 1 ? -rightCapShear / 2 : 0),
    py - halfHeight + signed(seed + 43 + index * 2, h * 0.018),
  ])
  const bottom = centerline.map(([px, py], index) => [
    px + (index === 0 ? leftCapShear / 2 : index === centerline.length - 1 ? rightCapShear / 2 : 0),
    py + halfHeight + signed(seed + 44 + index * 2, h * 0.018),
  ]).reverse()
  return {
    angle,
    centerline,
    polygon: [...top, ...bottom],
    width: halfHeight * 2,
  }
}
