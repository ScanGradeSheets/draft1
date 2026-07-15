#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const rawArgs = process.argv.slice(2);
const outIndex = rawArgs.indexOf('--out');
const outPath = outIndex >= 0 ? rawArgs[outIndex + 1] : null;
if (outIndex >= 0) rawArgs.splice(outIndex, 2);
const [truthPath, modelReportPath, ...replayDirs] = rawArgs;
if (!truthPath || !modelReportPath || replayDirs.length === 0) {
  console.error('Usage: node scripts/simulate_review_lane_ab.mjs <truth.json> <trocr-report.json> <baseline-replay-dir>...');
  process.exit(1);
}

const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
const modelReport = JSON.parse(fs.readFileSync(modelReportPath, 'utf8'));
const MODEL_MIN_TOKEN_PROBABILITY = 0.98;
const truthByKey = new Map((truth.entries || []).map((entry) => [
  `${entry.captureId}::${entry.questionLabel}`,
  entry
]));

const replayGroupByKey = new Map();
for (const dir of replayDirs) {
  for (const name of fs.readdirSync(dir).filter((item) => item.endsWith('-replay-result.json'))) {
    const replay = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
    for (const group of replay.groups || []) {
      replayGroupByKey.set(`${replay.file}::${group.label}`, group);
    }
  }
}

function normalize(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function wilson(successes, total, z = 1.96) {
  if (!total) return [0, 0];
  const p = successes / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)].map((value) => Number((100 * value).toFixed(1)));
}

const rows = [...(modelReport.validationRows || []), ...(modelReport.holdoutRows || [])]
  .filter((row) => row.appReview === true)
  .map((row) => {
    const key = `${row.captureId}::${row.questionLabel}`;
    const truthEntry = truthByKey.get(key);
    const replayGroup = replayGroupByKey.get(key);
    const handwrittenTruth = normalize(row.handwrittenTruth);
    const current = normalize(row.appPrediction);
    const modelRead = normalize(row.modelRead);
    const controlSuggestion = normalize(replayGroup?.reviewSuggestion?.text);
    const modelEligible =
      Number(row.minTokenProbability) >= MODEL_MIN_TOKEN_PROBABILITY &&
      !!modelRead &&
      modelRead !== current;
    const currentCorrect = current === handwrittenTruth;
    const controlSuggestionCorrect = !!controlSuggestion && controlSuggestion === handwrittenTruth;
    const modelCorrect = modelRead === handwrittenTruth;
    const controlCandidateCorrect = currentCorrect || controlSuggestionCorrect;
    // The treatment preserves every control choice and adds the model as one
    // more distinct option, so it cannot remove a previously correct choice.
    const treatmentCandidateCorrect = controlCandidateCorrect || (modelEligible && modelCorrect);
    return {
      captureId: row.captureId,
      pageIndex: Number(row.pageIndex),
      split: Number(row.pageIndex) >= 70 ? 'holdout' : 'validation',
      layoutId: row.layoutId,
      questionLabel: row.questionLabel,
      handwrittenTruth,
      answerKey: normalize(row.answerKey),
      current,
      controlSuggestion: controlSuggestion || null,
      modelRead,
      minTokenProbability: Number(row.minTokenProbability),
      modelEligible,
      currentCorrect,
      controlSuggestionCorrect,
      modelCorrect,
      controlCandidateCorrect,
      treatmentCandidateCorrect,
      mathWrong: normalize(row.answerKey) !== handwrittenTruth,
      truthStatus: truthEntry?.truthStatus || row.truthStatus || null
    };
  });

function summarize(items) {
  const total = items.length;
  const count = (predicate) => items.filter(predicate).length;
  const currentCorrect = count((row) => row.currentCorrect);
  const controlCandidateCorrect = count((row) => row.controlCandidateCorrect);
  const treatmentCandidateCorrect = count((row) => row.treatmentCandidateCorrect);
  const modelEligible = count((row) => row.modelEligible);
  const modelUseful = count((row) => row.modelEligible && row.modelCorrect && !row.currentCorrect);
  const modelWrongCurrentCorrect = count((row) => row.modelEligible && !row.modelCorrect && row.currentCorrect);
  const mathWrongRows = items.filter((row) => row.mathWrong);
  return {
    packets: new Set(items.map((row) => row.pageIndex)).size,
    yellowAnswers: total,
    currentCorrect,
    currentCorrectPct: total ? Number((100 * currentCorrect / total).toFixed(1)) : 0,
    controlCorrectChoiceAvailable: controlCandidateCorrect,
    controlCorrectChoicePct: total ? Number((100 * controlCandidateCorrect / total).toFixed(1)) : 0,
    controlCorrectChoice95PctCI: wilson(controlCandidateCorrect, total),
    treatmentCorrectChoiceAvailable: treatmentCandidateCorrect,
    treatmentCorrectChoicePct: total ? Number((100 * treatmentCandidateCorrect / total).toFixed(1)) : 0,
    treatmentCorrectChoice95PctCI: wilson(treatmentCandidateCorrect, total),
    pairedNetGain: treatmentCandidateCorrect - controlCandidateCorrect,
    modelEligible,
    modelUseful,
    modelWrongCurrentCorrect,
    mathWrong: {
      total: mathWrongRows.length,
      currentCorrect: mathWrongRows.filter((row) => row.currentCorrect).length,
      controlCorrectChoiceAvailable: mathWrongRows.filter((row) => row.controlCandidateCorrect).length,
      treatmentCorrectChoiceAvailable: mathWrongRows.filter((row) => row.treatmentCandidateCorrect).length,
      modelEligible: mathWrongRows.filter((row) => row.modelEligible).length,
      modelUseful: mathWrongRows.filter((row) => row.modelEligible && row.modelCorrect && !row.currentCorrect).length,
      modelWrongCurrentCorrect: mathWrongRows.filter((row) => row.modelEligible && !row.modelCorrect && row.currentCorrect).length
    }
  };
}

const report = {
  generatedAt: new Date().toISOString(),
  method: 'Retrospective packet-blocked candidate-availability simulation; not a human timing study.',
  modelEligibility: `Key-blind model differs from current OCR and minTokenProbability >= ${MODEL_MIN_TOKEN_PROBABILITY}.`,
  validationWarning: 'The 20 validation packets participated in model/epoch selection; use only for workflow development.',
  overall: summarize(rows),
  validation20Packets: summarize(rows.filter((row) => row.split === 'validation')),
  untouchedHoldoutPacketBlock: summarize(rows.filter((row) => row.split === 'holdout')),
  pairedChanges: {
    gains: rows.filter((row) => row.treatmentCandidateCorrect && !row.controlCandidateCorrect),
    losses: rows.filter((row) => !row.treatmentCandidateCorrect && row.controlCandidateCorrect)
  },
  rows
};

const rendered = `${JSON.stringify(report, null, 2)}\n`;
if (outPath) fs.writeFileSync(outPath, rendered);
console.log(rendered);
