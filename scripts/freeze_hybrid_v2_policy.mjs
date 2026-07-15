#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const POLICY_PATHS = [
  'src/components/CameraCapture.vue',
  'src/hybrid-recognition.js',
  'src/hybrid-review-client.js',
  'scripts/serve_trocr_review.py',
  'scripts/evaluate_hybrid_v2_packets.mjs',
  'public/mnist-model.onnx',
  'layouts',
  'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
  'private-evidence/capture-plans/four-packet-plan.json',
]

function hashFile(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function collectFiles(target, output = []) {
  if (!fs.existsSync(target)) return output
  const stat = fs.statSync(target)
  if (stat.isFile()) output.push(target)
  else if (stat.isDirectory()) {
    for (const name of fs.readdirSync(target).sort()) collectFiles(path.join(target, name), output)
  }
  return output
}

export function collectPolicyHashes(root = process.cwd()) {
  const files = POLICY_PATHS.flatMap((target) => collectFiles(path.resolve(root, target)))
  return Object.fromEntries(files.sort().map((file) => [path.relative(root, file), hashFile(file)]))
}

export function verifyPolicyFreeze(manifest, root = process.cwd()) {
  const current = collectPolicyHashes(root)
  const frozen = manifest?.files || {}
  const issues = []
  for (const [file, hash] of Object.entries(frozen)) {
    if (!current[file]) issues.push(`frozen file missing: ${file}`)
    else if (current[file] !== hash) issues.push(`frozen file changed: ${file}`)
  }
  for (const file of Object.keys(current)) {
    if (!frozen[file]) issues.push(`unfrozen policy file: ${file}`)
  }
  return { valid: issues.length === 0, issues, frozenFileCount: Object.keys(frozen).length }
}

function parseArgs(argv) {
  const index = argv.indexOf('--out')
  return { out: index >= 0 ? argv[index + 1] : 'private-evidence/hybrid-v2-prospective/policy-freeze.json' }
}

function main() {
  const { out } = parseArgs(process.argv.slice(2))
  const manifest = {
    schemaVersion: 1,
    frozenAt: new Date().toISOString(),
    purpose: 'Freeze Hybrid V2 code, models, layouts, evaluator, and prospective packet assignment before opening locked packet P02.',
    files: collectPolicyHashes(),
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ out, frozenFileCount: Object.keys(manifest.files).length }, null, 2))
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isDirect) {
  try { main() } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
