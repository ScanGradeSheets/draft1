#!/usr/bin/env node

// Tests whether the key-blind whole-answer model is safe enough to promote
// yellow answers automatically, or only useful as an additional review choice.

import fs from 'node:fs';
import path from 'node:path';

const modelPath = process.argv[2] || 'private-evidence/reports/trocr-lora-calibrated-2epoch-20260709.json';
const replayDir = process.argv[3] || 'private-evidence/reports/exhaustive-baseline-20260713';
const output = process.argv[4] || 'private-evidence/reports/whole-answer-promotion-safety-20260713.json';
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
const replayByKey = new Map();
for (const name of fs.readdirSync(replayDir).filter((value) => value.endsWith('-replay-result.json'))) {
  const replay = JSON.parse(fs.readFileSync(path.join(replayDir, name), 'utf8'));
  for (const group of replay.groups || []) replayByKey.set(`${replay.file}::${group.label}`, group);
}

const normalize = (value) => String(value ?? '').replace(/\D/g, '');
const rows = [...(model.validationRows || []), ...(model.holdoutRows || [])]
  .filter((row) => row.appReview === true)
  .map((row) => {
    const replay = replayByKey.get(`${row.captureId}::${row.questionLabel}`);
    const truth = normalize(row.handwrittenTruth);
    const current = normalize(row.appPrediction);
    const modelRead = normalize(row.modelRead);
    const suggestion = normalize(replay?.reviewSuggestion?.text);
    return {
      split: Number(row.pageIndex) >= 70 ? 'holdout' : 'validation',
      family: String(row.layoutId || '').match(/sg-g1-lw-0[1-5]-/) ? 'row' : 'non-row',
      answerLength: truth.length,
      truth,
      current,
      modelRead,
      suggestion,
      minTokenProbability: Number(row.minTokenProbability || 0),
    };
  });

function summary(selected) {
  const correct = selected.filter((row) => row.selectedRead === row.truth).length;
  return {
    total: selected.length,
    correct,
    wrong: selected.length - correct,
    accuracyPct: selected.length ? +(100 * correct / selected.length).toFixed(1) : null,
  };
}

function evaluate(items, threshold, policy) {
  let selected;
  if (policy === 'modelAlone') {
    selected = items.filter((row) => row.modelRead && row.minTokenProbability >= threshold)
      .map((row) => ({ ...row, selectedRead: row.modelRead }));
  } else if (policy === 'modelAgreesCurrent') {
    selected = items.filter((row) => row.modelRead && row.modelRead === row.current && row.minTokenProbability >= threshold)
      .map((row) => ({ ...row, selectedRead: row.modelRead }));
  } else {
    selected = items.filter((row) => row.modelRead && row.suggestion && row.modelRead === row.suggestion && row.minTokenProbability >= threshold)
      .map((row) => ({ ...row, selectedRead: row.modelRead }));
  }
  return summary(selected);
}

const thresholds = [0, 0.8, 0.9, 0.95, 0.98, 0.99, 0.995, 0.999];
const policies = ['modelAlone', 'modelAgreesCurrent', 'modelAgreesBuiltInSuggestion'];
const report = {
  generatedAt: new Date().toISOString(),
  method: 'Key-blind retrospective promotion-safety analysis on packet-blocked validation and holdout rows.',
  warning: 'Validation packets participated in model selection. Holdout is the decision signal, but is still small and lacks durable student IDs.',
  yellowRows: rows.length,
  results: {},
};
for (const policy of policies) {
  report.results[policy] = thresholds.map((threshold) => ({
    threshold,
    overall: evaluate(rows, threshold, policy),
    validation: evaluate(rows.filter((row) => row.split === 'validation'), threshold, policy),
    holdout: evaluate(rows.filter((row) => row.split === 'holdout'), threshold, policy),
    row: evaluate(rows.filter((row) => row.family === 'row'), threshold, policy),
    nonRow: evaluate(rows.filter((row) => row.family === 'non-row'), threshold, policy),
    oneDigit: evaluate(rows.filter((row) => row.answerLength === 1), threshold, policy),
    multiDigit: evaluate(rows.filter((row) => row.answerLength > 1), threshold, policy),
  }));
}

fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.results, null, 2));
console.log(output);
