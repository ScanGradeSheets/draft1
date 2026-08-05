import test from 'node:test'
import assert from 'node:assert/strict'

import { settleLegacyPromise } from '../src/v3/legacy-promise-settlement.js'

test('releases the correction lock after a successful legacy-iPad submission', async () => {
  let locked = true
  const completed = await settleLegacyPromise(
    async () => 'saved',
    () => { locked = false },
  )
  assert.equal(completed, true)
  assert.equal(locked, false)
})

test('releases the correction lock when submission rejects', async () => {
  let locked = true
  let reported = null
  const completed = await settleLegacyPromise(
    async () => { throw new Error('save failed') },
    () => { locked = false },
    (error) => { reported = error.message },
  )
  assert.equal(completed, false)
  assert.equal(locked, false)
  assert.equal(reported, 'save failed')
})

test('releases the correction lock when submission throws before returning a promise', async () => {
  let settled = 0
  const completed = await settleLegacyPromise(
    () => { throw new Error('synchronous failure') },
    () => { settled += 1 },
  )
  assert.equal(completed, false)
  assert.equal(settled, 1)
})
