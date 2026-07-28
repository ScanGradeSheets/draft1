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
  element.style.opacity = '1'
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
  // Delayed strokes must be completely absent until their own draw interval.
  // `forwards` fill leaves this underlying opacity in force during the delay,
  // preventing WebKit from exposing a round linecap before the pen is lifted.
  element.style.opacity = delayMs > 0 ? '0' : '1'

  if (typeof element.animate === 'function') {
    const animation = element.animate(
      [
        { strokeDasharray: dash, strokeDashoffset: String(revealLength), opacity: '1' },
        { strokeDasharray: dash, strokeDashoffset: '-2', opacity: '1' },
      ],
      {
        duration: durationMs,
        delay: delayMs,
        easing: 'cubic-bezier(0.2, 0.72, 0.26, 1)',
        fill: 'forwards',
      },
    )
    animation.addEventListener?.('finish', () => settleStroke(element), { once: true })
    if (!animation.addEventListener) animation.onfinish = () => settleStroke(element)
    return animation
  }

  const requestFrame = globalThis.requestAnimationFrame || ((callback) => globalThis.setTimeout(callback, 0))
  const cancelFrame = globalThis.cancelAnimationFrame || globalThis.clearTimeout
  let beginTimer = null
  const frame = requestFrame(() => {
    const begin = () => {
      element.style.opacity = '1'
      element.style.transition = `stroke-dashoffset ${durationMs}ms cubic-bezier(0.2, 0.72, 0.26, 1)`
      element.style.strokeDashoffset = '-2'
    }
    if (delayMs > 0) beginTimer = globalThis.setTimeout(begin, delayMs)
    else begin()
  })
  const timer = globalThis.setTimeout(() => settleStroke(element), delayMs + durationMs + 34)
  return {
    cancel() {
      cancelFrame(frame)
      if (beginTimer != null) globalThis.clearTimeout(beginTimer)
      globalThis.clearTimeout(timer)
    },
  }
}
