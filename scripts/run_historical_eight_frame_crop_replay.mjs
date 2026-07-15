#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const EIGHT_ANSWER_LAYOUTS = new Set([
  'sg-g1-lw-01-add-1digit',
  'sg-g1-lw-02-add-2digit',
  'sg-g1-lw-03-sub-1digit',
  'sg-g1-lw-04-sub-2digit',
  'sg-g1-lw-05-mixed-20',
])

function parseArgs(argv) {
  const options = { out: null, candidate: false, url: 'https://localhost:5174' }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--out') options.out = argv[++index]
    else if (value === '--candidate') options.candidate = true
    else if (value === '--url') options.url = argv[++index]
    else throw new Error(`unknown argument: ${value}`)
  }
  if (!options.out) throw new Error('--out is required')
  return options
}

const options = parseArgs(process.argv.slice(2))
const truth = JSON.parse(fs.readFileSync(path.join(ROOT, TRUTH), 'utf8'))
const captures = new Map()
for (const entry of truth.entries || []) {
  if (!EIGHT_ANSWER_LAYOUTS.has(entry.layoutId) || !entry.captureId || !entry.debugPath) continue
  const existing = captures.get(entry.captureId)
  if (existing && existing !== entry.debugPath) throw new Error(`capture ${entry.captureId} has conflicting debug paths`)
  captures.set(entry.captureId, entry.debugPath)
}
const files = [...captures.values()].sort().map((file) => path.join(ROOT, file))
if (files.length !== 33) throw new Error(`expected 33 historical eight-answer captures, found ${files.length}`)
for (const file of files) if (!fs.existsSync(file)) throw new Error(`missing ${file}`)

const output = path.resolve(ROOT, options.out)
fs.mkdirSync(output, { recursive: true })
fs.writeFileSync(path.join(output, 'matched-inputs.json'), `${JSON.stringify({
  schemaVersion: 1,
  sourceTruth: TRUTH,
  mode: options.candidate ? 'eight-frame-column-order-candidate' : 'production-default-control',
  captureCount: files.length,
  files: files.map((file) => path.relative(ROOT, file)),
}, null, 2)}\n`, { flag: 'wx' })

const result = spawnSync(process.execPath, [
  path.join(ROOT, 'scripts/replay_live_ocr_captured.mjs'),
  '--allow-imperfect',
  '--url', options.url,
  '--out-dir', output,
  ...files,
], {
  cwd: ROOT,
  env: { ...process.env, SG_EIGHT_FRAME_COLUMN_ORDER: options.candidate ? '1' : '0' },
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`historical replay exited ${result.status}`)
