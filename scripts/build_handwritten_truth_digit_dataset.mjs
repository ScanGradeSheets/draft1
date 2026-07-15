#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { PNG } = require('pngjs')

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_OUT = 'private-evidence/reports/digit-failure-dataset-20260705-current'
const DEFAULT_REPLAY_DIRS = [
  'private-evidence/reports/current-replay-20260704-general-policy-inkw6-a',
  'private-evidence/reports/current-replay-20260704-general-policy-inkw6-b',
  'private-evidence/reports/current-replay-20260704-general-policy-inkw6-c'
]

function parseArgs(argv) {
  const opts = {
    truth: DEFAULT_TRUTH,
    out: DEFAULT_OUT,
    datasetOut: 'datasets/handwritten_truth_digits_current',
    writeTensors: 'base',
    variants: false,
    replayDirs: []
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--truth') opts.truth = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
    else if (arg === '--dataset-out') opts.datasetOut = argv[++i] || opts.datasetOut
    else if (arg === '--no-dataset') opts.datasetOut = ''
    else if (arg === '--write-tensors') opts.writeTensors = argv[++i] || opts.writeTensors
    else if (arg === '--variants') opts.variants = true
    else opts.replayDirs.push(arg)
  }
  if (!['none', 'base', 'all'].includes(opts.writeTensors)) {
    throw new Error('--write-tensors must be one of none, base, all')
  }
  if (!opts.replayDirs.length) opts.replayDirs = DEFAULT_REPLAY_DIRS
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

function captureIdFromReplay(result, file) {
  if (result?.file) return result.file
  return path.basename(file, '-replay-result.json')
}

function questionKey(captureId, label) {
  return `${captureId}::${String(label ?? '').trim()}`
}

function normalizeAnswer(value) {
  return String(value ?? '').replace(/_/g, '').replace(/\s+/g, '').trim()
}

function digitString(value) {
  const text = normalizeAnswer(value)
  return /^\d+$/.test(text) ? text : ''
}

function slotChars(value, slotCount) {
  const text = String(value ?? '').replace(/\s+/g, '')
  if (text.length === slotCount) return [...text]
  return null
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function splitForPageIndex(pageIndex) {
  const packetIndex = Math.max(0, Math.floor(Number(pageIndex || 0) / 10))
  const mod = packetIndex % 5
  if (mod === 4) return 'holdout'
  if (mod === 3) return 'validation'
  return 'calibration'
}

function slotName(slotCount, digitIndex) {
  if (slotCount <= 1) return 'single'
  if (digitIndex === 0) return 'left'
  if (digitIndex === slotCount - 1) return 'right'
  return `slot-${digitIndex + 1}`
}

function emptyBucket() {
  return {
    total: 0,
    filled: 0,
    filledCurrentCorrect: 0,
    filledCurrentWrong: 0,
    filledPolicyCorrect: 0,
    filledPolicyWrong: 0,
    blank: 0,
    blankPolicyCorrect: 0,
    blankPolicyWrong: 0,
    unlabeled: 0,
    groupAuto: 0,
    groupYellow: 0
  }
}

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function finalizeBucket(bucket) {
  return {
    ...bucket,
    filledCurrentAccuracyPct: pct(bucket.filledCurrentCorrect, bucket.filled),
    filledPolicyAccuracyPct: pct(bucket.filledPolicyCorrect, bucket.filled),
    blankPolicyAccuracyPct: pct(bucket.blankPolicyCorrect, bucket.blank),
    groupAutoPct: pct(bucket.groupAuto, bucket.total),
    groupYellowPct: pct(bucket.groupYellow, bucket.total)
  }
}

function bumpBucket(bucket, row) {
  bucket.total += 1
  if (row.groupReview) bucket.groupYellow += 1
  else bucket.groupAuto += 1

  if (row.truthDigit !== null) {
    bucket.filled += 1
    if (row.currentDigitCorrect) bucket.filledCurrentCorrect += 1
    else bucket.filledCurrentWrong += 1
    if (row.policySlotCorrect) bucket.filledPolicyCorrect += 1
    else bucket.filledPolicyWrong += 1
  } else if (row.truthBlank === true) {
    bucket.blank += 1
    if (row.policySlotCorrect) bucket.blankPolicyCorrect += 1
    else bucket.blankPolicyWrong += 1
  } else {
    bucket.unlabeled += 1
  }
}

function inc(map, key, amount = 1) {
  map[key] = (map[key] || 0) + amount
}

function ensureBucket(map, key) {
  if (!map.has(key)) map.set(key, emptyBucket())
  return map.get(key)
}

function sanitize(value) {
  return String(value ?? 'item')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-|-$/g, '') || 'item'
}

function tensorToPngBuffer(values) {
  if (!Array.isArray(values) || values.length !== 28 * 28) return null
  const png = new PNG({ width: 28, height: 28, colorType: 0 })
  for (let i = 0; i < values.length; i += 1) {
    const value = Math.max(0, Math.min(255, Math.round((Number(values[i]) || 0) * 255)))
    png.data[i] = value
  }
  return PNG.sync.write(png)
}

function unwrapDebug(raw) {
  return raw?.debug && typeof raw.debug === 'object' ? raw.debug : raw
}

function deriveTruthSlots({ entry, group, details }) {
  const slotCount = details.length || Math.max(1, String(group?.predicted ?? '').length, digitString(entry.truth).length)
  const truth = digitString(entry.truth)
  const slots = Array(slotCount).fill(undefined)
  if (!truth) {
    return { slots, source: 'unusable-truth', confidence: 'none' }
  }

  if (truth.length === slotCount) {
    return { slots: [...truth], source: 'direct-length-match', confidence: 'high' }
  }

  if (truth.length > slotCount) {
    return { slots, source: 'truth-longer-than-slots', confidence: 'none' }
  }

  const predictedChars = slotChars(group?.predicted, slotCount)
  if (predictedChars) {
    const predictedDigits = predictedChars.filter((char) => char !== '_').join('')
    if (predictedDigits === truth) {
      return {
        slots: predictedChars.map((char) => char === '_' ? null : char),
        source: 'inferred-from-app-slot-underscores',
        confidence: 'medium'
      }
    }
  }

  if (truth.length === 1) {
    const matchingDetailIndexes = details
      .map((detail, index) => String(detail?.digit) === truth ? index : -1)
      .filter((index) => index >= 0)
    if (matchingDetailIndexes.length === 1) {
      const inferred = Array(slotCount).fill(null)
      inferred[matchingDetailIndexes[0]] = truth
      return {
        slots: inferred,
        source: 'inferred-from-unique-current-digit-match',
        confidence: 'low'
      }
    }
  }

  return { slots, source: 'ambiguous-short-answer-position', confidence: 'none' }
}

function policySlotChar(group, digitIndex, slotCount) {
  const chars = slotChars(group?.predicted, slotCount)
  if (!chars) return null
  const char = chars[digitIndex]
  return char === undefined ? null : char
}

function topVariantInfo(detail, truthDigit) {
  const variants = Array.isArray(detail?.preprocessVariants) ? detail.preprocessVariants : []
  if (truthDigit === null || !variants.length) {
    return {
      anyVariantCorrect: false,
      bestCorrectVariant: null,
      correctVariantNames: []
    }
  }
  const correct = variants.filter((variant) => String(variant?.digit) === String(truthDigit))
  correct.sort((a, b) => Number(b?.confidence || 0) - Number(a?.confidence || 0))
  return {
    anyVariantCorrect: correct.length > 0,
    bestCorrectVariant: correct[0]?.name || null,
    correctVariantNames: correct.map((variant) => variant.name).filter(Boolean)
  }
}

function csvEscape(value) {
  const text = value === null || value === undefined ? '' : String(value)
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

function rowsToCsv(rows) {
  const columns = [
    'uid',
    'captureId',
    'pageIndex',
    'packetIndex',
    'split',
    'layoutId',
    'family',
    'questionLabel',
    'questionNum',
    'slotCount',
    'digitIndex',
    'slotName',
    'expected',
    'truth',
    'truthDigit',
    'truthBlank',
    'truthSlotSource',
    'truthSlotConfidence',
    'groupPredicted',
    'groupReview',
    'detailDigit',
    'detailConfidence',
    'detailTopGap',
    'policySlotChar',
    'currentDigitCorrect',
    'policySlotCorrect',
    'anyVariantCorrect',
    'bestCorrectVariant',
    'preprocessReviewReason',
    'robustOverride',
    'cropPath',
    'replayFile'
  ]
  const out = [columns.join(',')]
  for (const row of rows) {
    out.push(columns.map((column) => csvEscape(row[column])).join(','))
  }
  return `${out.join('\n')}\n`
}

function bucketObject(map) {
  return Object.fromEntries([...map.entries()]
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    .map(([key, bucket]) => [key, finalizeBucket(bucket)]))
}

function topEntries(obj, limit = 20) {
  return Object.entries(obj)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }))
}

