import assert from 'node:assert/strict'
import test from 'node:test'
import { requestCompactWholeAnswers } from '../src/v3/compact-client.js'

test('compact client sends only key-blind image identity fields', async () => {
  const originalFetch = globalThis.fetch
  let body
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body)
    return { ok: true, json: async () => ({ ok: true, results: [{ id: 'q1', read: '7' }] }) }
  }
  try {
    const result = await requestCompactWholeAnswers({
      baseUrl: 'https://model.example',
      items: [{ id: 'q1', questionNum: 1, frameIndex: 2, cropVariant: 'expanded-context', continuousImageDataUrl: 'data:image/png;base64,AA==', answerKey: 9 }],
    })
    assert.equal(result[0].read, '7')
    assert.equal(result[0].frameIndex, 2)
    assert.equal(result[0].cropVariant, 'expanded-context')
    assert.deepEqual(Object.keys(body.items[0]).sort(), ['continuousImageDataUrl', 'id', 'questionNum'])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('compact client sends an optional bearer token only in the authorization header', async () => {
  const originalFetch = globalThis.fetch
  let options
  globalThis.fetch = async (_url, value) => {
    options = value
    return { ok: true, json: async () => ({ ok: true, results: [{ id: 'q1', read: '7' }] }) }
  }
  try {
    await requestCompactWholeAnswers({
      baseUrl: 'https://model.example', accessToken: 'short-lived-token',
      items: [{ id: 'q1', questionNum: 1, continuousImageDataUrl: 'data:image/png;base64,AA==' }],
    })
    assert.equal(options.headers.Authorization, 'Bearer short-lived-token')
    assert.equal(options.body.includes('short-lived-token'), false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('compact client preserves key-blind top candidates and strips non-digits', async () => {
  const results = await requestCompactWholeAnswers({
    baseUrl: 'https://compact.example',
    items: [{ id: 'q1', questionNum: 1, continuousImageDataUrl: 'data:image/png;base64,AA==' }],
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ ok: true, results: [{
        id: 'q1', questionNum: 1, read: '9', keyBlind: true,
        topCandidates: [{ read: '9', jointProbability: .8 }, { read: '1x9', jointProbability: .1 }],
      }] }),
    }),
  })
  assert.deepEqual(results[0].topCandidates.map((item) => item.read), ['9', '19'])
})
