import test from 'node:test'
import assert from 'node:assert/strict'

import {
  manualCorrectionContract,
} from '../src/v3/manual-correction-contract.js'

test('one digit entered for one flexible box stays that digit', () => {
  assert.deepEqual(manualCorrectionContract([null, 9], 1), {
    overflowSinglePhysicalBox: false,
    correctionCells: [9],
    answerText: '9',
  })
})

test('two digits entered for one flexible box remain one answer token', () => {
  assert.deepEqual(manualCorrectionContract([1, 4], 1), {
    overflowSinglePhysicalBox: true,
    correctionCells: [1, 4],
    answerText: '14',
  })
})

test('one digit remains right-aligned across two physical slots', () => {
  assert.deepEqual(manualCorrectionContract([null, 9], 2), {
    overflowSinglePhysicalBox: false,
    correctionCells: [null, 9],
    answerText: '9',
  })
})

test('two-slot teacher corrections preserve complete answers used for grading and display', () => {
  assert.deepEqual(manualCorrectionContract([3, 0], 2), {
    overflowSinglePhysicalBox: false,
    correctionCells: [3, 0],
    answerText: '30',
  })
  assert.deepEqual(manualCorrectionContract([4, 9], 2), {
    overflowSinglePhysicalBox: false,
    correctionCells: [4, 9],
    answerText: '49',
  })
})
