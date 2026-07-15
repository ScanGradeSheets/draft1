#!/usr/bin/env node

// Post-hoc falsification screen for Candidate 3 residual groups. This script
// describes possible future rules; it does not change application behavior.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const INVENTORY = path.join(ROOT, 'private-evidence/reports/candidate3-yellow-inventory-20260715.json')

function parseArgs(argv) {
  const options = { run: null, out: null }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--run') options.run = argv[++index]
    else if (argv[index] === '--out') options.out = argv[++index]
    else throw new Error(`unknown argument: ${argv[index]}`)
  }
  if (!options.run || !options.out) throw new Error('usage: analyze_candidate3_residual_experiments.mjs --run DIR --out FILE')
  return options
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const exact = (value, minimum = 0.70) => Boolean(
  digits(value?.text ?? value?.read) && value?.tied !== true &&
  Number(value?.count ?? value?.agreeingFrames) === 3 &&
  Number(value?.usableFrameCount ?? value?.usableCrops) === 3 &&
  Number(value?.minConfidence) >= minimum)

function findFiles(root, name, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) findFiles(resolved, name, output)
    else if (entry.isFile() && entry.name === name) output.push(resolved)
  }
  return output
}

function policySummary(rows, key) {
  const selected = rows.filter((row) => row[key]?.selected)
  return {
    selected: selected.length,
    correct: selected.filter((row) => row[key].read === row.truthText).length,
    wrong: selected.filter((row) => row[key].read !== row.truthText).length,
    examples: selected.map((row) => ({ id: row.id, truth: row.truthText, read: row[key].read })),
  }
}

const options = parseArgs(process.argv.slice(2))
const inventory = readJson(INVENTORY)
const debugByKey = new Map()
for (const packetId of ['P08', 'P03', 'P09', 'P02']) {
  for (const file of findFiles(path.join(ROOT, options.run, packetId), 'ocr-debug.json')) {
    const debug = readJson(file)
    debugByKey.set(`${packetId}|${debug.layoutId}`, debug)
  }
}

const rows = inventory.rows.map((source) => {
  const debug = debugByKey.get(`${source.packetId}|${source.layoutId}`)
  if (!debug) throw new Error(`missing replay page ${source.packetId}|${source.layoutId}`)
  const questionNum = Number(source.questionNum)
  const primary = (debug.v3Shadow?.decisions || []).find((item) => Number(item.questionNum) === questionNum)?.sequenceFrameConsensus || null
  const alternate = (debug.v3Shadow?.alternateCropReview?.decisions || []).find((item) => Number(item.questionNum) === questionNum)?.sequenceFrameConsensus || null
  const core = (debug.v3Shadow?.coreCropReview?.decisions || []).find((item) => Number(item.questionNum) === questionNum)?.sequenceFrameConsensus || null
  const primaryRead = digits(primary?.text)
  const alternateRead = digits(alternate?.text)
  const coreRead = digits(core?.text)
  const ambiguity = (debug.v3Shadow?.consensusPromotionDecisions || []).find((item) => Number(item.questionNum) === questionNum)?.ambiguity
  const noAmbiguity = ambiguity?.detected !== true
  const slotCompatible = (read) => Boolean(read && read.length <= Number(source.slotCount))

  // High-confidence 2/3 frame majority plus exact compact agreement. This is
  // intentionally much narrower than accepting arbitrary 2/3 majorities.
  const highTwoPlusCompact = source.policyReason === 'insufficient-three-frame-consensus' &&
    Number(primary?.count) >= 2 && Number(primary?.usableFrameCount) === 3 &&
    Number(primary?.minConfidence) >= 0.95 && primaryRead === digits(source.compactRead) &&
    slotCompatible(primaryRead) && noAmbiguity

  // Both physical crops agree on all three frames; one crop must be strong and
  // the other at least usable. Kept as research-only because thresholds were
  // formulated after seeing these development residuals.
  const relaxedDualCrop = source.policyReason === 'insufficient-three-frame-consensus' &&
    exact(primary, 0.60) && exact(alternate, 0.60) && primaryRead === alternateRead &&
    Math.max(Number(primary?.minConfidence), Number(alternate?.minConfidence)) >= 0.80 &&
    slotCompatible(primaryRead) && noAmbiguity

  // Falsification-only test for safety vetoes: require exact agreement across
  // primary frames, alternate frames, and three selected-crop views. Even a
  // clean result here does not authorize weakening the safety veto.
  const tripleViewSafety = source.policyReason === 'confidence-safety-veto-dominates' &&
    exact(primary) && exact(alternate) && exact(core) &&
    primaryRead === alternateRead && primaryRead === coreRead &&
    slotCompatible(primaryRead) && noAmbiguity

  return {
    id: `${source.packetId}|${source.layoutId}|${questionNum}`,
    packetId: source.packetId,
    layoutId: source.layoutId,
    layoutFamily: source.layoutFamily,
    questionNum,
    truthText: source.truthText,
    policyReason: source.policyReason,
    primary,
    alternate,
    core,
    compactRead: source.compactRead,
    ambiguity,
    highTwoPlusCompact: { selected: highTwoPlusCompact, read: highTwoPlusCompact ? primaryRead : null },
    relaxedDualCrop: { selected: relaxedDualCrop, read: relaxedDualCrop ? primaryRead : null },
    tripleViewSafety: { selected: tripleViewSafety, read: tripleViewSafety ? primaryRead : null },
  }
})

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'post-hoc residual experiment; no production change; not a launch estimate',
  answerKeyUsedForRecognition: false,
  truthUsedOnlyForScoringAfterKeyBlindRules: true,
  warning: 'These rules were formulated after observing the development residuals and require unseen-packet validation before use.',
  source: path.relative(ROOT, INVENTORY),
  replay: options.run,
  instability: {
    answers: rows.filter((row) => row.policyReason === 'insufficient-three-frame-consensus').length,
    highTwoPlusCompact: policySummary(rows, 'highTwoPlusCompact'),
    relaxedDualCrop: policySummary(rows, 'relaxedDualCrop'),
  },
  confidenceSafety: {
    answers: rows.filter((row) => row.policyReason === 'confidence-safety-veto-dominates').length,
    tripleViewSafety: policySummary(rows, 'tripleViewSafety'),
    recommendation: 'Keep the safety veto absolute until an unseen-packet falsification set demonstrates otherwise.',
  },
  rows,
}

fs.writeFileSync(path.resolve(ROOT, options.out), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: options.out, instability: report.instability, confidenceSafety: report.confidenceSafety }, null, 2))
