import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../src/App.vue', import.meta.url), 'utf8')

test('quiet scanning keeps its sweep while animated grading holds a steady yellow band', () => {
  assert.match(
    source,
    /'student-scan-grading-word--steady': studentScanStage === 'grading'/,
  )
  assert.match(
    source,
    /\.student-scan-grading-word::before\s*\{[^}]*animation:\s*scan-grading-word-highlight 1\.16s ease-in-out infinite/s,
  )
  assert.match(
    source,
    /\.student-scan-grading-word--steady::before\s*\{[^}]*animation:\s*none/s,
  )
})
