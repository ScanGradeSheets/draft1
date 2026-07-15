import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import crypto from 'node:crypto'
import { verifyCandidateManifest } from '../scripts/verify_consensus_candidate.mjs'

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex')

test('candidate verifier accepts identical bytes and rejects changed selection source', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scangrade-candidate-'))
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true })
    fs.writeFileSync(path.join(root, 'src/ocr-pipeline.js'), 'selection-v1\n')
    const manifest = { files: { 'src/ocr-pipeline.js': { sha256: digest('selection-v1\n'), bytes: 13 } } }
    assert.equal(verifyCandidateManifest(manifest, root).ok, true)
    fs.writeFileSync(path.join(root, 'src/ocr-pipeline.js'), 'selection-v2\n')
    const changed = verifyCandidateManifest(manifest, root)
    assert.equal(changed.ok, false)
    assert.equal(changed.mismatches[0].reason, 'content-mismatch')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('candidate verifier rejects a missing critical file and an empty manifest', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scangrade-candidate-'))
  try {
    const missing = verifyCandidateManifest({ files: { 'src/homography.js': { sha256: 'x', bytes: 1 } } }, root)
    assert.equal(missing.ok, false)
    assert.equal(missing.mismatches[0].reason, 'missing')
    assert.equal(verifyCandidateManifest({ files: {} }, root).ok, false)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
