#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const DEFAULT_REPLAY = 'private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser'
const DEFAULT_OUT = 'private-evidence/reports/nonrow-variant-lanes-20260708/summary.json'

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    rows: DEFAULT_ROWS,
    replays: [DEFAULT_REPLAY],
    out: DEFAULT_OUT
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--rows') opts.rows = argv[++i]
    else if (arg === '--replay') {
      if (opts.replays.length === 1 && opts.replays[0] === DEFAULT_REPLAY) opts.replays = []
      opts.replays.push(argv[++i])
    }
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

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function normalize(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

function normalizeDigit(value) {
  if (value === null || value === undefined || value === '' || value === '_') return null
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 && number <= 9 ? number : undefined
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function questionKey(captureId, label) {
  return `${String(captureId ?? '').trim()}::${String(label ?? '').trim()}`
}

function slotKey(captureId, label, digitIndex) {
  return `${questionKey(captureId, label)}::${Number(digitIndex)}`
}

function captureIdFromReplay(result, file) {
  return result?.file || path.basename(file, '-replay-result.json')
}

function predictionDetailsForGroup(result, group) {
  const questionNum = Number(group?.label)
  return (result.predictionDetails || [])
    .filter((detail) => Number(detail.questionNum) === questionNum)
    .sort((a, b) => Number(a.digitIndex || 0) - Number(b.digitIndex || 0))
}

function inc(map, key, n = 1) {
  map.set(key, (map.get(key) || 0) + n)
}

function emptyScore() {
  return {
    eligible: 0,
    selected: 0,
    correct: 0,
    wrong: 0,
    rescued: 0,
    harmed: 0,
    neutralCorrect: 0
  }
}

function finalizeScore(score) {
  return {
    ...score,
    precisionPct: pct(score.correct, score.selected),
    selectPct: pct(score.selected, score.eligible)
  }
}

function topEntries(map, limit = 20) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

function addCandidate(candidates, candidate) {
  const digit = normalizeDigit(candidate.digit)
  if (digit === null || digit === undefined) return
  const confidence = Math.max(0, Math.min(1, Number(candidate.confidence) || 0))
  const topGap = Math.max(0, Math.min(1, Number(candidate.topGap) || 0))
  candidates.push({
    ...candidate,
    digit,
    confidence,
    topGap,
    score: confidence + topGap * 0.35
  })
}

function candidatesForDetail(detail) {
  const candidates = []
  for (const [rank, item] of (detail.topK || detail.baseTopK || []).entries()) {
    addCandidate(candidates, {
      sourceType: 'model-topk',
      sourceName: `rank-${rank + 1}`,
      digit: item?.digit,
      confidence: item?.confidence,
      topGap: rank === 0 ? detail.topGap : 0,
      rank: rank + 1
    })
  }
  for (const variant of detail.preprocessVariants || []) {
    addCandidate(candidates, {
      sourceType: 'variant-top1',
      sourceName: variant?.name || 'unnamed',
      digit: variant?.digit,
      confidence: variant?.confidence,
      topGap: variant?.topGap,
      rank: 1
    })
    for (const [rank, item] of (variant?.topK || []).entries()) {
      addCandidate(candidates, {
        sourceType: 'variant-topk',
        sourceName: variant?.name || 'unnamed',
        digit: item?.digit,
        confidence: item?.confidence,
        topGap: rank === 0 ? variant?.topGap : 0,
        rank: rank + 1
      })
    }
  }
  const current = normalizeDigit(detail.blank || detail.empty ? null : detail.digit)
  return candidates
    .filter((candidate) => candidate.digit !== current)
    .sort((a, b) => b.score - a.score || b.confidence - a.confidence)
}

function matchesRule(item, candidate, rule) {
  if (item.family !== 'non-row') return false
  if (item.truthBlank) return false
  if (rule.layoutId !== '*' && item.layoutId !== rule.layoutId) return false
  if (rule.slotName !== '*' && item.slotName !== rule.slotName) return false
  if (rule.from !== '*' && String(item.currentDigit) !== String(rule.from)) return false
  if (rule.to !== '*' && String(candidate.digit) !== String(rule.to)) return false
  if (rule.sourceType !== '*' && candidate.sourceType !== rule.sourceType) return false
  if (rule.sourceName !== '*' && candidate.sourceName !== rule.sourceName) return false
  if (candidate.confidence < rule.minConfidence) return false
  if (candidate.topGap < rule.minTopGap) return false
  if (candidate.rank > rule.maxRank) return false
  return true
}

function scoreRule(items, rule, split) {
  const score = emptyScore()
  const examples = { correct: [], wrong: [] }
  for (const item of items) {
    if (split && item.split !== split) continue
    if (item.family !== 'non-row' || item.truthBlank) continue
    score.eligible += 1
    const candidate = item.candidates.find((entry) => matchesRule(item, entry, rule))
    if (!candidate) continue
    score.selected += 1
    const ok = candidate.digit === item.truthDigit
    const currentOk = item.currentDigit === item.truthDigit
    if (ok) {
      score.correct += 1
      if (!currentOk) score.rescued += 1
      else score.neutralCorrect += 1
      if (examples.correct.length < 8) examples.correct.push({ ...summarizeItem(item), candidate })
    } else {
      score.wrong += 1
      if (currentOk) score.harmed += 1
      if (examples.wrong.length < 8) examples.wrong.push({ ...summarizeItem(item), candidate })
    }
  }
  return { ...finalizeScore(score), examples }
}

function summarizeItem(item) {
  return {
    captureId: item.captureId,
    layoutId: item.layoutId,
    questionLabel: item.questionLabel,
    slotName: item.slotName,
    digitIndex: item.digitIndex,
    split: item.split,
    truthDigit: item.truthDigit,
    currentDigit: item.currentDigit,
    groupPredicted: item.groupPredicted,
    groupReview: item.groupReview,
    cropPath: item.cropPath
  }
}

function makeRules(items) {
  const values = {
    layoutId: new Set(['*']),
    slotName: new Set(['*']),
    from: new Set(['*']),
    to: new Set(['*']),
    sourceType: new Set(['*']),
    sourceName: new Set(['*'])
  }
  for (const item of items) {
    if (item.family !== 'non-row' || item.truthBlank) continue
    values.layoutId.add(item.layoutId)
    values.slotName.add(item.slotName || '*')
    values.from.add(String(item.currentDigit))
    for (const candidate of item.candidates.slice(0, 8)) {
      values.to.add(String(candidate.digit))
      values.sourceType.add(candidate.sourceType)
      values.sourceName.add(candidate.sourceName)
    }
  }

  const rules = []
  const minConfidences = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25]
  const minTopGaps = [0.45, 0.3, 0.15, 0]
  const maxRanks = [1, 2, 3]

  // Start broad, then add one or two interpretable constraints. This keeps the
  // search explainable enough for a future production gate review.
  const constraintSets = [
    {},
    { sourceType: true },
    { sourceName: true },
    { slotName: true },
    { from: true, to: true },
    { slotName: true, from: true, to: true },
    { layoutId: true, sourceType: true },
    { layoutId: true, slotName: true },
    { layoutId: true, from: true, to: true },
    { sourceName: true, from: true, to: true }
  ]

  for (const constraints of constraintSets) {
    const layoutIds = constraints.layoutId ? [...values.layoutId].filter((x) => x !== '*') : ['*']
    const slotNames = constraints.slotName ? [...values.slotName].filter((x) => x !== '*') : ['*']
    const froms = constraints.from ? [...values.from].filter((x) => x !== '*') : ['*']
    const tos = constraints.to ? [...values.to].filter((x) => x !== '*') : ['*']
    const sourceTypes = constraints.sourceType ? [...values.sourceType].filter((x) => x !== '*') : ['*']
    const sourceNames = constraints.sourceName ? [...values.sourceName].filter((x) => x !== '*') : ['*']
    for (const layoutId of layoutIds) {
      for (const slotName of slotNames) {
        for (const from of froms) {
          for (const to of tos) {
            for (const sourceType of sourceTypes) {
              for (const sourceName of sourceNames) {
                for (const minConfidence of minConfidences) {
                  for (const minTopGap of minTopGaps) {
                    for (const maxRank of maxRanks) {
                      rules.push({ layoutId, slotName, from, to, sourceType, sourceName, minConfidence, minTopGap, maxRank })
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  return rules
}

function ruleKey(rule) {
  return [
    `layout=${rule.layoutId}`,
    `slot=${rule.slotName}`,
    `from=${rule.from}`,
    `to=${rule.to}`,
    `sourceType=${rule.sourceType}`,
    `source=${rule.sourceName}`,
    `conf>=${rule.minConfidence}`,
    `gap>=${rule.minTopGap}`,
    `rank<=${rule.maxRank}`
  ].join(' ')
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const [truthJson, rowsJson] = await Promise.all([readJson(opts.truth), readJson(opts.rows)])
  const truthEntries = (truthJson.entries || []).filter((entry) =>
    entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label'
  )
  const truthByQuestion = new Map(truthEntries.map((entry) => [
    questionKey(entry.captureId, entry.questionLabel),
    entry
  ]))
  const rows = Array.isArray(rowsJson) ? rowsJson : rowsJson.rows || []
  const rowsBySlot = new Map(rows.map((row) => [
    slotKey(row.captureId, row.questionLabel, row.digitIndex),
    row
  ]))
  const files = (await Promise.all(opts.replays.map(collectReplayFiles))).flat().sort()
  const items = []
  const missingRows = []

  for (const file of files.sort()) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    for (const group of result.groups || []) {
      const truthEntry = truthByQuestion.get(questionKey(captureId, group.label))
      if (!truthEntry) continue
      const details = predictionDetailsForGroup(result, group)
      for (const detail of details) {
        const row = rowsBySlot.get(slotKey(captureId, group.label, detail.digitIndex))
        if (!row) {
          if (missingRows.length < 20) missingRows.push({ captureId, label: group.label, digitIndex: detail.digitIndex })
          continue
        }
        const currentDigit = normalizeDigit(detail.blank || detail.empty ? null : detail.digit)
        items.push({
          captureId,
          layoutId: truthEntry.layoutId || row.layoutId,
          family: layoutFamily(truthEntry.layoutId || row.layoutId),
          questionLabel: truthEntry.questionLabel,
          digitIndex: Number(detail.digitIndex || 0),
          slotName: row.slotName || `slot-${detail.digitIndex}`,
          split: row.split || 'unknown',
          truthDigit: normalizeDigit(row.truthDigit),
          truthBlank: Boolean(row.truthBlank),
          currentDigit,
          groupPredicted: normalize(group.predicted),
          groupReview: Boolean(group.review),
          cropPath: row.cropPath || truthEntry.cropPath,
          candidates: candidatesForDetail(detail)
        })
      }
    }
  }

  const nonRowFilled = items.filter((item) => item.family === 'non-row' && !item.truthBlank)
  const slotSummary = {
    total: nonRowFilled.length,
    currentCorrect: nonRowFilled.filter((item) => item.currentDigit === item.truthDigit).length,
    currentWrong: nonRowFilled.filter((item) => item.currentDigit !== item.truthDigit).length,
    wrongWithAnyCandidateCorrect: nonRowFilled.filter((item) =>
      item.currentDigit !== item.truthDigit && item.candidates.some((candidate) => candidate.digit === item.truthDigit)
    ).length
  }
  slotSummary.currentAccuracyPct = pct(slotSummary.currentCorrect, slotSummary.total)
  slotSummary.variantOpportunityPct = pct(slotSummary.wrongWithAnyCandidateCorrect, slotSummary.currentWrong)

  const byLayout = new Map()
  const bySlotName = new Map()
  const confusion = new Map()
  const sourceOpportunity = new Map()
  for (const item of nonRowFilled) {
    const currentOk = item.currentDigit === item.truthDigit
    const anyCorrect = item.candidates.some((candidate) => candidate.digit === item.truthDigit)
    const amount = currentOk ? 0 : 1
    inc(byLayout, `${item.layoutId} wrong`, amount)
    if (!currentOk && anyCorrect) inc(byLayout, `${item.layoutId} opportunity`)
    inc(bySlotName, `${item.slotName} wrong`, amount)
    if (!currentOk && anyCorrect) inc(bySlotName, `${item.slotName} opportunity`)
    if (!currentOk) inc(confusion, `${item.currentDigit ?? 'blank'} -> ${item.truthDigit}`)
    for (const candidate of item.candidates) {
      if (!currentOk && candidate.digit === item.truthDigit) {
        inc(sourceOpportunity, `${candidate.sourceType}:${candidate.sourceName}`)
      }
    }
  }

  const rules = makeRules(items)
  const scoredRules = rules.map((rule) => ({
    key: ruleKey(rule),
    rule,
    calibration: scoreRule(items, rule, 'calibration'),
    validation: scoreRule(items, rule, 'validation'),
    holdout: scoreRule(items, rule, 'holdout')
  }))
  const zeroWrongCandidates = scoredRules
    .filter((row) =>
      row.calibration.selected > 0 &&
      row.calibration.wrong === 0 &&
      row.validation.wrong === 0 &&
      row.holdout.wrong === 0 &&
      row.validation.selected > 0 &&
      row.holdout.selected > 0
    )
    .sort((a, b) =>
      (b.calibration.rescued + b.validation.rescued + b.holdout.rescued) -
        (a.calibration.rescued + a.validation.rescued + a.holdout.rescued) ||
      b.validation.rescued - a.validation.rescued ||
      b.holdout.rescued - a.holdout.rescued ||
      a.key.localeCompare(b.key)
    )
    .slice(0, 40)

  const validationHoldoutSafe = scoredRules
    .filter((row) =>
      row.validation.selected > 0 &&
      row.holdout.selected > 0 &&
      row.validation.wrong === 0 &&
      row.holdout.wrong === 0
    )
    .sort((a, b) =>
      (b.validation.rescued + b.holdout.rescued) - (a.validation.rescued + a.holdout.rescued) ||
      b.validation.selected + b.holdout.selected - (a.validation.selected + a.holdout.selected) ||
      a.calibration.wrong - b.calibration.wrong
    )
    .slice(0, 40)

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    rows: opts.rows,
    replays: opts.replays,
    replayFileCount: files.length,
    itemCount: items.length,
    missingRows,
    slotSummary: {
      ...slotSummary,
      bySplit: Object.fromEntries(['calibration', 'validation', 'holdout'].map((split) => {
        const splitItems = nonRowFilled.filter((item) => item.split === split)
        const correct = splitItems.filter((item) => item.currentDigit === item.truthDigit).length
        const wrong = splitItems.length - correct
        const opportunity = splitItems.filter((item) =>
          item.currentDigit !== item.truthDigit && item.candidates.some((candidate) => candidate.digit === item.truthDigit)
        ).length
        return [split, {
          total: splitItems.length,
          currentCorrect: correct,
          currentWrong: wrong,
          wrongWithAnyCandidateCorrect: opportunity,
          currentAccuracyPct: pct(correct, splitItems.length),
          variantOpportunityPct: pct(opportunity, wrong)
        }]
      }))
    },
    byLayout: topEntries(byLayout, 30),
    bySlotName: topEntries(bySlotName, 20),
    confusion: topEntries(confusion, 30),
    sourceOpportunity: topEntries(sourceOpportunity, 30),
    zeroWrongCandidates,
    validationHoldoutSafe,
    allRuleCount: scoredRules.length
  }

  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({
    out: opts.out,
    replayFileCount: report.replayFileCount,
    itemCount: report.itemCount,
    slotSummary: report.slotSummary,
    topConfusions: report.confusion.slice(0, 15),
    topSources: report.sourceOpportunity.slice(0, 12),
    zeroWrongCandidateCount: zeroWrongCandidates.length,
    topZeroWrongCandidates: zeroWrongCandidates.slice(0, 5).map((row) => ({
      key: row.key,
      calibration: {
        selected: row.calibration.selected,
        correct: row.calibration.correct,
        wrong: row.calibration.wrong,
        rescued: row.calibration.rescued
      },
      validation: {
        selected: row.validation.selected,
        correct: row.validation.correct,
        wrong: row.validation.wrong,
        rescued: row.validation.rescued
      },
      holdout: {
        selected: row.holdout.selected,
        correct: row.holdout.correct,
        wrong: row.holdout.wrong,
        rescued: row.holdout.rescued
      }
    }))
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
