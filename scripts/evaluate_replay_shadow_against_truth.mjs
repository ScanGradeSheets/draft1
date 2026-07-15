#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const replayRoot = path.resolve(ROOT, process.argv[2] || '')
const outputPath = path.resolve(ROOT, process.argv[3] || path.join(replayRoot, 'truth-evaluation.json'))

function walk(root, output = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) walk(resolved, output)
    else if (entry.isFile() && entry.name === 'ocr-debug.json') output.push(resolved)
  }
  return output
}

function truthMap() {
  const files = [
    'private-evidence/hybrid-v2-prospective/handwritten-truth-development.json',
    'private-evidence/hybrid-v2-prospective/handwritten-truth-p03-p09-primary.json',
    'private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json',
  ]
  const rows = files.flatMap((file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')).labels)
  return new Map(rows.map((row) => [`${row.packetId}|${row.layoutId}|${row.questionNum}`, row]))
}

function summary(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const count = (predicate) => scorable.filter(predicate).length
  const accepted = scorable.filter((row) => row.shadowAction === 'accept')
  return {
    answers: rows.length,
    scorable: scorable.length,
    sequenceCorrect: count((row) => row.sequenceRead === row.truth),
    compactCorrect: count((row) => row.compactRead === row.truth),
    slotCorrect: count((row) => row.slotRead === row.truth),
    unionContainsTruth: count((row) => [row.sequenceRead, row.compactRead, row.slotRead].includes(row.truth)),
    sequenceCompactAgree: count((row) => row.sequenceRead && row.sequenceRead === row.compactRead),
    sequenceCompactAgreeCorrect: count((row) => row.sequenceRead && row.sequenceRead === row.compactRead && row.sequenceRead === row.truth),
    shadowAccepted: accepted.length,
    shadowAcceptedCorrect: accepted.filter((row) => row.shadowRead === row.truth).length,
    shadowAcceptedWrong: accepted.filter((row) => row.shadowRead !== row.truth).length,
  }
}

function main() {
  if (!fs.existsSync(replayRoot)) throw new Error(`replay root not found: ${replayRoot}`)
  const truth = truthMap()
  const rows = []
  for (const file of walk(replayRoot)) {
    const debug = JSON.parse(fs.readFileSync(file, 'utf8'))
    const packetId = debug.packetId || path.relative(replayRoot, file).split(path.sep)[0]
    for (const decision of debug.v3Shadow?.decisions || []) {
      const key = `${packetId}|${debug.layoutId}|${decision.questionNum}`
      const label = truth.get(key)
      if (!label) continue
      rows.push({
        packetId,
        layoutId: debug.layoutId,
        questionNum: decision.questionNum,
        truthState: label.truthState,
        truth: label.handwrittenTruth,
        scorable: label.truthState === 'value',
        slotRead: decision.slotRead || '',
        sequenceRead: decision.sequenceRead || '',
        compactRead: decision.compactRead || '',
        sequenceMinConfidence: decision.sequenceFrameConsensus?.minConfidence,
        compactMinConfidence: decision.compactFrameConsensus?.minConfidence,
        shadowAction: decision.decision?.action,
        shadowRead: decision.decision?.read || '',
        shadowReason: decision.decision?.reason,
        evidenceFile: path.relative(ROOT, file),
      })
    }
  }
  rows.sort((a, b) => a.packetId.localeCompare(b.packetId) || a.layoutId.localeCompare(b.layoutId) || a.questionNum - b.questionNum)
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    answerKeyUsedAsTruth: false,
    replayRoot: path.relative(ROOT, replayRoot),
    overall: summary(rows),
    byPacket: Object.fromEntries([...new Set(rows.map((row) => row.packetId))].map((packet) => [packet, summary(rows.filter((row) => row.packetId === packet))])),
    rows,
  }
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ output: path.relative(ROOT, outputPath), overall: report.overall, byPacket: report.byPacket }, null, 2))
}

main()
