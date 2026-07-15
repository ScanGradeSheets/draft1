import test from 'node:test'
import assert from 'node:assert/strict'

import { createPacketPlan } from '../scripts/create_four_packet_capture_plan.mjs'

test('packet assignment is reproducible, grouped, and preserves eight reserves', () => {
  const ids = Array.from({ length: 12 }, (_, index) => `P${String(index + 1).padStart(2, '0')}`)
  const first = createPacketPlan(ids, 'fixed-test-seed')
  const second = createPacketPlan(ids, 'fixed-test-seed')

  assert.deepEqual(
    first.selected.map(({ packetId, role, scanOrder }) => ({ packetId, role, scanOrder })),
    second.selected.map(({ packetId, role, scanOrder }) => ({ packetId, role, scanOrder })),
  )
  assert.equal(first.selected.length, 4)
  assert.equal(first.reserveUnscanned.length, 8)
  assert.equal(new Set([...first.selected.map((row) => row.packetId), ...first.reserveUnscanned]).size, 12)
  assert.equal(first.selected.filter((row) => row.role === 'locked-test').length, 1)
})

test('packet assignment rejects duplicate identities', () => {
  assert.throws(() => createPacketPlan(['P01', 'P01', 'P02', 'P03'], 'seed'), /unique/)
})
