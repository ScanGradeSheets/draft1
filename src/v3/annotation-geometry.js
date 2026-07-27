/**
 * Pick the physical rectangle that teacher marks should surround or sit beside.
 *
 * `boxRect` is the answer frame actually detected on this photographed page.
 * `expectedRect` is only the template prediction and can visibly drift after
 * local paper distortion. OCR may still use the expected rectangle as a
 * fallback, but annotations should follow the detected ink/box whenever it is
 * available.
 */
function finiteRect(rect) {
  return rect && [rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) && rect.w > 0 && rect.h > 0
}

function cloneFiniteRect(rect) {
  return finiteRect(rect)
    ? { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
    : null
}

/**
 * Transform every annotation rectangle into the displayed source-photo space.
 * The deterministic layout rectangle must travel with the detected rectangles;
 * otherwise a bad local contour has no reference against which it can be
 * rejected after the warped sheet is projected back onto the camera image.
 */
export function transformAnnotationCrop(crop, transformRect, layoutBoxRect = null) {
  if (!crop || typeof transformRect !== 'function') return crop || null
  const transformOrClone = (rect) => {
    if (!finiteRect(rect)) return null
    return cloneFiniteRect(transformRect(rect)) || cloneFiniteRect(rect)
  }
  return {
    ...crop,
    annotationSpace: 'source-photo',
    cropRect: transformOrClone(crop.cropRect),
    boxRect: transformOrClone(crop.boxRect),
    expectedRect: transformOrClone(crop.expectedRect),
    refinedRect: transformOrClone(crop.refinedRect),
    annotationRect: transformOrClone(crop.annotationRect),
    annotationRectSource: crop.annotationRectSource || null,
    // `crop.expectedRect` is the page-registration rectangle produced in the
    // exact warped coordinate system used to extract this answer. Recomputing
    // the same normalized layout against a later canvas size can shift every
    // answer slot (notably after the pristine 1440×1864 V3 warp). Carry the
    // registration rectangle into source-photo space and use the separately
    // derived layout rectangle only as a fail-safe when it is unavailable.
    layoutBoxRect:
      transformOrClone(crop.annotationRect) ||
      transformOrClone(crop.expectedRect) ||
      transformOrClone(layoutBoxRect || crop.layoutBoxRect),
  }
}

export function annotationLayoutReference(crop, derivedLayoutRect = null) {
  return (
    cloneFiniteRect(crop?.annotationRect) ||
    cloneFiniteRect(crop?.expectedRect) ||
    cloneFiniteRect(crop?.layoutBoxRect) ||
    cloneFiniteRect(derivedLayoutRect)
  )
}

function plausiblyMatchesPrintedBox(candidate, reference) {
  if (!finiteRect(candidate) || !finiteRect(reference)) return false

  const candidateArea = candidate.w * candidate.h
  const referenceArea = reference.w * reference.h
  const areaRatio = candidateArea / referenceArea
  if (areaRatio < 0.5 || areaRatio > 1.9) return false

  const candidateCenterX = candidate.x + candidate.w / 2
  const candidateCenterY = candidate.y + candidate.h / 2
  const referenceCenterX = reference.x + reference.w / 2
  const referenceCenterY = reference.y + reference.h / 2
  const centerDriftX = Math.abs(candidateCenterX - referenceCenterX) / reference.w
  const centerDriftY = Math.abs(candidateCenterY - referenceCenterY) / reference.h

  // A neighbouring digit cell can still overlap enough to pass the coarse
  // overlap check below. Keep small wrinkle/camera corrections, but anchor
  // teacher ink much more tightly than OCR crops so it cannot visibly wander
  // toward the edge or lower half of the printed answer box.
  if (centerDriftX > 0.15 || centerDriftY > 0.15) return false

  const overlapW = Math.max(
    0,
    Math.min(candidate.x + candidate.w, reference.x + reference.w) -
      Math.max(candidate.x, reference.x)
  )
  const overlapH = Math.max(
    0,
    Math.min(candidate.y + candidate.h, reference.y + reference.h) -
      Math.max(candidate.y, reference.y)
  )
  const overlapRatio = (overlapW * overlapH) / Math.min(candidateArea, referenceArea)

  // Local box detection may correct a modest wrinkle or camera distortion, but
  // a detected rectangle that barely overlaps the known printed answer box is
  // usually a number-bond line, circle, or neighbouring box.
  return overlapRatio >= 0.28
}

export function annotationRectForCrop(crop) {
  if (!crop) return null

  const reference = finiteRect(crop.annotationRect)
    ? crop.annotationRect
    : finiteRect(crop.expectedRect)
      ? crop.expectedRect
    : finiteRect(crop.layoutBoxRect)
      ? crop.layoutBoxRect
      : null

  // Source-photo geometry has already passed through the page homography.
  // Applying a second local contour adjustment in that coordinate space can
  // turn wrinkles, nearby bond lines, or perspective AABBs into a visibly
  // displaced teacher mark. Anchor displayed ink to the transformed printed
  // box; OCR retains all refined crops and is deliberately unchanged.
  if (crop.annotationSpace === 'source-photo' && reference) return reference

  // Once a page has been photographed, a plausible detected answer box is the
  // best annotation anchor. Keep it bounded by the known printed box so nearby
  // number-bond lines and circles cannot pull teacher marks away from the
  // student's answer.
  if (finiteRect(crop.boxRect) && (!reference || plausiblyMatchesPrintedBox(crop.boxRect, reference))) {
    return crop.boxRect
  }
  if (finiteRect(crop.refinedRect) && (!reference || plausiblyMatchesPrintedBox(crop.refinedRect, reference))) {
    return crop.refinedRect
  }
  return reference || (finiteRect(crop.cropRect) ? crop.cropRect : null)
}
