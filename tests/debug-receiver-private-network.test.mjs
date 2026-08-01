import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const serverSource = await readFile(new URL('../mission-control/server.mjs', import.meta.url), 'utf8')

test('private debug receiver grants authenticated browser private-network preflights', () => {
  assert.match(serverSource, /'Access-Control-Allow-Private-Network': 'true'/)
  assert.match(serverSource, /'Access-Control-Allow-Headers': 'Content-Type, X-ScanGrade-Debug-Token'/)
  assert.match(serverSource, /if \(req\.method === 'OPTIONS'\)/)
  assert.match(serverSource, /SG_DEBUG_UPLOAD_TOKEN/)
})
