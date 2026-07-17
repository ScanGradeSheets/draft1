function finite(value) {
  const number = Number(value)
  return Number.isFinite(number) ? Number(number.toFixed(6)) : null
}

function rectSnapshot(rect) {
  if (!rect) return null
  return {
    x: finite(rect.x),
    y: finite(rect.y),
    w: finite(rect.w),
    h: finite(rect.h),
  }
}

/** Stable decorative seed: identical OCR evidence produces identical marks. */
export function annotationSeedForResult({ layoutId = '', annotationGeometry = null, predictions = [] } = {}) {
  const material = JSON.stringify({
    layoutId: String(layoutId || ''),
    dimensions: {
      w: finite(annotationGeometry?.warpedW),
      h: finite(annotationGeometry?.warpedH),
    },
    crops: (annotationGeometry?.crops || []).map((crop) => ({
      id: Number(crop?.id),
      questionNum: Number(crop?.questionNum),
      cropRect: rectSnapshot(crop?.cropRect),
      refinedRect: rectSnapshot(crop?.refinedRect),
    })),
    predictions: (predictions || []).map((prediction) => ({
      id: Number(prediction?.id),
      questionNum: Number(prediction?.questionNum),
      digit: prediction?.digit == null ? null : Number(prediction.digit),
      blank: prediction?.blank === true,
      reviewNeeded: prediction?.reviewNeeded === true,
    })),
  })
  let hash = 2166136261
  for (let index = 0; index < material.length; index += 1) {
    hash ^= material.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0) % 1000000 || 1
}
