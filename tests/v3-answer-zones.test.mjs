import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeBlankArtifact, analyzeCropContainment, answerContextRect, answerZoneRect, extractContinuousAnswerZones, grayscaleQuality, layoutBoxRect, printedFrameEraseRects } from '../src/v3/answer-zones.js'

const layout = {
  page: { units: 'normalized' },
  answer_key: [1, 2],
  boxes: [
    { id: 4, x: 0.4, y: 0.5, width: 0.1, height: 0.1 },
    { id: 5, x: 0.5, y: 0.5, width: 0.1, height: 0.1 },
  ],
  question_groups: [{ question_num: 9, answer: 12, digit_box_ids: [4, 5] }],
}

test('normalized layout coordinates use the stored bottom-right convention', () => {
  const rect = layoutBoxRect(layout.boxes[0], layout, 1000, 1000)
  assert.ok(Math.abs(rect.x - 300) < 1e-9)
  assert.deepEqual({ y: rect.y, w: rect.w, h: rect.h }, { y: 400, w: 100, h: 100 })
})

test('answer zone is one continuous rect spanning adjacent digit slots', () => {
  assert.deepEqual(answerZoneRect(layout.question_groups[0], layout, { width: 1000, height: 1000, marginX: 0, marginY: 0 }), {
    x: 300, y: 400, w: 200, h: 100,
  })
})

test('experimental offsets move a zone by a fraction of slot height without changing its size', () => {
  assert.deepEqual(answerZoneRect(layout.question_groups[0], layout, {
    width: 1000,
    height: 1000,
    marginX: 0,
    marginY: 0,
    offsetYFraction: 0.04,
  }), { x: 300, y: 404, w: 200, h: 100 })
})

test('context zone retains bounded pixels around the primary answer crop', () => {
  assert.deepEqual(answerContextRect(layout.question_groups[0], layout, {
    width: 1000,
    height: 1000,
    marginX: 0,
    marginY: 0,
    contextMarginX: 40,
    contextMarginY: 30,
  }), { x: 260, y: 370, w: 280, h: 160 })
})

test('containment flags handwriting-like ink crossing a crop edge but suppresses a full printed rule', () => {
  const width = 40, height = 30
  const primary = { x: 10, y: 7, w: 20, h: 16 }
  const clean = new Uint8Array(width * height).fill(255)
  for (let x = 0; x < width; x += 1) clean[5 * width + x] = 0
  for (let y = 10; y < 20; y += 1) clean[y * width + 20] = 70
  assert.equal(analyzeCropContainment(clean, width, height, primary).suspicious, false)
  const clipped = clean.slice()
  for (let y = 12; y < 27; y += 1) clipped[y * width + 29] = 60
  for (let x = 24; x <= 29; x += 1) clipped[18 * width + x] = 60
  assert.equal(analyzeCropContainment(clipped, width, height, primary).suspicious, true)
})

test('refined geometry can position the continuous crop without supplying its pixels', () => {
  const rect = answerZoneRect(layout.question_groups[0], layout, {
    width: 1000,
    height: 1000,
    marginX: 0,
    marginY: 0,
    refinedRects: [
      { id: 4, refinedRect: { x: 310, y: 405, w: 98, h: 94 } },
      { id: 5, refinedRect: { x: 408, y: 405, w: 98, h: 94 } },
    ],
  })
  assert.deepEqual(rect, { x: 310, y: 405, w: 196, h: 94 })
})

test('layout geometry can bypass misleading printed-line refinement', () => {
  const rect = answerZoneRect(layout.question_groups[0], layout, {
    width: 1000,
    height: 1000,
    marginX: 0,
    marginY: 0,
    geometrySource: 'layout',
    refinedRects: [
      { id: 4, refinedRect: { x: 10, y: 20, w: 25, h: 30 } },
      { id: 5, refinedRect: { x: 35, y: 20, w: 25, h: 30 } },
    ],
  })
  assert.deepEqual(rect, { x: 300, y: 400, w: 200, h: 100 })
})

