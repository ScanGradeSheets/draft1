#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const DEFAULT_REPLAY = 'private-evidence/reports/variant-topk-leading-one-review-20260707-full-browser'
const DEFAULT_OUT = 'private-evidence/reports/nonrow-next-push-20260708/six-from-five-review-gates.json'

function parseArgs(argv) {
  const opts = { truth: DEFAULT_TRUTH, rows: DEFAULT_ROWS, replay: DEFAULT_REPLAY, out: DEFAULT_OUT }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--rows') opts.rows = argv[++i]
    else if (arg === '--replay') opts.replay = argv[++i]
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

function normalizeAnswer(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

function normalizeDigit(value) {
  if (value === null || value === undefined || value === '' || value === '_') return null
  const digit = Number(value)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined
}

function questionKey(captureId, label) {
  return `${String(captureId ?? '').trim()}::${String(label ?? '').trim()}`
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

function expectedDigits(value, slotCount) {
  const text = normalizeAnswer(value)
  if (!/^\d+$/.test(text)) return []
  const digits = text.split('').map((digit) => Number(digit))
  if (digits.length === slotCount) return digits
  if (digits.length < slotCount) return Array(slotCount - digits.length).fill(null).concat(digits)
  return []
}

function detailCurrentDigit(detail) {
  return normalizeDigit(detail?.blank === true || detail?.empty === true ? null : detail?.digit)
}

function evidenceForTarget(detail, target) {
  const out = []
  const add = (source, confidence) => {
    const score = Math.max(0, Math.min(1, Number(confidence) || 0))
    if (score > 0) out.push({ source, confidence: Number(score.toFixed(4)) })
  }
  for (const item of detail?.topK || []) {
    if (normalizeDigit(item?.digit) === target) add('model-topk', item.confidence)
  }
  for (const variant of detail?.preprocessVariants || []) {
    if (normalizeDigit(variant?.digit) === target) add(`variant:${variant.name || 'unnamed'}`, variant.confidence || variant.topGap)
    for (const item of variant?.topK || []) {
      if (normalizeDigit(item?.digit) === target) add(`variant-topk:${variant.name || 'unnamed'}`, item.confidence)
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence)
}

function emptyBucket() {
  return { suggested: 0, correct: 0, wrong: 0, rescued: 0, harmedCurrentCorrect: 0 }
}

function bump(bucket, item) {
  bucket.suggested += 1
  if (item.correct) bucket.correct += 1
  else bucket.wrong += 1
  if (item.rescued) bucket.rescued += 1
  if (item.harmedCurrentCorrect) bucket.harmedCurrentCorrect += 1
}

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function finalize(bucket) {
  return { ...bucket, accuracyPct: pct(bucket.correct, bucket.suggested) }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const [truthJson, rows] = await Promise.all([readJson(opts.truth), readJson(opts.rows)])
  const truthEntries = (truthJson.entries || []).filter((entry) =>
    entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label'
  )
  const truthByQuestion = new Map(truthEntries.map((entry) => [questionKey(entry.captureId, entry.questionLabel), entry]))
  const splitByQuestion = new Map()
  for (const row of rows) {
    const key = questionKey(row.captureId, row.questionLabel)
    if (row.split && !splitByQuestion.has(key)) splitByQuestion.set(key, row.split)
  }

  const candidates = []
  const replayFiles = await collectReplayFiles(opts.replay)
  for (const file of replayFiles.sort()) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    for (const group of result.groups || []) {
      const key = questionKey(captureId, group.label)
      const truth = truthByQuestion.get(key)
      if (!truth || !group.review || normalizeAnswer(group?.reviewSuggestion?.text)) continue
      const details = predictionDetailsForGroup(result, group)
      const targets = expectedDigits(group.expected, details.length)
      if (!targets.length) continue
      const currentText = normalizeAnswer(group.predicted)
      const truthText = normalizeAnswer(truth.truth)
      const changedSlots = []
      for (let slotIndex = 0; slotIndex < details.length; slotIndex += 1) {
        const current = detailCurrentDigit(details[slotIndex])
        const target = targets[slotIndex]
        if (current === 5 && target === 6) {
          const evidence = evidenceForTarget(details[slotIndex], 6)
          changedSlots.push({ slotIndex, current, target, evidence, bestConfidence: evidence[0]?.confidence || 0 })
        } else if (target !== null && current !== target) {
          changedSlots.push({ slotIndex, current, target, evidence: [], bestConfidence: 0, otherMismatch: true })
        }
      }
      const sixSlot = changedSlots.find((slot) => slot.current === 5 && slot.target === 6)
      if (!sixSlot) continue
      const suggestionText = normalizeAnswer(targets.map((digit) => digit === null ? '_' : digit).join(''))
      candidates.push({
        captureId,
        layoutId: truth.layoutId,
        family: layoutFamily(truth.layoutId),
        split: splitByQuestion.get(key) || 'unknown',
        questionLabel: truth.questionLabel,
        expected: normalizeAnswer(group.expected),
        truth: truthText,
        current: currentText,
        suggestionText,
        bestConfidence: sixSlot.bestConfidence,
        changedSlotCount: changedSlots.length,
        correct: suggestionText === truthText,
        rescued: currentText !== truthText && suggestionText === truthText,
        harmedCurrentCorrect: currentText === truthText && suggestionText !== truthText,
        evidence: sixSlot.evidence.slice(0, 6),
        replayFile: file
      })
    }
  }

  const thresholds = [0.75, 0.7, 0.65, 0.6, 0.55, 0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2]
  const runs = thresholds.map((threshold) => {
    const selected = candidates.filter((item) => item.bestConfidence >= threshold && item.changedSlotCount <= 1)
    const overall = emptyBucket()
    const bySplit = new Map()
    const byFamily = new Map()
    for (const item of selected) {
      for (const [map, key] of [[bySplit, item.split], [byFamily, item.family]]) {
        if (!map.has(key)) map.set(key, emptyBucket())
      }
      bump(overall, item)
      bump(bySplit.get(item.split), item)
      bump(byFamily.get(item.family), item)
    }
    const finalizeMap = (map) => Object.fromEntries([...map.entries()]
      .sort(([a], [b]) => String(a).localeCompare(String(b)))
      .map(([key, bucket]) => [key, finalize(bucket)]))
    return {
      threshold,
      overall: finalize(overall),
      bySplit: finalizeMap(bySplit),
      byFamily: finalizeMap(byFamily),
      examples: selected.slice(0, 30)
    }
  })

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    rows: opts.rows,
    replay: opts.replay,
    replayFileCount: replayFiles.length,
    candidateCount: candidates.length,
    candidates,
    runs
  }
  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({
    out: opts.out,
    replayFileCount: replayFiles.length,
    candidateCount: candidates.length,
    runs: runs.map((run) => ({
      threshold: run.threshold,
      overall: run.overall,
      bySplit: run.bySplit,
      byFamily: run.byFamily
    }))
  }, null, 2))
}

await main()
