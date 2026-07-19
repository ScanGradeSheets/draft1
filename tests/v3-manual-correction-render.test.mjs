import test from 'node:test'
import assert from 'node:assert/strict'
import {
  manualCorrectionDisplayCells,
  shouldAutoApplySingleDigitCorrection,
} from '../src/v3/manual-correction-render.js'

test('a right-slot correction paints only the corrected 3, not the complete 13', () => {
  const correction = { cells: [1, 3], text: '13', correctedSlots: [1] }
  assert.deepEqual(manualCorrectionDisplayCells(correction, [{ slotIndex: 1, cell: 3 }]), [3])
})

test('a true multi-digit answer in one physical box still paints the complete answer', () => {
  const correction = { cells: [13], text: '13', correctedSlots: [0], overflowSinglePhysicalBox: true }
  assert.deepEqual(manualCorrectionDisplayCells(correction, [{ slotIndex: 0, cell: 13 }]), ['13'])
})

test('one typed digit can apply immediately, while multi-digit answers still wait for Save', () => {
  assert.equal(shouldAutoApplySingleDigitCorrection({ eventType: 'input', maxLength: 1, text: '3' }), true)
  assert.equal(shouldAutoApplySingleDigitCorrection({ eventType: 'input', maxLength: 2, text: '3' }), false)
  assert.equal(shouldAutoApplySingleDigitCorrection({
    eventType: 'input',
    maxLength: 2,
    text: '3',
    inferredSingleDigitSlotIndex: 1,
  }), true)
  assert.equal(shouldAutoApplySingleDigitCorrection({ eventType: 'change', maxLength: 1, text: '3' }), false)
  assert.equal(shouldAutoApplySingleDigitCorrection({ eventType: 'input', maxLength: 1, text: '' }), false)
})
