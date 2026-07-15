#!/usr/bin/env node

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

export function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

export function verifyCandidateManifest(manifest, root = ROOT) {
  const mismatches = []
  for (const [relative, expected] of Object.entries(manifest?.files || {})) {
    const absolute = path.join(root, relative)
    if (!fs.existsSync(absolute)) {
      mismatches.push({ file: relative, reason: 'missing' })
      continue
    }
    const actual = { sha256: sha256File(absolute), bytes: fs.statSync(absolute).size }
    if (actual.sha256 !== expected.sha256 || actual.bytes !== expected.bytes) {
      mismatches.push({ file: relative, reason: 'content-mismatch', expected, actual })
    }
  }
  return {
    ok: mismatches.length === 0 && Object.keys(manifest?.files || {}).length > 0,
    checkedFiles: Object.keys(manifest?.files || {}).length,
    mismatches,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifestPath = path.resolve(ROOT, process.argv[2] || 'private-evidence/protocols/consensus-candidate-freeze-20260714.json')
  const result = verifyCandidateManifest(JSON.parse(fs.readFileSync(manifestPath, 'utf8')))
  console.log(JSON.stringify({ manifest: path.relative(ROOT, manifestPath), ...result }, null, 2))
  if (!result.ok) process.exitCode = 1
}
