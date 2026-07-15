#!/usr/bin/env node

// Score a complete four-packet browser replay only after all key-blind OCR
// decisions have been saved. Handwriting truth is joined here, never during
// recognition.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const TRUTH_FILES = [
  'private-evidence/hybrid-v2-prospective/handwritten-truth-development.json',
  'private-evidence/hybrid-v2-prospective/handwritten-truth-p03-p09-primary.json',
  'private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json',
]
const PACKETS = ['P08', 'P03', 'P09', 'P02']
const EXPECTED_LAYOUTS = Array.from({ length: 10 }, (_, index) =>
  `sg-g1-lw-${String(index + 1).padStart(2, '0')}-${[
    'add-1digit', 'add-2digit', 'sub-1digit', 'sub-2digit', 'mixed-20',
    'ten-frames', 'dot-collections', 'number-bonds', 'number-patterns', 'place-value-50',
  ][index]}`)

function parseArgs(argv) {
  const options = { run: null, out: null }
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--run') options.run = argv[++index]
    else if (argv[index] === '--out') options.out = argv[++index]
    else throw new Error(`unknown argument: ${argv[index]}`)
  }
  if (!options.run || !options.out) throw new Error('usage: score_candidate_replay.mjs --run DIR --out FILE')
  return options
}

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const digits = (value) => String(value ?? '').replace(/\D/g, '') || null
const pct = (numerator, denominator) => denominator ? Number((100 * numerator / denominator).toFixed(1)) : null

function findFiles(root, name, output = []) {
  if (!fs.existsSync(root)) return output
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) findFiles(resolved, name, output)
    else if (entry.isFile() && entry.name === name) output.push(resolved)
  }
  return output
}

function family(layoutId) {
  const layout = readJson(path.join(ROOT, 'public/layouts', `${layoutId}.json`))
  return layout?.metadata?.layout_family === 'fact_rows' ? 'row' : 'non-row'
}

function summarize(rows) {
  const scorable = rows.filter((row) => row.scorable)
  const automatic = scorable.filter((row) => row.automatic)
  const promoted = automatic.filter((row) => row.promoted)
  return {
    answers: rows.length,
    scorableAnswers: scorable.length,
    ambiguousTruthExcluded: rows.length - scorable.length,
    automatic: automatic.length,
    coveragePct: pct(automatic.length, scorable.length),
    automaticCorrect: automatic.filter((row) => row.correct).length,
    automaticWrong: automatic.filter((row) => !row.correct).length,
    manualReview: scorable.length - automatic.length,
    promoted: promoted.length,
    promotedCorrect: promoted.filter((row) => row.correct).length,
    promotedWrong: promoted.filter((row) => !row.correct).length,
  }
}

const options = parseArgs(process.argv.slice(2))
const run = path.resolve(ROOT, options.run)
const truth = new Map()
for (const relative of TRUTH_FILES) {
  const source = readJson(path.join(ROOT, relative))
  if (source.answerKeyUsedAsTruth !== false) throw new Error(`${relative} does not reject answer-key truth`)
  for (const label of source.labels || []) {
    const key = `${label.packetId}|${label.layoutId}|${Number(label.questionNum)}`
    if (truth.has(key)) throw new Error(`duplicate truth ${key}`)
    truth.set(key, label)
  }
}

const pages = new Map()
const failures = []
for (const packetId of PACKETS) {
  const summaryFile = path.join(run, packetId, 'summary.json')
  if (fs.existsSync(summaryFile)) {
    for (const failure of readJson(summaryFile).failures || []) failures.push({ packetId, ...failure })
  }
  for (const file of findFiles(path.join(run, packetId), 'ocr-debug.json')) {
    const debug = readJson(file)
    if (!EXPECTED_LAYOUTS.includes(debug.layoutId) || debug.v3Shadow?.status !== 'complete') continue
    const key = `${packetId}|${debug.layoutId}`
    if (pages.has(key)) throw new Error(`duplicate page ${key}`)
    pages.set(key, { packetId, file, debug })
  }
}

const rows = []
for (const { packetId, file, debug } of [...pages.values()]) {
  const promoted = new Map((debug.v3Shadow?.consensusApplication?.applied || []).map((item) => [Number(item.questionNum), item]))
  for (const group of debug.answerGroups || []) {
    const questionNum = Number(group.questionNum)
    const label = truth.get(`${packetId}|${debug.layoutId}|${questionNum}`)
    if (!label) throw new Error(`missing truth ${packetId}|${debug.layoutId}|${questionNum}`)
    const truthText = label.truthState === 'value' ? digits(label.handwrittenTruth) : null
    const readText = digits(group.answerText)
    const automatic = group.reviewNeeded !== true && readText != null
    rows.push({
      packetId,
      pageId: path.basename(path.dirname(file)),
      layoutId: debug.layoutId,
      layoutFamily: family(debug.layoutId),
      questionNum,
      truthState: label.truthState,
      truthText,
      scorable: truthText != null,
      readText,
      automatic,
      correct: automatic && truthText != null ? readText === truthText : null,
      promoted: promoted.has(questionNum),
      promotion: promoted.get(questionNum) || null,
      decision: (debug.v3Shadow?.consensusPromotionDecisions || []).find((item) => Number(item.questionNum) === questionNum) || null,
      debugFile: path.relative(ROOT, file),
    })
  }
}

const overall = summarize(rows)
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  status: 'experimental browser integration replay; production unchanged',
  answerKeyUsedForRecognition: false,
  answerKeyUsedAsHandwritingTruth: false,
  truthUsedOnlyForScoringAfterDecisions: true,
  run: path.relative(ROOT, run),
  pagesExpected: 40,
  pagesCompleted: pages.size,
  pageFailures: failures,
  overall,
  byFamily: Object.fromEntries(['row', 'non-row'].map((item) => [item, summarize(rows.filter((row) => row.layoutFamily === item))])),
  byPacket: Object.fromEntries(PACKETS.map((item) => [item, summarize(rows.filter((row) => row.packetId === item))])),
  byLayout: Object.fromEntries(EXPECTED_LAYOUTS.map((item) => [item, summarize(rows.filter((row) => row.layoutId === item))])),
  gates: {
    allPagesCompleted: pages.size === 40 && failures.length === 0,
    allAnswerGroupsPresent: rows.length === 280,
    allScorableTruthJoined: overall.scorableAnswers === 275,
    zeroObservedAutomaticErrors: overall.automaticWrong === 0,
  },
  rows: rows.sort((a, b) => `${a.packetId}|${a.layoutId}|${a.questionNum}`.localeCompare(`${b.packetId}|${b.layoutId}|${b.questionNum}`)),
}

fs.writeFileSync(path.resolve(ROOT, options.out), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({ out: options.out, overall, byFamily: report.byFamily, byPacket: report.byPacket, gates: report.gates }, null, 2))
if (!Object.values(report.gates).every(Boolean)) process.exitCode = 2
