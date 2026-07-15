#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { verifyV3PolicyFreeze } from './freeze_v3_policy.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'))
}

function parseArgs(argv) {
  const options = {
    manifest: 'private-evidence/v3/live-continuous-answer-zones-manifest.json',
    truth: 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json',
    freeze: 'private-evidence/v3-prospective/nonrow-parity-policy-freeze-p08.json',
    out: 'private-evidence/reports/v3-historical-fresh-replay-20260713',
    url: 'https://localhost:5174',
    reviewUrl: 'http://127.0.0.1:8768',
    compactUrl: 'http://127.0.0.1:8769',
    dryRun: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--manifest') options.manifest = argv[++index]
    else if (value === '--truth') options.truth = argv[++index]
    else if (value === '--freeze') options.freeze = argv[++index]
    else if (value === '--out') options.out = argv[++index]
    else if (value === '--url') options.url = argv[++index]
    else if (value === '--review-url') options.reviewUrl = argv[++index]
    else if (value === '--compact-url') options.compactUrl = argv[++index]
    else if (value === '--dry-run') options.dryRun = true
    else throw new Error(`unknown argument: ${value}`)
  }
  return options
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const freeze = readJson(options.freeze)
  const verification = verifyV3PolicyFreeze(freeze, ROOT)
  if (!verification.valid) throw new Error(`main policy freeze invalid: ${verification.issues.join('; ')}`)

  const manifest = readJson(options.manifest)
  const truth = readJson(options.truth)
  const debugPathByCapture = new Map((truth.entries || []).map((row) => [row.captureId, row.debugPath]))
  const byCapture = new Map()
  for (const entry of manifest.entries || []) {
    if (!entry.captureId || !entry.imagePath) continue
    const debugPath = debugPathByCapture.get(entry.captureId)
    if (!debugPath) continue
    const captured = path.join(path.dirname(debugPath), 'captured.png')
    byCapture.set(entry.captureId, captured)
  }
  const missing = [...byCapture.entries()].filter(([, file]) => !fs.existsSync(path.resolve(ROOT, file)))
  if (missing.length) throw new Error(`missing ${missing.length} captured page images`)
  const files = [...byCapture.values()].sort().map((file) => path.resolve(ROOT, file))
  if (!files.length) throw new Error('manifest selected no captured page images')
  if (options.dryRun) {
    console.log(JSON.stringify({ captures: files.length, answers: manifest.entries?.length || 0, missingCapturedImages: missing.length }, null, 2))
    return
  }

  const out = path.resolve(ROOT, options.out)
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'historical-inputs.json'), `${JSON.stringify({
    schemaVersion: 1,
    purpose: 'Historical, development-influenced stress test of fresh untouched-pixel V3 zones; not prospective evidence.',
    manifest: options.manifest,
    policyFreeze: options.freeze,
    policyFreezeValidAtStart: true,
    captures: [...byCapture.entries()].map(([captureId, file]) => ({ captureId, file })),
  }, null, 2)}\n`, { flag: 'wx' })

  const query = new URLSearchParams({
    hybridV3: '1',
    v3PristineWarp: '1',
    v3SequenceFromZones: '1',
    reviewModelUrl: options.reviewUrl,
    v3CompactModelUrl: options.compactUrl,
  }).toString()
  const result = spawnSync(process.execPath, [
    path.resolve(ROOT, 'scripts/eval_uploaded_worksheets.mjs'),
    '--url', options.url,
    '--out', out,
    ...files,
  ], {
    cwd: ROOT,
    env: {
      ...process.env,
      SG_EVAL_QUERY: query,
      SG_V3_BURST_SIBLINGS: '0',
    },
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`historical replay exited ${result.status}`)
}

try { main() } catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
