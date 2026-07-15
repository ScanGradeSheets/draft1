#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const outIndex = args.indexOf('--out')
const outArg = outIndex >= 0 ? args[outIndex + 1] : ''
if (outIndex >= 0) args.splice(outIndex, 2)
const roots = args.map((item) => path.resolve(ROOT, item))

function walk(root, output = []) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const resolved = path.join(root, entry.name)
    if (entry.isDirectory()) walk(resolved, output)
    else if (entry.isFile() && entry.name === 'ocr-debug.json') output.push(resolved)
  }
  return output
}

function truthMap() {
  const files = [
    'private-evidence/hybrid-v2-prospective/handwritten-truth-development.json',
    'private-evidence/hybrid-v2-prospective/handwritten-truth-p03-p09-primary.json',
    'private-evidence/hybrid-v2-prospective/handwritten-truth-p02-verified.json',
  ]
  const labels = files.flatMap((file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')).labels)
  return new Map(labels.map((row) => [`${row.packetId}|${row.layoutId}|${row.questionNum}`, row]))
}

function summarize(rows) {
  const scorable = rows.filter((row) => row.scorable)
  return {
    reviewAnswers: rows.length,
    scorableReviewAnswers: scorable.length,
    currentChoiceCorrect: scorable.filter((row) => row.currentText === row.truth).length,
    primaryChoicesContainTruth: scorable.filter((row) => row.primaryChoices.includes(row.truth)).length,
    dualChoicesContainTruth: scorable.filter((row) => row.dualChoices.includes(row.truth)).length,
    alternateAddedCorrectChoice: scorable.filter((row) => !row.primaryChoices.includes(row.truth) && row.dualChoices.includes(row.truth)).length,
    alternateAddedDistinctWrongChoice: scorable.filter((row) => row.alternateDistinct.some((text) => text !== row.truth)).length,
    alternateAddedAnyDistinctChoice: scorable.filter((row) => row.alternateDistinct.length > 0).length,
    shadowSequenceCorrect: scorable.filter((row) => row.shadowSequenceRead === row.truth).length,
    relaxedShadowChoicePolicies: Object.fromEntries([0.7, 0.8, 0.85, 0.9, 0.95, 0.98].map((threshold) => {
      const offered = scorable.filter((row) => row.shadowSequenceRead && row.shadowSequenceMinConfidence >= threshold && row.shadowSequenceConsensusFraction >= (2 / 3))
      return [String(threshold), {
        offered: offered.length,
        correct: offered.filter((row) => row.shadowSequenceRead === row.truth).length,
        wrong: offered.filter((row) => row.shadowSequenceRead !== row.truth).length,
      }]
    })),
  }
}

function main() {
  if (!roots.length) throw new Error('provide one or more replay roots')
  const truth = truthMap()
  const rows = []
  let alternateItems = 0
  let alternateFramesProcessed = 0
  for (const root of roots) {
    for (const file of walk(root)) {
      const debug = JSON.parse(fs.readFileSync(file, 'utf8'))
      const packetId = debug.packetId || path.relative(root, file).split(path.sep)[0]
      const predictionById = new Map((debug.predictions || []).map((row) => [row.id, row]))
      alternateItems += Number(debug.v3Shadow?.alternateCropReview?.itemCount || 0)
      alternateFramesProcessed += (debug.v3Shadow?.alternateCropReview?.frames || []).filter((frame) => frame.processed).length
      for (const [index, isReview] of (debug.questionReview || []).entries()) {
        if (!isReview) continue
        const group = (debug.answerGroups || []).find((item) => Number(item.questionNum) === index + 1)
        if (!group) continue
        const label = truth.get(`${packetId}|${debug.layoutId}|${index + 1}`)
        if (!label) continue
        const firstPrediction = predictionById.get(group.digitBoxIds?.[0])
        const shadow = (debug.v3Shadow?.decisions || []).find((item) => Number(item.questionNum) === index + 1)
        const suggestions = firstPrediction?.wholeAnswerReviewSuggestions || (firstPrediction?.wholeAnswerReviewSuggestion ? [firstPrediction.wholeAnswerReviewSuggestion] : [])
        const primary = [...new Set(suggestions.filter((item) => !item.cropVariant).map((item) => item.text))]
        const alternate = [...new Set(suggestions.filter((item) => !!item.cropVariant).map((item) => item.text))]
        const currentText = String(group.answerText || '')
        const primaryChoices = [...new Set([currentText, ...primary].filter(Boolean))]
        const alternateDistinct = alternate.filter((text) => !primaryChoices.includes(text))
        rows.push({
          packetId, layoutId: debug.layoutId, questionNum: index + 1,
          truthState: label.truthState, truth: label.handwrittenTruth,
          scorable: label.truthState === 'value', currentText,
          primarySuggestions: primary, alternateSuggestions: alternate,
          primaryChoices, alternateDistinct,
          dualChoices: [...primaryChoices, ...alternateDistinct].slice(0, 3),
          shadowSequenceRead: shadow?.sequenceRead || '',
          shadowSequenceMinConfidence: Number(shadow?.sequenceFrameConsensus?.minConfidence || 0),
          shadowSequenceConsensusFraction: Number(shadow?.sequenceFrameConsensus?.fraction || 0),
          evidenceFile: path.relative(ROOT, file),
        })
      }
    }
  }
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    answerKeyUsedAsTruth: false,
    roots: roots.map((root) => path.relative(ROOT, root)),
    runtimeWork: { alternateItems, alternateFramesProcessed },
    overall: summarize(rows),
    byPacket: Object.fromEntries([...new Set(rows.map((row) => row.packetId))].map((packet) => [packet, summarize(rows.filter((row) => row.packetId === packet))])),
    rows,
  }
  const destination = path.resolve(ROOT, outArg || 'private-evidence/reports/v3-dual-crop-review-choice-evaluation-20260714.json')
  fs.writeFileSync(destination, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ destination: path.relative(ROOT, destination), runtimeWork: report.runtimeWork, overall: report.overall, byPacket: report.byPacket }, null, 2))
}

main()
