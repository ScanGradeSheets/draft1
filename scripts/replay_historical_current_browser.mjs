#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const truthPages = JSON.parse(fs.readFileSync(path.join(
  ROOT,
  'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled-pages.json',
), 'utf8')).pages

const files = truthPages.map((page) => path.join(ROOT, path.dirname(page.debugPath), 'captured.png'))
const missing = files.filter((file) => !fs.existsSync(file))
if (truthPages.length !== 86 || missing.length) {
  throw new Error(`historical input integrity failed: pages=${truthPages.length}, missing=${missing.length}`)
}

const output = path.resolve(ROOT, process.env.SG_HISTORICAL_BROWSER_OUT || 'private-evidence/reports/current-historical-browser-replay-20260714')
if (fs.existsSync(output)) throw new Error(`refusing to overwrite ${path.relative(ROOT, output)}`)
const result = spawnSync(process.execPath, [
  path.join(ROOT, 'scripts/eval_uploaded_worksheets.mjs'),
  '--url', process.env.SG_REPLAY_URL || 'https://localhost:5174',
  '--out', output,
  ...files,
], {
  cwd: ROOT,
  env: {
    ...process.env,
    SG_V3_BURST_SIBLINGS: '0',
    SG_EVAL_QUERY: process.env.SG_EVAL_QUERY || '',
  },
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`current browser replay exited ${result.status}`)
