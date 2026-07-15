#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const truthPath = args.shift();
if (!truthPath || !args.length) {
  console.error('Usage: node scripts/eval_independent_context_suggestions.mjs <truth.json> <replay-dir>...');
  process.exit(1);
}

const truth = JSON.parse(fs.readFileSync(truthPath, 'utf8'));
const truthByKey = new Map((truth.entries || []).map((entry) => [
  `${entry.captureId}::${entry.questionNum}`,
  entry
]));

function answerText(cells) {
  const raw = cells.map((cell) => cell == null ? '_' : String(cell)).join('');
  const trimmed = raw.replace(/^_+/, '');
  return trimmed || (raw.includes('_') ? 'blank' : raw);
}

function splitForPage(pageIndex) {
  if (pageIndex < 50) return 'development';
  if (pageIndex < 68) return 'validation';
  return 'holdout';
}

const samples = [];
for (const replayDir of args) {
  for (const name of fs.readdirSync(replayDir).filter((item) => item.endsWith('-replay-result.json'))) {
    const replay = JSON.parse(fs.readFileSync(path.join(replayDir, name), 'utf8'));
    for (const group of replay.groups || []) {
      if (group.review !== true) continue;
      const questionNum = Number(group.label);
      const truthEntry = truthByKey.get(`${replay.file}::${questionNum}`);
      if (!truthEntry) continue;
      const predictions = (replay.predictionDetails || [])
        .filter((item) => Number(item.questionNum) === questionNum)
        .sort((a, b) => Number(a.digitIndex) - Number(b.digitIndex));
      if (!predictions.length || predictions.every((item) => !(item.reviewSuggestionVariants || []).length)) continue;
      samples.push({ replay, group, predictions, truth: truthEntry });
    }
  }
}

const strategies = [];
for (const threshold of [0, 0.4, 0.6, 0.75, 0.9]) {
  strategies.push({ name: `agreement-${threshold}`, threshold, mode: 'agreement' });
  strategies.push({ name: `context-raw-${threshold}`, threshold, mode: 'context-raw-slot' });
  strategies.push({ name: `context-safe-${threshold}`, threshold, mode: 'context-safe-slot' });
}

function proposedDigit(prediction, strategy) {
  const current = prediction.digit ?? null;
  const variants = prediction.reviewSuggestionVariants || [];
  if (strategy.mode === 'agreement') {
    const safe = variants.find((item) => item.name === 'context-safe-slot');
    const raw = variants.find((item) => item.name === 'context-raw-slot');
    if (!safe || !raw || safe.digit !== raw.digit) return current;
    if (Math.min(Number(safe.confidence) || 0, Number(raw.confidence) || 0) < strategy.threshold) return current;
    return safe.digit;
  }
  const variant = variants.find((item) => item.name === strategy.mode);
  if (!variant || (Number(variant.confidence) || 0) < strategy.threshold) return current;
  return variant.digit;
}

function summarize(rows) {
  const result = { offered: rows.length, correct: 0, wrong: 0, mathWrongOffered: 0, mathWrongCorrect: 0 };
  for (const row of rows) {
    const correct = row.candidate === String(row.truth.truth);
    result.correct += Number(correct);
    result.wrong += Number(!correct);
    const mathWrong = String(row.truth.truth) !== String(row.truth.expected);
    result.mathWrongOffered += Number(mathWrong);
    result.mathWrongCorrect += Number(mathWrong && correct);
  }
  result.accuracyPct = result.offered ? Number((100 * result.correct / result.offered).toFixed(1)) : 0;
  return result;
}

const results = [];
for (const strategy of strategies) {
  const rows = [];
  for (const sample of samples) {
    const current = answerText(sample.predictions.map((item) => item.digit ?? null));
    const candidate = answerText(sample.predictions.map((item) => proposedDigit(item, strategy)));
    if (candidate === current) continue;
    rows.push({
      captureId: sample.replay.file,
      questionNum: sample.truth.questionNum,
      layoutId: sample.truth.layoutId,
      current,
      candidate,
      truth: sample.truth,
      split: splitForPage(Number(sample.truth.pageIndex))
    });
  }
  results.push({
    strategy: strategy.name,
    overall: summarize(rows),
    development: summarize(rows.filter((row) => row.split === 'development')),
    validation: summarize(rows.filter((row) => row.split === 'validation')),
    holdout: summarize(rows.filter((row) => row.split === 'holdout')),
    examples: rows
  });
}

console.log(JSON.stringify({ sampleCount: samples.length, results }, null, 2));
