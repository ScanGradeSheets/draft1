#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_TRUTH = 'private-evidence/truth-labels/20260703-flex-duplicate-accepted-needs-label/handwritten-truth-labelled.json'
const DEFAULT_REPLAY_DIRS = [
  'private-evidence/reports/current-replay-20260704-general-geometry-policy-a',
  'private-evidence/reports/current-replay-20260704-general-geometry-policy-b',
  'private-evidence/reports/current-replay-20260704-general-geometry-policy-c'
]

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
  if (!opts.dirs.length) opts.dirs = DEFAULT_REPLAY_DIRS
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
  return `${captureId}::${String(label ?? '').trim()}`
}

function captureIdFromReplay(result, file) {
  if (result?.file) return result.file
  return path.basename(file, '-replay-result.json')
}

function numberOrZero(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function emptyBucket() {
  return {
    candidates: 0,
    truthIsExpected: 0,
    truthIsStudentWrong: 0,
    wouldFixYellow: 0,
    wouldCreateConfidentWrong: 0
  }
}

function layoutFamily(layoutId) {
  if (/sg-g1-lw-0[1-5]-/.test(layoutId || '')) return 'row'
  if (/sg-g1-lw-(0[6-9]|10)-/.test(layoutId || '')) return 'non-row'
  return 'other'
}

function leadingOneStrokeVariantLooksStrong(quality, policy) {
  if (!quality) return false
  const inkPixels = numberOrZero(quality.inkPixels)
  const inkW = numberOrZero(quality.inkW)
  const inkH = numberOrZero(quality.inkH)
  const density = numberOrZero(quality.density)
  const maxRowCount = numberOrZero(quality.maxRowCount)
  const maxColCount = numberOrZero(quality.maxColCount)
  const edgeInkRatio = numberOrZero(quality.edgeInkRatio)
  return (
    quality.ok === true &&
    quality.lineArtifactLikely !== true &&
    quality.horizontalArtifactLikely !== true &&
    quality.edgeArtifactLikely !== true &&
    inkPixels >= policy.minInkPixels &&
    inkPixels <= policy.maxInkPixels &&
    inkW >= policy.minInkW &&
    inkW <= policy.maxInkW &&
    inkH >= policy.minInkH &&
    inkH <= policy.maxInkH &&
    density <= policy.maxDensity &&
    maxRowCount <= policy.maxRowCount &&
    maxColCount >= policy.minMaxColCount &&
    edgeInkRatio <= policy.maxEdgeInkRatio
  )
}

function contextAssistedLeadingOneEvidence(prediction, quality, policy) {
  if (!prediction || !quality) return null
  if (Number(prediction.digit) !== 9) return null
  if (numberOrZero(prediction.confidence) < 0.38) return null
  if (numberOrZero(quality.weakVariantRatio) >= 0.65) return null
  if (numberOrZero(quality.artifactVariantRatio) >= 0.35) return null

  const trustedNames = new Set([
    'raw-border-slot',
    'wide-slot',
    'no-side-erase',
    'center-safe-slot',
    'expected-slot',
    'edge-band-slot',
    'gentle'
  ])
  const anchorNames = new Set([
    'raw-border-slot',
    'wide-slot',
    'no-side-erase',
    'expected-slot'
  ])
  const hits = (Array.isArray(quality.variantQualities) ? quality.variantQualities : [])
    .filter((variant) => trustedNames.has(variant?.variantName) && leadingOneStrokeVariantLooksStrong(variant, policy))
  const anchors = hits.filter((variant) => anchorNames.has(variant?.variantName))
  if (hits.length < policy.minHits || anchors.length < policy.minAnchors) return null

  return {
    hits: hits.map((variant) => variant.variantName),
    anchors: anchors.map((variant) => variant.variantName)
  }
}

function rightSlotStableForContextAssist(prediction, expectedDigit) {
  if (!prediction) return false
  return (
    normalize(prediction.digit) === normalize(expectedDigit) &&
    prediction.reviewNeeded !== true &&
    numberOrZero(prediction.confidence) >= 0.70 &&
    numberOrZero(prediction.topGap) >= 0.16
  )
}

function bump(bucket, entry, group) {
  bucket.candidates += 1
  if (normalize(entry.truth) === normalize(entry.expected)) bucket.truthIsExpected += 1
  else bucket.truthIsStudentWrong += 1
  if (group.review && normalize(group.predicted) !== normalize(entry.truth) && normalize(entry.expected) === normalize(entry.truth)) {
    bucket.wouldFixYellow += 1
  }
  if (normalize(entry.truth) !== normalize(entry.expected)) bucket.wouldCreateConfidentWrong += 1
}

function addExample(examples, entry, group, file, leftPrediction, evidence) {
  if (examples.length >= 30) return
  examples.push({
    captureId: entry.captureId,
    layoutId: entry.layoutId,
    questionLabel: entry.questionLabel,
    expected: entry.expected,
    truth: entry.truth,
    appPrediction: group.predicted,
    review: Boolean(group.review),
    leftDigit: leftPrediction?.digit,
    leftConfidence: leftPrediction?.confidence ?? null,
    leftTopGap: leftPrediction?.topGap ?? null,
    evidence,
    cropPath: entry.cropPath,
    replayFile: file
  })
}

async function loadLayout(layoutId, cache) {
  if (cache.has(layoutId)) return cache.get(layoutId)
  const candidates = [
    path.join('layouts', `${layoutId}.json`),
    path.join('public', 'layouts', `${layoutId}.json`)
  ]
  for (const file of candidates) {
    const layout = await readJson(file).catch(() => null)
    if (layout) {
      cache.set(layoutId, layout)
      return layout
    }
  }
  cache.set(layoutId, null)
  return null
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
  const layoutCache = new Map()

  const policies = [
    {
      name: 'prepatch-inkW5',
      minInkPixels: 12,
      maxInkPixels: 42,
      minInkW: 2,
      maxInkW: 5,
      minInkH: 12,
      maxInkH: 22,
      maxDensity: 0.62,
      maxRowCount: 3,
      minMaxColCount: 8,
      maxEdgeInkRatio: 0.25,
      minHits: 3,
      minAnchors: 1
    },
    {
      name: 'current',
      minInkPixels: 12,
      maxInkPixels: 42,
      minInkW: 2,
      maxInkW: 6,
      minInkH: 12,
      maxInkH: 22,
      maxDensity: 0.62,
      maxRowCount: 3,
      minMaxColCount: 8,
      maxEdgeInkRatio: 0.25,
      minHits: 3,
      minAnchors: 1
    },
    {
      name: 'inkW6-two-anchors',
      minInkPixels: 12,
      maxInkPixels: 42,
      minInkW: 2,
      maxInkW: 6,
      minInkH: 12,
      maxInkH: 22,
      maxDensity: 0.62,
      maxRowCount: 3,
      minMaxColCount: 8,
      maxEdgeInkRatio: 0.25,
      minHits: 3,
      minAnchors: 2
    }
  ]

  const allExpectedLeadingOne = {
    overall: emptyBucket(),
    row: emptyBucket(),
    'non-row': emptyBucket(),
    other: emptyBucket()
  }
  const policyBuckets = new Map(policies.map((policy) => [policy.name, {
    overall: emptyBucket(),
    row: emptyBucket(),
    'non-row': emptyBucket(),
    other: emptyBucket(),
    examples: {
      safe: [],
      risky: []
    }
  }]))

  for (const file of replayFiles) {
    const result = await readJson(file)
    const captureId = captureIdFromReplay(result, file)
    const predictionsById = new Map((result.predictionDetails || []).map((prediction) => [prediction.id, prediction]))
    const qualityById = new Map((result?.guard?.cropQuality || []).map((quality) => [quality.id, quality]))
    const groupsByLabel = new Map((result.groups || []).map((group) => [String(group.label), group]))

    for (const [label, replayGroup] of groupsByLabel.entries()) {
      const entry = truthByQuestion.get(questionKey(captureId, label))
      if (!entry) continue
      if (!/^1\d$/.test(normalize(entry.expected))) continue
      const layout = await loadLayout(entry.layoutId, layoutCache)
      const layoutGroup = (layout?.question_groups || []).find((group) => String(group.question_num) === String(label))
      const ids = Array.isArray(layoutGroup?.digit_box_ids) ? layoutGroup.digit_box_ids : []
      if (ids.length !== 2) continue

      const expectedRightDigit = normalize(entry.expected)[1]
      const leftPrediction = predictionsById.get(ids[0])
      const rightPrediction = predictionsById.get(ids[1])
      if (!leftPrediction || !rightPrediction) continue
      if (normalize(leftPrediction.digit) === '1') continue
      if (!rightSlotStableForContextAssist(rightPrediction, expectedRightDigit)) continue

      const family = layoutFamily(entry.layoutId)
      for (const bucket of [allExpectedLeadingOne.overall, allExpectedLeadingOne[family]]) {
        bump(bucket, entry, replayGroup)
      }

      for (const policy of policies) {
        const evidence = contextAssistedLeadingOneEvidence(leftPrediction, qualityById.get(ids[0]), policy)
        if (!evidence) continue
        const policyResult = policyBuckets.get(policy.name)
        for (const bucket of [policyResult.overall, policyResult[family]]) {
          bump(bucket, entry, replayGroup)
        }
        const target = normalize(entry.truth) === normalize(entry.expected)
          ? policyResult.examples.safe
          : policyResult.examples.risky
        addExample(target, entry, replayGroup, file, leftPrediction, evidence)
      }
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    truth: opts.truth,
    replayDirs: opts.dirs,
    replayFileCount: replayFiles.length,
    allExpectedLeadingOne,
    policies: Object.fromEntries(policyBuckets.entries())
  }

  if (opts.out) {
    await fs.mkdir(path.dirname(opts.out), { recursive: true })
    await fs.writeFile(opts.out, JSON.stringify(report, null, 2))
  }

  console.log(JSON.stringify({
    replayFileCount: replayFiles.length,
    allExpectedLeadingOne,
    policies: Object.fromEntries([...policyBuckets.entries()].map(([name, value]) => [
      name,
      {
        overall: value.overall,
        row: value.row,
        nonRow: value['non-row'],
        riskyExamples: value.examples.risky.length,
        safeExamples: value.examples.safe.length
      }
    ])),
    out: opts.out
  }, null, 2))
}

await main()
