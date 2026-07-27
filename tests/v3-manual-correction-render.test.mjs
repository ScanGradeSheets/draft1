import test from 'node:test'
import assert from 'node:assert/strict'
import {
  manualCorrectionClearRect,
  manualCorrectionDisplayCells,
  shouldAutoApplySingleDigitCorrection,
} from '../src/v3/manual-correction-render.js'
import { fluorescentHighlighterGeometry } from '../src/v3/highlighter-stroke.js'

test('a right-slot correction paints only the corrected 3, not the complete 13', () => {
  const correction = { cells: [1, 3], text: '13', correctedSlots: [1] }
  assert.deepEqual(manualCorrectionDisplayCells(correction, [{ slotIndex: 1, cell: 3 }]), [3])
})

test('a true multi-digit answer in one physical box still paints the complete answer', () => {
  const correction = { cells: [13], text: '13', correctedSlots: [0], overflowSinglePhysicalBox: true }
  assert.deepEqual(manualCorrectionDisplayCells(correction, [{ slotIndex: 0, cell: 13 }]), ['13'])
})

test('one typed digit applies immediately only when exactly one digit is unresolved', () => {
  assert.equal(shouldAutoApplySingleDigitCorrection({ eventType: 'input', maxLength: 1, text: '3' }), true)
  assert.equal(shouldAutoApplySingleDigitCorrection({ eventType: 'input', maxLength: 2, text: '3' }), false)
  assert.equal(shouldAutoApplySingleDigitCorrection({ eventType: 'input', maxLength: 2, text: '31' }), true)
  assert.equal(shouldAutoApplySingleDigitCorrection({ eventType: 'change', maxLength: 1, text: '3' }), false)
  assert.equal(shouldAutoApplySingleDigitCorrection({ eventType: 'input', maxLength: 1, text: '' }), false)
})

test('manual correction cleanup covers the complete previous highlighter stroke', () => {
  const rect = { x: 120, y: 240, w: 80, h: 52 }
  const seed = 473
  const clear = manualCorrectionClearRect(rect, seed, { width: 800, height: 1100 })
  const geometry = fluorescentHighlighterGeometry(rect, seed)
  for (const [x, y] of geometry.polygon) {
    assert.ok(x >= clear.x && x <= clear.x + clear.w)
    assert.ok(y >= clear.y && y <= clear.y + clear.h)
  }
})
