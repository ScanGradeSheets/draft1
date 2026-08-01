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

function measuredStrokeSpec(element) {
  if (!element?.style || typeof element.getTotalLength !== 'function') return null
  const measuredLength = Number(element.getTotalLength())
  if (!(measuredLength > 0)) return null
  const attributeWidth = Number(element.getAttribute?.('stroke-width'))
  const strokeWidth = Number.isFinite(attributeWidth) && attributeWidth > 0 ? attributeWidth : 0
  // WebKit can leave the last few pixels of a dashed path hidden until the
  // dash is removed. Run the animated dash beyond the physical endpoint by
  // at least four units, scaled for broad teacher-ink reveal masks.
  const endpointOverrun = Math.max(4, Math.ceil(strokeWidth * 0.75))
  const revealLength = Math.ceil(measuredLength) + endpointOverrun
  return {
    endpointOverrun,
    revealLength,
    dash: `${revealLength} ${revealLength}`,
  }
}

function hidePreparedStroke(element) {
  const spec = measuredStrokeSpec(element)
  if (!spec) return null
  element.style.animation = 'none'
  element.style.strokeDasharray = spec.dash
  element.style.strokeDashoffset = String(spec.revealLength)
  element.style.opacity = '0'
  element.style.transition = 'none'
  return spec
}

/**
 * Reveal an SVG pen stroke using its measured physical length.
 *
 * Safari can leave visible holes when `pathLength` normalisation and CSS dash
 * interpolation disagree. Measuring the actual path avoids that rounding, and
 * a stroke-width-aware overrun plus the settled solid path closes both round
 * endpoints, including WebKit's occasional late final pixels.
 */
export function startMeasuredProgressiveStroke(element, options = {}) {
  const spec = measuredStrokeSpec(element)
  if (!spec) return null
  const durationMs = finiteMilliseconds(options.durationMs, 500)
  const delayMs = finiteMilliseconds(options.delayMs, 0)
  const { dash, revealLength, endpointOverrun } = spec

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
        { strokeDasharray: dash, strokeDashoffset: String(-endpointOverrun), opacity: '1' },
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
      element.style.strokeDashoffset = String(-endpointOverrun)
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

function waitForAnimation(animation, fallbackMs, timers) {
  if (animation?.finished && typeof animation.finished.then === 'function') {
    return animation.finished.catch(() => undefined)
  }
  return new Promise((resolve) => {
    let settled = false
    let timer = null
    const finish = () => {
      if (settled) return
      settled = true
      if (timer != null) {
        globalThis.clearTimeout(timer)
        timers.delete(timer)
      }
      resolve()
    }
    animation?.addEventListener?.('finish', finish, { once: true })
    timer = globalThis.setTimeout(finish, Math.max(0, fallbackMs) + 50)
    timers.add(timer)
  })
}

/**
 * Draw a group of teacher strokes in a strict physical sequence.
 *
 * In particular, an X's crossing stroke is not even started until WebKit
 * reports that the first stroke has actually finished. This avoids relying on
 * two independent wall-clock delays, which can overlap when Safari starts one
 * animation a frame late.
 */
export function startMeasuredProgressiveStrokeSequence(elements, options = {}) {
  const strokes = Array.from(elements || []).filter((element) => hidePreparedStroke(element))
  if (!strokes.length) return null

  let cancelled = false
  let activeAnimation = null
  const timers = new Set()
  const registerTimer = (timer) => timers.add(timer)
  const wait = (milliseconds) => new Promise((resolve) => {
    if (!(milliseconds > 0) || cancelled) {
      resolve()
      return
    }
    const timer = globalThis.setTimeout(() => {
      timers.delete(timer)
      resolve()
    }, milliseconds)
    registerTimer(timer)
  })

  const finished = (async () => {
    let previousNominalEnd = 0
    for (const element of strokes) {
      if (cancelled) return
      const durationMs = finiteMilliseconds(
        element.style.getPropertyValue('--progressive-stroke-duration'),
        500,
      )
      const nominalDelayMs = finiteMilliseconds(
        element.style.getPropertyValue('--progressive-stroke-delay'),
        0,
      )
      const penLiftMs = Math.max(0, nominalDelayMs - previousNominalEnd)
      await wait(penLiftMs)
      if (cancelled) return
      activeAnimation = startMeasuredProgressiveStroke(element, {
        durationMs,
        delayMs: 0,
      })
      await waitForAnimation(activeAnimation, durationMs, timers)
      previousNominalEnd = nominalDelayMs + durationMs
    }
  })()

  return {
    finished,
    cancel() {
      cancelled = true
      activeAnimation?.cancel?.()
      timers.forEach((timer) => globalThis.clearTimeout(timer))
      timers.clear()
      strokes.forEach(settleStroke)
      options.onCancel?.()
    },
  }
}
