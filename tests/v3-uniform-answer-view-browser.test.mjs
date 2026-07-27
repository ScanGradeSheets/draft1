import test from 'node:test'
import assert from 'node:assert/strict'

import { browserUniformAnswerViews } from '../src/v3/uniform-answer-view-browser.js'

function fakeCanvas(width = 100, height = 100) {
  const pixels = new Uint8ClampedArray(width * height * 4).fill(255)
  return {
    width,
    height,
    getContext() {
      return {
        fillStyle: '#fff',
        fillRect() {},
        drawImage() {},
        getImageData() { return { data: pixels } },
      }
    },
    toDataURL() { return `data:image/png;base64,${width}x${height}` },
  }
}

test('browser materializer remains inert without resident page pixels', () => {
  assert.deepEqual(browserUniformAnswerViews({}), [])
})

test('browser materializer emits only requested questions and no semantic context', () => {
  const layout = {
    page: { units: 'normalized' },
    boxes: [
      { id: 1, x: 0.2, y: 0.2, width: 0.1, height: 0.08 },
      { id: 2, x: 0.5, y: 0.2, width: 0.1, height: 0.08 },
      { id: 3, x: 0.8, y: 0.5, width: 0.1, height: 0.08 },
    ],
    question_groups: [
      { question_num: 1, digit_box_ids: [1] },
      { question_num: 2, digit_box_ids: [2] },
      { question_num: 3, digit_box_ids: [3] },
    ],
  }
  const zones = [
    { questionNum: 1, rect: { x: 20, y: 20, w: 10, h: 8 } },
    { questionNum: 2, rect: { x: 50, y: 20, w: 10, h: 8 } },
    { questionNum: 3, rect: { x: 80, y: 50, w: 10, h: 8 } },
  ]
  const cv = {
    Rect: class Rect {
      constructor(x, y, width, height) {
        Object.assign(this, { x, y, width, height })
      }
    },
    imshow() {},
  }
  const warpedImage = {
    cols: 100,
    rows: 100,
    roi(rect) {
      return { cols: rect.width, rows: rect.height, delete() {} }
    },
  }
  const views = browserUniformAnswerViews({
    layout,
    zones,
    warpedImage,
    sourceCanvas: fakeCanvas(),
    cv,
    questionNums: new Set([2]),
    createCanvas: () => fakeCanvas(),
  })
  assert.equal(views.length, 1)
  assert.equal(views[0].questionNum, 2)
  assert.equal(views[0].answerKeyUsed, false)
  assert.equal('answerKey' in views[0], false)
  assert.equal('truth' in views[0], false)
})
