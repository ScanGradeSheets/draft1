#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const MATCHED = path.join(ROOT, 'private-evidence/reports/v3-crop-matched-comparison-20260714.json')
const HISTORICAL = path.join(ROOT, 'private-evidence/reports/v3-crop-historical-review-lanes-20260714.json')
const OUT = path.join(ROOT, 'private-evidence/reports/v3-multicrop-stability-20260714.json')
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))
const pct = (n, d) => d ? Number((100 * n / d).toFixed(1)) : null

function validConsensus(row) {
  return row.sequenceConsensusRead && row.sequenceConsensusCount === 3 && Number(row.sequenceConsensusMinConfidence) >= 0.70
    ? row.sequenceConsensusRead : null
}

function scorePolicy(pairs, compactRequirement) {
  const rows = pairs.map((pair) => {
    const base = pair.control
    const controlRead = validConsensus(pair.control)
    const candidateRead = validConsensus(pair.candidate)
    const stableRead = controlRead && controlRead === candidateRead ? controlRead : null
    const compactMatches = [pair.control.compactRead === stableRead, pair.candidate.compactRead === stableRead]
    const compactPass = compactRequirement === 'none' ? true
      : compactRequirement === 'one' ? compactMatches.some(Boolean)
        : compactMatches.every(Boolean)
    const promotion = !base.v2Automatic && stableRead && compactPass && !base.strongSlotEvidence
    const disagreementVeto = base.disagreementVeto
    const read = disagreementVeto ? null : base.v2Automatic ? base.v2Read : promotion ? stableRead : null
    return { packetId: pair.packetId, truthText: pair.truthText, read, automatic: read != null, correct: read != null ? read === pair.truthText : null, promotion: Boolean(promotion) }
  })
  const automatic = rows.filter((row) => row.automatic)
  return {
    answers: rows.length,
    automatic: automatic.length,
    coveragePct: pct(automatic.length, rows.length),
    automaticCorrect: automatic.filter((row) => row.correct).length,
    automaticWrong: automatic.filter((row) => !row.correct).length,
    promotions: rows.filter((row) => row.promotion).length,
    byPacket: Object.fromEntries(['P08', 'P03', 'P09', 'P02'].map((packetId) => {
      const subset = rows.filter((row) => row.packetId === packetId)
      const selected = subset.filter((row) => row.automatic)
      return [packetId, { answers: subset.length, automatic: selected.length, coveragePct: pct(selected.length, subset.length), automaticWrong: selected.filter((row) => !row.correct).length }]
    })),
  }
}

const matched = readJson(MATCHED)
const pairs = matched.pairs
const reviewPairs = pairs.filter((pair) => !pair.control.v2Automatic)
const controlChoices = (pair) => new Set([pair.control.v2Read, pair.control.sequenceRead, pair.control.compactRead].filter(Boolean))
const unionChoices = (pair) => new Set([...controlChoices(pair), pair.candidate.v2Read, pair.candidate.sequenceRead, pair.candidate.compactRead].filter(Boolean))
const historical = readJson(HISTORICAL)
const historicalChanged = new Map((historical.changedPairs || []).map((pair) => [pair.control.key, pair]))
const historicalAllPairs = []
for (const rootName of ['control', 'candidate']) {
  // Full rows are intentionally not duplicated in the review-lane report. The
  // aggregate union can be derived because unchanged pairs have identical sets.
  if (!historical[rootName]) break
}
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  answerKeyUsedForRecognition: false,
  prospectiveMatched: {
    answers: pairs.length,
    v2ReviewAnswers: reviewPairs.length,
    correctChoiceAvailableControl: reviewPairs.filter((pair) => controlChoices(pair).has(pair.truthText)).length,
    correctChoiceAvailableUnion: reviewPairs.filter((pair) => unionChoices(pair).has(pair.truthText)).length,
    unionAddedCorrectChoice: reviewPairs.filter((pair) => !controlChoices(pair).has(pair.truthText) && unionChoices(pair).has(pair.truthText)).length,
    unionLostCorrectChoice: reviewPairs.filter((pair) => controlChoices(pair).has(pair.truthText) && !unionChoices(pair).has(pair.truthText)).length,
  },
  automaticPolicies: {
    stableLargeAcrossViews: scorePolicy(pairs, 'none'),
    stableLargePlusOneCompact: scorePolicy(pairs, 'one'),
    stableLargePlusBothCompact: scorePolicy(pairs, 'both'),
  },
  historicalReviewLane: {
    control: historical.allTruth.control,
    candidate: historical.allTruth.candidate,
    changedPairs: [...historicalChanged.values()].length,
    conclusion: 'Use the union only as review evidence. Replacing the control crop loses one correct large-model read on historical data.',
  },
}
fs.writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
console.log(JSON.stringify({ out: path.relative(ROOT, OUT), ...result }, null, 2))
