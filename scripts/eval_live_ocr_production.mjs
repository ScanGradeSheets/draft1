#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_URL = process.env.SG_REPLAY_URL || 'https://localhost:5174';

function parseArgs() {
  const files = [];
  const opts = {
    url: DEFAULT_URL,
    modelPath: null,
    rightSlotModelPath: null,
    verbose: false
  };
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--url') {
      opts.url = process.argv[++i] || opts.url;
    } else if (arg === '--modelPath') {
      opts.modelPath = process.argv[++i] || null;
    } else if (arg === '--rightSlotModelPath') {
      opts.rightSlotModelPath = process.argv[++i] || null;
    } else if (arg === '--verbose') {
      opts.verbose = true;
    } else {
      files.push(arg);
    }
  }
  return { files, opts };
}

function appendParams(url, params) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && typeof value !== 'undefined') parsed.searchParams.set(key, value);
  }
  return parsed.toString();
}

const { files, opts } = parseArgs();
if (!files.length) {
  console.error('Usage: node scripts/eval_live_ocr_production.mjs [--url URL] [--modelPath PATH] [--rightSlotModelPath PATH] /path/to/scangrade-live-ocr-debug-*.json');
  process.exit(2);
}

const captures = [];
for (const file of files.sort()) {
  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(debug.tensors) || !Array.isArray(debug.answerKey)) continue;
  captures.push({
    file: path.basename(file),
    answerKey: debug.answerKey,
    predictions: Array.isArray(debug.predictions) ? debug.predictions.map((p) => p?.digit) : null,
    tensors: debug.tensors.map((item, index) => ({
      id: item.id || String(index + 1),
      questionNum: item.questionNum ?? null,
      digitIndex: Number.isFinite(Number(item.digitIndex)) ? Number(item.digitIndex) : null,
      tensor: item.tensor,
      tensorVariants: Array.isArray(item.tensorVariants) ? item.tensorVariants : null
    }))
  });
}

if (!captures.length) {
  console.error('No usable debug captures found.');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
const pageUrl = appendParams(opts.url, {
  liveOcrDebug: '1',
  modelPath: opts.modelPath,
  rightSlotModelPath: opts.rightSlotModelPath
});
await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction(
  () => !!window.cv && typeof window.cv.Mat !== 'undefined',
  undefined,
  { timeout: 60000 }
);

const result = await page.evaluate(async ({ captures }) => {
  const {
    initDigitModel,
    getDigitModelInfo,
    recognizeDigits,
    recognizeDigitsWithPreprocessVariants
  } = await import('/src/ocr-pipeline.js');
  await initDigitModel();

  function topGap(pred) {
    const topK = pred?.topK || [];
    return topK.length >= 2 ? (topK[0].confidence - topK[1].confidence) : 1;
  }

  async function classifyTensor(item) {
    const variants = Array.isArray(item.tensorVariants) && item.tensorVariants.length
      ? item.tensorVariants
      : [{ name: 'base', tensor: item.tensor }];
    const [production] = await recognizeDigitsWithPreprocessVariants(
      variants,
      null,
      {
        digitIndex: item.digitIndex,
        forceReviewOnDisagreement: true
      }
    );
    const variantPredictions = [];
    for (const variant of variants) {
      const [pred] = await recognizeDigits(variant.tensor || variant.data || variant);
      variantPredictions.push({
        name: variant.name || `variant-${variantPredictions.length + 1}`,
        digit: pred.digit,
        confidence: pred.confidence,
        topGap: topGap(pred),
        topK: pred.topK || []
      });
    }
    return {
      ...production,
      topGap: topGap(production),
      variantPredictions
    };
  }

  const rows = [];
  const confusion = new Map();
  const reasonCounts = new Map();
  let total = 0;
  let correct = 0;
  let review = 0;

  for (const capture of captures) {
    const preds = [];
    const misses = [];
    let captureCorrect = 0;
    let captureReview = 0;
    for (let i = 0; i < capture.tensors.length; i += 1) {
      const item = capture.tensors[i];
      const pred = await classifyTensor(item);
      const expected = capture.answerKey[i];
      const ok = pred.digit === expected;
      const reason = pred.robustOverride || pred.preprocessReviewReason || 'weighted-average';
      reasonCounts.set(reason, (reasonCounts.get(reason) || 0) + 1);
      if (pred.preprocessDisagreement) {
        review += 1;
        captureReview += 1;
      }
      total += 1;
      correct += ok ? 1 : 0;
      captureCorrect += ok ? 1 : 0;
      preds.push(pred.digit);
      if (!ok) {
        const key = `${expected}->${pred.digit}`;
        confusion.set(key, (confusion.get(key) || 0) + 1);
        const expectedWinners = pred.variantPredictions
          .filter((v) => v.digit === expected)
          .map((v) => `${v.name}@${v.confidence.toFixed(2)}`);
        const expectedTop = pred.variantPredictions
          .filter((v) => v.topK?.some((t) => t.digit === expected))
          .map((v) => {
            const hit = v.topK.find((t) => t.digit === expected);
            return `${v.name}:${(hit?.confidence || 0).toFixed(2)}`;
          });
        misses.push({
          index: i + 1,
          id: item.id,
          questionNum: item.questionNum,
          digitIndex: item.digitIndex,
          expected,
          predicted: pred.digit,
          confidence: pred.confidence,
          topGap: pred.topGap,
          reason,
          review: pred.preprocessDisagreement === true,
          topK: pred.topK || [],
          expectedWinners,
          expectedTop
        });
      }
    }
    rows.push({
      file: capture.file,
      correct: captureCorrect,
      total: capture.tensors.length,
      review: captureReview,
      predictions: preds,
      previousPredictions: capture.predictions,
      misses
    });
  }

  return {
    modelInfo: getDigitModelInfo(),
    correct,
    total,
    review,
    rows,
    confusion: Array.from(confusion.entries()).sort((a, b) => b[1] - a[1]),
    reasonCounts: Array.from(reasonCounts.entries()).sort((a, b) => b[1] - a[1])
  };
}, { captures });

await browser.close();

console.log(`Model: ${result.modelInfo?.primary?.path || 'unknown'}`);
console.log(`Score: ${result.correct}/${result.total} (${(100 * result.correct / result.total).toFixed(2)}%), review-flagged digits ${result.review}`);
console.log('Reasons:', result.reasonCounts.map(([reason, count]) => `${reason}=${count}`).join(', '));
console.log('Confusions:', result.confusion.slice(0, 12).map(([key, count]) => `${key}:${count}`).join(', '));

for (const row of result.rows) {
  console.log(`\n${row.file}: ${row.correct}/${row.total}, review=${row.review}, pred=${JSON.stringify(row.predictions)}`);
  if (!row.misses.length) continue;
  for (const miss of row.misses) {
    const top = (miss.topK || []).slice(0, 3).map((t) => `${t.digit}:${t.confidence.toFixed(2)}`).join('/');
    const oracle = miss.expectedWinners.length
      ? ` expected-wins=${miss.expectedWinners.join(',')}`
      : (miss.expectedTop.length ? ` expected-top=${miss.expectedTop.join(',')}` : '');
    console.log(
      `  #${miss.index} q=${miss.questionNum ?? '?'} digit=${miss.digitIndex ?? '?'} ${miss.expected}->${miss.predicted}` +
      ` conf=${miss.confidence.toFixed(3)} gap=${miss.topGap.toFixed(3)} reason=${miss.reason}` +
      `${miss.review ? ' review' : ''} top=${top}${oracle}`
    );
  }
}
