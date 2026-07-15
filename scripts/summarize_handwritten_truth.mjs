#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_LABELS = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labels.json'
const DEFAULT_OVERRIDES = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/manual-truth-overrides.json'
const DEFAULT_OUT = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'

function parseArgs(argv) {
  const opts = {
    labels: DEFAULT_LABELS,
    overrides: DEFAULT_OVERRIDES,
    out: DEFAULT_OUT
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--labels') opts.labels = argv[++i]
    else if (arg === '--overrides') opts.overrides = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function normalize(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

function emptyStats() {
  return {
    total: 0,
    correct: 0,
    wrong: 0
  }
}

function addCorrect(stats, correct) {
  stats.total += 1
  if (correct) stats.correct += 1
  else stats.wrong += 1
}

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function byLayoutSummary(entries) {
  const byLayout = new Map()
  for (const entry of entries) {
    const layout = entry.layoutId || 'unknown'
    if (!byLayout.has(layout)) byLayout.set(layout, { total: 0, auto: 0, autoCorrect: 0, yellow: 0, yellowLeaningCorrect: 0 })
    const row = byLayout.get(layout)
    row.total += 1
    const appMatchesTruth = normalize(entry.appPrediction) === normalize(entry.truth)
    if (entry.review) {
      row.yellow += 1
      if (appMatchesTruth) row.yellowLeaningCorrect += 1
    } else {
      row.auto += 1
      if (appMatchesTruth) row.autoCorrect += 1
    }
  }
  return Object.fromEntries([...byLayout.entries()].sort((a, b) => a[0].localeCompare(b[0])))
}

function csvCell(value) {
  const text = String(value ?? '')
  if (!/[",\n]/.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

function buildPageRollups(entries) {
  const pages = new Map()
  for (const entry of entries) {
    const key = entry.captureId || `page-${entry.pageIndex}`
    if (!pages.has(key)) {
      pages.set(key, {
        captureId: entry.captureId,
        pageIndex: entry.pageIndex,
        layoutId: entry.layoutId,
        debugPath: entry.debugPath,
        replayPath: entry.replayPath,
        total: 0,
        auto: 0,
        autoCorrect: 0,
        autoWrong: 0,
        yellow: 0,
        yellowLeaningCorrect: 0,
        studentMathCorrect: 0,
        studentMathWrong: 0,
        answers: []
      })
    }
    const page = pages.get(key)
    const appMatchesTruth = normalize(entry.appPrediction) === normalize(entry.truth)
    const truthMatchesExpected = normalize(entry.truth) === normalize(entry.expected)
    page.total += 1
    if (entry.review) {
      page.yellow += 1
      if (appMatchesTruth) page.yellowLeaningCorrect += 1
    } else {
      page.auto += 1
      if (appMatchesTruth) page.autoCorrect += 1
      else page.autoWrong += 1
    }
    if (truthMatchesExpected) page.studentMathCorrect += 1
    else page.studentMathWrong += 1
    page.answers.push({
      uid: entry.uid,
      questionLabel: entry.questionLabel,
      questionNum: entry.questionNum,
      problem: entry.problem,
      expected: entry.expected,
      appPrediction: entry.appPrediction,
      review: Boolean(entry.review),
      truth: entry.truth,
      truthStatus: entry.truthStatus,
      appMatchesTruth,
      truthMatchesExpected,
      cropPath: entry.cropPath
    })
  }

  return [...pages.values()]
    .sort((a, b) => a.pageIndex - b.pageIndex || String(a.captureId).localeCompare(String(b.captureId)))
    .map((page) => ({
      ...page,
      autoAccuracyPct: pct(page.autoCorrect, page.auto),
      yellowLeaningMatchesTruthPct: pct(page.yellowLeaningCorrect, page.yellow),
      studentMathCorrectPct: pct(page.studentMathCorrect, page.total),
      answers: page.answers.sort((a, b) => a.questionNum - b.questionNum)
    }))
}

function pageRollupsToCsv(pageRollups) {
  const rows = [
    [
      'pageIndex',
      'captureId',
      'layoutId',
      'total',
      'auto',
      'autoCorrect',
      'autoWrong',
      'yellow',
      'yellowLeaningCorrect',
      'studentMathCorrect',
      'studentMathWrong',
      'truthByQuestion',
      'appByQuestion',
      'reviewQuestions',
      'autoWrongQuestions',
      'debugPath'
    ]
  ]
  for (const page of pageRollups) {
    const truthByQuestion = page.answers.map((a) => `${a.questionLabel}:${a.truth}`).join(' ')
    const appByQuestion = page.answers.map((a) => `${a.questionLabel}:${a.appPrediction}`).join(' ')
    const reviewQuestions = page.answers.filter((a) => a.review).map((a) => a.questionLabel).join(' ')
    const autoWrongQuestions = page.answers
      .filter((a) => !a.review && !a.appMatchesTruth)
      .map((a) => `${a.questionLabel}:${a.appPrediction}->${a.truth}`)
      .join(' ')
    rows.push([
      page.pageIndex + 1,
      page.captureId,
      page.layoutId,
      page.total,
      page.auto,
      page.autoCorrect,
      page.autoWrong,
      page.yellow,
      page.yellowLeaningCorrect,
      page.studentMathCorrect,
      page.studentMathWrong,
      truthByQuestion,
      appByQuestion,
      reviewQuestions,
      autoWrongQuestions,
      page.debugPath
    ])
  }
  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const labels = await readJson(opts.labels)
  const overridesRaw = await readJson(opts.overrides)
  const overrides = overridesRaw.overrides || overridesRaw
  const manualStatuses = new Set(['manual', 'blank', 'unclear'])

  const entries = labels.entries.map((entry) => {
    const rawOverride = overrides[entry.uid]
    if (rawOverride == null) return entry
    const override = typeof rawOverride === 'object'
      ? rawOverride
      : { truth: rawOverride, status: rawOverride === '' ? 'blank' : 'manual' }
    return {
      ...entry,
      truth: Object.hasOwn(override, 'truth') ? override.truth : entry.truth,
      truthStatus: override.status || 'manual',
      truthNote: override.note || undefined
    }
  })

  const missing = entries.filter((entry) => entry.truthStatus === 'needs-label')
  const known = entries.filter((entry) => entry.truthStatus === 'seeded-auto-correct' || manualStatuses.has(entry.truthStatus))
  const scored = known.filter((entry) => entry.truthStatus !== 'unclear')

  const auto = emptyStats()
  const yellow = emptyStats()
  const math = emptyStats()
  let yellowLeaningWouldMatchTruth = 0
  let yellowTotal = 0
  const pageRollups = buildPageRollups(scored)
  const parsedOut = path.parse(opts.out)
  const pageRollupJson = path.join(parsedOut.dir, `${parsedOut.name}-pages.json`)
  const pageRollupCsv = path.join(parsedOut.dir, `${parsedOut.name}-pages.csv`)

  for (const entry of scored) {
    const truth = normalize(entry.truth)
    const app = normalize(entry.appPrediction)
    const expected = normalize(entry.expected)
    const appMatchesTruth = app === truth
    if (entry.review) {
      addCorrect(yellow, appMatchesTruth)
      yellowTotal += 1
      if (appMatchesTruth) yellowLeaningWouldMatchTruth += 1
    } else {
      addCorrect(auto, appMatchesTruth)
    }
    addCorrect(math, truth === expected)
  }

  const summary = {
    labels: opts.labels,
    overrides: opts.overrides,
    out: opts.out,
    totalEntries: entries.length,
    seeded: entries.filter((entry) => entry.truthStatus === 'seeded-auto-correct').length,
    manual: entries.filter((entry) => entry.truthStatus === 'manual').length,
    blank: entries.filter((entry) => entry.truthStatus === 'blank').length,
    unclear: entries.filter((entry) => entry.truthStatus === 'unclear').length,
    missing: missing.length,
    scored: scored.length,
    auto: {
      ...auto,
      accuracyPct: pct(auto.correct, auto.total)
    },
    yellow: {
      ...yellow,
      leaningMatchesTruthPct: pct(yellowLeaningWouldMatchTruth, yellowTotal)
    },
    overallAppRead: {
      correct: auto.correct + yellow.correct,
      total: auto.total + yellow.total,
      accuracyPct: pct(auto.correct + yellow.correct, auto.total + yellow.total)
    },
    studentMath: {
      ...math,
      correctPct: pct(math.correct, math.total)
    },
    byLayout: byLayoutSummary(scored),
    pageRollupJson,
    pageRollupCsv,
    missingUids: missing.map((entry) => entry.uid)
  }

  await fs.writeFile(opts.out, JSON.stringify({ ...labels, entries, summary }, null, 2))
  await fs.writeFile(pageRollupJson, JSON.stringify({ generatedAt: new Date().toISOString(), pages: pageRollups }, null, 2))
  await fs.writeFile(pageRollupCsv, pageRollupsToCsv(pageRollups))
  console.log(JSON.stringify(summary, null, 2))
}

await main()
