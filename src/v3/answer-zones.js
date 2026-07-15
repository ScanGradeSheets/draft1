const DEFAULT_WARP_WIDTH = 1700
const DEFAULT_WARP_HEIGHT = 2200

function clamp(value, low, high) {
  return Math.max(low, Math.min(high, value))
}

function finiteRect(rect) {
  return rect && [rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) && rect.w > 0 && rect.h > 0
}

export function layoutBoxRect(box, layout, width = DEFAULT_WARP_WIDTH, height = DEFAULT_WARP_HEIGHT) {
  if (!box || !layout?.page) return null
  if (layout.page.units === 'normalized') {
    return {
      x: (box.x - box.width) * width,
      y: (box.y - box.height) * height,
      w: box.width * width,
      h: box.height * height,
    }
  }
  const scaleX = width / Number(layout.page.width_mm)
  const scaleY = height / Number(layout.page.height_mm)
  if (![scaleX, scaleY, box.cx, box.cy, box.width, box.height].every(Number.isFinite)) return null
  const w = box.width * scaleX
  const h = box.height * scaleY
  return { x: box.cx * scaleX - w / 2, y: box.cy * scaleY - h / 2, w, h }
}

export function unionRects(rects) {
  const valid = (rects || []).filter(finiteRect)
  if (!valid.length) return null
  const x0 = Math.min(...valid.map((rect) => rect.x))
  const y0 = Math.min(...valid.map((rect) => rect.y))
  const x1 = Math.max(...valid.map((rect) => rect.x + rect.w))
  const y1 = Math.max(...valid.map((rect) => rect.y + rect.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function clampAndRoundRect(rect, width, height) {
  if (!finiteRect(rect)) return null
  const x0 = clamp(Math.floor(rect.x), 0, Math.max(0, width - 1))
  const y0 = clamp(Math.floor(rect.y), 0, Math.max(0, height - 1))
  const x1 = clamp(Math.ceil(rect.x + rect.w), x0 + 1, width)
  const y1 = clamp(Math.ceil(rect.y + rect.h), y0 + 1, height)
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

/**
 * Resolve one continuous question-level region on the canonical page.
 * Refined rects may move the region, but never supply pixels: the final image
 * is cropped once from the lossless warped page, not stitched from slot crops.
 */
export function answerZoneRect(group, layout, options = {}) {
  const width = Number(options.width || DEFAULT_WARP_WIDTH)
  const height = Number(options.height || DEFAULT_WARP_HEIGHT)
  const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
  if (!ids.length) return null
  const boxById = new Map((layout?.boxes || []).map((box) => [box.id, box]))
  const refinedById = new Map((options.geometrySource === 'layout' ? [] : (options.refinedRects || [])).map((item) => [item.id, item]))
  const rects = ids.map((id) => {
    const refined = refinedById.get(id)
    const refinedRect = refined?.refinedRect || refined?.boxRect
    return finiteRect(refinedRect) ? refinedRect : layoutBoxRect(boxById.get(id), layout, width, height)
  })
  const union = unionRects(rects)
  if (!union) return null
  const reference = Math.max(1, Math.min(union.h, ...rects.filter(finiteRect).map((rect) => rect.h)))
  const marginX = Number.isFinite(options.marginX) ? options.marginX : reference * 0.08
  const marginY = Number.isFinite(options.marginY) ? options.marginY : reference * 0.08
  return clampAndRoundRect({
    x: union.x - marginX,
    y: union.y - marginY,
    w: union.w + marginX * 2,
    h: union.h + marginY * 2,
  }, width, height)
}

/**
 * Resolve a second, bounded context region around an answer zone. This keeps
 * untouched pixels that may contain pencil strokes crossing the printed box.
 * It is independent of the mathematical answer and never replaces the primary
 * crop by itself.
 */
export function answerContextRect(group, layout, options = {}) {
  const width = Number(options.width || DEFAULT_WARP_WIDTH)
  const height = Number(options.height || DEFAULT_WARP_HEIGHT)
  const primary = answerZoneRect(group, layout, options)
  if (!primary) return null
  const reference = Math.max(1, primary.h)
  const marginX = Number.isFinite(options.contextMarginX) ? options.contextMarginX : reference * 0.38
  const marginY = Number.isFinite(options.contextMarginY) ? options.contextMarginY : reference * 0.38
  return clampAndRoundRect({
    x: primary.x - marginX,
    y: primary.y - marginY,
    w: primary.w + marginX * 2,
    h: primary.h + marginY * 2,
  }, width, height)
}

function rectContainsPoint(rect, x, y, inset = 0) {
  return x >= rect.x + inset && y >= rect.y + inset && x < rect.x + rect.w - inset && y < rect.y + rect.h - inset
}

/**
 * Key-blind crop-containment diagnostic. `gray` is the larger context image;
 * `primaryRect` is expressed in that image's coordinates. Long straight rules
 * are suppressed before connected components are measured so printed answer
 * frames do not automatically look like escaping handwriting.
 */
export function analyzeCropContainment(gray, width, height, primaryRect) {
  const values = Array.from(gray || [])
  if (!finiteRect(primaryRect) || values.length !== width * height) return null
  const sorted = [...values].sort((a, b) => a - b)
  const p10 = quantile(sorted, .10)
  const p90 = quantile(sorted, .90)
  const threshold = p90 - Math.max(18, (p90 - p10) * .30)
  const ink = Uint8Array.from(values, (value) => Number(value < threshold))

  // Suppress only near-complete straight rules. Child strokes are shorter and
  // remain available to connect the primary crop with its surrounding ring.
  for (let y = 0; y < height; y += 1) {
    let count = 0
    for (let x = 0; x < width; x += 1) count += ink[y * width + x]
    if (count >= width * .72) for (let yy = Math.max(0, y - 2); yy <= Math.min(height - 1, y + 2); yy += 1) {
      for (let x = 0; x < width; x += 1) ink[yy * width + x] = 0
    }
  }
  for (let x = 0; x < width; x += 1) {
    let count = 0
    for (let y = 0; y < height; y += 1) count += ink[y * width + x]
    if (count >= height * .72) for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx += 1) {
      for (let y = 0; y < height; y += 1) ink[y * width + xx] = 0
    }
  }

  const seen = new Uint8Array(ink.length)
  const components = []
  for (let start = 0; start < ink.length; start += 1) {
    if (!ink[start] || seen[start]) continue
    const queue = [start]
    seen[start] = 1
    let area = 0, inside = 0, outside = 0
    let minX = width, maxX = 0, minY = height, maxY = 0
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]
      const x = index % width
      const y = Math.floor(index / width)
      area += 1
      if (rectContainsPoint(primaryRect, x, y)) inside += 1
      else outside += 1
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx, ny = y + dy
        if ((dx === 0 && dy === 0) || nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const next = ny * width + nx
        if (ink[next] && !seen[next]) { seen[next] = 1; queue.push(next) }
      }
    }
    if (area >= Math.max(10, width * height * .00035)) components.push({
      area, inside, outside, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1,
      crossesPrimaryBoundary: inside >= 4 && outside >= 4,
    })
  }
  const boundaryCrossers = components.filter((component) => (
    component.crossesPrimaryBoundary &&
    component.area >= Math.max(18, width * height * .0007) &&
    component.h >= Math.max(5, primaryRect.h * .08)
  ))
  const outsideInk = components.reduce((sum, component) => sum + component.outside, 0)
  const insideInk = components.reduce((sum, component) => sum + component.inside, 0)
  return {
    suspicious: boundaryCrossers.length > 0,
    boundaryCrosserCount: boundaryCrossers.length,
    outsideInkFraction: outsideInk / Math.max(1, width * height - primaryRect.w * primaryRect.h),
    insideInkFraction: insideInk / Math.max(1, primaryRect.w * primaryRect.h),
    components: components.slice(0, 20),
  }
}

function quantile(sorted, q) {
  if (!sorted.length) return 0
  return sorted[Math.round((sorted.length - 1) * q)]
}

export function grayscaleQuality(gray, width, height) {
  const values = Array.from(gray || [])
  if (!values.length || width * height !== values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  const p05 = quantile(sorted, 0.05)
  const p50 = quantile(sorted, 0.50)
  const p95 = quantile(sorted, 0.95)
  let edgeSum = 0
  let edgeCount = 0
  let lapSum = 0
  let lapSqSum = 0
  let lapCount = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x
      if (x + 1 < width) { edgeSum += Math.abs(values[index] - values[index + 1]); edgeCount += 1 }
      if (y + 1 < height) { edgeSum += Math.abs(values[index] - values[index + width]); edgeCount += 1 }
      if (x > 0 && x + 1 < width && y > 0 && y + 1 < height) {
        const lap = values[index - 1] + values[index + 1] + values[index - width] + values[index + width] - 4 * values[index]
        lapSum += lap
        lapSqSum += lap * lap
        lapCount += 1
      }
    }
  }
  const lapMean = lapCount ? lapSum / lapCount : 0
  const tileMeans = []
  for (let ty = 0; ty < 2; ty += 1) {
    for (let tx = 0; tx < 3; tx += 1) {
      const x0 = Math.floor(tx * width / 3)
      const x1 = Math.floor((tx + 1) * width / 3)
      const y0 = Math.floor(ty * height / 2)
      const y1 = Math.floor((ty + 1) * height / 2)
      let sum = 0
      let count = 0
      for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) { sum += values[y * width + x]; count += 1 }
      if (count) tileMeans.push(sum / count)
    }
  }
  const inkThreshold = p95 - Math.max(12, (p95 - p05) * 0.22)
  return {
    width,
    height,
    mean: Number(mean.toFixed(3)),
    standardDeviation: Number(Math.sqrt(variance).toFixed(3)),
    p05,
    p50,
    p95,
    contrastRange: p95 - p05,
    darkClipFraction: values.filter((value) => value <= 8).length / values.length,
    lightClipFraction: values.filter((value) => value >= 247).length / values.length,
    estimatedInkFraction: values.filter((value) => value < inkThreshold).length / values.length,
    meanEdgeMagnitude: edgeCount ? edgeSum / edgeCount : 0,
    laplacianVariance: lapCount ? lapSqSum / lapCount - lapMean ** 2 : 0,
    illuminationRange: tileMeans.length ? Math.max(...tileMeans) - Math.min(...tileMeans) : 0,
  }
}

