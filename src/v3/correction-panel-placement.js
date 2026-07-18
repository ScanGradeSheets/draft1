function finite(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Anchors the correction card above or below the physical answer. The card's
 * actual rendered height is intentionally not part of the arrow calculation:
 * translateY moves the entire card while the arrow remains attached to the
 * answer center. This avoids the old side-arrow drift on dynamic-height cards.
 */
export function correctionPanelPlacementForRegion(region, options = {}) {
  if (!region) return null
  const focusLeft = finite(region.focusLeftPct, finite(region.leftPct, NaN))
  const focusTop = finite(region.focusTopPct, finite(region.topPct, NaN))
  const focusWidth = finite(region.focusWidthPct, finite(region.widthPct, NaN))
  const focusHeight = finite(region.focusHeightPct, finite(region.heightPct, NaN))
  if (![focusLeft, focusTop, focusWidth, focusHeight].every(Number.isFinite)) return null

  const panelWidth = finite(options.panelWidthPct, 40)
  const estimatedPanelHeight = finite(options.estimatedPanelHeightPct, 25)
  const gap = finite(options.gapPct, 1.65)
  const bounds = options.bounds || { left: 2, top: 4, right: 98, bottom: 96 }
  const focusBottom = focusTop + focusHeight
  const targetX = focusLeft + focusWidth / 2
  const spaceAbove = focusTop - bounds.top
  const spaceBelow = bounds.bottom - focusBottom
  const placement = spaceBelow >= estimatedPanelHeight + gap && (spaceBelow >= spaceAbove || focusTop < 42)
    ? 'below'
    : 'above'
  const left = clamp(targetX - panelWidth / 2, bounds.left, bounds.right - panelWidth)
  const arrowX = clamp(((targetX - left) / panelWidth) * 100, 10, 90)

  return {
    placement,
    left,
    top: placement === 'below' ? focusBottom + gap : focusTop - gap,
    width: panelWidth,
    transform: placement === 'above' ? 'translateY(-100%)' : 'none',
    arrowX,
    arrowY: placement === 'above' ? 100 : 0,
    targetX,
    targetY: placement === 'above' ? focusTop : focusBottom,
  }
}
