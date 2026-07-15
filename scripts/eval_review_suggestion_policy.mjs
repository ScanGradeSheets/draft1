#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_ROWS = 'private-evidence/reports/digit-failure-dataset-20260705-current/digit-rows.json'
const DEFAULT_OUT = 'private-evidence/reports/review-suggestion-policy-20260705/summary.json'

function parseArgs(argv) {
  const opts = {
    rows: DEFAULT_ROWS,
    out: DEFAULT_OUT,
    nonRowLeadingSevenContext: false,
    leadingOneEvidenceThreshold: 0.22,
    variantTopKEvidence: true,
    sixFromFiveEvidenceThreshold: 0.25
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--rows') opts.rows = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg === '--non-row-leading-seven-context') opts.nonRowLeadingSevenContext = true
    else if (arg === '--leading-one-evidence-threshold') opts.leadingOneEvidenceThreshold = Number(argv[++i])
    else if (arg === '--variant-topk-evidence') opts.variantTopKEvidence = true
    else if (arg === '--six-from-five-evidence-threshold') opts.sixFromFiveEvidenceThreshold = Number(argv[++i])
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function normalizeGradingDigit(value) {
  if (value == null || value === '' || value === '_') return null
  const digit = Number(value)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined
}

function normalizeGradingCells(cells) {
  if (!Array.isArray(cells)) return null
  const out = []
  for (const cell of cells) {
    const normalized = normalizeGradingDigit(cell)
    if (normalized === undefined) return null
    out.push(normalized)
  }
  return out
}

function normalizeAnswer(value) {
  return String(value ?? '').replace(/_/g, '').trim()
}

function acceptedResponsesFromAnswer(answer, slotCount) {
  if (answer == null) return []
  const text = String(answer).trim()
  if (!/^\d+$/.test(text)) return []
  const digits = text.split('').map((digit) => Number(digit))
  if (slotCount === 2 && digits.length === 1) {
    const digit = digits[0]
    return [
      [null, digit],
      [digit, null],
      [0, digit]
    ]
  }
  if (digits.length === slotCount) return [digits]
  if (digits.length < slotCount) {
    return [Array(slotCount - digits.length).fill(null).concat(digits)]
  }
  return []
}

function acceptedResponsesForGroup(group, slotCount) {
  const configured = Array.isArray(group?.accepted_digit_responses)
    ? group.accepted_digit_responses
      .map((response) => normalizeGradingCells(Array.isArray(response) ? response : response?.digits))
      .filter(Boolean)
    : []
  if (configured.length > 0) return configured
  return acceptedResponsesFromAnswer(group?.answer, slotCount)
}

function predictionCellsForIds(ids, byId) {
  const cells = []
  for (const id of ids) {
    const prediction = byId.get(id)
    if (!prediction) return null
    const normalized = normalizeGradingDigit(
      prediction.blank === true || prediction.empty === true ? null : prediction.digit
    )
    if (normalized === undefined) return null
    cells.push(normalized)
  }
  return cells
}

function cellsToAnswerText(cells) {
  if (!Array.isArray(cells)) return ''
  const text = cells
    .map((cell) => (cell === null || cell === undefined ? '_' : String(cell)))
    .join('')
  const trimmed = text.replace(/^_+/, '')
  return trimmed || (text.includes('_') ? 'blank' : text)
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function suggestionEvidenceForDigit(prediction, digit, group = null, slotIndex = 0) {
  const target = normalizeGradingDigit(digit)
  if (target === undefined || target === null || !prediction) return null
  const currentDigit = normalizeGradingDigit(
    prediction.blank === true || prediction.empty === true ? null : prediction.digit
  )
  const evidence = []
  let confidence = 0
  const addEvidence = (reason, value) => {
    const score = Math.max(0, Math.min(1, Number(value) || 0))
    if (score <= 0) return
    confidence = Math.max(confidence, score)
    evidence.push({ reason, confidence: Number(score.toFixed(4)) })
  }

  if (currentDigit === target) {
    addEvidence('current-read', prediction.confidence || 0.2)
  }
  for (const item of prediction.topK || []) {
    if (normalizeGradingDigit(item?.digit) === target) {
      addEvidence('model-topk', item.confidence || 0.01)
    }
  }
  for (const variant of prediction.preprocessVariants || []) {
    if (normalizeGradingDigit(variant?.digit) === target) {
      addEvidence(`variant:${variant.name || 'unnamed'}`, variant.confidence || variant.topGap || 0.01)
    }
    if (group?.variantTopKEvidence === true) {
      for (const item of variant?.topK || []) {
        if (normalizeGradingDigit(item?.digit) === target) {
          addEvidence(`variant-topk:${variant.name || 'unnamed'}`, item.confidence || 0.01)
          break
        }
      }
    }
  }

  const answerText = group?.answer == null ? '' : String(group.answer).trim()
  const isLeadingOneContext =
    target === 1 &&
    slotIndex === 0 &&
    /^1\d$/.test(answerText) &&
    [7, 8, 9].includes(currentDigit) &&
    (
      prediction.reviewNeeded === true ||
      prediction.highRiskMismatchReview === true ||
      prediction.preprocessReviewReason === 'two-digit-mismatch-low-trust-review'
    )
  if (isLeadingOneContext) {
    const family = layoutFamily(group?.layoutId || group?.layout_id || '')
    const allowNonRowSevenContext = group?.nonRowLeadingSevenContext === true && family === 'non-row'
    const hasIndependentOneEvidence = evidence.some((item) =>
      !String(item.reason || '').startsWith('answer-key-') &&
      Number(item.confidence) >= Number(group?.leadingOneEvidenceThreshold ?? 0.35)
    )
    if (currentDigit !== 7 || hasIndependentOneEvidence || allowNonRowSevenContext) {
      addEvidence('answer-key-leading-one-context', 0.68)
    }
  }

  const isNineTwoContext =
    target === 9 &&
    currentDigit === 2 &&
    prediction.reviewNeeded === true
  if (isNineTwoContext) {
    addEvidence('answer-key-nine-two-context', 0.48)
  }

  if (target === 6 && currentDigit === 5) {
    const strongIndependentEvidence = evidence.some((item) =>
      !String(item.reason || '').startsWith('answer-key-') &&
      Number(item.confidence) >= Number(group?.sixFromFiveEvidenceThreshold ?? 0.75)
    )
    if (!strongIndependentEvidence) return null
  }

  if (!evidence.length) return null
  return {
    digit: target,
    confidence: Number(confidence.toFixed(4)),
    evidence
  }
}

function responseSuggestionScore(response, group, predictionsById, ids) {
  const evidenceBySlot = []
  let score = 1
  let supportedSlots = 0
  for (let slotIndex = 0; slotIndex < ids.length; slotIndex += 1) {
    const cell = response[slotIndex]
    const prediction = predictionsById.get(ids[slotIndex])
    if (cell === null || cell === undefined) {
      const currentDigit = normalizeGradingDigit(
        prediction?.blank === true || prediction?.empty === true ? null : prediction?.digit
      )
      const blankConfidence = currentDigit === null || currentDigit === undefined
        ? 0.72
        : prediction?.reviewNeeded === true
          ? 0.28
          : 0
      if (!blankConfidence) return null
      score *= blankConfidence
      supportedSlots += 1
      evidenceBySlot.push({
        slotIndex,
        digit: null,
        confidence: Number(blankConfidence.toFixed(4)),
        evidence: [{ reason: 'blank-or-optional-slot', confidence: Number(blankConfidence.toFixed(4)) }]
      })
      continue
    }
    const evidence = suggestionEvidenceForDigit(prediction, cell, group, slotIndex)
    if (!evidence || evidence.confidence < 0.18) return null
    score *= Math.max(0.05, evidence.confidence)
    supportedSlots += 1
    evidenceBySlot.push({ slotIndex, ...evidence })
  }
  if (!supportedSlots) return null
  return {
    cells: response,
    text: cellsToAnswerText(response),
    confidence: Number(Math.pow(score, 1 / Math.max(1, supportedSlots)).toFixed(4)),
    evidenceBySlot
  }
}

function answerKeyContextSensitiveGroup(group) {
  const problem = String(group?.problem || '').trim().toLowerCase()
  const layoutId = String(group?.layoutId || group?.layout_id || '')
  return problem === 'how many?' || layoutId === 'sg-g1-lw-06-ten-frames'
}

function hasStrongIndependentSuggestionEvidence(candidate) {
  return (candidate?.evidenceBySlot || []).every((slot) => {
    if (slot.digit === null || slot.digit === undefined) return true
    return (slot.evidence || []).some((item) => {
      const reason = String(item.reason || '')
      return !reason.startsWith('answer-key-') && Number(item.confidence) >= 0.75
    })
  })
}

function hasStrongChangedSlotEvidence(candidate, currentCells, minConfidence = 0.79) {
  return (candidate?.evidenceBySlot || []).every((slot) => {
    const currentDigit = currentCells[slot.slotIndex]
    if (slot.digit === null || slot.digit === undefined || currentDigit === slot.digit) return true
    return (slot.evidence || []).some((item) => {
      const reason = String(item.reason || '')
      return !reason.startsWith('answer-key-') && Number(item.confidence) >= minConfidence
    })
  })
}

function noKeyNonRowLeftSevenOneSuggestion(group, groupPredictions, currentCells) {
  const layoutId = String(group?.layoutId || group?.layout_id || '')
  if (layoutFamily(layoutId) !== 'non-row') return null
  if (!Array.isArray(currentCells) || currentCells.length < 2 || currentCells[0] !== 7) return null
  const prediction = groupPredictions[0]
  if (!prediction || prediction.reviewNeeded !== true) return null
  if (groupPredictions.slice(1).some((item) => item?.reviewNeeded === true)) return null
  let best = null
  for (const variant of prediction.preprocessVariants || []) {
    if (normalizeGradingDigit(variant?.digit) !== 1) continue
    const confidence = Math.max(0, Math.min(1, Number(variant?.confidence) || 0))
    if (confidence < 0.25) continue
    const evidence = {
      reason: `no-key-non-row-left-seven-one:${variant.name || 'unnamed'}`,
      confidence: Number(confidence.toFixed(4))
    }
    if (!best || confidence > best.confidence) best = evidence
  }
  if (!best) return null
  const cells = currentCells.slice()
  cells[0] = 1
  return {
    cells,
    text: cellsToAnswerText(cells),
    confidence: best.confidence,
    evidenceBySlot: [{
      slotIndex: 0,
      digit: 1,
      confidence: best.confidence,
      evidence: [best]
    }]
  }
}

function hasNoKeyNonRowLeftSevenOneEvidence(candidate, currentCells) {
  return (candidate?.evidenceBySlot || []).some((slot) => (
    currentCells[slot.slotIndex] === 7 &&
    slot.digit === 1 &&
    (slot.evidence || []).some((item) => String(item.reason || '').startsWith('no-key-non-row-left-seven-one:'))
  ))
}

function likelyReadSuggestionForGroup(group, predictions, { requireReview = true } = {}) {
  const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
  if (!ids.length) return null
  const byId = new Map((predictions || []).map((prediction) => [prediction.id, prediction]))
  const groupPredictions = ids.map((id) => byId.get(id)).filter(Boolean)
  const hasReview = groupPredictions.some((prediction) => prediction?.reviewNeeded)
  if (requireReview && !hasReview) return null
  const responses = acceptedResponsesForGroup(group, ids.length)
    .filter((response) => Array.isArray(response) && response.length === ids.length)
  if (!responses.length) return null

  const currentCells = predictionCellsForIds(ids, byId) || []
  const currentText = cellsToAnswerText(currentCells)
  const noKeyLeadingOne = noKeyNonRowLeftSevenOneSuggestion(group, groupPredictions, currentCells)
  const candidates = responses
    .map((response) => responseSuggestionScore(response, group, byId, ids))
    .filter(Boolean)
    .filter((candidate) => candidate.text !== 'blank')
    .concat(noKeyLeadingOne ? [noKeyLeadingOne] : [])
    .sort((a, b) => b.confidence - a.confidence)
  const safeCandidates = candidates.filter((candidate) => {
    const candidateHasContextEvidence = candidate.evidenceBySlot.some((slot) =>
      (slot.evidence || []).some((item) => String(item.reason || '').startsWith('answer-key-'))
    )
    const candidateHasAlternativeEvidence = candidate.evidenceBySlot.some((slot) =>
      (slot.evidence || []).some((item) => String(item.reason || '').startsWith('variant:') || item.reason === 'model-topk')
    )
    const candidateHasNoKeyLeftSevenOneEvidence = hasNoKeyNonRowLeftSevenOneEvidence(candidate, currentCells)
    if (
      candidateHasContextEvidence &&
      answerKeyContextSensitiveGroup(group) &&
      !hasStrongIndependentSuggestionEvidence(candidate)
    ) {
      return false
    }
    if (
      !candidateHasContextEvidence &&
      !candidateHasNoKeyLeftSevenOneEvidence &&
      !hasStrongChangedSlotEvidence(candidate, currentCells)
    ) {
      return false
    }
    const threshold = candidateHasContextEvidence ? 0.42 : 0.55
    if (candidate.confidence < threshold && !candidateHasAlternativeEvidence && !candidateHasNoKeyLeftSevenOneEvidence) return false
    return true
  })
  const best = safeCandidates[0]
  if (!best) return null
  const hasContextEvidence = best.evidenceBySlot.some((slot) =>
    (slot.evidence || []).some((item) => String(item.reason || '').startsWith('answer-key-'))
  )
  const hasNoKeyLeftSevenOneEvidence = hasNoKeyNonRowLeftSevenOneEvidence(best, currentCells)
  return {
    text: best.text,
    cells: best.cells,
    confidence: best.confidence,
    currentText,
    source: hasContextEvidence
      ? 'answer-key-context-review'
      : hasNoKeyLeftSevenOneEvidence
        ? 'no-key-non-row-leading-one-review'
        : 'ocr-alternative-review',
    reviewOnly: true,
    evidenceBySlot: best.evidenceBySlot
  }
}

function keyFor(row) {
  return `${row.captureId}::${row.questionLabel}`
}

function slotSort(a, b) {
  return Number(a.digitIndex ?? 0) - Number(b.digitIndex ?? 0) ||
    String(a.slotName || '').localeCompare(String(b.slotName || ''))
}

function emptyBucket() {
  return {
    total: 0,
    auto: 0,
    autoCorrect: 0,
    autoWrong: 0,
    yellow: 0,
    yellowCurrentCorrect: 0,
    yellowCurrentWrong: 0,
    suggestionPresent: 0,
    suggestionCorrect: 0,
    suggestionWrong: 0,
    suggestionRescued: 0,
    suggestionHarmedCurrentCorrect: 0
  }
}

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function addRates(bucket) {
  return {
    ...bucket,
    autoCoveragePct: pct(bucket.auto, bucket.total),
    autoAccuracyPct: pct(bucket.autoCorrect, bucket.auto),
    yellowPct: pct(bucket.yellow, bucket.total),
    yellowCurrentMatchesTruthPct: pct(bucket.yellowCurrentCorrect, bucket.yellow),
    suggestionCoveragePct: pct(bucket.suggestionPresent, bucket.yellow),
    suggestionMatchesTruthPct: pct(bucket.suggestionCorrect, bucket.suggestionPresent),
    suggestionRescuePct: pct(bucket.suggestionRescued, bucket.yellowCurrentWrong)
  }
}

function bump(bucket, item) {
  bucket.total += 1
  if (item.groupReview) {
    bucket.yellow += 1
    if (item.currentCorrect) bucket.yellowCurrentCorrect += 1
    else bucket.yellowCurrentWrong += 1
    if (item.suggestion) {
      bucket.suggestionPresent += 1
      if (item.suggestionCorrect) bucket.suggestionCorrect += 1
      else bucket.suggestionWrong += 1
      if (!item.currentCorrect && item.suggestionCorrect) bucket.suggestionRescued += 1
      if (item.currentCorrect && !item.suggestionCorrect) bucket.suggestionHarmedCurrentCorrect += 1
    }
  } else {
    bucket.auto += 1
    if (item.currentCorrect) bucket.autoCorrect += 1
    else bucket.autoWrong += 1
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const rows = await readJson(opts.rows)
  const byQuestion = new Map()
  for (const row of rows) {
    if (row.truthSlotSource === 'unlabeled') continue
    const key = keyFor(row)
    if (!byQuestion.has(key)) byQuestion.set(key, [])
    byQuestion.get(key).push(row)
  }

  const replayCache = new Map()
  const getReplay = async (file) => {
    if (!file) return null
    if (!replayCache.has(file)) replayCache.set(file, await readJson(file))
    return replayCache.get(file)
  }

  const buckets = {
    overall: emptyBucket(),
    row: emptyBucket(),
    'non-row': emptyBucket(),
    other: emptyBucket()
  }
  const byLayout = new Map()
  const examples = {
    suggestionCorrect: [],
    suggestionWrong: [],
    autoWrong: []
  }
  const items = []

  for (const questionRows of byQuestion.values()) {
    questionRows.sort(slotSort)
    const first = questionRows[0]
    const replay = await getReplay(first.replayFile)
    if (!replay?.predictionDetails?.length) continue
    const ids = questionRows.map((row) => row.detailId).filter((id) => id !== undefined && id !== null)
    if (!ids.length) continue
    const group = {
      answer: first.expected,
      layoutId: first.layoutId,
      digit_box_ids: ids,
      nonRowLeadingSevenContext: opts.nonRowLeadingSevenContext,
      leadingOneEvidenceThreshold: opts.leadingOneEvidenceThreshold,
      variantTopKEvidence: opts.variantTopKEvidence,
      sixFromFiveEvidenceThreshold: opts.sixFromFiveEvidenceThreshold
    }
    const suggestion = likelyReadSuggestionForGroup(group, replay.predictionDetails, { requireReview: true })
    const truth = normalizeAnswer(first.truth)
    const current = normalizeAnswer(first.groupPredictedNormalized ?? first.groupPredicted)
    const item = {
      captureId: first.captureId,
      layoutId: first.layoutId,
      family: first.family || 'other',
      questionLabel: first.questionLabel,
      expected: normalizeAnswer(first.expected),
      truth,
      current,
      groupReview: Boolean(first.groupReview),
      currentCorrect: current === truth,
      suggestion,
      suggestionCorrect: suggestion ? normalizeAnswer(suggestion.text) === truth : false,
      cropPath: first.cropPath,
      replayFile: first.replayFile
    }
    if (!byLayout.has(item.layoutId)) byLayout.set(item.layoutId, emptyBucket())
    for (const bucket of [buckets.overall, buckets[item.family] || buckets.other, byLayout.get(item.layoutId)]) {
      bump(bucket, item)
    }
    if (!item.groupReview && !item.currentCorrect) examples.autoWrong.push(item)
    if (item.groupReview && item.suggestion) {
      if (item.suggestionCorrect) examples.suggestionCorrect.push(item)
      else examples.suggestionWrong.push(item)
    }
    items.push({
      key: `${item.captureId}::${item.questionLabel}`,
      captureId: item.captureId,
      layoutId: item.layoutId,
      family: item.family,
      questionLabel: item.questionLabel,
      expected: item.expected,
      truth: item.truth,
      current: item.current,
      groupReview: item.groupReview,
      currentCorrect: item.currentCorrect,
      suggestionText: item.suggestion?.text ?? null,
      suggestionConfidence: item.suggestion?.confidence ?? null,
      suggestionSource: item.suggestion?.source ?? null,
      suggestionCorrect: item.suggestionCorrect,
      suggestionRescued: Boolean(item.groupReview && item.suggestion && !item.currentCorrect && item.suggestionCorrect),
      suggestionHarmedCurrentCorrect: Boolean(item.groupReview && item.suggestion && item.currentCorrect && !item.suggestionCorrect),
      cropPath: item.cropPath,
      replayFile: item.replayFile
    })
  }

  const report = {
    generatedAt: new Date().toISOString(),
    rows: opts.rows,
    replayFileCount: replayCache.size,
    policy: opts.nonRowLeadingSevenContext
      ? 'live-lightweight-review-suggestion-non-row-leading-seven-context'
      : opts.variantTopKEvidence
        ? `live-lightweight-review-suggestion-variant-topk-leading-one-${opts.leadingOneEvidenceThreshold}-six-five-${opts.sixFromFiveEvidenceThreshold}`
        : opts.leadingOneEvidenceThreshold !== 0.35
        ? `live-lightweight-review-suggestion-leading-one-evidence-${opts.leadingOneEvidenceThreshold}`
        : 'live-lightweight-review-suggestion',
    overall: addRates(buckets.overall),
    byFamily: {
      row: addRates(buckets.row),
      'non-row': addRates(buckets['non-row']),
      other: addRates(buckets.other)
    },
    byLayout: Object.fromEntries([...byLayout.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([layout, bucket]) => [layout, addRates(bucket)])),
    examples: {
      autoWrong: examples.autoWrong.slice(0, 30),
      suggestionCorrect: examples.suggestionCorrect.slice(0, 40),
      suggestionWrong: examples.suggestionWrong.slice(0, 40)
    },
    items
  }

  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({
    out: opts.out,
    replayFileCount: report.replayFileCount,
    overall: report.overall,
    byFamily: report.byFamily
  }, null, 2))
}

await main()
