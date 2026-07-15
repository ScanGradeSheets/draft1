#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const LAYOUTS = Array.from({ length: 10 }, (_, index) =>
  `sg-g1-lw-${String(index + 1).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index]}`)
const CANONICAL_P02_DOT = '2026-07-14_03-52-45-221-sg-g1-lw-07-dot-collections-39ec2eb4'

function debugFiles(root, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) debugFiles(resolved, output)
    else if (entry.isFile() && entry.name === 'debug.json') output.push(resolved)
  }
  return output
}

const versions = []
for (const date of ['2026-07-13', '2026-07-14']) {
  for (const file of debugFiles(path.join(ROOT, 'private-evidence/debug-scans', date))) {
    try {
      const wrapper = JSON.parse(fs.readFileSync(file, 'utf8'))
      const debug = wrapper.debug || wrapper
      if (PACKETS.includes(debug.packetId) && LAYOUTS.includes(debug.layoutId)) {
        versions.push({ file, dir: path.dirname(file), debug })
      }
    } catch {}
  }
}

const selected = []
for (const packetId of PACKETS) {
  for (const layoutId of LAYOUTS) {
    const candidates = versions.filter((row) => row.debug.packetId === packetId && row.debug.layoutId === layoutId)
    const sessions = new Map()
    for (const row of candidates) {
      const id = row.debug.scanSessionId || path.basename(row.dir)
      if (!sessions.has(id)) sessions.set(id, [])
      sessions.get(id).push(row)
    }
    let eligible = [...sessions.values()].filter((rows) => rows.some((row) =>
      Array.isArray(row.debug.answerGroups) && row.debug.answerGroups.length > 0 &&
      fs.existsSync(path.join(row.dir, 'captured.png')) && fs.existsSync(path.join(row.dir, 'burst-frames'))))
    if (packetId === 'P02' && layoutId === 'sg-g1-lw-07-dot-collections') {
      eligible = eligible.filter((rows) => rows.some((row) => path.basename(row.dir) === CANONICAL_P02_DOT))
    }
    if (eligible.length !== 1) throw new Error(`${packetId}|${layoutId}: ${eligible.length} canonical sessions`)
    const asset = eligible[0].find((row) => fs.existsSync(path.join(row.dir, 'captured.png')))
    selected.push({ packetId, layoutId, captured: path.join(asset.dir, 'captured.png') })
  }
}
if (selected.length !== 40) throw new Error(`expected 40 canonical pages, found ${selected.length}`)
const files = selected.map((row) => path.resolve(ROOT, row.captured))
const missing = files.filter((file) => !fs.existsSync(file))
if (missing.length) throw new Error(`missing ${missing.length} captured pages`)

const out = path.resolve(ROOT, process.env.SG_CURRENT_BROWSER_OUT || 'private-evidence/reports/current-four-packet-browser-replay-20260714')
if (fs.existsSync(out)) throw new Error(`refusing to overwrite ${path.relative(ROOT, out)}`)

const result = spawnSync(process.execPath, [
  path.join(ROOT, 'scripts/eval_uploaded_worksheets.mjs'),
  '--url', process.env.SG_REPLAY_URL || 'https://localhost:5174',
  '--out', out,
  ...files,
], {
  cwd: ROOT,
  env: { ...process.env, SG_EVAL_QUERY: process.env.SG_EVAL_QUERY || '', SG_V3_BURST_SIBLINGS: '0' },
  stdio: 'inherit',
})
if (result.error) throw result.error
if (result.status !== 0) throw new Error(`current browser replay exited ${result.status}`)
