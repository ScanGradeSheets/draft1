import test from 'node:test'
import assert from 'node:assert/strict'
import { geometryRescuePlan } from '../src/v3/geometry-rescue.js'

function fixture(twoOutliers = false) {
  const boxes = []
  const question_groups = []
  const zones = []
  for (let index = 0; index < 6; index += 1) {
    boxes.push({ id: index, cx: 20 + (index % 2) * 50, cy: 25 + Math.floor(index / 2) * 35, width: 12, height: 10 })
    question_groups.push({ question_num: index + 1, digit_box_ids: [index] })
    const x = (20 + (index % 2) * 50 - 6) * 10 + 13
    const y = (25 + Math.floor(index / 2) * 35 - 5) * 10 + 17
    zones.push({ questionNum: index + 1, rect: { x, y, w: 120, h: 100 } })
  }
  zones[3].rect.x += 150
  if (twoOutliers) zones[4].rect.y += 150
  return { layout: { page: { units: 'mm', width_mm: 100, height_mm: 120 }, boxes, question_groups }, zones, width: 1000, height: 1200 }
}

test('rescues exactly one clear same-page geometry outlier without answer content', () => {
  const plan = geometryRescuePlan(fixture())
  assert.equal(plan.questionNum, 4)
  assert.equal(plan.affectsGrade, false)
  assert.ok(plan.residual > plan.threshold)
  assert.deepEqual(Object.keys(plan).filter((key) => /answer|expected|truth|key/i.test(key)), [])
})

test('refuses rescue when the page has more than one unsupported outlier', () => {
  assert.equal(geometryRescuePlan(fixture(true)), null)
})
