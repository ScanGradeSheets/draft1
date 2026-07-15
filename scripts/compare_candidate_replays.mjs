#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function parseArgs(argv) {
  const options = { before: null, after: null, out: null }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--before') options.before = argv[++index]
    else if (argv[index] === '--after') options.after = argv[++index]
    else if (argv[index] === '--out') options.out = argv[++index]
    else throw new Error(`unknown argument: ${argv[index]}`)
  }
  if (!options.before || !options.after || !options.out) throw new Error('usage: compare_candidate_replays.mjs --before DIR --after DIR --out FILE')
  return options
}

function findFiles(root, name, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) findFiles(resolved, name, output)
    else if (entry.isFile() && entry.name === name) output.push(resolved)
  }
  return output
}

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const stable = (value) => JSON.stringify(value)
const pageKey = (packetId, debug) => `${packetId}|${debug.layoutId}`

function pages(relative) {
  const output = new Map()
  for (const packetId of ['P08', 'P03', 'P09', 'P02']) {
    for (const file of findFiles(path.join(ROOT, relative, packetId), 'ocr-debug.json')) {
      const debug = read(file)
      output.set(pageKey(packetId, debug), { packetId, file, debug })
    }
  }
  return output
}

function projection(debug) {
  return {
    layoutId: debug.layoutId,
    predictions: (debug.predictions || []).map((item) => ({
      id: item.id, questionNum: item.questionNum, digit: item.digit,
      confidence: item.confidence, topGap: item.topGap, reviewNeeded: item.reviewNeeded,
      robust: item.robust, robustOverride: item.robustOverride,
    })),
    strong: (debug.v3Shadow?.decisions || []).map((item) => ({ questionNum: item.questionNum, consensus: item.sequenceFrameConsensus })),
    alternate: (debug.v3Shadow?.alternateCropReview?.decisions || []).map((item) => ({ questionNum: item.questionNum, consensus: item.sequenceFrameConsensus })),
    core: (debug.v3Shadow?.coreCropReview?.decisions || []).map((item) => ({ questionNum: item.questionNum, consensus: item.sequenceFrameConsensus })),
    compact: (debug.wholeAnswerReviewSuggestions || []).filter((item) => item.source === 'key-blind-compact-model'),
    groups: (debug.answerGroups || []).map((item) => ({
      questionNum: item.questionNum, answerText: item.answerText,
      reviewNeeded: item.reviewNeeded, status: item.status,
    })),
    applications: debug.v3Shadow?.consensusApplication?.applied || [],
  }
}

const options = parseArgs(process.argv.slice(2))
const before = pages(options.before)
const after = pages(options.after)
const keys = [...new Set([...before.keys(), ...after.keys()])].sort()
const comparisons = []
for (const key of keys) {
  const a = before.get(key)
  const b = after.get(key)
  if (!a || !b) {
    comparisons.push({ key, completePair: false })
    continue
  }
  const pa = projection(a.debug)
  const pb = projection(b.debug)
  comparisons.push({
    key,
    completePair: true,
    predictionsIdentical: stable(pa.predictions) === stable(pb.predictions),
    strongIdentical: stable(pa.strong) === stable(pb.strong),
    alternateIdentical: stable(pa.alternate) === stable(pb.alternate),
    coreIdentical: stable(pa.core) === stable(pb.core),
    compactIdentical: stable(pa.compact) === stable(pb.compact),
    groupsIdentical: stable(pa.groups) === stable(pb.groups),
    applicationsIdentical: stable(pa.applications) === stable(pb.applications),
    changedGroups: pb.groups.filter((item) => stable(item) !== stable(pa.groups.find((old) => Number(old.questionNum) === Number(item.questionNum)))),
  })
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  before: options.before,
  after: options.after,
  expectedPolicyDifference: 'The final run adds an ambiguity guard to the selected-core-crop bypass.',
  pages: keys.length,
  completePairs: comparisons.filter((item) => item.completePair).length,
  identicalEvidencePages: comparisons.filter((item) => item.completePair && item.predictionsIdentical && item.strongIdentical && item.alternateIdentical && item.coreIdentical && item.compactIdentical).length,
  changedFinalPages: comparisons.filter((item) => item.completePair && (!item.groupsIdentical || !item.applicationsIdentical)).length,
  comparisons,
}
fs.writeFileSync(path.resolve(ROOT, options.out), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  out: options.out,
  pages: report.pages,
  completePairs: report.completePairs,
  identicalEvidencePages: report.identicalEvidencePages,
  changedFinalPages: report.changedFinalPages,
  changed: comparisons.filter((item) => !item.groupsIdentical || !item.applicationsIdentical),
}, null, 2))
