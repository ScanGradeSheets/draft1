import assert from 'node:assert/strict'
import test from 'node:test'

import { copyDebugJson, exportDebugJson, serializeDebugJson } from '../src/v3/debug-json-export.js'

class TestBlob {
  constructor(parts, options) {
    this.parts = parts
    this.type = options?.type
  }
}

class TestFile {
  constructor(parts, name, options) {
    this.parts = parts
    this.name = name
    this.type = options?.type
  }
}

test('iOS-capable export shares a JSON file instead of relying on an anchor download', async () => {
  let shared = null
  const navigatorLike = {
    canShare: ({ files }) => files?.[0]?.name === 'scan.json',
    share: async (payload) => { shared = payload },
  }
  const result = await exportDebugJson({ digit: 7 }, {
    filename: 'scan.json', navigatorLike, BlobCtor: TestBlob, FileCtor: TestFile,
  })
  assert.equal(result.method, 'share')
  assert.equal(shared.files[0].name, 'scan.json')
  assert.equal(shared.files[0].type, 'application/json')
})

test('desktop fallback clicks a download link and delays URL revocation', async () => {
  let clicked = false
  let revoked = null
  const documentLike = {
    createElement: () => ({ click: () => { clicked = true } }),
  }
  const urlLike = {
    createObjectURL: () => 'blob:debug',
    revokeObjectURL: (url) => { revoked = url },
  }
  const result = await exportDebugJson({ digit: 7 }, {
    filename: 'scan.json', navigatorLike: {}, documentLike, urlLike,
    BlobCtor: TestBlob, FileCtor: null,
  })
  assert.equal(result.method, 'download')
  assert.equal(clicked, true)
  assert.equal(revoked, null)
  await new Promise((resolve) => setTimeout(resolve, 1010))
  assert.equal(revoked, 'blob:debug')
})

test('copy fallback preserves the exact debug JSON', async () => {
  let copied = null
  const navigatorLike = { clipboard: { writeText: async (text) => { copied = text } } }
  await copyDebugJson({ digit: 7 }, navigatorLike)
  assert.equal(copied, serializeDebugJson({ digit: 7 }))
})

test('installed iOS fallback copies instead of attempting a silent anchor download', async () => {
  let copied = null
  let clicked = false
  const navigatorLike = {
    standalone: true,
    clipboard: { writeText: async (text) => { copied = text } },
  }
  const result = await exportDebugJson({ digit: 7 }, {
    navigatorLike,
    documentLike: { createElement: () => ({ click: () => { clicked = true } }) },
    urlLike: { createObjectURL: () => 'blob:debug', revokeObjectURL: () => {} },
    BlobCtor: TestBlob,
    FileCtor: null,
  })
  assert.equal(result.method, 'copy')
  assert.equal(copied, serializeDebugJson({ digit: 7 }))
  assert.equal(clicked, false)
})
