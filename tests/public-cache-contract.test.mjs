import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

test('mutable app shell and worksheet contracts cannot pin an older public build', () => {
  const headers = fs.readFileSync(new URL('../public/_headers', import.meta.url), 'utf8')
  assert.match(headers, /\/\n\s+Cache-Control: no-cache, no-store, must-revalidate/)
  assert.match(headers, /\/index\.html\n\s+Cache-Control: no-cache, no-store, must-revalidate/)
  assert.match(headers, /\/layouts\/\*\n\s+Cache-Control: no-cache, max-age=0, must-revalidate/)
  assert.match(headers, /\/worksheets\/\*\/layouts\/\*\n\s+Cache-Control: no-cache, max-age=0, must-revalidate/)
})
