import test from 'node:test'
import assert from 'node:assert/strict'
import {
  consensusFeatureEnabled,
  consensusModelEndpoint,
  promotedConsensusRuntimeEnabled,
} from '../src/v3/production-runtime.js'

const privateLocation = {
  hostname: 'hobbes-mac-mini.tail9a3379.ts.net',
  href: 'https://hobbes-mac-mini.tail9a3379.ts.net/',
  search: '',
}

test('promotes the frozen candidate only on the private tailnet deployment by default', () => {
  assert.equal(promotedConsensusRuntimeEnabled(privateLocation), true)
  assert.equal(consensusFeatureEnabled('v3ConsensusPromotion', privateLocation), true)
  assert.equal(promotedConsensusRuntimeEnabled({
    hostname: 'scangradesheets.github.io',
    href: 'https://scangradesheets.github.io/draft1/',
    search: '',
  }), false)
})

test('uses same-origin private model routes and permits an immediate rollback override', () => {
  assert.equal(
    consensusModelEndpoint('reviewModelUrl', '/review-model', privateLocation),
    'https://hobbes-mac-mini.tail9a3379.ts.net/review-model',
  )
  const rollback = { ...privateLocation, search: '?consensusCandidate=0' }
  assert.equal(promotedConsensusRuntimeEnabled(rollback), false)
  assert.equal(consensusFeatureEnabled('v3ConsensusPromotion', rollback), false)
  assert.equal(consensusModelEndpoint('reviewModelUrl', '/review-model', rollback), '')
})

test('explicit development flags and safe endpoints still work outside the tailnet', () => {
  const local = {
    hostname: '127.0.0.1',
    href: 'https://127.0.0.1:5174/',
    search: '?hybridV3=1&reviewModelUrl=http%3A%2F%2F127.0.0.1%3A8766',
  }
  assert.equal(consensusFeatureEnabled('hybridV3', local), true)
  assert.equal(consensusModelEndpoint('reviewModelUrl', '/review-model', local), 'http://127.0.0.1:8766')
  const unsafe = { ...local, search: '?reviewModelUrl=http%3A%2F%2Fexample.com%2Fmodel' }
  assert.equal(consensusModelEndpoint('reviewModelUrl', '/review-model', unsafe), '')
})
