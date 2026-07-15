#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const FILES = [
  'scripts/evaluate_v3_frozen_prospective.mjs',
  'scripts/freeze_v3_prospective_protocol.mjs',
  'private-evidence/v3-prospective/prospective-evaluator-protocol.json',
  'private-evidence/v3-prospective/nonrow-parity-policy-candidate.json',
  'private-evidence/v3-prospective/nonrow-parity-policy-freeze-p08.json',
  'private-evidence/capture-plans/four-packet-plan.json',
]

const hash = (file) => createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, file))).digest('hex')
export function collectProspectiveProtocolHashes() {
  return Object.fromEntries(FILES.map((file) => [file, hash(file)]))
}

export function verifyProspectiveProtocolFreeze(manifest, root = ROOT) {
  const issues = []
  const current = Object.fromEntries(FILES.map((file) => [
    file,
    createHash('sha256').update(fs.readFileSync(path.resolve(root, file))).digest('hex'),
  ]))
  for (const [file, expected] of Object.entries(manifest?.files || {})) {
    if (!current[file]) issues.push(`unexpected frozen file: ${file}`)
    else if (current[file] !== expected) issues.push(`frozen protocol file changed: ${file}`)
  }
  for (const file of FILES) if (!manifest?.files?.[file]) issues.push(`protocol file is not frozen: ${file}`)
  return { valid: issues.length === 0, issues, frozenFileCount: Object.keys(manifest?.files || {}).length }
}

function main() {
  const index = process.argv.indexOf('--out')
  const out = path.resolve(ROOT, index >= 0 ? process.argv[index + 1] : 'private-evidence/v3-prospective/prospective-evaluator-freeze.json')
  const manifest = {
    schemaVersion: 1,
    frozenAt: new Date().toISOString(),
    purpose: 'Write-once P03/P09 evaluator protocol for the frozen P08 non-row parity candidate.',
    files: collectProspectiveProtocolHashes(),
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ out: path.relative(ROOT, out), frozenFileCount: Object.keys(manifest.files).length }, null, 2))
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isDirect) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
