#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUTPUT_ROOT = path.join(ROOT, 'private-evidence/v3/four-packet-sequence-20260714')
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const SPLITS = { P08: 'development', P03: 'development', P09: 'validation', P02: 'holdout' }
const LAYOUTS = Array.from({ length: 10 }, (_, index) =>
  `sg-g1-lw-${String(index + 1).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index]}`)
const CANONICAL_P02_DOT = '2026-07-14_03-52-45-221-sg-g1-lw-07-dot-collections-39ec2eb4'

function walk(root, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) walk(resolved, output)
    else if (entry.isFile() && entry.name === 'debug.json') output.push(resolved)
  }
  return output
}

function loadTruth() {
  const files = [
    'private-evidence/hybrid-v2-prospective/handwritten-truth-development.json',
    'private-evidence/hybrid-v2-prospective/handwritten-truth-p03-p09-primary.json',
    'private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json',
  ]
  const labels = files.flatMap((file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')).labels)
    .filter((row) => PACKETS.includes(row.packetId))
  return new Map(labels.map((row) => [`${row.packetId}|${row.layoutId}|${row.questionNum}`, row]))
}

function loadVersions() {
  const output = []
  for (const file of ['2026-07-13', '2026-07-14'].flatMap((date) => walk(path.join(ROOT, 'private-evidence/debug-scans', date)))) {
    try {
      const wrapper = JSON.parse(fs.readFileSync(file, 'utf8'))
      const debug = wrapper.debug || wrapper
      if (PACKETS.includes(debug.packetId) && LAYOUTS.includes(debug.layoutId)) output.push({ file, dir: path.dirname(file), debug })
    } catch {
      // Ignore interrupted debug writes.
    }
  }
  return output
}

function canonicalPages(versions) {
  const pages = []
  for (const packetId of PACKETS) {
    for (const layoutId of LAYOUTS) {
      const sessions = new Map()
      for (const row of versions.filter((item) => item.debug.packetId === packetId && item.debug.layoutId === layoutId)) {
        const session = row.debug.scanSessionId || path.basename(row.dir)
        if (!sessions.has(session)) sessions.set(session, [])
        sessions.get(session).push(row)
      }
      let eligible = [...sessions.values()].filter((rows) => rows.some((row) =>
        Array.isArray(row.debug.answerGroups) && row.debug.answerGroups.length > 0 && fs.existsSync(path.join(row.dir, 'captured.png'))))
      if (packetId === 'P02' && layoutId === 'sg-g1-lw-07-dot-collections') {
        eligible = eligible.filter((rows) => rows.some((row) => path.basename(row.dir) === CANONICAL_P02_DOT))
      }
      if (eligible.length !== 1) throw new Error(`${packetId}|${layoutId}: expected one canonical session; got ${eligible.length}`)
      const best = [...eligible[0]].sort((a, b) =>
        (b.debug.v3AnswerZones?.length || 0) - (a.debug.v3AnswerZones?.length || 0))[0]
      pages.push(best)
    }
  }
  return pages
}

function decodeDataUrl(dataUrl) {
  const match = /^data:image\/png;base64,(.+)$/s.exec(dataUrl || '')
  if (!match) throw new Error('zone image is not a PNG data URL')
  return Buffer.from(match[1], 'base64')
}

function main() {
  const truth = loadTruth()
  const pages = canonicalPages(loadVersions())
  fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
  const entries = []
  for (const page of pages) {
    for (const zone of page.debug.v3AnswerZones || []) {
      const key = `${page.debug.packetId}|${page.debug.layoutId}|${zone.questionNum}`
      const label = truth.get(key)
      if (!label) throw new Error(`missing truth for ${key}`)
      if (label.truthState !== 'value') continue
      const split = SPLITS[page.debug.packetId]
      const basename = `${page.debug.packetId}-${page.debug.layoutId}-q${String(zone.questionNum).padStart(2, '0')}.png`
      const imagePath = path.join(OUTPUT_ROOT, split, basename)
      fs.mkdirSync(path.dirname(imagePath), { recursive: true })
      fs.writeFileSync(imagePath, decodeDataUrl(zone.imageDataUrl))
      entries.push({
        uid: key,
        packetId: page.debug.packetId,
        captureId: page.debug.scanSessionId,
        layoutId: page.debug.layoutId,
        layoutFamily: /lw-0[1-5]-/.test(page.debug.layoutId) ? 'row' : 'non-row',
        questionNum: zone.questionNum,
        split,
        truth: label.handwrittenTruth,
        truthStatus: label.qaStatus,
        truthState: label.truthState,
        recognitionPath: path.relative(ROOT, imagePath),
        imagePath: path.relative(ROOT, imagePath),
        quality: zone.quality,
      })
    }
  }
  const counts = Object.fromEntries(Object.values(SPLITS).map((split) => [split, entries.filter((row) => row.split === split).length]))
  if (entries.length !== 275 || counts.development !== 137 || counts.validation !== 70 || counts.holdout !== 68) {
    throw new Error(`unexpected manifest counts: ${JSON.stringify(counts)} total=${entries.length}`)
  }
  const manifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    answerKeyUsedAsTruth: false,
    answerKeyProvidedToModel: false,
    splitWarning: 'Writer/packet-aware prospective split: P08+P03 development, P09 validation, P02 holdout. P02 was previously inspected during crop debugging, so it is not pristine for overall architecture selection; it remains excluded from all training and validation.',
    splitPolicy: { development: ['P08', 'P03'], validation: ['P09'], holdout: ['P02'] },
    counts,
    entries,
  }
  fs.writeFileSync(path.join(OUTPUT_ROOT, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(JSON.stringify({ output: path.relative(ROOT, path.join(OUTPUT_ROOT, 'manifest.json')), counts }, null, 2))
}

main()
