import {
  selectUniformAnswerView,
  uniformAnswerViewPlan,
  uniformPrintedFrameScore,
} from './uniform-answer-view.js'

function cropDimensions(rect) {
  if (!Array.isArray(rect) || rect.length !== 4) return null
  const [x0, y0, x1, y1] = rect.map(Number)
  const width = Math.max(0, Math.round(x1 - x0))
  const height = Math.max(0, Math.round(y1 - y0))
  if (![x0, y0, width, height].every(Number.isFinite) || width < 2 || height < 2) return null
  return { x: Math.round(x0), y: Math.round(y0), width, height }
}

function grayForCanvas(canvas) {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data
  const gray = new Uint8Array(canvas.width * canvas.height)
  for (let index = 0; index < gray.length; index += 1) {
    const offset = index * 4
    gray[index] = Math.round(
      0.299 * rgba[offset] +
      0.587 * rgba[offset + 1] +
      0.114 * rgba[offset + 2],
    )
  }
  return gray
}

function simpleCropCanvas(sourceCanvas, rect, createCanvas) {
  const crop = cropDimensions(rect)
  if (!crop) return null
  const canvas = createCanvas()
  canvas.width = crop.width
  canvas.height = crop.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.fillStyle = '#fff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(
    sourceCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  )
  return canvas
}

function homographyCropCanvas(warpedImage, rect, cv, createCanvas) {
  const crop = cropDimensions(rect)
  if (!crop) return null
  let roi = null
  try {
    roi = warpedImage.roi(new cv.Rect(crop.x, crop.y, crop.width, crop.height))
    const canvas = createCanvas()
    canvas.width = crop.width
    canvas.height = crop.height
    cv.imshow(canvas, roi)
    return canvas
  } finally {
    try { roi?.delete?.() } catch (_) {}
  }
}

/**
 * Materialize the frozen, layout-derived uniform answer views while the page
 * pixels are still resident. It uses geometry and printed-frame completeness
 * only—never OCR text, truth, or an answer key.
 */
export function browserUniformAnswerViews({
  layout,
  zones,
  warpedImage,
  sourceCanvas,
  cv,
  questionNums = null,
  createCanvas = () => document.createElement('canvas'),
} = {}) {
  if (!warpedImage || !sourceCanvas || !cv) return []
  const plan = uniformAnswerViewPlan({
    layout,
    zones,
    width: warpedImage.cols,
    height: warpedImage.rows,
    simpleWidth: sourceCanvas.width,
    simpleHeight: sourceCanvas.height,
  })
  const requested = questionNums
    ? new Set([...questionNums].map(Number))
    : null
  const output = []
  for (const entry of plan?.entries || []) {
    if (requested && !requested.has(Number(entry.questionNum))) continue
    const simple = simpleCropCanvas(sourceCanvas, entry.simpleRect, createCanvas)
    const homography = homographyCropCanvas(
      warpedImage,
      entry.homographyRect,
      cv,
      createCanvas,
    )
    if (!simple || !homography) continue
    const simpleFrame = uniformPrintedFrameScore(
      grayForCanvas(simple),
      simple.width,
      simple.height,
    )
    const homographyFrame = uniformPrintedFrameScore(
      grayForCanvas(homography),
      homography.width,
      homography.height,
    )
    const selectedView = selectUniformAnswerView(simpleFrame, homographyFrame)
    const selected = selectedView === 'clean-homography' ? homography : simple
    output.push({
      schemaVersion: 1,
      questionNum: Number(entry.questionNum),
      source: selectedView,
      imageDataUrl: selected.toDataURL('image/png'),
      referenceRect: entry.referenceRect,
      homographyRect: entry.homographyRect,
      simpleRect: entry.simpleRect,
      simpleFrame,
      homographyFrame,
      residual: entry.residual,
      observedZoneIsAffineInlier: entry.observedZoneIsAffineInlier,
      answerKeyUsed: false,
      handwritingTruthUsed: false,
    })
  }
  return output
}
