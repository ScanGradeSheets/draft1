#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_URL = process.env.SG_REPLAY_URL || 'https://localhost:5174';
const DEFAULT_MODELS = [
  'models/worksheet-digit-tony-generalist-aug-strong-noaug-touch-20260601.onnx',
  'models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx',
  'models/worksheet-digit-tony-generalist-extra-20260601.onnx',
  'models/worksheet-digit-tony-generalist-noaug-20260601.onnx',
  'models/worksheet-digit-generalist.onnx',
  'models/worksheet-digit-tony-generalist-20260601.onnx',
  'models/worksheet-digit-tony-generalist-noaug-lite-20260601.onnx',
  'models/worksheet-digit-generalist-final.onnx',
  'models/worksheet-digit-wide-cnn-local-rerun.onnx',
  'models/worksheet-digit-cnn-local-rerun.onnx'
];

function parseArgs() {
  const files = [];
  const models = [];
  let url = DEFAULT_URL;
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--url') url = process.argv[++i] || url;
    else if (arg === '--model') models.push(process.argv[++i]);
    else files.push(arg);
  }
  return { files, url, models: models.length ? models : DEFAULT_MODELS };
}

function appendParams(url, params) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && typeof value !== 'undefined') parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

const { files, url, models } = parseArgs();
if (!files.length) {
  console.error('Usage: node scripts/eval_live_ocr_models.mjs [--url URL] [--model PATH] /path/to/scangrade-live-ocr-debug-*.json');
  process.exit(2);
}

const captures = [];
for (const file of files.sort()) {
  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(debug.tensors) || !Array.isArray(debug.answerKey)) continue;
  captures.push({
    file: path.basename(file),
    answerKey: debug.answerKey,
    tensors: debug.tensors.map((item, index) => ({
      id: item.id || String(index + 1),
      questionNum: item.questionNum ?? null,
      digitIndex: Number.isFinite(Number(item.digitIndex)) ? Number(item.digitIndex) : null,
      tensor: item.tensor,
      tensorVariants: Array.isArray(item.tensorVariants) ? item.tensorVariants : null
    }))
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const all = [];

for (const modelPath of models) {
  const page = await context.newPage();
  await page.goto(appendParams(url, {
    liveOcrDebug: '1',
    modelPath
  }), { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(
    () => !!window.cv && typeof window.cv.Mat !== 'undefined',
    undefined,
    { timeout: 60000 }
  );

  const result = await page.evaluate(async ({ captures }) => {
    const { initDigitModel, recognizeDigitsWithPreprocessVariants } = await import('/src/ocr-pipeline.js');
    await initDigitModel();
    let correct = 0;
    let total = 0;
    const rows = [];
    const confusion = new Map();
    for (const capture of captures) {
      let rowCorrect = 0;
      const predictions = [];
      for (let i = 0; i < capture.tensors.length; i += 1) {
        const item = capture.tensors[i];
        const variants = Array.isArray(item.tensorVariants) && item.tensorVariants.length
          ? item.tensorVariants
          : [{ name: 'base', tensor: item.tensor }];
        const [pred] = await recognizeDigitsWithPreprocessVariants(
          variants,
          null,
          { digitIndex: item.digitIndex, forceReviewOnDisagreement: true }
        );
        predictions.push(pred.digit);
        const expected = capture.answerKey[i];
        const ok = pred.digit === expected;
        correct += Number(ok);
        rowCorrect += Number(ok);
        total += 1;
        if (!ok) {
          const key = `${expected}->${pred.digit}`;
          confusion.set(key, (confusion.get(key) || 0) + 1);
        }
      }
      rows.push({ file: capture.file, correct: rowCorrect, total: capture.tensors.length, predictions });
    }
    return {
      correct,
      total,
      rows,
      confusion: Array.from(confusion.entries()).sort((a, b) => b[1] - a[1])
    };
  }, { captures });
  await page.close();
  all.push({ modelPath, ...result });
}

await browser.close();

all.sort((a, b) => b.correct - a.correct);
for (const result of all) {
  console.log(`\n${result.modelPath}: ${result.correct}/${result.total} (${(100 * result.correct / result.total).toFixed(2)}%)`);
  console.log(`  confusions=${result.confusion.slice(0, 10).map(([k, v]) => `${k}:${v}`).join(', ')}`);
  console.log(`  rows=${result.rows.map((row) => `${row.correct}/${row.total}`).join(' ')}`);
}
