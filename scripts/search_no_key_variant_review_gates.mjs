#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    rows: DEFAULT_ROWS,
    out: null,
    dirs: []
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--rows') opts.rows = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else opts.dirs.push(arg)
  }
  if (!opts.dirs.length) {
    throw new Error('Usage: node scripts/search_no_key_variant_review_gates.mjs [--truth file] [--rows file] [--out file] <replay-dir>...')
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

function cellsToText(cells) {
  const text = cells.map((cell) => (cell === null || cell === undefined ? '_' : String(cell))).join('')
  return text.replace(/_/g, '').replace(/^0+(?=\d)/, '')
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

function addEvidence(map, digit, reason, confidence) {
  const normalized = normalizeDigit(digit)
  if (normalized === null || normalized === undefined) return
  const score = Math.max(0, Math.min(1, Number(confidence) || 0))
  if (score <= 0) return
  if (!map.has(normalized)) {
    map.set(normalized, {
      digit: normalized,
      maxConfidence: 0,
      variantTop1Count: 0,
      topKCount: 0,
      reasons: new Set()
    })
  }
  const item = map.get(normalized)
  item.maxConfidence = Math.max(item.maxConfidence, score)
  item.reasons.add(reason)
  if (reason.startsWith('variant:')) item.variantTop1Count += 1
  if (reason.includes('topk')) item.topKCount += 1
}

function slotCandidates(prediction) {
  const current = normalizeDigit(prediction?.blank || prediction?.empty ? null : prediction?.digit)
  const byDigit = new Map()
  if (current !== null && current !== undefined) {
    addEvidence(byDigit, current, 'current-read', prediction.confidence || 0.2)
  }
  for (const item of prediction?.topK || []) {
    addEvidence(byDigit, item?.digit, 'model-topk', item?.confidence || 0.01)
  }
  for (const variant of prediction?.preprocessVariants || []) {
    addEvidence(byDigit, variant?.digit, `variant:${variant?.name || 'unnamed'}`, variant?.confidence || variant?.topGap || 0.01)
    for (const item of variant?.topK || []) {
      addEvidence(byDigit, item?.digit, `variant-topk:${variant?.name || 'unnamed'}`, item?.confidence || 0.01)
    }
  }
  return [...byDigit.values()]
    .filter((candidate) => candidate.digit !== current)
    .map((candidate) => ({
      ...candidate,
      reasons: [...candidate.reasons].sort()
    }))
    .sort((a, b) => b.maxConfidence - a.maxConfidence || b.variantTop1Count - a.variantTop1Count)
    .slice(0, 3)
}

function candidateAnswers(details) {
  const currentCells = details.map((detail) => normalizeDigit(detail.blank || detail.empty ? null : detail.digit))
  const perSlot = details.map(slotCandidates)
  const out = []
  const visit = (index, cells, changes) => {
    if (index >= details.length) {
      if (!changes.length) return
      const text = cellsToText(cells)
      const currentText = cellsToText(currentCells)
      if (!text || text === currentText) return
      const minConfidence = Math.min(...changes.map((change) => change.maxConfidence))
      const minVariantTop1Count = Math.min(...changes.map((change) => change.variantTop1Count))
      const minTopKCount = Math.min(...changes.map((change) => change.topKCount))
      out.push({
        text,
        currentText,
        changedSlots: changes.length,
        minConfidence,
        maxConfidence: Math.max(...changes.map((change) => change.maxConfidence)),
        minVariantTop1Count,
        minTopKCount,
        allHaveVariantTop1: changes.every((change) => change.variantTop1Count > 0),
        allHaveTopK: changes.every((change) => change.topKCount > 0),
        changes
      })
      return
    }
    visit(index + 1, cells.concat([currentCells[index]]), changes)
    for (const candidate of perSlot[index]) {
      visit(index + 1, cells.concat([candidate.digit]), changes.concat([{
        slotIndex: index,
        from: currentCells[index],
        to: candidate.digit,
        ...candidate
      }]))
    }
  }
  visit(0, [], [])
  return out.sort((a, b) =>
    b.minConfidence - a.minConfidence ||
    b.minVariantTop1Count - a.minVariantTop1Count ||
    a.changedSlots - b.changedSlots
  )
}

function gateKey(gate) {
  return [
    `conf>=${gate.minConfidence}`,
    `changed<=${gate.maxChangedSlots}`,
    `vtop>=${gate.minVariantTop1Count}`,
    `topk>=${gate.minTopKCount}`,
    gate.family || 'all'
  ].join(' ')
}

function applyGate(item, gate) {
  if (gate.family && item.family !== gate.family) return null
  const candidate = item.candidates.find((entry) =>
    entry.changedSlots <= gate.maxChangedSlots &&
    entry.minConfidence >= gate.minConfidence &&
    entry.minVariantTop1Count >= gate.minVariantTop1Count &&
    entry.minTopKCount >= gate.minTopKCount
  )
  return candidate || null
}

function emptyScore() {
  return {
    totalReviewWrongLeans: 0,
    suggested: 0,
    correct: 0,
    wrong: 0,
    rescued: 0,
    harmedCurrentCorrect: 0
  }
}

function scoreItems(items, gate) {
  const score = emptyScore()
  const examples = { correct: [], wrong: [] }
  for (const item of items) {
    if (!item.review) continue
    if (!item.currentCorrect) score.totalReviewWrongLeans += 1
    const candidate = applyGate(item, gate)
    if (!candidate) continue
    score.suggested += 1
    const ok = candidate.text === item.truth
    if (ok) {
      score.correct += 1
      if (!item.currentCorrect) score.rescued += 1
      if (examples.correct.length < 12) examples.correct.push({ ...item, candidate })
    } else {
      score.wrong += 1
      if (item.currentCorrect) score.harmedCurrentCorrect += 1
      if (examples.wrong.length < 20) examples.wrong.push({ ...item, candidate })
    }
  }
  return {
    ...score,
    accuracyPct: score.suggested ? Number((score.correct / score.suggested * 100).toFixed(1)) : 0,
    rescuePct: score.totalReviewWrongLeans ? Number((score.rescued / score.totalReviewWrongLeans * 100).toFixed(1)) : 0,
    examples
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const truth = await readJson(opts.truth)
  const rows = await readJson(opts.rows)
  const truthEntries = (truth.entries || [])
    .filter((entry) => entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label')
  const truthByQuestion = new Map(truthEntries.map((entry) => [
    questionKey(entry.captureId, entry.questionLabel),
    entry
  ]))
  const splitByQuestion = new Map()
  for (const row of rows) {
    const key = questionKey(row.captureId, row.questionLabel)
    if (row.split && !splitByQuestion.has(key)) splitByQuestion.set(key, row.split)
  }
  const replayFiles = (await Promise.all(opts.dirs.map(collectReplayFiles))).flat().sort()
  const items = []

  for (const file of replayFiles) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    for (const group of result.groups || []) {
      const key = questionKey(captureId, group.label)
      const truthEntry = truthByQuestion.get(key)
      const split = splitByQuestion.get(key)
      if (!truthEntry || !split) continue
      const details = predictionDetailsForGroup(result, group)
      if (!details.length) continue
      const current = normalizeAnswer(group.predicted)
      const truthText = normalizeAnswer(truthEntry.truth)
      const candidates = candidateAnswers(details)
      items.push({
        key,
        captureId,
        layoutId: truthEntry.layoutId,
        family: layoutFamily(truthEntry.layoutId),
        split,
        questionLabel: truthEntry.questionLabel,
        expected: normalizeAnswer(truthEntry.expected),
        truth: truthText,
        current,
        currentCorrect: current === truthText,
        review: Boolean(group.review),
        candidates: candidates.slice(0, 20),
        cropPath: truthEntry.cropPath,
        replayFile: file
      })
    }
  }

  const bySplit = {
    calibration: items.filter((item) => item.split === 'calibration'),
    validation: items.filter((item) => item.split === 'validation'),
    holdout: items.filter((item) => item.split === 'holdout')
  }
  const gates = []
  for (const minConfidence of [0.95, 0.9, 0.85, 0.8, 0.75, 0.7, 0.65, 0.6]) {
    for (const maxChangedSlots of [1, 2]) {
      for (const minVariantTop1Count of [0, 1, 2]) {
        for (const minTopKCount of [0, 1, 2]) {
          for (const family of [null, 'row', 'non-row']) {
            gates.push({ minConfidence, maxChangedSlots, minVariantTop1Count, minTopKCount, family })
          }
        }
      }
    }
  }

  const scored = gates.map((gate) => ({
    gate,
    key: gateKey(gate),
    calibration: scoreItems(bySplit.calibration, gate),
    validation: scoreItems(bySplit.validation, gate),
    holdout: scoreItems(bySplit.holdout, gate)
  }))
  const calibrationZeroWrong = scored
    .filter((row) => row.calibration.wrong === 0 && row.calibration.suggested > 0)
    .sort((a, b) =>
      b.calibration.rescued - a.calibration.rescued ||
      b.validation.correct - a.validation.correct ||
      a.validation.wrong - b.validation.wrong ||
      b.holdout.correct - a.holdout.correct
    )
    .slice(0, 30)
  const validationZeroWrong = scored
    .filter((row) => row.validation.wrong === 0 && row.validation.suggested > 0)
    .sort((a, b) =>
      b.validation.rescued - a.validation.rescued ||
      b.holdout.correct - a.holdout.correct ||
      a.holdout.wrong - b.holdout.wrong
    )
    .slice(0, 30)

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    rows: opts.rows,
    replayDirs: opts.dirs,
    replayFileCount: replayFiles.length,
    itemCount: items.length,
    splitCounts: Object.fromEntries(Object.entries(bySplit).map(([split, splitItems]) => [split, splitItems.length])),
    gateCount: gates.length,
    calibrationZeroWrong,
    validationZeroWrong,
    allGateSummary: scored.map((row) => ({
      key: row.key,
      gate: row.gate,
      calibration: {
        suggested: row.calibration.suggested,
        correct: row.calibration.correct,
        wrong: row.calibration.wrong,
        rescued: row.calibration.rescued,
        accuracyPct: row.calibration.accuracyPct
      },
      validation: {
        suggested: row.validation.suggested,
        correct: row.validation.correct,
        wrong: row.validation.wrong,
        rescued: row.validation.rescued,
        accuracyPct: row.validation.accuracyPct
      },
      holdout: {
        suggested: row.holdout.suggested,
        correct: row.holdout.correct,
        wrong: row.holdout.wrong,
        rescued: row.holdout.rescued,
        accuracyPct: row.holdout.accuracyPct
      }
    }))
  }

  if (opts.out) {
    await fs.mkdir(path.dirname(opts.out), { recursive: true })
    await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  }
  const best = calibrationZeroWrong[0] || null
  console.log(JSON.stringify({
    out: opts.out,
    replayFileCount: report.replayFileCount,
    itemCount: items.length,
    splitCounts: report.splitCounts,
    calibrationZeroWrongCount: calibrationZeroWrong.length,
    bestCalibrationZeroWrong: best && {
      key: best.key,
      calibration: {
        suggested: best.calibration.suggested,
        correct: best.calibration.correct,
        wrong: best.calibration.wrong,
        rescued: best.calibration.rescued,
        accuracyPct: best.calibration.accuracyPct
      },
      validation: {
        suggested: best.validation.suggested,
        correct: best.validation.correct,
        wrong: best.validation.wrong,
        rescued: best.validation.rescued,
        accuracyPct: best.validation.accuracyPct
      },
      holdout: {
        suggested: best.holdout.suggested,
        correct: best.holdout.correct,
        wrong: best.holdout.wrong,
        rescued: best.holdout.rescued,
        accuracyPct: best.holdout.accuracyPct
      }
    },
    validationZeroWrongTop: validationZeroWrong.slice(0, 5).map((row) => ({
      key: row.key,
      validation: {
        suggested: row.validation.suggested,
        correct: row.validation.correct,
        wrong: row.validation.wrong,
        rescued: row.validation.rescued,
        accuracyPct: row.validation.accuracyPct
      },
      holdout: {
        suggested: row.holdout.suggested,
        correct: row.holdout.correct,
        wrong: row.holdout.wrong,
        rescued: row.holdout.rescued,
        accuracyPct: row.holdout.accuracyPct
      }
    }))
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
