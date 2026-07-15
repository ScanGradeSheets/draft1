import assert from 'node:assert/strict'
import test from 'node:test'

import { requestKeyBlindWholeAnswers } from '../src/hybrid-review-client.js'

function response(results, answerKeyUsed = false) {
  return { ok: true, status: 200, json: async () => ({ results, answerKeyUsed }) }
}

test('review client sends only items and preserves complete key-blind results', async () => {
  const sent = []
  const items = Array.from({ length: 25 }, (_, index) => ({ id: `q-${index}`, imageDataUrl: 'data:image/png;base64,eA==' }))
  const results = await requestKeyBlindWholeAnswers({
    baseUrl: 'https://review.example',
    items,
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body)
      sent.push(body)
      return response(body.items.map((item) => ({ id: item.id, read: '7' })))
    },
  })
  assert.equal(sent.length, 2)
  assert.deepEqual(Object.keys(sent[0]), ['items'])
  assert.equal(results.length, 25)
})

test('review client fails open on service, integrity, and partial-response errors', async () => {
  const items = [{ id: 'q-1', imageDataUrl: 'x' }]
  const cases = [
    async () => { throw new Error('offline') },
    async () => ({ ok: false, status: 503, json: async () => ({}) }),
    async () => response([], false),
    async () => response([{ id: 'q-1', read: '7' }], true),
  ]
  for (const fetchImpl of cases) {
    const errors = []
    const results = await requestKeyBlindWholeAnswers({
      baseUrl: 'https://review.example',
      items,
      fetchImpl,
      onError: (error) => errors.push(error),
    })
    assert.deepEqual(results, [])
    assert.equal(errors.length, 1)
  }
})

test('review client aborts a timed-out optional request and returns no suggestions', async () => {
  const errors = []
  const results = await requestKeyBlindWholeAnswers({
    baseUrl: 'https://review.example',
    items: [{ id: 'q-1', imageDataUrl: 'x' }],
    timeoutMs: 5,
    fetchImpl: async (_url, options) => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
    }),
    onError: (error) => errors.push(error),
  })
  assert.deepEqual(results, [])
  assert.equal(errors.length, 1)
})

test('review client can send a short-lived bearer token without putting it in the payload', async () => {
  let observed
  await requestKeyBlindWholeAnswers({
    baseUrl: 'https://review.example',
    accessToken: 'short-lived-token',
    items: [{ id: 'q-1', imageDataUrl: 'x' }],
    fetchImpl: async (_url, options) => {
      observed = options
      return response([{ id: 'q-1', read: '7' }])
    },
  })
  assert.equal(observed.headers.Authorization, 'Bearer short-lived-token')
  assert.equal(JSON.stringify(JSON.parse(observed.body)).includes('short-lived-token'), false)
})
