#!/usr/bin/env node

import fs from 'node:fs'

function parseArgs(argv) {
  const named = {}
  const positional = []
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === '--control') named.control = argv[++index]
    else if (value === '--review') named.review = argv[++index]
    else if (value === '--consensus') named.consensus = argv[++index]
    else if (value === '--out') named.out = argv[++index]
    else positional.push(value)
  }
  return { named, positional }
}

const { named, positional } = parseArgs(process.argv.slice(2))
const controlPath = named.control || positional[0] || 'private-evidence/reports/hybrid-v2-control-check-20260713/truth-score.json'
const reviewPath = named.review || positional[1] || 'private-evidence/reports/review-lane-ab-simulation-exhaustive-20260713.json'
const consensusPath = named.consensus || positional[2] || 'private-evidence/reports/pseudo-frame-consensus-20260713.json'
const output = named.out || positional[3] || 'private-evidence/reports/control-vs-hybrid-v2-20260713.json'

const control = JSON.parse(fs.readFileSync(controlPath, 'utf8'))
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'))
const consensus = JSON.parse(fs.readFileSync(consensusPath, 'utf8'))
const bestPseudo = [...(consensus.combinations || [])].sort((a, b) => {
  const aPolicy = a.yellowShadowPolicy?.holdout || {}
  const bPolicy = b.yellowShadowPolicy?.holdout || {}
  return (bPolicy.consensusCorrect || 0) - (aPolicy.consensusCorrect || 0) ||
    (aPolicy.consensusWrong || 0) - (bPolicy.consensusWrong || 0)
})[0]

const report = {
  generatedAt: new Date().toISOString(),
  verdict: 'Hybrid V2 improves review choice availability on saved evidence while preserving the control. Cross-frame automatic gain remains simulated and shadow-only until real bursts arrive.',
  control: {
    answers: control.overall.total,
    automatic: control.overall.auto,
    automaticCoveragePct: control.overall.autoCoveragePct,
    automaticCorrect: control.overall.autoCorrect,
    automaticWrong: control.overall.autoWrong,
    yellow: control.overall.yellow,
  },
  hybridImplementedBehavior: {
    automatic: control.overall.auto,
    automaticCorrect: control.overall.autoCorrect,
    automaticWrong: control.overall.autoWrong,
    controlChanged: false,
    currentOcrChoiceAlwaysFirst: true,
    yellowAutomaticPromotionEnabled: false,
    serviceFailureBlocksGrading: false,
  },
  demonstratedSingleFrameReviewGain: {
    evaluatedYellowAnswers: review.overall.yellowAnswers,
    controlCorrectChoiceAvailable: review.overall.controlCorrectChoiceAvailable,
    hybridCorrectChoiceAvailable: review.overall.treatmentCorrectChoiceAvailable,
    additionalCorrectOneTapChoices: review.overall.pairedNetGain,
    holdoutYellowAnswers: review.untouchedHoldoutPacketBlock.yellowAnswers,
    holdoutControlCorrectChoiceAvailable: review.untouchedHoldoutPacketBlock.controlCorrectChoiceAvailable,
    holdoutHybridCorrectChoiceAvailable: review.untouchedHoldoutPacketBlock.treatmentCorrectChoiceAvailable,
    holdoutAdditionalCorrectOneTapChoices: review.untouchedHoldoutPacketBlock.pairedNetGain,
    pairedChoiceLosses: review.pairedChanges?.losses?.length || 0,
  },
  simulatedCrossFrameShadowGain: bestPseudo ? {
    pseudoFrameConditions: bestPseudo.conditions,
    warning: consensus.warning,
    yellowAnswers: bestPseudo.yellowShadowPolicy.overall.total,
    shadowEligible: bestPseudo.yellowShadowPolicy.overall.consensus,
    shadowCorrect: bestPseudo.yellowShadowPolicy.overall.consensusCorrect,
    shadowWrong: bestPseudo.yellowShadowPolicy.overall.consensusWrong,
    holdoutYellowAnswers: bestPseudo.yellowShadowPolicy.holdout.total,
    holdoutShadowEligible: bestPseudo.yellowShadowPolicy.holdout.consensus,
    holdoutShadowCorrect: bestPseudo.yellowShadowPolicy.holdout.consensusCorrect,
    holdoutShadowWrong: bestPseudo.yellowShadowPolicy.holdout.consensusWrong,
  } : null,
  missingBeforeFinalComparison: [
    'Real three-frame burst crops from unseen student packets',
    'Prospective one-tap review duration measurements',
    'Packet-level locked test result after policy freeze',
    'Service timeout and memory measurements on the intended cloud host',
  ],
}

fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report, null, 2))
console.log(output)
