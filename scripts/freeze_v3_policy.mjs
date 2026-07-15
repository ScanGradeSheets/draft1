#!/usr/bin/env node
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const POLICY_PATHS = [
  'src/components/CameraCapture.vue',
  'src/homography.js',
  'src/ocr-pipeline.js',
  'src/hybrid-recognition.js',
  'src/hybrid-review-client.js',
  'src/v3',
  'scripts/serve_trocr_review.py',
  'scripts/serve_v3_compact.mjs',
  'scripts/eval_uploaded_worksheets.mjs',
  'scripts/evaluate_hybrid_v2_packets.mjs',
  'scripts/evaluate_v3_fusion_policy.mjs',
  'scripts/freeze_v3_policy.mjs',
  'private-evidence/hybrid-v2-prospective/score-p08-fresh-zone-parity.mjs',
  'private-evidence/v3-prospective/nonrow-parity-policy-candidate.json',
  'public/mnist-model.onnx',
  'layouts',
  'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
  'private-evidence/models/v3-sequence-live/model.onnx',
  'private-evidence/capture-plans/four-packet-plan.json',
]

const hashFile = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex')
function collectFiles(target, output = []) {
  if (!fs.existsSync(target)) return output
  const stat = fs.statSync(target)
  if (stat.isFile()) output.push(target)
  else for (const name of fs.readdirSync(target).sort()) collectFiles(path.join(target, name), output)
  return output
}

export function collectV3PolicyHashes(root = process.cwd()) {
  const files = POLICY_PATHS.flatMap((target) => collectFiles(path.resolve(root, target)))
  return Object.fromEntries(files.sort().map((file) => [path.relative(root, file), hashFile(file)]))
}

export function verifyV3PolicyFreeze(manifest, root = process.cwd()) {
  const current = collectV3PolicyHashes(root)
  const frozen = manifest?.files || {}
  const issues = []
  for (const [file, hash] of Object.entries(frozen)) {
    if (!current[file]) issues.push(`frozen file missing: ${file}`)
    else if (current[file] !== hash) issues.push(`frozen file changed: ${file}`)
  }
  for (const file of Object.keys(current)) if (!frozen[file]) issues.push(`unfrozen policy file: ${file}`)
  return { valid: issues.length === 0, issues, frozenFileCount: Object.keys(frozen).length }
}

function main() {
  const index = process.argv.indexOf('--out')
  const out = index >= 0 ? process.argv[index + 1] : 'private-evidence/v3-prospective/policy-freeze.json'
  const manifest = {
    schemaVersion: 1,
    frozenAt: new Date().toISOString(),
    purpose: 'Freeze V2 control, V3 recognizers, fusion, evaluator, layouts, and four-packet assignment before opening locked packet P02.',
    files: collectV3PolicyHashes(),
  }
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({ out, frozenFileCount: Object.keys(manifest.files).length }, null, 2))
}

const isDirect = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
if (isDirect) {
  try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
}
