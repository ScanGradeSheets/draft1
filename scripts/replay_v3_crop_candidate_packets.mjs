#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const EXPECTED_LAYOUTS = Array.from({ length: 10 }, (_, index) =>
  `sg-g1-lw-${String(index + 1).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index]}`)
const CANONICAL_P02_DOT = '2026-07-14_03-52-45-221-sg-g1-lw-07-dot-collections-39ec2eb4'

function parseArgs(argv) {
  const options = {
    out: 'private-evidence/reports/v3-crop-candidate-replay-20260714',
    url: 'https://localhost:5174',
    reviewUrl: 'http://127.0.0.1:8768',
    compactUrl: 'http://127.0.0.1:8769',
    packets: PACKETS,
    layouts: EXPECTED_LAYOUTS,
    cropCandidate: true,
    dualCropReview: false,
    consensusPromotion: false,
    confidenceSafetyControl: false,
    cleanPrintedFrames: false,
    numberBondShiftDown: false,
    nonrowTrimEvidence: false,
    frameRegistrationMode: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--out') options.out = argv[++index]
    else if (value === '--url') options.url = argv[++index]
    else if (value === '--review-url') options.reviewUrl = argv[++index]
    else if (value === '--compact-url') options.compactUrl = argv[++index]
    else if (value === '--packets') options.packets = argv[++index].split(',').map((item) => item.trim()).filter(Boolean)
    else if (value === '--six-answer-pages') options.layouts = EXPECTED_LAYOUTS.slice(5)
    else if (value === '--eight-answer-pages') options.layouts = EXPECTED_LAYOUTS.slice(0, 5)
    else if (value === '--layouts') options.layouts = argv[++index].split(',').map((item) => item.trim()).filter(Boolean)
    else if (value === '--control') options.cropCandidate = false
    else if (value === '--dual-crop-review') options.dualCropReview = true
    else if (value === '--consensus-promotion') options.consensusPromotion = true
    else if (value === '--confidence-safety-control') options.confidenceSafetyControl = true
    else if (value === '--clean-printed-frames') options.cleanPrintedFrames = true
    else if (value === '--number-bond-shift-down') options.numberBondShiftDown = true
    else if (value === '--nonrow-trim-evidence') options.nonrowTrimEvidence = true
    else if (value === '--frame-registration-mode') options.frameRegistrationMode = argv[++index]
    else throw new Error(`unknown argument: ${value}`)
  }
  return options
}

function debugFiles(root, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) debugFiles(resolved, output)
    else if (entry.isFile() && entry.name === 'debug.json') output.push(resolved)
  }
  return output
}

function loadVersions() {
  const roots = ['2026-07-13', '2026-07-14'].map((date) => path.join(ROOT, 'private-evidence/debug-scans', date))
  const versions = []
  for (const file of roots.flatMap((root) => debugFiles(root))) {
    try {
      const wrapper = JSON.parse(fs.readFileSync(file, 'utf8'))
      const debug = wrapper.debug || wrapper
      if (!PACKETS.includes(debug.packetId) || !EXPECTED_LAYOUTS.includes(debug.layoutId)) continue
      versions.push({ file, dir: path.dirname(file), debug })
    } catch {
      // Ignore unrelated/incomplete debug writes; selected evidence must pass
      // the explicit completeness checks below.
    }
  }
  return versions
}