async function writeTensorImage({ opts, outDir, row, debugByCapture, tensorKind }) {
  if (opts.writeTensors === 'none') return null
  if (row.truthDigit === null && row.truthBlank !== true) return null

  const debug = debugByCapture.get(row.captureId)
  const tensorRow = debug?.tensors?.find((candidate) => Number(candidate?.id) === Number(row.detailId))
  if (!tensorRow) return null

  const label = row.truthDigit === null ? '_blank' : String(row.truthDigit)
  const baseName = `${sanitize(row.captureId)}-q${String(row.questionNum).padStart(2, '0')}-d${row.digitIndex}-${sanitize(row.truthSlotSource)}`
  const written = []

  if (opts.writeTensors === 'base' || opts.writeTensors === 'all') {
    const buffer = tensorToPngBuffer(tensorRow.tensor)
    if (buffer) {
      const file = path.join(outDir, 'tensors', tensorKind, label, `${baseName}-base.png`)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, buffer)
      written.push(file)
    }
  }

  if (opts.writeTensors === 'all' || opts.variants) {
    for (const variant of tensorRow.tensorVariants || []) {
      const buffer = tensorToPngBuffer(variant?.tensor)
      if (!buffer) continue
      const file = path.join(outDir, 'tensors', 'variants', label, `${baseName}-${sanitize(variant.name)}.png`)
      await fs.mkdir(path.dirname(file), { recursive: true })
      await fs.writeFile(file, buffer)
      written.push(file)
    }
  }

  return written
}