/** Independent, key-blind blank/artifact evidence from the grayscale zone. */
export function analyzeBlankArtifact(gray, width, height) {
  const values = Array.from(gray || [])
  if (!values.length || values.length !== width * height) return null
  const sorted = [...values].sort((a, b) => a - b)
  const p05 = quantile(sorted, .05)
  const p95 = quantile(sorted, .95)
  const threshold = p95 - Math.max(18, (p95 - p05) * .28)
  const ink = Uint8Array.from(values, (value) => Number(value < threshold))
  for (let y = 0; y < height; y += 1) {
    let count = 0
    for (let x = 0; x < width; x += 1) count += ink[y * width + x]
    if (count >= width * .58 && (y <= height * .16 || y >= height * .84)) {
      for (let yy = Math.max(0, y - 2); yy <= Math.min(height - 1, y + 2); yy += 1) {
        for (let x = 0; x < width; x += 1) ink[yy * width + x] = 0
      }
    }
  }
  for (let x = 0; x < width; x += 1) {
    let count = 0
    for (let y = 0; y < height; y += 1) count += ink[y * width + x]
    if (count >= height * .58 && (x <= width * .12 || x >= width * .88)) {
      for (let xx = Math.max(0, x - 2); xx <= Math.min(width - 1, x + 2); xx += 1) {
        for (let y = 0; y < height; y += 1) ink[y * width + xx] = 0
      }
    }
  }
  const seen = new Uint8Array(ink.length)
  const components = []
  for (let start = 0; start < ink.length; start += 1) {
    if (!ink[start] || seen[start]) continue
    const queue = [start]
    seen[start] = 1
    let area = 0
    let minX = width, maxX = 0, minY = height, maxY = 0
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]
      const x = index % width
      const y = Math.floor(index / width)
      area += 1
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
        const nx = x + dx, ny = y + dy
        if ((dx === 0 && dy === 0) || nx < 0 || nx >= width || ny < 0 || ny >= height) continue
        const next = ny * width + nx
        if (ink[next] && !seen[next]) { seen[next] = 1; queue.push(next) }
      }
    }
    if (area >= 3) components.push({
      area, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1,
      touchesEdge: minX <= 1 || minY <= 1 || maxX >= width - 2 || maxY >= height - 2,
    })
  }
  const meaningful = components.filter((component) => component.area >= Math.max(8, width * height * .00045))
  const digitLike = meaningful.filter((component) => (
    !component.touchesEdge && component.h >= height * .16 && component.w >= Math.max(3, width * .018) &&
    component.w <= width * .48 && component.h <= height * .9
  ))
  const residualInk = ink.reduce((sum, value) => sum + value, 0) / ink.length
  const artifactOnly = meaningful.length > 0 && digitLike.length === 0
  const blankConfidence = digitLike.length === 0
    ? clamp(1 - residualInk / .018 - meaningful.length * .05, 0, 1)
    : 0
  return {
    isBlankCandidate: blankConfidence >= .995,
    blankConfidence,
    artifactProbability: artifactOnly ? clamp(.55 + residualInk * 8, 0, 1) : 0,
    residualInkFraction: residualInk,
    meaningfulComponentCount: meaningful.length,
    digitLikeComponentCount: digitLike.length,
    components: meaningful.slice(0, 12),
  }
}

