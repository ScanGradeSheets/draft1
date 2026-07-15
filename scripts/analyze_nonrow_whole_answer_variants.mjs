#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const DEFAULT_REPLAY = 'private-evidence/reports/nonrow-left-seven-one-stable-companion-20260708-full-browser'
const DEFAULT_OUT = 'private-evidence/reports/nonrow-whole-answer-variants-20260708/summary.json'

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    rows: DEFAULT_ROWS,
    replays: [DEFAULT_REPLAY],
    out: DEFAULT_OUT,
    candidatesOut: null
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
    else if (arg === '--candidates-out') opts.candidatesOut = argv[++i]
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

  const files = []
  const names = await fs.readdir(entry, { withFileTypes: true })
  for (const name of names) {
    const child = path.join(entry, name.name)
    if (name.isDirectory()) files.push(...await collectReplayFiles(child))
    else if (name.isFile() && name.name.endsWith('-replay-result.json')) files.push(child)
  }
  return files
}

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function normalizeAnswer(value) {
  return String(value ?? '').replace(/_/g, '').trim().replace(/^0+(?=\d)/, '')
}

function normalizeDigit(value) {
  if (value === null || value === undefined || value === '' || value === '_') return null
  const digit = Number(value)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined
}

function cellsToText(cells) {
  return normalizeAnswer(cells.map((cell) => (cell === null || cell === undefined ? '_' : String(cell))).join(''))
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

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function predictionDetailsForGroup(result, group) {
  const questionNum = Number(group?.label)
  return (result.predictionDetails || [])
    .filter((detail) => Number(detail.questionNum) === questionNum)
    .sort((a, b) => Number(a.digitIndex || 0) - Number(b.digitIndex || 0))
}

function isReviewGroup(group, details) {
  return Boolean(group?.review || details.some((detail) => detail.reviewNeeded))
}

function splitForQuestion(rowsByQuestion, captureId, label) {
  return rowsByQuestion.get(questionKey(captureId, label))?.split || 'unknown'
}

function scoreCandidateEvidence(candidate) {
  return (
    candidate.maxConfidence +
    candidate.maxTopGap * 0.35 +
    candidate.variantTop1Count * 0.08 +
    candidate.topKCount * 0.025
  )
}

function addSlotEvidence(map, digit, evidence) {
  const normalized = normalizeDigit(digit)
  if (normalized === null || normalized === undefined) return
  const confidence = Math.max(0, Math.min(1, Number(evidence.confidence) || 0))
  const topGap = Math.max(0, Math.min(1, Number(evidence.topGap) || 0))
  if (!map.has(normalized)) {
    map.set(normalized, {
      digit: normalized,
      maxConfidence: 0,
      maxTopGap: 0,
      variantTop1Count: 0,
      topKCount: 0,
      top1Count: 0,
      rankOneCount: 0,
      sourceTypes: new Set(),
      sourceNames: new Set(),
      reasons: new Set()
    })
  }
  const item = map.get(normalized)
  item.maxConfidence = Math.max(item.maxConfidence, confidence)
  item.maxTopGap = Math.max(item.maxTopGap, topGap)
  item.sourceTypes.add(evidence.sourceType)
  item.sourceNames.add(evidence.sourceName)
  item.reasons.add(`${evidence.sourceType}:${evidence.sourceName}:r${evidence.rank || 1}`)
  if (evidence.sourceType === 'variant-top1') item.variantTop1Count += 1
  if (evidence.sourceType.includes('topk') || evidence.sourceType === 'model-topk') item.topKCount += 1
  if ((evidence.rank || 1) === 1) item.rankOneCount += 1
  if (evidence.sourceType === 'variant-top1' || evidence.sourceType === 'model-top1') item.top1Count += 1
}

function slotAlternatives(detail) {
  const current = normalizeDigit(detail?.blank || detail?.empty ? null : detail?.digit)
  const byDigit = new Map()
  for (const [rank, item] of (detail?.topK || detail?.baseTopK || []).entries()) {
    addSlotEvidence(byDigit, item?.digit, {
      sourceType: rank === 0 ? 'model-top1' : 'model-topk',
      sourceName: `rank-${rank + 1}`,
      confidence: item?.confidence,
      topGap: rank === 0 ? detail?.topGap : 0,
      rank: rank + 1
    })
  }
  for (const variant of detail?.preprocessVariants || []) {
    addSlotEvidence(byDigit, variant?.digit, {
      sourceType: 'variant-top1',
      sourceName: variant?.name || 'unnamed',
      confidence: variant?.confidence,
      topGap: variant?.topGap,
      rank: 1
    })
    for (const [rank, item] of (variant?.topK || []).entries()) {
      addSlotEvidence(byDigit, item?.digit, {
        sourceType: rank === 0 ? 'variant-top1-topk' : 'variant-topk',
        sourceName: variant?.name || 'unnamed',
        confidence: item?.confidence,
        topGap: rank === 0 ? variant?.topGap : 0,
        rank: rank + 1
      })
    }
  }
  return [...byDigit.values()]
    .filter((candidate) => candidate.digit !== current)
    .map((candidate) => ({
      ...candidate,
      sourceTypes: [...candidate.sourceTypes].sort(),
      sourceNames: [...candidate.sourceNames].sort(),
      reasons: [...candidate.reasons].sort(),
      score: scoreCandidateEvidence(candidate)
    }))
    .sort((a, b) =>
      b.score - a.score ||
      b.maxConfidence - a.maxConfidence ||
      b.variantTop1Count - a.variantTop1Count ||
      String(a.digit).localeCompare(String(b.digit))
    )
    .slice(0, 5)
}

function candidateAnswers(details, rowsBySlot, captureId, label) {
  const currentCells = details.map((detail) => normalizeDigit(detail.blank || detail.empty ? null : detail.digit))
  const currentText = cellsToText(currentCells)
  const perSlot = details.map((detail) => {
    const current = normalizeDigit(detail.blank || detail.empty ? null : detail.digit)
    const reviewNeeded = Boolean(detail.reviewNeeded)
    const alternatives = slotAlternatives(detail)
    if (reviewNeeded && current !== null && current !== undefined) {
      alternatives.push({
        digit: null,
        maxConfidence: Math.max(0, Math.min(1, 1 - (Number(detail.confidence) || 0))),
        maxTopGap: 0,
        variantTop1Count: 0,
        topKCount: 0,
        top1Count: 0,
        rankOneCount: 1,
        sourceTypes: ['blank-candidate'],
        sourceNames: ['review-slot-blank'],
        reasons: ['blank-candidate:review-slot-blank:r1'],
        score: Math.max(0, Math.min(1, 1 - (Number(detail.confidence) || 0)))
      })
    }
    return {
      digitIndex: Number(detail.digitIndex || 0),
      slotName: rowsBySlot.get(slotKey(captureId, label, detail.digitIndex))?.slotName || `slot-${detail.digitIndex}`,
      current,
      reviewNeeded,
      confidence: Number(detail.confidence) || 0,
      topGap: Number(detail.topGap) || 0,
      alternatives: alternatives.sort((a, b) =>
        b.score - a.score ||
        b.maxConfidence - a.maxConfidence ||
        b.variantTop1Count - a.variantTop1Count ||
        String(a.digit).localeCompare(String(b.digit))
      ).slice(0, 6)
    }
  })
  const out = []
  const visit = (index, cells, changes) => {
    if (index >= perSlot.length) {
      if (!changes.length) return
      const text = cellsToText(cells)
      if (!text || text === currentText) return
      const changedSlotNames = changes.map((change) => change.slotName)
      out.push({
        text,
        cells,
        currentText,
        changedSlots: changes.length,
        changedSlotNames,
        changedSlotKey: changedSlotNames.join('+'),
        changedReviewSlots: changes.filter((change) => change.reviewNeeded).length,
        unchangedReviewSlots: perSlot.filter((slot) =>
          slot.reviewNeeded && !changes.some((change) => change.digitIndex === slot.digitIndex)
        ).length,
        allCompanionSlotsStable: perSlot.every((slot) =>
          changes.some((change) => change.digitIndex === slot.digitIndex) || !slot.reviewNeeded
        ),
        minConfidence: Math.min(...changes.map((change) => change.maxConfidence)),
        maxConfidence: Math.max(...changes.map((change) => change.maxConfidence)),
        minTopGap: Math.min(...changes.map((change) => change.maxTopGap)),
        maxTopGap: Math.max(...changes.map((change) => change.maxTopGap)),
        minVariantTop1Count: Math.min(...changes.map((change) => change.variantTop1Count)),
        allChangedHaveVariantTop1: changes.every((change) => change.variantTop1Count > 0),
        allChangedHaveModelTopK: changes.every((change) => change.topKCount > 0),
        sourceTypeKey: [...new Set(changes.flatMap((change) => change.sourceTypes))].sort().join('+'),
        sourceNameKey: [...new Set(changes.flatMap((change) => change.sourceNames))].sort().join('+'),
        changePattern: changes.map((change) => `${change.slotName}:${change.from ?? 'blank'}>${change.to}`).join('|'),
        changes
      })
      return
    }
    const slot = perSlot[index]
    visit(index + 1, cells.concat([slot.current]), changes)
    for (const alternative of slot.alternatives) {
      visit(index + 1, cells.concat([alternative.digit]), changes.concat([{
        digitIndex: slot.digitIndex,
        slotName: slot.slotName,
        from: slot.current,
        to: alternative.digit,
        reviewNeeded: slot.reviewNeeded,
        ...alternative
      }]))
    }
  }
  visit(0, [], [])
  return out.sort((a, b) =>
    b.allCompanionSlotsStable - a.allCompanionSlotsStable ||
    b.changedReviewSlots - a.changedReviewSlots ||
    a.unchangedReviewSlots - b.unchangedReviewSlots ||
    b.minConfidence - a.minConfidence ||
    b.minTopGap - a.minTopGap ||
    a.changedSlots - b.changedSlots
  )
}

function emptyScore() {
  return {
    eligible: 0,
    selected: 0,
    correct: 0,
    wrong: 0,
    rescued: 0,
    harmedCurrentCorrect: 0,
    neutralCorrect: 0
  }
}

function finalizeScore(score) {
  return {
    ...score,
    coveragePct: pct(score.selected, score.eligible),
    accuracyPct: pct(score.correct, score.selected),
    rescuePct: pct(score.rescued, score.eligible)
  }
}

function summarizeCandidate(candidate) {
  return {
    text: candidate.text,
    currentText: candidate.currentText,
    changedSlots: candidate.changedSlots,
    changedSlotKey: candidate.changedSlotKey,
    changedReviewSlots: candidate.changedReviewSlots,
    unchangedReviewSlots: candidate.unchangedReviewSlots,
    allCompanionSlotsStable: candidate.allCompanionSlotsStable,
    minConfidence: Number(candidate.minConfidence.toFixed(4)),
    minTopGap: Number(candidate.minTopGap.toFixed(4)),
    minVariantTop1Count: candidate.minVariantTop1Count,
    sourceTypeKey: candidate.sourceTypeKey,
    sourceNameKey: candidate.sourceNameKey,
    changePattern: candidate.changePattern
  }
}

function summarizeItem(item, candidate) {
  return {
    captureId: item.captureId,
    layoutId: item.layoutId,
    split: item.split,
    questionLabel: item.questionLabel,
    truth: item.truth,
    current: item.current,
    currentCorrect: item.currentCorrect,
    review: item.review,
    expected: item.expected,
    cropPath: item.cropPath,
    candidate: summarizeCandidate(candidate)
  }
}

function applyRule(item, rule) {
  if (item.family !== 'non-row') return null
  if (rule.layoutId !== '*' && item.layoutId !== rule.layoutId) return null
  if (rule.changedSlotKey !== '*' && !item.candidates.some((candidate) => candidate.changedSlotKey === rule.changedSlotKey)) return null
  const candidates = item.candidates.filter((candidate) => {
    if (candidate.changedSlots > rule.maxChangedSlots) return false
    if (candidate.changedReviewSlots < rule.minChangedReviewSlots) return false
    if (candidate.unchangedReviewSlots > rule.maxUnchangedReviewSlots) return false
    if (rule.requireStableCompanions && !candidate.allCompanionSlotsStable) return false
    if (candidate.minConfidence < rule.minConfidence) return false
    if (candidate.minTopGap < rule.minTopGap) return false
    if (candidate.minVariantTop1Count < rule.minVariantTop1Count) return false
    if (rule.sourceTypeKey !== '*' && !candidate.sourceTypeKey.includes(rule.sourceTypeKey)) return false
    if (rule.sourceNameKey !== '*' && !candidate.sourceNameKey.includes(rule.sourceNameKey)) return false
    if (rule.changePattern !== '*' && candidate.changePattern !== rule.changePattern) return false
    if (rule.textLength !== '*' && String(candidate.text.length) !== String(rule.textLength)) return false
    return true
  })
  return candidates[0] || null
}

function scoreRule(items, rule, split = null, includeExamples = false) {
  const score = emptyScore()
  const examples = { correct: [], wrong: [] }
  for (const item of items) {
    if (split && item.split !== split) continue
    if (item.family !== 'non-row' || !item.review) continue
    score.eligible += 1
    const candidate = applyRule(item, rule)
    if (!candidate) continue
    score.selected += 1
    const ok = candidate.text === item.truth
    if (ok) {
      score.correct += 1
      if (!item.currentCorrect) score.rescued += 1
      else score.neutralCorrect += 1
      if (includeExamples && examples.correct.length < 10) examples.correct.push(summarizeItem(item, candidate))
    } else {
      score.wrong += 1
      if (item.currentCorrect) score.harmedCurrentCorrect += 1
      if (includeExamples && examples.wrong.length < 10) examples.wrong.push(summarizeItem(item, candidate))
    }
  }
  return { ...finalizeScore(score), examples }
}

function makeRules(items) {
  const layouts = new Set(['*'])
  const changedSlotKeys = new Set(['*'])
  const sourceTypeKeys = new Set(['*'])
  const sourceNameKeys = new Set(['*'])
  const changePatterns = new Set(['*'])
  const textLengths = new Set(['*'])

  const changePatternCounts = new Map()
  const sourceNameCounts = new Map()
  for (const item of items) {
    if (item.family !== 'non-row' || !item.review) continue
    layouts.add(item.layoutId)
    for (const candidate of item.candidates.slice(0, 16)) {
      changePatternCounts.set(candidate.changePattern, (changePatternCounts.get(candidate.changePattern) || 0) + 1)
      changedSlotKeys.add(candidate.changedSlotKey)
      for (const sourceType of candidate.sourceTypeKey.split('+').filter(Boolean)) sourceTypeKeys.add(sourceType)
      for (const sourceName of candidate.sourceNameKey.split('+').filter(Boolean)) {
        sourceNameCounts.set(sourceName, (sourceNameCounts.get(sourceName) || 0) + 1)
        sourceNameKeys.add(sourceName)
      }
      changePatterns.add(candidate.changePattern)
      textLengths.add(String(candidate.text.length))
    }
  }
  const commonSourceNames = new Set([...sourceNameCounts.entries()]
    .filter(([, count]) => count >= 8)
    .map(([name]) => name)
  )
  const commonChangePatterns = new Set([...changePatternCounts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([pattern]) => pattern)
  )

  const rules = []
  const minConfidences = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25]
  const minTopGaps = [0.5, 0.35, 0.2, 0.1, 0]
  const maxChangedSlots = [1, 2]
  const minChangedReviewSlots = [0, 1]
  const maxUnchangedReviewSlots = [0, 1, 2]
  const minVariantTop1Counts = [0, 1, 2]
  const stableCompanionOptions = [true, false]

  const constraintSets = [
    {},
    { layoutId: true },
    { changedSlotKey: true },
    { sourceTypeKey: true },
    { sourceNameKey: true },
    { changePattern: true },
    { textLength: true },
    { layoutId: true, changedSlotKey: true },
    { layoutId: true, sourceTypeKey: true },
    { layoutId: true, sourceNameKey: true },
    { changedSlotKey: true, sourceTypeKey: true },
    { changedSlotKey: true, sourceNameKey: true },
    { textLength: true, changedSlotKey: true }
  ]

  for (const constraints of constraintSets) {
    const layoutValues = constraints.layoutId ? [...layouts].filter((value) => value !== '*') : ['*']
    const changedSlotValues = constraints.changedSlotKey ? [...changedSlotKeys].filter((value) => value !== '*') : ['*']
    const sourceTypeValues = constraints.sourceTypeKey ? [...sourceTypeKeys].filter((value) => value !== '*') : ['*']
    const sourceNameValues = constraints.sourceNameKey
      ? [...sourceNameKeys].filter((value) => value !== '*' && commonSourceNames.has(value))
      : ['*']
    const changePatternValues = constraints.changePattern
      ? [...changePatterns].filter((value) => value !== '*' && commonChangePatterns.has(value))
      : ['*']
    const textLengthValues = constraints.textLength ? [...textLengths].filter((value) => value !== '*') : ['*']
    for (const layoutId of layoutValues) {
      for (const changedSlotKey of changedSlotValues) {
        for (const sourceTypeKey of sourceTypeValues) {
          for (const sourceNameKey of sourceNameValues) {
            for (const changePattern of changePatternValues) {
              for (const textLength of textLengthValues) {
                for (const maxChanged of maxChangedSlots) {
                  for (const minChangedReview of minChangedReviewSlots) {
                    for (const maxUnchangedReview of maxUnchangedReviewSlots) {
                      for (const minVariantTop1Count of minVariantTop1Counts) {
                        for (const requireStableCompanions of stableCompanionOptions) {
                          for (const minConfidence of minConfidences) {
                            for (const minTopGap of minTopGaps) {
                              rules.push({
                                layoutId,
                                changedSlotKey,
                                sourceTypeKey,
                                sourceNameKey,
                                changePattern,
                                textLength,
                                maxChangedSlots: maxChanged,
                                minChangedReviewSlots: minChangedReview,
                                maxUnchangedReviewSlots: maxUnchangedReview,
                                minVariantTop1Count,
                                requireStableCompanions,
                                minConfidence,
                                minTopGap
                              })
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
        }
      }
    }
  }
  return rules
}

function ruleKey(rule) {
  return [
    `layout=${rule.layoutId}`,
    `slot=${rule.changedSlotKey}`,
    `sourceType~=${rule.sourceTypeKey}`,
    `source~=${rule.sourceNameKey}`,
    `pattern=${rule.changePattern}`,
    `len=${rule.textLength}`,
    `changed<=${rule.maxChangedSlots}`,
    `changedReview>=${rule.minChangedReviewSlots}`,
    `unchangedReview<=${rule.maxUnchangedReviewSlots}`,
    `vtop>=${rule.minVariantTop1Count}`,
    `stable=${rule.requireStableCompanions}`,
    `conf>=${rule.minConfidence}`,
    `gap>=${rule.minTopGap}`
  ].join(' ')
}

function summarizeRules(scoredRules, predicate, limit = 30) {
  return scoredRules
    .filter(predicate)
    .sort((a, b) =>
      b.full.rescued - a.full.rescued ||
      b.holdout.rescued - a.holdout.rescued ||
      b.validation.rescued - a.validation.rescued ||
      b.full.selected - a.full.selected ||
      a.key.localeCompare(b.key)
    )
    .slice(0, limit)
}

function countBy(items, getKey) {
  const counts = new Map()
  for (const item of items) counts.set(getKey(item), (counts.get(getKey(item)) || 0) + 1)
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))))
}

function patternScores(items) {
  const scores = new Map()
  for (const item of items) {
    if (item.family !== 'non-row' || !item.review) continue
    const seen = new Set()
    for (const candidate of item.candidates) {
      const key = [
        candidate.changePattern,
        `layout=${item.layoutId}`,
        `slot=${candidate.changedSlotKey}`,
        `source=${candidate.sourceTypeKey}`
      ].join(' ')
      if (seen.has(key)) continue
      seen.add(key)
      if (!scores.has(key)) {
        scores.set(key, {
          key,
          pattern: candidate.changePattern,
          layoutId: item.layoutId,
          changedSlotKey: candidate.changedSlotKey,
          sourceTypeKey: candidate.sourceTypeKey,
          total: 0,
          correct: 0,
          wrong: 0,
          rescued: 0,
          harmedCurrentCorrect: 0,
          bySplit: {
            calibration: { total: 0, correct: 0, wrong: 0 },
            validation: { total: 0, correct: 0, wrong: 0 },
            holdout: { total: 0, correct: 0, wrong: 0 }
          },
          examples: { correct: [], wrong: [] }
        })
      }
      const score = scores.get(key)
      const ok = candidate.text === item.truth
      score.total += 1
      score.correct += ok ? 1 : 0
      score.wrong += ok ? 0 : 1
      if (ok && !item.currentCorrect) score.rescued += 1
      if (!ok && item.currentCorrect) score.harmedCurrentCorrect += 1
      if (score.bySplit[item.split]) {
        score.bySplit[item.split].total += 1
        score.bySplit[item.split].correct += ok ? 1 : 0
        score.bySplit[item.split].wrong += ok ? 0 : 1
      }
      if (ok && score.examples.correct.length < 4) score.examples.correct.push(summarizeItem(item, candidate))
      if (!ok && score.examples.wrong.length < 4) score.examples.wrong.push(summarizeItem(item, candidate))
    }
  }
  return [...scores.values()]
    .map((score) => ({
      ...score,
      accuracyPct: pct(score.correct, score.total),
      rescuePct: pct(score.rescued, score.total)
    }))
    .sort((a, b) =>
      b.correct - a.correct ||
      a.wrong - b.wrong ||
      b.rescued - a.rescued ||
      a.key.localeCompare(b.key)
    )
}

function candidateOracle(items) {
  const buckets = {
    reviewNonRow: 0,
    reviewNonRowCurrentCorrect: 0,
    reviewNonRowCurrentWrong: 0,
    anyCandidateCorrect: 0,
    wrongLeanAnyCandidateCorrect: 0,
    byLayout: {}
  }
  for (const item of items) {
    if (item.family !== 'non-row' || !item.review) continue
    buckets.reviewNonRow += 1
    if (item.currentCorrect) buckets.reviewNonRowCurrentCorrect += 1
    else buckets.reviewNonRowCurrentWrong += 1
    const anyCorrect = item.candidates.some((candidate) => candidate.text === item.truth)
    if (anyCorrect) buckets.anyCandidateCorrect += 1
    if (!item.currentCorrect && anyCorrect) buckets.wrongLeanAnyCandidateCorrect += 1
    if (!buckets.byLayout[item.layoutId]) {
      buckets.byLayout[item.layoutId] = {
        reviewNonRow: 0,
        currentCorrect: 0,
        currentWrong: 0,
        anyCandidateCorrect: 0,
        wrongLeanAnyCandidateCorrect: 0
      }
    }
    const layoutBucket = buckets.byLayout[item.layoutId]
    layoutBucket.reviewNonRow += 1
    if (item.currentCorrect) layoutBucket.currentCorrect += 1
    else layoutBucket.currentWrong += 1
    if (anyCorrect) layoutBucket.anyCandidateCorrect += 1
    if (!item.currentCorrect && anyCorrect) layoutBucket.wrongLeanAnyCandidateCorrect += 1
  }
  for (const bucket of [buckets, ...Object.values(buckets.byLayout)]) {
    bucket.currentCorrectPct = pct(bucket.reviewNonRowCurrentCorrect ?? bucket.currentCorrect, bucket.reviewNonRow)
    bucket.oracleCoveragePct = pct(bucket.anyCandidateCorrect, bucket.reviewNonRow)
    bucket.wrongLeanOraclePct = pct(bucket.wrongLeanAnyCandidateCorrect, bucket.reviewNonRowCurrentWrong ?? bucket.currentWrong)
  }
  return buckets
}

function candidateRows(items) {
  const rows = []
  for (const item of items) {
    if (item.family !== 'non-row' || !item.review) continue
    for (const [candidateIndex, candidate] of item.candidates.entries()) {
      rows.push({
        key: item.key,
        captureId: item.captureId,
        layoutId: item.layoutId,
        family: item.family,
        split: item.split,
        questionLabel: item.questionLabel,
        expected: item.expected,
        truth: item.truth,
        current: item.current,
        currentCorrect: item.currentCorrect,
        candidateIndex,
        candidateText: candidate.text,
        correct: candidate.text === item.truth,
        rescued: candidate.text === item.truth && !item.currentCorrect,
        harmedCurrentCorrect: candidate.text !== item.truth && item.currentCorrect,
        changedSlots: candidate.changedSlots,
        changedSlotKey: candidate.changedSlotKey,
        changedReviewSlots: candidate.changedReviewSlots,
        unchangedReviewSlots: candidate.unchangedReviewSlots,
        allCompanionSlotsStable: candidate.allCompanionSlotsStable,
        minConfidence: candidate.minConfidence,
        maxConfidence: candidate.maxConfidence,
        minTopGap: candidate.minTopGap,
        maxTopGap: candidate.maxTopGap,
        minVariantTop1Count: candidate.minVariantTop1Count,
        allChangedHaveVariantTop1: candidate.allChangedHaveVariantTop1,
        allChangedHaveModelTopK: candidate.allChangedHaveModelTopK,
        sourceTypeKey: candidate.sourceTypeKey,
        sourceNameKey: candidate.sourceNameKey,
        changePattern: candidate.changePattern,
        candidateLength: candidate.text.length,
        currentLength: item.current.length,
        cropPath: item.cropPath,
        replayFile: item.replayFile
      })
    }
  }
  return rows
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const [truthJson, rowsJson] = await Promise.all([readJson(opts.truth), readJson(opts.rows)])
  const rows = Array.isArray(rowsJson) ? rowsJson : rowsJson.rows || []
  const truthEntries = (truthJson.entries || []).filter((entry) =>
    entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label'
  )
  const truthByQuestion = new Map(truthEntries.map((entry) => [
    questionKey(entry.captureId, entry.questionLabel),
    entry
  ]))
  const rowsByQuestion = new Map()
  const rowsBySlot = new Map()
  for (const row of rows) {
    const qKey = questionKey(row.captureId, row.questionLabel)
    if (!rowsByQuestion.has(qKey)) rowsByQuestion.set(qKey, row)
    rowsBySlot.set(slotKey(row.captureId, row.questionLabel, row.digitIndex), row)
  }

  const replayFiles = (await Promise.all(opts.replays.map(collectReplayFiles))).flat().sort()
  const items = []
  const missingTruth = []
  for (const file of replayFiles) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    for (const group of result.groups || []) {
      const qKey = questionKey(captureId, group.label)
      const truthEntry = truthByQuestion.get(qKey)
      if (!truthEntry) {
        if (missingTruth.length < 20) missingTruth.push({ captureId, label: group.label, file })
        continue
      }
      const details = predictionDetailsForGroup(result, group)
      if (!details.length) continue
      const layoutId = truthEntry.layoutId || rowsByQuestion.get(qKey)?.layoutId
      const family = layoutFamily(layoutId)
      const current = normalizeAnswer(group.predicted)
      const truth = normalizeAnswer(truthEntry.truth)
      const candidates = candidateAnswers(details, rowsBySlot, captureId, group.label)
      items.push({
        key: qKey,
        captureId,
        layoutId,
        family,
        split: splitForQuestion(rowsByQuestion, captureId, group.label),
        questionLabel: truthEntry.questionLabel,
        expected: normalizeAnswer(group.expected || truthEntry.expected),
        truth,
        current,
        currentCorrect: current === truth,
        review: isReviewGroup(group, details),
        candidateCount: candidates.length,
        candidates: candidates.slice(0, 40),
        cropPath: truthEntry.cropPath,
        replayFile: file
      })
    }
  }

  const rules = makeRules(items)
  const scoredRules = rules.map((rule) => ({
    key: ruleKey(rule),
    rule,
    full: scoreRule(items, rule),
    calibration: scoreRule(items, rule, 'calibration'),
    validation: scoreRule(items, rule, 'validation'),
    holdout: scoreRule(items, rule, 'holdout')
  }))

  const fullZeroWrong = summarizeRules(scoredRules, (row) =>
    row.full.selected > 0 &&
    row.full.wrong === 0 &&
    row.calibration.selected > 0 &&
    row.validation.selected > 0 &&
    row.holdout.selected > 0
  )
  const validationHoldoutZeroWrong = summarizeRules(scoredRules, (row) =>
    row.validation.selected > 0 &&
    row.holdout.selected > 0 &&
    row.validation.wrong === 0 &&
    row.holdout.wrong === 0
  )
  const calibrationZeroWrong = summarizeRules(scoredRules, (row) =>
    row.calibration.selected > 0 &&
    row.calibration.wrong === 0
  )

  const nonRowReview = items.filter((item) => item.family === 'non-row' && item.review)
  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    rows: opts.rows,
    replays: opts.replays,
    replayFileCount: replayFiles.length,
    itemCount: items.length,
    missingTruth,
    splitCounts: countBy(items, (item) => item.split),
    reviewCounts: {
      totalReview: items.filter((item) => item.review).length,
      nonRowReview: nonRowReview.length,
      nonRowCurrentCorrect: nonRowReview.filter((item) => item.currentCorrect).length,
      nonRowCurrentWrong: nonRowReview.filter((item) => !item.currentCorrect).length
    },
    candidateOracle: candidateOracle(items),
    nonRowReviewByLayout: countBy(nonRowReview, (item) => item.layoutId),
    nonRowWrongCurrentByLayout: countBy(nonRowReview.filter((item) => !item.currentCorrect), (item) => item.layoutId),
    commonCorrectCandidatePatterns: countBy(
      nonRowReview.flatMap((item) => item.candidates
        .filter((candidate) => candidate.text === item.truth)
        .slice(0, 3)
        .map((candidate) => candidate.changePattern)
      ),
      (pattern) => pattern
    ),
    commonWrongTopCandidatePatterns: countBy(
      nonRowReview
        .map((item) => ({ item, candidate: item.candidates[0] }))
        .filter(({ candidate }) => Boolean(candidate))
        .filter(({ item, candidate }) => candidate.text !== item.truth)
        .map(({ candidate }) => candidate.changePattern),
      (pattern) => pattern
    ),
    topPatternScores: patternScores(items).slice(0, 80),
    zeroWrongPatternScores: patternScores(items)
      .filter((score) =>
        score.correct > 0 &&
        score.wrong === 0 &&
        score.bySplit.validation.total > 0 &&
        score.bySplit.holdout.total > 0
      )
      .slice(0, 80),
    ruleCount: scoredRules.length,
    fullZeroWrong,
    validationHoldoutZeroWrong,
    calibrationZeroWrong,
    sampleNonRowItems: nonRowReview.slice(0, 20).map((item) => ({
      captureId: item.captureId,
      layoutId: item.layoutId,
      split: item.split,
      questionLabel: item.questionLabel,
      truth: item.truth,
      current: item.current,
      currentCorrect: item.currentCorrect,
      topCandidates: item.candidates.slice(0, 5).map(summarizeCandidate)
    }))
  }

  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  if (opts.candidatesOut) {
    await fs.mkdir(path.dirname(opts.candidatesOut), { recursive: true })
    await fs.writeFile(opts.candidatesOut, `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      truth: opts.truth,
      rows: opts.rows,
      replays: opts.replays,
      sourceReport: opts.out,
      candidateRows: candidateRows(items)
    }, null, 2)}\n`)
  }
  console.log(JSON.stringify({
    out: opts.out,
    candidatesOut: opts.candidatesOut,
    replayFileCount: report.replayFileCount,
    itemCount: report.itemCount,
    splitCounts: report.splitCounts,
    reviewCounts: report.reviewCounts,
    candidateOracle: report.candidateOracle,
    ruleCount: report.ruleCount,
    fullZeroWrongCount: fullZeroWrong.length,
    topFullZeroWrong: fullZeroWrong.slice(0, 5).map((row) => ({
      key: row.key,
      full: row.full,
      calibration: row.calibration,
      validation: row.validation,
      holdout: row.holdout
    })),
    validationHoldoutZeroWrongCount: validationHoldoutZeroWrong.length,
    topValidationHoldoutZeroWrong: validationHoldoutZeroWrong.slice(0, 5).map((row) => ({
      key: row.key,
      full: {
        selected: row.full.selected,
        correct: row.full.correct,
        wrong: row.full.wrong,
        rescued: row.full.rescued
      },
      validation: row.validation,
      holdout: row.holdout
    }))
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