function datasetSplitDir(split) {
  if (split === 'calibration') return 'train'
  if (split === 'validation') return 'val'
  return split || 'other'
}

function isTrainingLabelEligible(row) {
  return row.truthDigit !== null &&
    ['direct-length-match', 'inferred-from-app-slot-underscores'].includes(row.truthSlotSource)
}

async function writeDatasetTensor({ opts, row, debugByCapture }) {
  if (!opts.datasetOut || !isTrainingLabelEligible(row)) return null
  const debug = debugByCapture.get(row.captureId)
  const tensorRow = debug?.tensors?.find((candidate) => Number(candidate?.id) === Number(row.detailId))
  const buffer = tensorToPngBuffer(tensorRow?.tensor)
  if (!buffer) return null

  const label = String(row.truthDigit)
  const name = `${sanitize(row.captureId)}-q${String(row.questionNum).padStart(2, '0')}-d${row.digitIndex}-${sanitize(row.truthSlotSource)}.png`
  const targets = [
    path.join(opts.datasetOut, 'raw', label, name),
    path.join(opts.datasetOut, datasetSplitDir(row.split), label, name)
  ]
  for (const file of targets) {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, buffer)
  }
  return targets
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const truthPack = await readJson(opts.truth)
  const truthEntries = (truthPack.entries || [])
    .filter((entry) => entry.truthStatus !== 'unclear' && entry.truthStatus !== 'needs-label')

  const replayFiles = (await Promise.all(opts.replayDirs.map(collectReplayFiles))).flat().sort()
  const replayByCapture = new Map()
  const duplicateReplayCaptures = []
  for (const file of replayFiles) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    if (replayByCapture.has(captureId)) duplicateReplayCaptures.push(captureId)
    replayByCapture.set(captureId, { file, result })
  }

  const debugByCapture = new Map()
  for (const entry of truthEntries) {
    if (debugByCapture.has(entry.captureId) || !entry.debugPath) continue
    const raw = await readJson(entry.debugPath).catch(() => null)
    if (raw) debugByCapture.set(entry.captureId, unwrapDebug(raw))
  }

  await fs.rm(opts.out, { recursive: true, force: true })
  await fs.mkdir(opts.out, { recursive: true })
  if (opts.datasetOut) {
    await fs.rm(opts.datasetOut, { recursive: true, force: true })
    for (const split of ['raw', 'train', 'val', 'holdout']) {
      for (let digit = 0; digit <= 9; digit += 1) {
        await fs.mkdir(path.join(opts.datasetOut, split, String(digit)), { recursive: true })
      }
    }
  }

  const rows = []
  const missingReplayEntries = []
  const missingGroupEntries = []
  const byLayout = new Map()
  const byFamily = new Map()
  const bySlotName = new Map()
  const byTruthDigit = new Map()
  const bySplit = new Map()
  const byTruthSlotSource = new Map()
  const confusion = {}
  const policyConfusion = {}
  const reviewReasonCounts = {}
  const robustOverrideCounts = {}
  const variantStats = new Map()
  const examples = {
    currentWrongAnyVariantCorrect: [],
    policyBlankWrong: [],
    autoWrongFilledDigit: [],
    ambiguousPosition: []
  }
  let tensorsWritten = 0
  let datasetImagesWritten = 0

  for (const entry of truthEntries) {
    const replay = replayByCapture.get(entry.captureId)
    if (!replay) {
      missingReplayEntries.push({
        uid: entry.uid,
        captureId: entry.captureId,
        layoutId: entry.layoutId,
        questionLabel: entry.questionLabel
      })
      continue
    }

    const group = (replay.result.groups || []).find((candidate) => (
      String(candidate?.label ?? '').trim() === String(entry.questionLabel ?? '').trim()
    ))
    if (!group) {
      missingGroupEntries.push({
        uid: entry.uid,
        captureId: entry.captureId,
        layoutId: entry.layoutId,
        questionLabel: entry.questionLabel,
        replayFile: replay.file
      })
      continue
    }

    const details = (replay.result.predictionDetails || [])
      .filter((detail) => Number(detail?.questionNum) === Number(entry.questionNum))
      .sort((a, b) => Number(a?.digitIndex || 0) - Number(b?.digitIndex || 0))

    if (!details.length) continue

    const truthSlots = deriveTruthSlots({ entry, group, details })
    const slotCount = details.length
    const family = layoutFamily(entry.layoutId)
    const packetIndex = Math.max(0, Math.floor(Number(entry.pageIndex || 0) / 10))
    const split = splitForPageIndex(entry.pageIndex)

    for (const detail of details) {
      const digitIndex = Number(detail?.digitIndex || 0)
      const truthSlot = truthSlots.slots[digitIndex]
      const truthDigit = /^\d$/.test(String(truthSlot)) ? Number(truthSlot) : null
      const truthBlank = truthSlot === null
      const policyChar = policySlotChar(group, digitIndex, slotCount)
      const policySlotCorrect = truthDigit !== null
        ? policyChar === String(truthDigit)
        : truthBlank
          ? policyChar === '_'
          : null
      const currentDigitCorrect = truthDigit !== null
        ? Number(detail?.digit) === truthDigit
        : null
      const variantInfo = topVariantInfo(detail, truthDigit)

      const row = {
        uid: entry.uid,
        captureId: entry.captureId,
        pageIndex: Number(entry.pageIndex),
        packetIndex,
        split,
        layoutId: entry.layoutId,
        family,
        questionLabel: entry.questionLabel,
        questionNum: Number(entry.questionNum),
        slotCount,
        digitIndex,
        slotName: slotName(slotCount, digitIndex),
        expected: entry.expected,
        truth: normalizeAnswer(entry.truth),
        truthDigit,
        truthBlank,
        truthSlotSource: truthSlots.source,
        truthSlotConfidence: truthSlots.confidence,
        groupPredicted: group.predicted,
        groupPredictedNormalized: normalizeAnswer(group.predicted),
        groupReview: Boolean(group.review),
        groupCorrectAgainstTruth: normalizeAnswer(group.predicted) === normalizeAnswer(entry.truth),
        detailId: detail.id,
        detailDigit: Number.isInteger(Number(detail?.digit)) ? Number(detail.digit) : null,
        detailConfidence: Number(detail?.confidence || 0),
        detailTopGap: Number(detail?.topGap || 0),
        detailReviewNeeded: Boolean(detail?.reviewNeeded),
        policySlotChar: policyChar,
        currentDigitCorrect,
        policySlotCorrect,
        anyVariantCorrect: variantInfo.anyVariantCorrect,
        bestCorrectVariant: variantInfo.bestCorrectVariant,
        correctVariantNames: variantInfo.correctVariantNames,
        preprocessReviewReason: detail?.preprocessReviewReason || '',
        robustOverride: detail?.robustOverride || '',
        confidencePolicyCleared: Boolean(detail?.confidencePolicyCleared),
        cropPath: entry.cropPath,
        debugPath: entry.debugPath,
        replayFile: replay.file
      }
      rows.push(row)

      for (const bucket of [
        ensureBucket(byLayout, row.layoutId),
        ensureBucket(byFamily, row.family),
        ensureBucket(bySlotName, row.slotName),
        ensureBucket(bySplit, row.split),
        ensureBucket(byTruthSlotSource, row.truthSlotSource),
        truthDigit !== null ? ensureBucket(byTruthDigit, String(truthDigit)) : null
      ].filter(Boolean)) {
        bumpBucket(bucket, row)
      }

      if (truthDigit !== null) {
        inc(confusion, `${truthDigit}->${row.detailDigit}`)
        inc(policyConfusion, `${truthDigit}->${policyChar ?? '?'}`)
        const currentStats = ensureBucket(variantStats, 'current')
        bumpBucket(currentStats, row)
        for (const variant of detail?.preprocessVariants || []) {
          const variantRow = {
            ...row,
            detailDigit: Number(variant?.digit),
            currentDigitCorrect: Number(variant?.digit) === truthDigit,
            policySlotCorrect: Number(variant?.digit) === truthDigit
          }
          bumpBucket(ensureBucket(variantStats, `variant:${variant?.name || 'unknown'}`), variantRow)
        }
        if (!row.currentDigitCorrect && row.anyVariantCorrect) {
          examples.currentWrongAnyVariantCorrect.push(row)
        }
        if (!row.groupReview && !row.groupCorrectAgainstTruth && !row.currentDigitCorrect) {
          examples.autoWrongFilledDigit.push(row)
        }
      } else if (truthBlank && !policySlotCorrect) {
        inc(policyConfusion, `_blank->${policyChar ?? '?'}`)
        examples.policyBlankWrong.push(row)
      }

      if (row.preprocessReviewReason) inc(reviewReasonCounts, row.preprocessReviewReason)
      if (row.robustOverride) inc(robustOverrideCounts, row.robustOverride)
      if (row.truthSlotSource === 'ambiguous-short-answer-position') {
        examples.ambiguousPosition.push(row)
      }

      const written = await writeTensorImage({
        opts,
        outDir: opts.out,
        row,
        debugByCapture,
        tensorKind: row.truthSlotConfidence === 'high' ? 'trusted' : 'inferred'
      })
      tensorsWritten += written?.length || 0

      const datasetWritten = await writeDatasetTensor({ opts, row, debugByCapture })
      datasetImagesWritten += datasetWritten?.length || 0
    }
  }

  const filledRows = rows.filter((row) => row.truthDigit !== null)
  const knownRows = rows.filter((row) => row.truthDigit !== null || row.truthBlank === true)
  const variantOracle = {
    filledSlots: filledRows.length,
    currentCorrect: filledRows.filter((row) => row.currentDigitCorrect).length,
    currentWrong: filledRows.filter((row) => row.currentDigitCorrect === false).length,
    anyVariantCorrect: filledRows.filter((row) => row.anyVariantCorrect).length,
    currentWrongAnyVariantCorrect: filledRows.filter((row) => !row.currentDigitCorrect && row.anyVariantCorrect).length,
    currentOrVariantCorrect: filledRows.filter((row) => row.currentDigitCorrect || row.anyVariantCorrect).length,
    currentCorrectPct: pct(filledRows.filter((row) => row.currentDigitCorrect).length, filledRows.length),
    anyVariantCorrectPct: pct(filledRows.filter((row) => row.anyVariantCorrect).length, filledRows.length),
    currentOrVariantCorrectPct: pct(filledRows.filter((row) => row.currentDigitCorrect || row.anyVariantCorrect).length, filledRows.length)
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    replayDirs: opts.replayDirs,
    replayFileCount: replayFiles.length,
    truthEntryCount: truthEntries.length,
    captureCount: new Set(truthEntries.map((entry) => entry.captureId)).size,
    rowCount: rows.length,
    knownSlotCount: knownRows.length,
    filledSlotCount: filledRows.length,
    blankSlotCount: rows.filter((row) => row.truthBlank === true).length,
    unlabeledSlotCount: rows.filter((row) => row.truthDigit === null && row.truthBlank !== true).length,
    tensorsWritten,
    datasetOut: opts.datasetOut || null,
    datasetImagesWritten,
    duplicateReplayCaptures: [...new Set(duplicateReplayCaptures)].sort(),
    missingReplayEntries,
    missingGroupEntries,
    overall: finalizeBucket(rows.reduce((bucket, row) => {
      bumpBucket(bucket, row)
      return bucket
    }, emptyBucket())),
    byFamily: bucketObject(byFamily),
    byLayout: bucketObject(byLayout),
    bySlotName: bucketObject(bySlotName),
    bySplit: bucketObject(bySplit),
    byTruthDigit: bucketObject(byTruthDigit),
    byTruthSlotSource: bucketObject(byTruthSlotSource),
    confusionTop: topEntries(confusion, 40),
    policyConfusionTop: topEntries(policyConfusion, 40),
    reviewReasonTop: topEntries(reviewReasonCounts, 30),
    robustOverrideTop: topEntries(robustOverrideCounts, 30),
    variantOracle,
    variantStats: bucketObject(variantStats),
    examples: {
      currentWrongAnyVariantCorrect: examples.currentWrongAnyVariantCorrect.slice(0, 80),
      policyBlankWrong: examples.policyBlankWrong.slice(0, 80),
      autoWrongFilledDigit: examples.autoWrongFilledDigit.slice(0, 80),
      ambiguousPosition: examples.ambiguousPosition.slice(0, 80)
    }
  }

  const md = [
    '# ScanGrade Digit Failure Dataset',
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Headline',
    '',
    `- Truth entries: ${summary.truthEntryCount}`,
    `- Digit-slot rows: ${summary.rowCount}`,
    `- Filled digit slots with usable labels: ${summary.filledSlotCount}`,
    `- Known blank slots: ${summary.blankSlotCount}`,
    `- Ambiguous/unlabeled slots: ${summary.unlabeledSlotCount}`,
    `- Current digit accuracy on labelled filled slots: ${summary.variantOracle.currentCorrectPct}%`,
    `- Existing variant rescue ceiling, counting current-or-any-variant correct: ${summary.variantOracle.currentOrVariantCorrectPct}%`,
    `- Current-wrong slots where an existing variant already had the truth digit: ${summary.variantOracle.currentWrongAnyVariantCorrect}`,
    '',
    '## By Family',
    '',
    '```json',
    JSON.stringify(summary.byFamily, null, 2),
    '```',
    '',
    '## Top Current Confusions',
    '',
    '```json',
    JSON.stringify(summary.confusionTop.slice(0, 20), null, 2),
    '```',
    '',
    '## Top Review Reasons',
    '',
    '```json',
    JSON.stringify(summary.reviewReasonTop.slice(0, 20), null, 2),
    '```'
  ].join('\n')

  await fs.writeFile(path.join(opts.out, 'digit-rows.json'), JSON.stringify(rows, null, 2))
  await fs.writeFile(path.join(opts.out, 'digit-rows.csv'), rowsToCsv(rows))
  await fs.writeFile(path.join(opts.out, 'summary.json'), JSON.stringify(summary, null, 2))
  await fs.writeFile(path.join(opts.out, 'README.md'), md)
  if (opts.datasetOut) {
    await fs.writeFile(path.join(opts.datasetOut, 'dataset-summary.json'), JSON.stringify({
      generatedAt: summary.generatedAt,
      sourceReport: opts.out,
      sourceTruth: opts.truth,
      eligibleTruthSlotSources: ['direct-length-match', 'inferred-from-app-slot-underscores'],
      splitMapping: {
        calibration: 'train',
        validation: 'val',
        holdout: 'holdout'
      },
      imagesWritten: datasetImagesWritten
    }, null, 2))
  }

  console.log(JSON.stringify({
    out: opts.out,
    truthEntryCount: summary.truthEntryCount,
    rowCount: summary.rowCount,
    filledSlotCount: summary.filledSlotCount,
    blankSlotCount: summary.blankSlotCount,
    unlabeledSlotCount: summary.unlabeledSlotCount,
    currentDigitAccuracyPct: summary.variantOracle.currentCorrectPct,
    anyVariantCorrectPct: summary.variantOracle.anyVariantCorrectPct,
    currentOrVariantCorrectPct: summary.variantOracle.currentOrVariantCorrectPct,
    currentWrongAnyVariantCorrect: summary.variantOracle.currentWrongAnyVariantCorrect,
    tensorsWritten,
    datasetOut: summary.datasetOut,
    datasetImagesWritten
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
