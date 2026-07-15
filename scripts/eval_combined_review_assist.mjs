#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const DEFAULT_REPLAY = 'private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser'
const DEFAULT_BLANK_SIM = 'private-evidence/reports/blank-artifact-classifier-20260708/visual-only-replay-sim.json'
const DEFAULT_SIX_FIVE = 'private-evidence/reports/nonrow-next-push-20260708/six-from-five-review-gates.json'
const DEFAULT_OUT = 'private-evidence/reports/combined-review-assist-20260708/summary.json'

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    rows: DEFAULT_ROWS,
    replay: DEFAULT_REPLAY,
    blankSim: DEFAULT_BLANK_SIM,
    sixFive: DEFAULT_SIX_FIVE,
    sixFiveThreshold: 0.25,
    out: DEFAULT_OUT
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--rows') opts.rows = argv[++i]
    else if (arg === '--replay') opts.replay = argv[++i]
    else if (arg === '--blank-sim') opts.blankSim = argv[++i]
    else if (arg === '--six-five') opts.sixFive = argv[++i]
    else if (arg === '--six-five-threshold') opts.sixFiveThreshold = Number(argv[++i])
    else if (arg === '--out') opts.out = argv[++i]
    else throw new Error(`Unknown argument: ${arg}`)
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

function questionKey(captureId, label) {
  return `${String(captureId ?? '').trim()}::${String(label ?? '').trim()}`
}