function selectInputs(packets = PACKETS, layouts = EXPECTED_LAYOUTS) {
  const versions = loadVersions()
  const selected = []
  for (const packetId of packets) {
    if (!PACKETS.includes(packetId)) throw new Error(`unknown packet: ${packetId}`)
    for (const layoutId of layouts) {
      const candidates = versions.filter((row) => row.debug.packetId === packetId && row.debug.layoutId === layoutId)
      const sessions = new Map()
      for (const row of candidates) {
        const sessionId = row.debug.scanSessionId || path.basename(row.dir)
        if (!sessions.has(sessionId)) sessions.set(sessionId, [])
        sessions.get(sessionId).push(row)
      }
      let eligible = [...sessions.values()].filter((rows) =>
        rows.some((row) => Array.isArray(row.debug.answerGroups) && row.debug.answerGroups.length > 0) &&
        rows.some((row) => fs.existsSync(path.join(row.dir, 'captured.png')) && fs.existsSync(path.join(row.dir, 'burst-frames'))))
      if (packetId === 'P02' && layoutId === 'sg-g1-lw-07-dot-collections') {
        eligible = eligible.filter((rows) => rows.some((row) => path.basename(row.dir) === CANONICAL_P02_DOT))
      }
      if (eligible.length !== 1) throw new Error(`${packetId}|${layoutId} has ${eligible.length} eligible canonical sessions`)
      const rows = eligible[0]
      const asset = rows.find((row) =>
        fs.existsSync(path.join(row.dir, 'captured.png')) &&
        fs.readdirSync(path.join(row.dir, 'burst-frames')).filter((name) => /^frame-\d+\.(?:png|jpe?g)$/i.test(name)).length >= 3)
      if (!asset) throw new Error(`${packetId}|${layoutId} lacks captured page plus three frames`)
      selected.push({ packetId, layoutId, sessionId: asset.debug.scanSessionId, dir: asset.dir, captured: path.join(asset.dir, 'captured.png') })
    }
  }
  return selected
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const selected = selectInputs(options.packets, options.layouts)
  const destination = path.resolve(ROOT, options.out)
  fs.mkdirSync(destination, { recursive: true })
  const inputsFile = path.join(destination, 'inputs.json')
  if (!fs.existsSync(inputsFile)) {
    fs.writeFileSync(inputsFile, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      purpose: options.cropCandidate
        ? 'Replay the opt-in eight-frame answer-frame column-order crop candidate without changing recognition or confidence policy.'
        : 'Replay the production-default answer-frame assignment as a matched crop control.',
      cropMode: options.cropCandidate ? 'eight-frame-column-order-candidate' : 'production-default-control',
      packets: PACKETS,
      selected,
    }, null, 2)}\n`, { flag: 'wx' })
  }

  const query = new URLSearchParams({
    hybridV3: '1',
    v3BurstReplay: '1',
    v3PristineWarp: '1',
    v3SequenceFromZones: '1',
    reviewModelUrl: options.reviewUrl,
    v3CompactModelUrl: options.compactUrl,
    ...(options.cropCandidate ? { v3EightFrameColumnOrder: '1' } : {}),
    ...(options.dualCropReview ? { v3DualCropReview: '1' } : {}),
    ...(options.consensusPromotion ? {
      v3LocalFirstReview: '1',
      v3ConfidenceSafety: '1',
      v3ConsensusPromotion: '1',
    } : {}),
    ...(options.confidenceSafetyControl ? {
      v3LocalFirstReview: '1',
      v3ConfidenceSafety: '1',
    } : {}),
    ...(options.cleanPrintedFrames ? { v3CleanPrintedFrames: '1' } : {}),
    ...(options.numberBondShiftDown ? { v3NumberBondShiftDown: '1' } : {}),
    ...(options.nonrowTrimEvidence ? { v3NonrowTrimEvidence: '1' } : {}),
    ...(options.frameRegistrationMode ? { v3FrameRegistrationMode: options.frameRegistrationMode } : {}),
  }).toString()
  for (const packetId of options.packets) {
    const files = selected.filter((row) => row.packetId === packetId).map((row) => row.captured)
    const out = path.join(destination, packetId)
    if (fs.existsSync(path.join(out, 'summary.json'))) {
      console.log(`[skip] ${packetId}: completed replay already exists`)
      continue
    }
    const result = spawnSync(process.execPath, [
      path.join(ROOT, 'scripts/eval_uploaded_worksheets.mjs'),
      '--url', options.url,
      '--out', out,
      ...files,
    ], {
      cwd: ROOT,
      env: { ...process.env, SG_EVAL_QUERY: query, SG_V3_BURST_SIBLINGS: '1' },
      stdio: 'inherit',
    })
    if (result.error) throw result.error
    if (result.status !== 0) throw new Error(`${packetId} replay exited ${result.status}`)
  }
}

try { main() } catch (error) { console.error(error.message); process.exitCode = 1 }
