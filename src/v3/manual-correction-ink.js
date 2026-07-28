function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}
function jitter(seed, amount) {
  return (seededUnit(seed) - 0.5) * 2 * amount
}

/**
 * Draw the correction tape and black teacher entry used both by the live
 * editor and the settled worksheet. Sharing this renderer prevents the entry
 * from changing size or position when focus advances.
 */
export function drawManualCorrectionInk(ctx, rects, cells, seed) {
  if (!ctx || !Array.isArray(rects) || !Array.isArray(cells)) return
  const visibleEntries = rects
    .map((rect, index) => ({ rect, cell: cells[index] }))
    .filter(({ rect, cell }) => rect && cell !== null && cell !== undefined && cell !== '')
  const validRects = visibleEntries.map(({ rect }) => rect)
  if (!validRects.length) return

  ctx.save()
  const tapeX0 = Math.min(...validRects.map((rect) => rect.x))
  const tapeY0 = Math.min(...validRects.map((rect) => rect.y))
  const tapeX1 = Math.max(...validRects.map((rect) => rect.x + rect.w))
  const tapeY1 = Math.max(...validRects.map((rect) => rect.y + rect.h))
  const tapeW = tapeX1 - tapeX0
  const tapeH = tapeY1 - tapeY0
  const tapeInsetX = -tapeW * 0.035
  const tapeInsetY = tapeH * 0.045
  const centerX = tapeX0 + tapeW / 2 + jitter(seed + 401, tapeW * 0.01)
  const centerY = tapeY0 + tapeH / 2 + jitter(seed + 403, tapeH * 0.012)
  const stripW = tapeW - tapeInsetX * 2
  const stripH = tapeH - tapeInsetY * 2
  const angle = jitter(seed + 409, 0.012)
  const roughTapePath = () => {
    const left = -stripW / 2
    const right = stripW / 2
    const top = -stripH / 2
    const bottom = stripH / 2
    ctx.beginPath()
    ctx.moveTo(left + jitter(seed + 421, stripW * 0.012), top + jitter(seed + 423, stripH * 0.05))
    ctx.lineTo(left + stripW * 0.25, top + jitter(seed + 425, stripH * 0.035))
    ctx.lineTo(left + stripW * 0.56, top + jitter(seed + 427, stripH * 0.03))
    ctx.lineTo(right + jitter(seed + 429, stripW * 0.012), top + jitter(seed + 431, stripH * 0.06))
    ctx.lineTo(right + jitter(seed + 433, stripW * 0.012), bottom + jitter(seed + 435, stripH * 0.06))
    ctx.lineTo(left + stripW * 0.62, bottom + jitter(seed + 437, stripH * 0.035))
    ctx.lineTo(left + stripW * 0.27, bottom + jitter(seed + 439, stripH * 0.04))
    ctx.lineTo(left + jitter(seed + 441, stripW * 0.012), bottom + jitter(seed + 443, stripH * 0.06))
    ctx.closePath()
  }

  ctx.save()
  ctx.translate(centerX, centerY)
  ctx.rotate(angle)
  roughTapePath()
  ctx.globalAlpha = 0.16
  ctx.fillStyle = 'rgba(86, 79, 64, 0.32)'
  ctx.translate(0.8, 1.2)
  ctx.fill()
  ctx.translate(-0.8, -1.2)
  roughTapePath()
  ctx.globalAlpha = 0.92
  ctx.fillStyle = '#fbfaf4'
  ctx.fill()
  ctx.globalAlpha = 0.42
  ctx.strokeStyle = 'rgba(203, 196, 178, 0.72)'
  ctx.lineWidth = Math.max(1.4, tapeH * 0.018)
  ctx.stroke()
  for (let scratch = 0; scratch < 4; scratch++) {
    const scratchSeed = seed + 461 + scratch * 17
    ctx.globalAlpha = 0.13 + seededUnit(scratchSeed) * 0.08
    ctx.strokeStyle = 'rgba(176, 169, 150, 0.55)'
    ctx.lineWidth = Math.max(0.8, tapeH * 0.009)
    ctx.beginPath()
    const sx = -stripW * 0.42 + seededUnit(scratchSeed + 3) * stripW * 0.84
    const sy = -stripH * 0.28 + seededUnit(scratchSeed + 5) * stripH * 0.56
    ctx.moveTo(sx, sy)
    ctx.lineTo(
      sx + stripW * (0.1 + seededUnit(scratchSeed + 7) * 0.18),
      sy + jitter(scratchSeed + 9, stripH * 0.06),
    )
    ctx.stroke()
  }
  ctx.restore()

  visibleEntries.forEach(({ rect, cell: digit }, index) => {
    const digitText = String(digit)
    const widthScale = digitText.length > 1 ? 0.58 : 1.05
    const minimumSize = digitText.length > 1 ? 30 : 38
    const fontSize = Math.max(minimumSize, Math.min(rect.h * 0.86, rect.w * widthScale))
    const x = rect.x + rect.w * 0.52 + jitter(seed + index * 17, rect.w * 0.035)
    const y = rect.y + rect.h * 0.58 + jitter(seed + index * 19, rect.h * 0.035)
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(jitter(seed + index * 23, 0.03))
    ctx.font = `600 ${fontSize}px "Marker Felt", "Comic Sans MS", "Chalkboard SE", system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.lineWidth = Math.max(3, fontSize * 0.08)
    ctx.strokeText(digitText, 0, 0)
    ctx.fillStyle = '#171717'
    ctx.globalAlpha = 0.92
    ctx.fillText(digitText, 0, 0)
    ctx.globalAlpha = 0.1
    ctx.fillText(digitText, jitter(seed + index * 29, 1.3), jitter(seed + index * 31, 1.1))
    ctx.restore()
  })
  ctx.restore()
}
