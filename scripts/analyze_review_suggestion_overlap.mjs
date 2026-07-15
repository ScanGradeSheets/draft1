#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_REVIEW =
  'private-evidence/reports/review-suggestion-policy-20260707/final-strong-review-suggestions-with-items/summary.json'
const DEFAULT_ENSEMBLE =
  'private-evidence/reports/digit-ensemble-answer-level-20260707/no-key-yellow-only-with-items/summary.json'
const DEFAULT_OUT =
  'private-evidence/reports/review-suggestion-overlap-20260707/summary.json'

function parseArgs(argv) {
  const opts = {
    review: DEFAULT_REVIEW,
    ensemble: DEFAULT_ENSEMBLE,
    out: DEFAULT_OUT
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--review') opts.review = argv[++i]
    else if (arg === '--ensemble') opts.ensemble = argv[++i]
    else if (arg === '--out') opts.out = argv[++i]
  }
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function emptyBucket() {
  return {
    total: 0,
    yellow: 0,
    currentYellowCorrect: 0,
    currentYellowWrong: 0,
    liveSuggestionPresent: 0,
    liveSuggestionCorrect: 0,
    liveSuggestionWrong: 0,
    ensembleSuggestionPresent: 0,
    ensembleSuggestionCorrect: 0,
    ensembleSuggestionWrong: 0,
    unionSuggestionPresent: 0,
    unionSuggestionCorrect: 0,
    unionSuggestionWrong: 0,
    liveRescued: 0,
    ensembleRescued: 0,
    unionRescued: 0,
    additiveEnsembleRescued: 0,
    additiveEnsembleHarmed: 0,
    overlapBothPresent: 0,
    overlapSameText: 0,
    overlapDifferentText: 0
  }
}

function pct(n, d) {
  return d ? Number((n / d * 100).toFixed(1)) : 0
}

function addRates(bucket) {
  return {
    ...bucket,
    liveSuggestionAccuracyPct: pct(bucket.liveSuggestionCorrect, bucket.liveSuggestionPresent),
    ensembleSuggestionAccuracyPct: pct(bucket.ensembleSuggestionCorrect, bucket.ensembleSuggestionPresent),
    unionSuggestionAccuracyPct: pct(bucket.unionSuggestionCorrect, bucket.unionSuggestionPresent),
    unionSuggestionCoveragePct: pct(bucket.unionSuggestionPresent, bucket.yellow),
    unionRescuePct: pct(bucket.unionRescued, bucket.currentYellowWrong),
    additiveEnsembleRescuePct: pct(bucket.additiveEnsembleRescued, bucket.currentYellowWrong)
  }
}

function bump(bucket, reviewItem, ensembleItem) {
  const isYellow = Boolean(reviewItem.groupReview)
  bucket.total += 1
  if (!isYellow) return

  const liveText = reviewItem.suggestionText
  const ensembleText = ensembleItem?.changed ? ensembleItem.candidatePrediction : null
  const currentCorrect = Boolean(reviewItem.currentCorrect)
  const liveCorrect = Boolean(liveText && reviewItem.suggestionCorrect)
  const ensembleCorrect = Boolean(ensembleText && ensembleItem?.candidateCorrect)
  const useLive = Boolean(liveText)
  const useEnsemble = !useLive && Boolean(ensembleText)
  const unionText = useLive ? liveText : useEnsemble ? ensembleText : null
  const unionCorrect = useLive ? liveCorrect : useEnsemble ? ensembleCorrect : false

  bucket.yellow += 1
  bucket.currentYellowCorrect += Number(currentCorrect)
  bucket.currentYellowWrong += Number(!currentCorrect)

  if (liveText) {
    bucket.liveSuggestionPresent += 1
    bucket.liveSuggestionCorrect += Number(liveCorrect)
    bucket.liveSuggestionWrong += Number(!liveCorrect)
    bucket.liveRescued += Number(liveCorrect && !currentCorrect)
  }
  if (ensembleText) {
    bucket.ensembleSuggestionPresent += 1
    bucket.ensembleSuggestionCorrect += Number(ensembleCorrect)
    bucket.ensembleSuggestionWrong += Number(!ensembleCorrect)
    bucket.ensembleRescued += Number(ensembleCorrect && !currentCorrect)
  }
  if (unionText) {
    bucket.unionSuggestionPresent += 1
    bucket.unionSuggestionCorrect += Number(unionCorrect)
    bucket.unionSuggestionWrong += Number(!unionCorrect)
    bucket.unionRescued += Number(unionCorrect && !currentCorrect)
  }
  if (liveText && ensembleText) {
    bucket.overlapBothPresent += 1
    bucket.overlapSameText += Number(String(liveText) === String(ensembleText))
    bucket.overlapDifferentText += Number(String(liveText) !== String(ensembleText))
  }
  if (!liveText && ensembleText) {
    bucket.additiveEnsembleRescued += Number(ensembleCorrect && !currentCorrect)
    bucket.additiveEnsembleHarmed += Number(currentCorrect && !ensembleCorrect)
  }
}

function compactExample(reviewItem, ensembleItem) {
  return {
    key: reviewItem.key,
    captureId: reviewItem.captureId,
    layoutId: reviewItem.layoutId,
    family: reviewItem.family,
    questionLabel: reviewItem.questionLabel,
    expected: reviewItem.expected,
    truth: reviewItem.truth,
    current: reviewItem.current,
    liveSuggestion: reviewItem.suggestionText,
    ensembleSuggestion: ensembleItem?.candidatePrediction ?? null,
    ensembleChanges: ensembleItem?.changes ?? [],
    cropPath: reviewItem.cropPath
  }
}

function compactChangeFeatures(ensembleItem) {
  const changes = ensembleItem?.changes || []
  const confidences = changes
    .map((change) => Number(change?.selected?.confidence))
    .filter(Number.isFinite)
  const scores = changes
    .map((change) => Number(change?.selected?.score))
    .filter(Number.isFinite)
  const pairs = changes.map((change) => `${change.current?.digit ?? '?'}->${change.selected?.digit ?? '?'}`)
  const candidates = changes
    .map((change) => `${change.selected?.model ?? 'unknown'}:${change.selected?.variant ?? 'unknown'}`)
    .filter(Boolean)

  return {
    changedCount: changes.length,
    minConfidence: confidences.length ? Math.min(...confidences) : 0,
    minScore: scores.length ? Math.min(...scores) : 0,
    pairs,
    pairKey: pairs.join(','),
    candidates,
    candidateKey: candidates.join(',')
  }
}

function buildGateSearch(additiveItems) {
  const minConfidenceValues = [0, 0.9, 0.94, 0.95, 0.97, 0.98, 0.99]
  const minScoreValues = [0, 0.2, 0.24, 0.3, 0.33, 0.35, 0.4]
  const changedCountValues = [null, 1]
  const familyValues = [null, 'row', 'non-row']
  const pairAllowLists = [
    null,
    ['1->9', '1->5', '5->6', '7->2'],
    ['1->9', '1->5'],
    ['5->6', '7->2']
  ]
  const candidateIncludes = [
    null,
    'tony-generalist-extra-20260601',
    'tony-generalist-aug-strong-noaug-touch-20260601'
  ]
  const results = []

  for (const minConfidence of minConfidenceValues) {
    for (const minScore of minScoreValues) {
      for (const changedCount of changedCountValues) {
        for (const family of familyValues) {
          for (const pairAllowList of pairAllowLists) {
            for (const candidateInclude of candidateIncludes) {
              const matches = additiveItems.filter((item) => {
                const features = item.features
                if (features.minConfidence < minConfidence) return false
                if (features.minScore < minScore) return false
                if (changedCount != null && features.changedCount !== changedCount) return false
                if (family && item.reviewItem.family !== family) return false
                if (pairAllowList && !features.pairs.every((pair) => pairAllowList.includes(pair))) return false
                if (candidateInclude && !features.candidates.some((candidate) => candidate.includes(candidateInclude))) return false
                return true
              })
              if (!matches.length) continue
              const correct = matches.filter((item) => item.ensembleItem.candidateCorrect).length
              const wrong = matches.length - correct
              const rescued = matches.filter((item) => item.ensembleItem.candidateCorrect && !item.reviewItem.currentCorrect).length
              results.push({
                gate: {
                  minConfidence,
                  minScore,
                  changedCount,
                  family,
                  pairAllowList,
                  candidateInclude
                },
                present: matches.length,
                correct,
                wrong,
                rescued,
                accuracyPct: pct(correct, matches.length),
                examples: matches.slice(0, 8).map(({ reviewItem, ensembleItem }) => compactExample(reviewItem, ensembleItem))
              })
            }
          }
        }
      }
    }
  }

  return {
    additiveChangedTotal: additiveItems.length,
    topZeroWrong: results
      .filter((result) => result.wrong === 0)
      .sort((a, b) => b.correct - a.correct || b.rescued - a.rescued || b.present - a.present)
      .slice(0, 20),
    topOverall: results
      .sort((a, b) => a.wrong - b.wrong || b.correct - a.correct || b.rescued - a.rescued)
      .slice(0, 20)
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const review = await readJson(opts.review)
  const ensemble = await readJson(opts.ensemble)
  const strategies = ensemble.strategies || {}
  const strategyNames = Object.keys(strategies).filter((name) => name.endsWith('YellowOnly'))
  const reviewItems = review.items || []
  const reports = {}

  for (const strategyName of strategyNames) {
    const ensembleItems = new Map((strategies[strategyName].items || []).map((item) => [item.key, item]))
    const buckets = {
      overall: emptyBucket(),
      row: emptyBucket(),
      'non-row': emptyBucket(),
      other: emptyBucket()
    }
    const byLayout = new Map()
    const examples = {
      additiveEnsembleRescued: [],
      additiveEnsembleHarmed: [],
      overlapDifferentText: []
    }
    const additiveChangedItems = []

    for (const reviewItem of reviewItems) {
      const ensembleItem = ensembleItems.get(reviewItem.key)
      if (!byLayout.has(reviewItem.layoutId)) byLayout.set(reviewItem.layoutId, emptyBucket())
      const bucketList = [
        buckets.overall,
        buckets[reviewItem.family] || buckets.other,
        byLayout.get(reviewItem.layoutId)
      ]
      for (const bucket of bucketList) bump(bucket, reviewItem, ensembleItem)

      if (reviewItem.groupReview && !reviewItem.suggestionText && ensembleItem?.changed) {
        additiveChangedItems.push({
          reviewItem,
          ensembleItem,
          features: compactChangeFeatures(ensembleItem)
        })
        if (ensembleItem.candidateCorrect && !reviewItem.currentCorrect && examples.additiveEnsembleRescued.length < 40) {
          examples.additiveEnsembleRescued.push(compactExample(reviewItem, ensembleItem))
        }
        if (reviewItem.currentCorrect && !ensembleItem.candidateCorrect && examples.additiveEnsembleHarmed.length < 40) {
          examples.additiveEnsembleHarmed.push(compactExample(reviewItem, ensembleItem))
        }
      }
      if (
        reviewItem.groupReview &&
        reviewItem.suggestionText &&
        ensembleItem?.changed &&
        String(reviewItem.suggestionText) !== String(ensembleItem.candidatePrediction) &&
        examples.overlapDifferentText.length < 40
      ) {
        examples.overlapDifferentText.push(compactExample(reviewItem, ensembleItem))
      }
    }

    reports[strategyName] = {
      overall: addRates(buckets.overall),
      byFamily: {
        row: addRates(buckets.row),
        'non-row': addRates(buckets['non-row']),
        other: addRates(buckets.other)
      },
      byLayout: Object.fromEntries([...byLayout.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([layoutId, bucket]) => [layoutId, addRates(bucket)])),
      examples,
      gateSearch: buildGateSearch(additiveChangedItems)
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    reviewReport: opts.review,
    ensembleReport: opts.ensemble,
    strategyNames,
    reports
  }

  await fs.mkdir(path.dirname(opts.out), { recursive: true })
  await fs.writeFile(opts.out, `${JSON.stringify(out, null, 2)}\n`)
  console.log(JSON.stringify({
    out: opts.out,
    strategies: Object.fromEntries(Object.entries(reports).map(([name, report]) => [name, report.overall]))
  }, null, 2))
}

await main()