function matGrayscale(mat) {
  const channels = typeof mat.channels === 'function' ? mat.channels() : Math.max(1, Math.round(mat.data.length / (mat.rows * mat.cols)))
  const gray = new Uint8Array(mat.rows * mat.cols)
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * channels
    gray[index] = channels === 1
      ? mat.data[offset]
      : Math.round(0.299 * mat.data[offset] + 0.587 * mat.data[offset + 1] + 0.114 * mat.data[offset + 2])
  }
  return gray
}

export function printedFrameEraseRects(width, height, slotCount = 1) {
  const edgeX = Math.max(1, Math.round(width * 0.115))
  const edgeY = Math.max(1, Math.round(height * 0.115))
  const rects = [
    { x: 0, y: 0, w: width, h: edgeY },
    { x: 0, y: height - edgeY, w: width, h: edgeY },
    { x: 0, y: 0, w: edgeX, h: height },
    { x: width - edgeX, y: 0, w: edgeX, h: height },
  ]
  if (Number(slotCount) > 1) {
    const centerW = Math.max(2, Math.round(width * 0.035))
    const centerX = Math.round(width / 2 - centerW / 2)
    const guideH = Math.max(1, Math.round(height * 0.24))
    rects.push(
      { x: centerX, y: 0, w: centerW, h: guideH },
      { x: centerX, y: height - guideH, w: centerW, h: guideH },
    )
  }
  return rects
}

