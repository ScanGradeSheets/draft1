import test from 'node:test'
import assert from 'node:assert/strict'

import { selectDecisiveQrOrientation } from '../src/qr-orientation-fast-path.js'

const physicalOrangeIpadCandidates = [
  { shift: 0, qrDistance: 0.002584148828153049 },
  { shift: 1, qrDistance: 0.5762016847861409 },
  { shift: 2, qrDistance: 0.8327234212853448 },
  { shift: 3, qrDistance: 0.5764940059959668 },
]

test('uses the physically verified orange-iPad QR orientation when decisive', () => {
  assert.equal(selectDecisiveQrOrientation(physicalOrangeIpadCandidates)?.shift, 0)
})

test('retains the full alignment fallback for ambiguous QR placement', () => {
  assert.equal(selectDecisiveQrOrientation([
    { shift: 0, qrDistance: 0.04 },
    { shift: 1, qrDistance: 0.12 },
    { shift: 2, qrDistance: 0.7 },
    { shift: 3, qrDistance: 0.8 },
  ]), null)
})

test('retains the full alignment fallback when the QR is not near its template position', () => {
  assert.equal(selectDecisiveQrOrientation([
    { shift: 0, qrDistance: 0.10 },
    { shift: 1, qrDistance: 0.40 },
  ]), null)
})
