import test from 'node:test'
import assert from 'node:assert/strict'

import {
  robustUniformAffine,
  selectUniformAnswerView,
  uniformAnswerViewPlan,
  uniformPrintedFrameScore,
} from '../src/v3/uniform-answer-view.js'

test('robust affine rejects one displaced answer center without using answer content', () => {
  const source = [[0, 0], [100, 0], [0, 100], [100, 100], [50, 50]]
  const target = source.map(([x, y]) => [12 + x * 1.02, 8 + y * 0.98])
  target[4] = [300, 400]
  const fit = robustUniformAffine(source, target, 1000)
  assert.ok(fit)
  assert.deepEqual(fit.inliers, [true, true, true, true, false])
  assert.ok(fit.residuals.slice(0, 4).every((value) => value < 1e-6))
})

test('uniform plan returns deterministic layout-derived crop rectangles', () => {
  const layout = {
    page: { units: 'normalized' },
    boxes: [
      { id: 1, x: 0.20, y: 0.20, width: 0.10, height: 0.08 },
      { id: 2, x: 0.50, y: 0.20, width: 0.10, height: 0.08 },
      { id: 3, x: 0.80, y: 0.50, width: 0.10, height: 0.08 },
    ],
    question_groups: [
      { question_num: 1, digit_box_ids: [1] },
      { question_num: 2, digit_box_ids: [2] },
      { question_num: 3, digit_box_ids: [3] },
    ],
  }
  const zones = [
    { questionNum: 1, rect: { x: 120, y: 130, w: 120, h: 96 } },
    { questionNum: 2, rect: { x: 420, y: 130, w: 120, h: 96 } },
    { questionNum: 3, rect: { x: 720, y: 490, w: 120, h: 96 } },
  ]
  const first = uniformAnswerViewPlan({
    layout,
    zones,
    width: 1000,
    height: 1200,
    simpleWidth: 500,
    simpleHeight: 600,
  })
  const second = uniformAnswerViewPlan({
    layout,
    zones,
    width: 1000,
    height: 1200,
    simpleWidth: 500,
    simpleHeight: 600,
  })
  assert.deepEqual(second, first)
  assert.equal(first.answerKeyUsed, false)
  assert.equal(first.handwritingTruthUsed, false)
  assert.equal(first.entries.length, 3)
  assert.deepEqual(first.entries[0].simpleRect, first.entries[0].referenceRect.map((value) => Math.round(value / 2)))
})

test('four-sided printed frame wins over a crop missing one side', () => {
  const width = 80
  const height = 50
  const complete = new Uint8Array(width * height).fill(245)
  const incomplete = new Uint8Array(width * height).fill(245)
  const draw = (image, includeRight) => {
    for (let x = 8; x < 72; x += 1) {
      image[8 * width + x] = 30
      image[41 * width + x] = 30
    }
    for (let y = 8; y < 42; y += 1) {
      image[y * width + 8] = 30
      if (includeRight) image[y * width + 71] = 30
    }
  }
  draw(complete, true)
  draw(incomplete, false)
  const completeScore = uniformPrintedFrameScore(complete, width, height)
  const incompleteScore = uniformPrintedFrameScore(incomplete, width, height)
  assert.ok(completeScore.score > incompleteScore.score)
  assert.equal(selectUniformAnswerView(incompleteScore, completeScore), 'clean-homography')
  assert.equal(selectUniformAnswerView(completeScore, incompleteScore), 'clean-simple-scale')
})
