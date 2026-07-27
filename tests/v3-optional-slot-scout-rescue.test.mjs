import assert from 'node:assert/strict'
import test from 'node:test'

import {
  applyOptionalSlotScoutRescue,
  OPTIONAL_SLOT_SCOUT_MIN_PROBABILITY,
} from '../src/v3/optional-slot-scout-rescue.js'

const yellow = {
  automatic: false,
  read: '61',
  reason: 'local-reader-disagrees-with-browser',
}

test('rescues one contract-verified optional-slot yellow with an independent scout', () => {
  const decision = applyOptionalSlotScoutRescue({
    baseDecision: yellow,
    optionalSlotContractVerified: true,
    optionalSlotIndices: [1],
    scout: { read: '6', probability: OPTIONAL_SLOT_SCOUT_MIN_PROBABILITY },
  })
  assert.deepEqual(decision, {
    automatic: true,
    read: '6',
    reason: 'optional-slot-scout-single-digit',
    preAcceptance: true,
    changedAcceptedRead: false,
    answerKeyUsed: false,
  })
})

test('does not promote an accepted answer, an unverified blank, a weak scout, or a two-digit scout', () => {
  const accepted = applyOptionalSlotScoutRescue({
    baseDecision: { ...yellow, automatic: true },
    optionalSlotContractVerified: true,
    optionalSlotIndices: [1],
    scout: { read: '6', probability: 0.99 },
  })
  const unverified = applyOptionalSlotScoutRescue({
    baseDecision: yellow,
    optionalSlotIndices: [1],
    scout: { read: '6', probability: 0.99 },
  })
  const weak = applyOptionalSlotScoutRescue({
    baseDecision: yellow,
    optionalSlotContractVerified: true,
    optionalSlotIndices: [1],
    scout: { read: '6', probability: 0.69 },
  })
  const twoDigit = applyOptionalSlotScoutRescue({
    baseDecision: yellow,
    optionalSlotContractVerified: true,
    optionalSlotIndices: [1],
    scout: { read: '16', probability: 0.99 },
  })
  assert.equal(accepted.automatic, true)
  assert.equal(unverified.automatic, false)
  assert.equal(weak.automatic, false)
  assert.equal(twoDigit.automatic, false)
})

test('truth-shaped fields fail closed', () => {
  const decision = applyOptionalSlotScoutRescue({
    baseDecision: yellow,
    optionalSlotContractVerified: true,
    optionalSlotIndices: [1],
    scout: { read: '6', probability: 0.99 },
    truthText: '6',
  })
  assert.equal(decision.automatic, false)
  assert.equal(decision.reason, 'answer-key-shaped-field-rejected')
})
