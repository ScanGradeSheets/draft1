import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../mission-control/debug-upload-proxy.mjs', import.meta.url), 'utf8')

test('public debug ingress is upload-only and tightly bounded', () => {
  assert.match(source, /const ALLOWED_ORIGIN = 'https:\/\/scangrade\.io'/)
  assert.match(source, /url\.pathname !== '\/'/)
  assert.match(source, /req\.method !== 'POST'/)
  assert.match(source, /timingSafeEqual/)
  assert.match(source, /MAX_BODY_BYTES/)
  assert.match(source, /RATE_MAX_REQUESTS = 60/)
  assert.match(source, /REQUEST_TIMEOUT_MS = 70_000/)
})

test('public response strips Mission Control filesystem paths', () => {
  assert.match(source, /Never expose local filesystem paths/)
  assert.match(source, /\{ ok: true, id: upstream\.payload\?\.id \|\| null \}/)
  assert.doesNotMatch(source, /sendJson\(res, 201, upstream\.payload/)
})

test('public ingress accepts the authenticated text envelope used by legacy Safari', () => {
  assert.match(source, /const contentType = String\(req\.headers\['content-type'\][\s\S]*?contentType\.startsWith\('text\/plain'\)/)
  assert.match(source, /envelope\?\.debugUploadToken/)
  assert.match(source, /JSON\.stringify\(envelope\.payload\)/)
  assert.doesNotMatch(source, /url\.searchParams\.get\(['"]debugUploadToken/)
})
