import test from 'node:test'
import assert from 'node:assert/strict'
import { recognitionOverlayItemsForAnswers } from '../src/v3/recognition-overlay.js'

test('positions a separate blue reading above each physical answer slot', () => {
  const items = recognitionOverlayItemsForAnswers(
    [{ questionNum: 1, displayDigits: ['1', '2'] }],
    [
      { questionNum: 1, slotIndex: 0, focusLeftPct: 20, focusTopPct: 30, focusWidthPct: 5, focusHeightPct: 6 },
      { questionNum: 1, slotIndex: 1, focusLeftPct: 25, focusTopPct: 30, focusWidthPct: 5, focusHeightPct: 6 },
      { questionNum: 1, leftPct: 20, topPct: 30, widthPct: 10, heightPct: 6 },
    ],
  )
  assert.deepEqual(items.map(({ text }) => text), ['1', '2'])
  assert.deepEqual(items.map(({ style }) => style.left), ['22.5%', '27.5%'])
})

test('shows an underscore only for a physically blank slot', () => {
  const items = recognitionOverlayItemsForAnswers(
    [{ questionNum: 4, displayDigits: [null, '9'] }],
    [
      { questionNum: 4, slotIndex: 0, leftPct: 40, topPct: 50, widthPct: 4, heightPct: 5 },
      { questionNum: 4, slotIndex: 1, leftPct: 44, topPct: 50, widthPct: 4, heightPct: 5 },
    ],
  )
  assert.deepEqual(items.map(({ text }) => text), ['_', '9'])
})

test('falls back to one whole-answer label when slot geometry is unavailable', () => {
  const items = recognitionOverlayItemsForAnswers(
    [{ questionNum: 2, displayDigits: ['1', '5'] }],
    [{ questionNum: 2, leftPct: 60, topPct: 40, widthPct: 12, heightPct: 6 }],
  )
  assert.equal(items.length, 1)
  assert.equal(items[0].text, '15')
  assert.equal(items[0].style.left, '66%')
})
