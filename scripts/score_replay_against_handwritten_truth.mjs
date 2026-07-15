#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    out: null,
    dirs: []
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else opts.dirs.push(arg)
  }
  if (!opts.dirs.length) {
    throw new Error('Usage: node scripts/score_replay_against_handwritten_truth.mjs [--truth file] [--out file] <replay-dir>...')
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function collectReplayFiles(entry) {
  const stat = await fs.stat(entry).catch(() => null)
  if (!stat) return []
  if (stat.isFile()) return entry.endsWith('-replay-result.json') ? [entry] : []
  if (!stat.isDirectory()) return []

  const out = []
  const names = await fs.readdir(entry, { withFileTypes: true })
  for (const name of names) {
    const child = path.join(entry, name.name)
    if (name.isDirectory()) out.push(...await collectReplayFiles(child))
    else if (name.isFile() && name.name.endsWith('-replay-result.json')) out.push(child)
  }
  return out
}

function normalize(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

function emptyBucket() {
  return {
    total: 0,
    auto: 0,
    autoCorrect: 0,
    autoWrong: 0,
    yellow: 0,
    yellowLeaningCorrect: 0,
    yellowLeaningWrong: 0,
    yellowSuggestionPresent: 0,
    yellowSuggestionCorrect: 0,
    yellowSuggestionWrong: 0,
    studentMathCorrect: 0,
    studentMathWrong: 0
  }
}

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function addPercentages(bucket) {
  return {
    ...bucket,
    autoCoveragePct: pct(bucket.auto, bucket.total),
    autoAccuracyPct: pct(bucket.autoCorrect, bucket.auto),
    yellowPct: pct(bucket.yellow, bucket.total),
    yellowLeaningMatchesTruthPct: pct(bucket.yellowLeaningCorrect, bucket.yellow),
    yellowSuggestionCoveragePct: pct(bucket.yellowSuggestionPresent, bucket.yellow),
    yellowSuggestionMatchesTruthPct: pct(bucket.yellowSuggestionCorrect, bucket.yellowSuggestionPresent),
    studentMathCorrectPct: pct(bucket.studentMathCorrect, bucket.total)
  }
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function captureIdFromReplay(result, file) {
  if (result?.file) return result.file
  return path.basename(file, '-replay-result.json')
}

function questionKey(captureId, label) {
  return `${captureId}::${String(label ?? '').trim()}`
}

function bump(bucket, entry, group) {
  const app = normalize(group?.predicted)
  const truth = normalize(entry.truth)
  const expected = normalize(entry.expected)
  const appMatchesTruth = app === truth
  const mathCorrect = truth === expected

  bucket.total += 1
  if (group?.review) {
    bucket.yellow += 1
    if (appMatchesTruth) bucket.yellowLeaningCorrect += 1
    else bucket.yellowLeaningWrong += 1
    const suggestion = normalize(group?.reviewSuggestion?.text)
    if (suggestion) {
      bucket.yellowSuggestionPresent += 1
      if (suggestion === truth) bucket.yellowSuggestionCorrect += 1
      else bucket.yellowSuggestionWrong += 1
    }
  } else {
    bucket.auto += 1
    if (appMatchesTruth) bucket.autoCorrect += 1
    else bucket.autoWrong += 1
  }
  if (mathCorrect) bucket.studentMathCorrect += 1
  else bucket.studentMathWrong += 1
}

function sortExamples(a, b) {
  return String(a.layoutId).localeCompare(String(b.layoutId)) ||
    String(a.captureId).localeCompare(String(b.captureId)) ||
    Number(a.questionLabel) - Number(b.questionLabel)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const truth = await readJson(opts.truth)
  const truthEntries = (truth.entries || []).filter((entry) => entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label')
  const truthByQuestion = new Map(truthEntries.map((entry) => [
    questionKey(entry.captureId, entry.questionLabel),
    entry
  ]))

  const replayFiles = (await Promise.all(opts.dirs.map(collectReplayFiles))).flat().sort()
  const buckets = {
    overall: emptyBucket(),
    row: emptyBucket(),
    'non-row': emptyBucket(),
    other: emptyBucket()
  }
  const byLayout = new Map()
  const examples = {
    autoWrong: [],
    yellowLeaningCorrect: [],
    yellowLeaningWrong: [],
    yellowSuggestionCorrect: [],
    yellowSuggestionWrong: []
  }
  const matchedKeys = new Set()
  const unmatchedReplayGroups = []

  for (const file of replayFiles) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    for (const group of result.groups || []) {
      const key = questionKey(captureId, group.label)
      const entry = truthByQuestion.get(key)
      if (!entry) {
        unmatchedReplayGroups.push({ captureId, label: group.label, replayFile: file })
        continue
      }
      matchedKeys.add(key)
      const family = layoutFamily(entry.layoutId)
      if (!byLayout.has(entry.layoutId)) byLayout.set(entry.layoutId, emptyBucket())
      for (const bucket of [buckets.overall, buckets[family], byLayout.get(entry.layoutId)]) {
        bump(bucket, entry, group)
      }

      const appMatchesTruth = normalize(group.predicted) === normalize(entry.truth)
      const example = {
        captureId,
        layoutId: entry.layoutId,
        questionLabel: entry.questionLabel,
        problem: entry.problem,
        expected: entry.expected,
        truth: entry.truth,
        appPrediction: group.predicted,
        review: Boolean(group.review),
        replayFile: file,
        cropPath: entry.cropPath
      }
      if (!group.review && !appMatchesTruth) examples.autoWrong.push(example)
      else if (group.review && appMatchesTruth) examples.yellowLeaningCorrect.push(example)
      else if (group.review && !appMatchesTruth) examples.yellowLeaningWrong.push(example)
      const suggestion = normalize(group?.reviewSuggestion?.text)
      if (group.review && suggestion) {
        const suggestionExample = {
          ...example,
          reviewSuggestion: group.reviewSuggestion
        }
        if (suggestion === normalize(entry.truth)) examples.yellowSuggestionCorrect.push(suggestionExample)
        else examples.yellowSuggestionWrong.push(suggestionExample)
      }
    }
  }

  const missingTruthEntries = truthEntries
    .filter((entry) => !matchedKeys.has(questionKey(entry.captureId, entry.questionLabel)))
    .map((entry) => ({
      captureId: entry.captureId,
      layoutId: entry.layoutId,
      questionLabel: entry.questionLabel,
      truth: entry.truth
    }))

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    replayDirs: opts.dirs,
    replayFileCount: replayFiles.length,
    matchedGroups: matchedKeys.size,
    truthEntryCount: truthEntries.length,
    unmatchedReplayGroups,
    missingTruthEntries,
    overall: addPercentages(buckets.overall),
    byFamily: {
      row: addPercentages(buckets.row),
      'non-row': addPercentages(buckets['non-row']),
      other: addPercentages(buckets.other)
    },
    byLayout: Object.fromEntries([...byLayout.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([layout, bucket]) => [layout, addPercentages(bucket)])),
    examples: {
      autoWrong: examples.autoWrong.sort(sortExamples),
      yellowLeaningCorrect: examples.yellowLeaningCorrect.sort(sortExamples),
      yellowLeaningWrongSample: examples.yellowLeaningWrong.sort(sortExamples).slice(0, 80),
      yellowSuggestionCorrect: examples.yellowSuggestionCorrect.sort(sortExamples),
      yellowSuggestionWrongSample: examples.yellowSuggestionWrong.sort(sortExamples).slice(0, 80)
    }
  }

  if (opts.out) {
    await fs.mkdir(path.dirname(opts.out), { recursive: true })
    await fs.writeFile(opts.out, JSON.stringify(report, null, 2))
  }

  console.log(JSON.stringify({
    replayFileCount: report.replayFileCount,
    matchedGroups: report.matchedGroups,
    overall: report.overall,
    byFamily: report.byFamily,
    byLayout: report.byLayout,
    autoWrongCount: report.examples.autoWrong.length,
    yellowLeaningCorrectCount: report.examples.yellowLeaningCorrect.length,
    yellowSuggestionCorrectCount: report.examples.yellowSuggestionCorrect.length,
    yellowSuggestionWrongSampleCount: report.examples.yellowSuggestionWrongSample.length,
    missingTruthEntries: report.missingTruthEntries.length,
    unmatchedReplayGroups: report.unmatchedReplayGroups.length,
    out: opts.out
  }, null, 2))
}

await main()
