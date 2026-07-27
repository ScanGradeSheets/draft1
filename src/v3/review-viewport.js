export function correctionKeyboardScrollDelta({
  targetRect,
  panelRect,
  viewportTop = 0,
  viewportHeight,
  margin = 18,
  bottomOcclusion = 64,
} = {}) {
  const top = Number(viewportTop) || 0
  const height = Number(viewportHeight)
  if (!targetRect || !Number.isFinite(height) || height <= 0) return 0

  const safeTop = top + margin
  // Mobile Safari may place a QuickType/password-domain suggestion strip
  // above its numeric keyboard. visualViewport reports that strip as visible
  // even though it obscures the correction controls, so reserve its height.
  const safeBottom = top + height - margin - Math.max(0, Number(bottomOcclusion) || 0)
  const targetTop = Number(targetRect.top)
  const targetBottom = Number(targetRect.bottom)
  const panelBottom = Number(panelRect?.bottom)
  if (!Number.isFinite(targetTop) || !Number.isFinite(targetBottom)) return 0

  const contentBottom = Math.max(targetBottom, Number.isFinite(panelBottom) ? panelBottom : targetBottom)
  if (targetTop >= safeTop && contentBottom <= safeBottom) return 0

  // Move only far enough to clear the keyboard. Upper answers that already
  // fit remain completely still; lower answers make one bounded motion.
  const requested = Math.max(0, contentBottom - safeBottom)
  const available = Math.max(0, targetTop - safeTop)
  return Math.min(requested, available)
}
