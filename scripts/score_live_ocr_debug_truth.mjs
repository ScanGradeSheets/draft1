#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_TRUTH_PATH = 'docs/SG3_IPHONE_LIVE_OCR_SCORECARD.json';

function parseArgs() {
  const files = [];
  const opts = { truth: DEFAULT_TRUTH_PATH };
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--truth') {
      opts.truth = process.argv[++i] || opts.truth;
    } else {
      files.push(arg);
    }
  }
  return { files, opts };
}

function debugIdFromFile(file, json) {
  const candidates = [
    path.basename(file),
    typeof json?.file === 'string' ? json.file : ''
  ];
  for (const candidate of candidates) {
    const match = candidate.match(/scangrade-live-ocr-debug-(\d+)/);
    if (match) return match[1];
  }
  return path.basename(file, '.json');
}

function truthDigits(value) {
  if (value == null) return [];
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) return [];
  return text.split('').map((digit) => Number(digit));
}

function predictionList(json) {
  if (Array.isArray(json?.predictionDetails)) return json.predictionDetails;
  if (Array.isArray(json?.predictions) && typeof json.predictions[0] === 'object') return json.predictions;
  return [];
}

function predictionsByQuestion(predictions) {
  const byQuestion = new Map();
  predictions.forEach((prediction, index) => {
    const questionNum = Number.isFinite(Number(prediction?.questionNum))
      ? Number(prediction.questionNum)
      : Math.floor(index / 2) + 1;
    const digitIndex = Number.isFinite(Number(prediction?.digitIndex))
      ? Number(prediction.digitIndex)
      : index % 2;
    if (!byQuestion.has(questionNum)) byQuestion.set(questionNum, []);
    byQuestion.get(questionNum).push({ ...prediction, digitIndex });
  });
  for (const items of byQuestion.values()) {
    items.sort((a, b) => Number(a.digitIndex) - Number(b.digitIndex));
  }
  return byQuestion;
}

function scoreFile(file, json, truthAnswers) {
  const predictions = predictionList(json);
  const byQuestion = predictionsByQuestion(predictions);
  const misses = [];
  const reviewRows = [];
  let answerCorrect = 0;
  let confidentAnswers = 0;
  let confidentCorrect = 0;
  let confidentWrong = 0;
  let digitCorrect = 0;
  let digitTotal = 0;
  let confidentDigitWrong = 0;

  for (let q = 1; q <= truthAnswers.length; q += 1) {
    const truth = truthDigits(truthAnswers[q - 1]);
    const preds = byQuestion.get(q) || [];
    const predDigits = preds.slice(0, truth.length).map((prediction) => Number(prediction?.digit));
    const answerOk = truth.length > 0 && predDigits.length === truth.length &&
      truth.every((digit, index) => digit === predDigits[index]);
    const review = preds.some((prediction) => prediction?.reviewNeeded === true || prediction?.review === true);
    const expectedText = truth.join('');
    const predictedText = predDigits.map((digit) => Number.isFinite(digit) ? String(digit) : '_').join('');

    if (answerOk) answerCorrect += 1;
    if (!review) {
      confidentAnswers += 1;
      if (answerOk) confidentCorrect += 1;
      else confidentWrong += 1;
    } else {
      reviewRows.push(`#${q}:${predictedText}/${expectedText}`);
    }
    if (!answerOk) misses.push(`#${q}:${predictedText}->${expectedText}${review ? '?' : '!'}`);

    for (let i = 0; i < truth.length; i += 1) {
      const pred = preds[i];
      const predDigit = Number(pred?.digit);
      const digitOk = predDigit === truth[i];
      digitTotal += 1;
      if (digitOk) digitCorrect += 1;
      if (!digitOk && !(pred?.reviewNeeded === true || pred?.review === true)) {
        confidentDigitWrong += 1;
      }
    }
  }

  return {
    file: path.basename(file),
    answerCorrect,
    answerTotal: truthAnswers.length,
    confidentAnswers,
    confidentCorrect,
    confidentWrong,
    reviewAnswers: truthAnswers.length - confidentAnswers,
    digitCorrect,
    digitTotal,
    confidentDigitWrong,
    misses,
    reviewRows
  };
}

const { files, opts } = parseArgs();
if (!files.length) {
  console.error(`Usage: node scripts/score_live_ocr_debug_truth.mjs [--truth ${DEFAULT_TRUTH_PATH}] /path/to/*debug*.json`);
  process.exit(2);
}

const truthDoc = JSON.parse(await fs.readFile(opts.truth, 'utf8'));
const truthById = truthDoc.truth_by_debug_id || truthDoc.truthByDebugId || {};
const rows = [];
for (const file of files.sort()) {
  const json = JSON.parse(await fs.readFile(file, 'utf8'));
  const id = debugIdFromFile(file, json);
  const truth = truthById[id];
  if (!Array.isArray(truth)) {
    console.error(`No handwritten truth for ${path.basename(file)} (${id}).`);
    process.exit(2);
  }
  rows.push(scoreFile(file, json, truth));
}

const totals = rows.reduce((acc, row) => {
  acc.answerCorrect += row.answerCorrect;
  acc.answerTotal += row.answerTotal;
  acc.confidentAnswers += row.confidentAnswers;
  acc.confidentCorrect += row.confidentCorrect;
  acc.confidentWrong += row.confidentWrong;
  acc.reviewAnswers += row.reviewAnswers;
  acc.digitCorrect += row.digitCorrect;
  acc.digitTotal += row.digitTotal;
  acc.confidentDigitWrong += row.confidentDigitWrong;
  return acc;
}, {
  answerCorrect: 0,
  answerTotal: 0,
  confidentAnswers: 0,
  confidentCorrect: 0,
  confidentWrong: 0,
  reviewAnswers: 0,
  digitCorrect: 0,
  digitTotal: 0,
  confidentDigitWrong: 0
});

for (const row of rows) {
  console.log(
    `${row.file}: answer=${row.answerCorrect}/${row.answerTotal}` +
    ` confident=${row.confidentAnswers}/${row.answerTotal}` +
    ` confident_ok=${row.confidentCorrect}/${row.confidentAnswers}` +
    ` confident_wrong=${row.confidentWrong}` +
    ` digit=${row.digitCorrect}/${row.digitTotal}` +
    ` conf_digit_wrong=${row.confidentDigitWrong}`
  );
  if (row.misses.length) console.log(`  misses ${row.misses.join(' ')}`);
  if (row.reviewRows.length) console.log(`  review ${row.reviewRows.join(' ')}`);
}

console.log('');
console.log(`Answer OCR truth: ${totals.answerCorrect}/${totals.answerTotal}`);
console.log(`Confident answers: ${totals.confidentAnswers}/${totals.answerTotal}`);
console.log(`Confident answer accuracy: ${totals.confidentCorrect}/${totals.confidentAnswers}`);
console.log(`Confident wrong answers: ${totals.confidentWrong}`);
console.log(`Review answers: ${totals.reviewAnswers}`);
console.log(`Digit OCR truth: ${totals.digitCorrect}/${totals.digitTotal}`);
console.log(`Confident digit wrong: ${totals.confidentDigitWrong}`);