function captureIdFromReplay(result, file) {
  if (result?.file) return result.file
  return path.basename(file, '-replay-result.json')
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function emptyBucket() {
  return {
    reviewGroups: 0,
    suggested: 0,
    correct: 0,
    wrong: 0,
    rescued: 0,
    harmedCurrentCorrect: 0
  }
}

function finalizeBucket(bucket) {
  return {
    ...bucket,
    coveragePct: pct(bucket.suggested, bucket.reviewGroups),
    accuracyPct: pct(bucket.correct, bucket.suggested),
    rescuePct: pct(bucket.rescued, bucket.reviewGroups)
  }
}

function bumpBucket(bucket, item) {
  if (item.review) bucket.reviewGroups += 1
  if (!item.suggestionText) return
  bucket.suggested += 1
  if (item.correct) bucket.correct += 1
  else bucket.wrong += 1
  if (item.rescued) bucket.rescued += 1
  if (item.harmedCurrentCorrect) bucket.harmedCurrentCorrect += 1
}

function splitForQuestion(rowsByQuestion, captureId, label) {
  return rowsByQuestion.get(questionKey(captureId, label))?.split || 'unknown'
}

function suggestionFromBuiltIn(group) {
  const text = normalize(group?.reviewSuggestion?.text)
  if (!group?.review || !text) return null
  return {
    source: 'built-in-review-suggestion',
    text,
    raw: group.reviewSuggestion
  }
}

function loadBlankSuggestions(blankSim) {
  const out = new Map()
  const suggestion = blankSim?.replaySimulation?.suggestion || {}
  const examples = suggestion.examples || {}
  const items = Array.isArray(suggestion.items) && suggestion.items.length
    ? suggestion.items
    : [...(examples.correct || []), ...(examples.wrong || [])]
  for (const example of items) {
    const text = normalize(example.blankedPredicted)
    if (!text) continue
    out.set(questionKey(example.captureId, example.questionLabel), {
      source: 'blank-artifact-review-suggestion',
      text,
      raw: example
    })
  }
  return out
}

function loadSixFiveSuggestions(report, threshold) {
  const out = new Map()
  const run = (report?.runs || []).find((item) => Number(item.threshold) === Number(threshold))
  for (const example of run?.examples || []) {
    const text = normalize(example.suggestionText)
    if (!text) continue
    out.set(questionKey(example.captureId, example.questionLabel), {
      source: 'six-from-five-review-suggestion',
      text,
      raw: example
    })
  }
  return out
}

function summarizeItems(items) {
  const overall = emptyBucket()
  const byFamily = new Map()
  const bySplit = new Map()
  const bySource = new Map()

  for (const item of items) {
    for (const [map, key] of [
      [byFamily, item.family],
      [bySplit, item.split],
      [bySource, item.source || 'none']
    ]) {
      if (!map.has(key)) map.set(key, emptyBucket())
    }
    for (const bucket of [overall, byFamily.get(item.family), bySplit.get(item.split), bySource.get(item.source || 'none')]) {
      bumpBucket(bucket, item)
    }
  }

  const finalizeMap = (map) => Object.fromEntries(
    [...map.entries()]
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
      .map(([key, bucket]) => [key, finalizeBucket(bucket)])
  )
  return {
    overall: finalizeBucket(overall),
    byFamily: finalizeMap(byFamily),
    bySplit: finalizeMap(bySplit),
    bySource: finalizeMap(bySource)
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const [truthJson, rowsJson, blankSim, sixFiveReport] = await Promise.all([
    readJson(opts.truth),
    readJson(opts.rows),
    readJson(opts.blankSim),
    readJson(opts.sixFive).catch(() => ({ runs: [] }))
  ])
  const truthEntries = (truthJson.entries || []).filter((entry) =>
    entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label'
  )
  const truthByQuestion = new Map(truthEntries.map((entry) => [
    questionKey(entry.captureId, entry.questionLabel),
    entry
  ]))
  const rows = Array.isArray(rowsJson) ? rowsJson : rowsJson.rows || []
  const rowsByQuestion = new Map()
  for (const row of rows) {
    const key = questionKey(row.captureId, row.questionLabel)
    if (!rowsByQuestion.has(key)) rowsByQuestion.set(key, row)
  }
  const blankSuggestions = loadBlankSuggestions(blankSim)
  const sixFiveSuggestions = loadSixFiveSuggestions(sixFiveReport, opts.sixFiveThreshold)
  const replayFiles = await collectReplayFiles(opts.replay)

  const baseline = {
    matchedGroups: 0,
    auto: 0,
    autoCorrect: 0,
    autoWrong: 0,
    yellow: 0,
    yellowLeaningCorrect: 0,
    yellowLeaningWrong: 0
  }
  const builtInItems = []
  const blankItems = []
  const sixFiveItems = []
  const combinedItems = []
  const conflicts = []
  const matchedKeys = new Set()

  for (const file of replayFiles.sort()) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    for (const group of result.groups || []) {
      const key = questionKey(captureId, group.label)
      const truth = truthByQuestion.get(key)
      if (!truth) continue
      matchedKeys.add(key)

      const family = layoutFamily(truth.layoutId)
      const split = splitForQuestion(rowsByQuestion, captureId, group.label)
      const currentText = normalize(group.predicted)
      const truthText = normalize(truth.truth)
      const currentCorrect = currentText === truthText
      const review = Boolean(group.review)

      baseline.matchedGroups += 1
      if (review) {
        baseline.yellow += 1
        if (currentCorrect) baseline.yellowLeaningCorrect += 1
        else baseline.yellowLeaningWrong += 1
      } else {
        baseline.auto += 1
        if (currentCorrect) baseline.autoCorrect += 1
        else baseline.autoWrong += 1
      }

      const common = {
        captureId,
        layoutId: truth.layoutId,
        family,
        split,
        questionLabel: truth.questionLabel,
        expected: normalize(truth.expected),
        truth: truthText,
        currentText,
        currentCorrect,
        review,
        replayFile: file
      }

      const builtIn = suggestionFromBuiltIn(group)
      const blank = review ? blankSuggestions.get(key) : null
      const sixFive = review ? sixFiveSuggestions.get(key) : null
      const presentCandidates = [
        ['builtIn', builtIn],
        ['blank', blank],
        ['sixFive', sixFive]
      ].filter(([, candidate]) => candidate?.text)
      const candidateTexts = new Set(presentCandidates.map(([, candidate]) => candidate.text))
      if (candidateTexts.size > 1) {
        conflicts.push({
          ...common,
          ...Object.fromEntries(presentCandidates.map(([name, candidate]) => [name, candidate.text]))
        })
      }

      const scoreItem = (candidate) => ({
        ...common,
        source: candidate?.source || null,
        suggestionText: candidate?.text || null,
        suggestionRaw: candidate?.raw || null,
        correct: candidate ? candidate.text === truthText : false,
        rescued: Boolean(candidate && !currentCorrect && candidate.text === truthText),
        harmedCurrentCorrect: Boolean(candidate && currentCorrect && candidate.text !== truthText)
      })

      builtInItems.push(scoreItem(builtIn))
      blankItems.push(scoreItem(blank))
      sixFiveItems.push(scoreItem(sixFive))
      // Built-in suggestions are already stricter and broader; specialty sources fill only gaps.
      combinedItems.push(scoreItem(builtIn || blank || sixFive))
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    rows: opts.rows,
    replay: opts.replay,
    blankSim: opts.blankSim,
    sixFive: opts.sixFive,
    sixFiveThreshold: opts.sixFiveThreshold,
    replayFileCount: replayFiles.length,
    matchedGroups: matchedKeys.size,
    truthEntryCount: truthEntries.length,
    baseline: {
      ...baseline,
      autoCoveragePct: pct(baseline.auto, baseline.matchedGroups),
      autoAccuracyPct: pct(baseline.autoCorrect, baseline.auto),
      yellowPct: pct(baseline.yellow, baseline.matchedGroups),
      yellowLeaningCorrectPct: pct(baseline.yellowLeaningCorrect, baseline.yellow)
    },
    streams: {
      builtIn: summarizeItems(builtInItems),
      blankArtifact: summarizeItems(blankItems),
      sixFive: summarizeItems(sixFiveItems),
      combined: summarizeItems(combinedItems)
    },
    conflicts,
    examples: {
      combinedCorrect: combinedItems.filter((item) => item.suggestionText && item.correct).slice(0, 80),
      combinedWrong: combinedItems.filter((item) => item.suggestionText && !item.correct).slice(0, 80),
      combinedRescued: combinedItems.filter((item) => item.rescued).slice(0, 80),
      blankArtifactAdditional: combinedItems
        .filter((item) => item.source === 'blank-artifact-review-suggestion')
        .slice(0, 80),
      sixFiveAdditional: combinedItems
        .filter((item) => item.source === 'six-from-five-review-suggestion')
        .slice(0, 80)
    }
  }

  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, JSON.stringify(report, null, 2))

  console.log(JSON.stringify({
    out: opts.out,
    baseline: report.baseline,
    builtIn: report.streams.builtIn.overall,
    blankArtifact: report.streams.blankArtifact.overall,
    sixFive: report.streams.sixFive.overall,
    combined: report.streams.combined.overall,
    conflicts: report.conflicts.length
  }, null, 2))
}

await main()
