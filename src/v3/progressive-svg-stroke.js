function finiteMilliseconds(value, fallback = 0) {
  const text = String(value ?? '').trim()
  if (!text) return fallback
  const number = Number.parseFloat(text)
  if (!Number.isFinite(number) || number < 0) return fallback
  return text.endsWith('s') && !text.endsWith('ms') ? number * 1000 : number
}

function settleStroke(element) {
  if (!element?.style) return
  element.style.strokeDasharray = 'none'
  element.style.strokeDashoffset = '0'
  element.style.transition = 'none'
}

/**
 * Reveal an SVG pen stroke using its measured physical length.
 *
 * Safari can leave visible holes when `pathLength` normalisation and CSS dash
 * interpolation disagree. Measuring the actual path avoids that rounding, and
 * a two-unit overrun plus the settled solid path closes both round endpoints.
 */
export function startMeasuredProgressiveStroke(element, options = {}) {
  if (!element?.style || typeof element.getTotalLength !== 'function') return null
  const measuredLength = Number(element.getTotalLength())
  if (!(measuredLength > 0)) return null
  const durationMs = finiteMilliseconds(options.durationMs, 500)
  const delayMs = finiteMilliseconds(options.delayMs, 0)
  const revealLength = Math.ceil(measuredLength) + 2
  const dash = `${revealLength} ${revealLength}`

  element.style.animation = 'none'
  element.style.strokeDasharray = dash
  element.style.strokeDashoffset = String(revealLength)

  if (typeof element.animate === 'function') {
    const animation = element.animate(
      [
        { strokeDasharray: dash, strokeDashoffset: String(revealLength) },
        { strokeDasharray: dash, strokeDashoffset: '-2' },
      ],
      {
        duration: durationMs,
        delay: delayMs,
        easing: 'cubic-bezier(0.2, 0.72, 0.26, 1)',
        fill: 'both',
      },
    )
    animation.addEventListener?.('finish', () => settleStroke(element), { once: true })
    if (!animation.addEventListener) animation.onfinish = () => settleStroke(element)
    return animation
  }

  const requestFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0))
  const cancelFrame = globalThis.cancelAnimationFrame || globalThis.clearTimeout
  const frame = requestFrame(() => {
    element.style.transition = `stroke-dashoffset ${durationMs}ms cubic-bezier(0.2, 0.72, 0.26, 1) ${delayMs}ms`
    element.style.strokeDashoffset = '-2'
  })
  const timer = globalThis.setTimeout(() => settleStroke(element), delayMs + durationMs + 34)
  return {
    cancel() {
      cancelFrame(frame)
      globalThis.clearTimeout(timer)
    },
  }
}
