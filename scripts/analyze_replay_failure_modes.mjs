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
    throw new Error('Usage: node scripts/analyze_replay_failure_modes.mjs [--truth file] [--out file] <replay-dir>...')
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

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function captureIdFromReplay(result, file) {
  return result?.file || path.basename(file, '-replay-result.json')
}

function questionKey(captureId, label) {
  return `${captureId}::${String(label ?? '').trim()}`
}

function inc(map, key, n = 1) {
  map.set(key, (map.get(key) || 0) + n)
}

function topEntries(map, limit = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

function confusionKey(predicted, truth) {
  return `${predicted || 'blank'} -> ${truth || 'blank'}`
}

function predictionDetailsForGroup(result, group) {
  const questionNum = Number(group?.label)
  return (result.predictionDetails || [])
    .filter((detail) => Number(detail.questionNum) === questionNum)
    .sort((a, b) => Number(a.digitIndex || 0) - Number(b.digitIndex || 0))
}

function summarizeDetail(detail) {
  return {
    slot: detail.digitIndex,
    digit: detail.digit,
    confidence: detail.confidence,
    topGap: detail.topGap,
    reviewNeeded: detail.reviewNeeded,
    reason: detail.preprocessReviewReason || null,
    robustOverride: detail.robustOverride || null,
    topK: (detail.topK || detail.baseTopK || []).slice(0, 4),
    variantTopK: (detail.preprocessVariants || []).slice(0, 4).map((variant) => ({
      name: variant.name,
      digit: variant.digit,
      confidence: variant.confidence,
      topGap: variant.topGap,
      topK: (variant.topK || []).slice(0, 4)
    }))
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const truth = await readJson(opts.truth)
  const truthEntries = (truth.entries || [])
    .filter((entry) => entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label')
  const truthByQuestion = new Map(truthEntries.map((entry) => [
    questionKey(entry.captureId, entry.questionLabel),
    entry
  ]))
  const replayFiles = (await Promise.all(opts.dirs.map(collectReplayFiles))).flat().sort()

  const byLayout = new Map()
  const byFamily = new Map()
  const confusion = new Map()
  const uncoveredConfusion = new Map()
  const coveredConfusion = new Map()
  const reviewReason = new Map()
  const examples = []

  let matched = 0
  let yellowWrong = 0
  let yellowWrongWithSuggestion = 0
  let yellowWrongWithoutSuggestion = 0
  let autoWrong = 0

  for (const file of replayFiles) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    for (const group of result.groups || []) {
      const entry = truthByQuestion.get(questionKey(captureId, group.label))
      if (!entry) continue
      matched += 1
      const predicted = normalize(group.predicted)
      const truthText = normalize(entry.truth)
      const family = layoutFamily(entry.layoutId)
      const suggestion = normalize(group?.reviewSuggestion?.text)
      const appMatchesTruth = predicted === truthText
      const suggestionMatchesTruth = suggestion && suggestion === truthText

      if (!group.review && !appMatchesTruth) {
        autoWrong += 1
        continue
      }
      if (!group.review || appMatchesTruth) continue

      yellowWrong += 1
      inc(byLayout, entry.layoutId)
      inc(byFamily, family)
      inc(confusion, confusionKey(predicted, truthText))
      if (suggestionMatchesTruth) {
        yellowWrongWithSuggestion += 1
        inc(coveredConfusion, confusionKey(predicted, truthText))
      } else {
        yellowWrongWithoutSuggestion += 1
        inc(uncoveredConfusion, confusionKey(predicted, truthText))
      }

      const details = predictionDetailsForGroup(result, group)
      for (const detail of details) {
        if (detail.reviewNeeded) inc(reviewReason, detail.preprocessReviewReason || 'review-needed')
      }
      if (examples.length < 80 && !suggestionMatchesTruth) {
        examples.push({
          captureId,
          layoutId: entry.layoutId,
          family,
          questionLabel: entry.questionLabel,
          expected: entry.expected,
          truth: entry.truth,
          predicted: group.predicted,
          problem: entry.problem,
          replayFile: file,
          cropPath: entry.cropPath,
          details: details.map(summarizeDetail)
        })
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    replayDirs: opts.dirs,
    replayFileCount: replayFiles.length,
    matched,
    autoWrong,
    yellowWrong,
    yellowWrongWithSuggestion,
    yellowWrongWithoutSuggestion,
    byFamily: topEntries(byFamily),
    byLayout: topEntries(byLayout, 30),
    confusion: topEntries(confusion, 30),
    uncoveredConfusion: topEntries(uncoveredConfusion, 30),
    coveredConfusion: topEntries(coveredConfusion, 30),
    reviewReason: topEntries(reviewReason, 30),
    examples
  }

  if (opts.out) {
    await fs.mkdir(path.dirname(opts.out), { recursive: true })
    await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  }
  console.log(JSON.stringify({
    out: opts.out,
    replayFileCount: report.replayFileCount,
    matched,
    autoWrong,
    yellowWrong,
    yellowWrongWithSuggestion,
    yellowWrongWithoutSuggestion,
    byFamily: report.byFamily,
    byLayout: report.byLayout.slice(0, 12),
    uncoveredConfusion: report.uncoveredConfusion.slice(0, 15),
    reviewReason: report.reviewReason.slice(0, 12)
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