function erasePrintedFrame(image, slotCount, cvApi) {
  const paper = new cvApi.Scalar(255, 255, 255, 255)
  for (const rect of printedFrameEraseRects(image.cols, image.rows, slotCount)) {
    cvApi.rectangle(
      image,
      new cvApi.Point(rect.x, rect.y),
      new cvApi.Point(rect.x + rect.w, rect.y + rect.h),
      paper,
      -1,
    )
  }
}

export function extractContinuousAnswerZones(warpedImage, layout, options = {}) {
  const cvApi = options.cv || globalThis.cv
  if (!warpedImage || !cvApi?.Rect) throw new Error('OpenCV and a warped page are required')
  const refinedRects = options.refinedRects || options.rawCrops || []
  return (layout?.question_groups || []).map((group, index) => {
    const rectResolver = options.context === true ? answerContextRect : answerZoneRect
    const rect = rectResolver(group, layout, {
      width: warpedImage.cols,
      height: warpedImage.rows,
      refinedRects,
      geometrySource: options.geometrySource,
      marginX: options.marginX,
      marginY: options.marginY,
      contextMarginX: options.contextMarginX,
      contextMarginY: options.contextMarginY,
    })
    if (!rect) return null
    const image = warpedImage.roi(new cvApi.Rect(rect.x, rect.y, rect.w, rect.h)).clone()
    if (options.cleanPrintedFrame === true) {
      erasePrintedFrame(image, group?.digit_box_ids?.length || 1, cvApi)
    }
    const gray = matGrayscale(image)
    return {
      schemaVersion: 1,
      questionNum: group?.question_num ?? index + 1,
      digitBoxIds: [...(group?.digit_box_ids || [])],
      source: options.context === true
        ? 'canonical-warp-expanded-context-grayscale'
        : (options.cleanPrintedFrame === true
            ? 'canonical-warp-continuous-grayscale-frame-cleaned'
            : 'canonical-warp-continuous-grayscale'),
      rect,
      image,
      quality: grayscaleQuality(gray, image.cols, image.rows),
      blankArtifact: analyzeBlankArtifact(gray, image.cols, image.rows),
    }
  }).filter(Boolean)
}