test('printed frame cleanup erases edges and only adds center-guide bands for multi-slot answers', () => {
  const one = printedFrameEraseRects(200, 100, 1)
  const two = printedFrameEraseRects(200, 100, 2)
  assert.equal(one.length, 4)
  assert.equal(two.length, 6)
  assert.ok(two.slice(4).every((rect) => rect.x < 100 && rect.x + rect.w > 100))
  assert.ok(two.every((rect) => rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= 200 && rect.y + rect.h <= 100))
})

test('quality metrics distinguish flat from sharp grayscale evidence', () => {
  const flat = grayscaleQuality(new Uint8Array(16).fill(200), 4, 4)
  const sharp = grayscaleQuality(Uint8Array.from([0, 255, 0, 255, 255, 0, 255, 0, 0, 255, 0, 255, 255, 0, 255, 0]), 4, 4)
  assert.equal(flat.contrastRange, 0)
  assert.ok(sharp.contrastRange > flat.contrastRange)
  assert.ok(sharp.meanEdgeMagnitude > flat.meanEdgeMagnitude)
})

test('artifacts are key-blind and crop directly from the warped page once', () => {
  class Rect { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h }) } }
  const source = {
    cols: 1000,
    rows: 1000,
    roi(rect) {
      return {
        clone: () => ({ cols: rect.w, rows: rect.h, data: new Uint8Array(rect.w * rect.h * 4).fill(255), channels: () => 4 }),
      }
    },
  }
  const [artifact] = extractContinuousAnswerZones(source, layout, { cv: { Rect }, marginX: 0, marginY: 0 })
  assert.equal(artifact.questionNum, 9)
  assert.equal(artifact.source, 'canonical-warp-continuous-grayscale')
  assert.equal('answer' in artifact, false)
  assert.equal('answer_key' in artifact, false)
  assert.deepEqual(artifact.rect, { x: 300, y: 400, w: 200, h: 100 })
})

test('zone extraction forwards experimental offsets to the pure geometry resolver', () => {
  class Rect { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h }) } }
  const source = {
    cols: 1000,
    rows: 1000,
    roi(rect) {
      return { clone: () => ({ cols: rect.w, rows: rect.h, data: new Uint8Array(rect.w * rect.h * 4).fill(255), channels: () => 4 }) }
    },
  }
  const [artifact] = extractContinuousAnswerZones(source, layout, {
    cv: { Rect }, marginX: 0, marginY: 0, offsetYFraction: 0.04,
  })
  assert.deepEqual(artifact.rect, { x: 300, y: 404, w: 200, h: 100 })
})

test('expanded context artifact is labeled review-only evidence and keeps surrounding pixels', () => {
  class Rect { constructor(x, y, w, h) { Object.assign(this, { x, y, w, h }) } }
  const source = {
    cols: 1000,
    rows: 1000,
    roi(rect) {
      return {
        clone: () => ({ cols: rect.w, rows: rect.h, data: new Uint8Array(rect.w * rect.h * 4).fill(255), channels: () => 4 }),
      }
    },
  }
  const [artifact] = extractContinuousAnswerZones(source, layout, {
    cv: { Rect },
    context: true,
    geometrySource: 'layout',
    marginX: 0,
    marginY: 0,
    contextMarginX: 40,
    contextMarginY: 30,
  })
  assert.equal(artifact.source, 'canonical-warp-expanded-context-grayscale')
  assert.deepEqual(artifact.rect, { x: 260, y: 370, w: 280, h: 160 })
  assert.equal('answer' in artifact, false)
  assert.equal('answer_key' in artifact, false)
})

test('blank/artifact evidence removes long printed rules before measuring handwriting', () => {
  const width = 40, height = 24
  const blankFrame = new Uint8Array(width * height).fill(255)
  for (let x = 0; x < width; x += 1) blankFrame[2 * width + x] = 0
  const blank = analyzeBlankArtifact(blankFrame, width, height)
  const written = blankFrame.slice()
  for (let y = 6; y < 20; y += 1) for (let x = 17; x < 21; x += 1) written[y * width + x] = 70
  const digit = analyzeBlankArtifact(written, width, height)
  assert.ok(blank.blankConfidence > digit.blankConfidence)
  assert.equal(digit.digitLikeComponentCount > 0, true)
})
