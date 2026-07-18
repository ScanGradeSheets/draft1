import test from 'node:test'
import assert from 'node:assert/strict'

import { correctionPanelPlacementForRegion } from '../src/v3/correction-panel-placement.js'

test('upper answers place the panel below with its arrow on the tapped answer center', () => {
  const placement = correctionPanelPlacementForRegion({
    focusLeftPct: 18,
    focusTopPct: 15,
    focusWidthPct: 10,
    focusHeightPct: 6,
  })
  assert.equal(placement.placement, 'below')
  assert.equal(placement.targetX, 23)
  assert.equal(placement.left + placement.width * placement.arrowX / 100, placement.targetX)
})

test('lower answers place the panel above without estimating the rendered card height', () => {
  const placement = correctionPanelPlacementForRegion({
    focusLeftPct: 65,
    focusTopPct: 77,
    focusWidthPct: 12,
    focusHeightPct: 7,
  })
  assert.equal(placement.placement, 'above')
  assert.equal(placement.transform, 'translateY(-100%)')
  assert.equal(placement.top, 75.35)
})

test('edge answers keep the panel onscreen while the arrow remains near the answer', () => {
  const left = correctionPanelPlacementForRegion({
    focusLeftPct: 1,
    focusTopPct: 42,
    focusWidthPct: 8,
    focusHeightPct: 6,
  })
  const right = correctionPanelPlacementForRegion({
    focusLeftPct: 91,
    focusTopPct: 42,
    focusWidthPct: 8,
    focusHeightPct: 6,
  })
  assert.equal(left.left, 2)
  assert.equal(right.left + right.width, 98)
  assert.ok(left.arrowX >= 10 && right.arrowX <= 90)
})
