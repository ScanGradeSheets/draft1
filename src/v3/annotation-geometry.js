/**
 * Pick the physical rectangle that teacher marks should surround or sit beside.
 *
 * `boxRect` is the answer frame actually detected on this photographed page.
 * `expectedRect` is only the template prediction and can visibly drift after
 * local paper distortion. OCR may still use the expected rectangle as a
 * fallback, but annotations should follow the detected ink/box whenever it is
 * available.
 */
export function annotationRectForCrop(crop) {
  return crop?.layoutBoxRect || crop?.boxRect || crop?.refinedRect || crop?.expectedRect || crop?.cropRect || null
}
