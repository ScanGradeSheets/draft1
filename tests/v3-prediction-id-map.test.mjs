import test from 'node:test'
import assert from 'node:assert/strict'
import {
  predictionIdKey,
  predictionIndexMapById,
  predictionMapById,
} from '../src/v3/prediction-id-map.js'

test('legacy numeric worksheet ids match string prediction ids', () => {
  const predictions = [
    { id: '10', digit: 1 },
    { id: '11', digit: 9 },
  ]
  const byId = predictionMapById(predictions)
  const indexById = predictionIndexMapById(predictions)
  assert.equal(byId.get(predictionIdKey(10))?.digit, 1)
  assert.equal(byId.get(predictionIdKey(11))?.digit, 9)
  assert.equal(indexById.get(predictionIdKey(10)), 0)
  assert.equal(indexById.get(predictionIdKey(11)), 1)
})

test('string worksheet ids match numeric prediction ids', () => {
  const predictions = [
    { id: 10, digit: 1 },
    { id: 11, digit: 9 },
  ]
  const byId = predictionMapById(predictions)
  assert.equal(byId.get(predictionIdKey('10'))?.digit, 1)
  assert.equal(byId.get(predictionIdKey('11'))?.digit, 9)
})
