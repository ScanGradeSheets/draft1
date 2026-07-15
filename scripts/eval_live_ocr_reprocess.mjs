#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_URL = process.env.SG_REPLAY_URL || 'https://localhost:5174';

function parseArgs() {
  const files = [];
  const opts = { url: DEFAULT_URL, modelPath: null, rightSlotModelPath: null, target: 'answerKey', dumpItems: null, grid: false };
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--url') opts.url = process.argv[++i] || opts.url;
    else if (arg === '--modelPath') opts.modelPath = process.argv[++i] || null;
    else if (arg === '--rightSlotModelPath') opts.rightSlotModelPath = process.argv[++i] || null;
    else if (arg === '--target') opts.target = process.argv[++i] || opts.target;
    else if (arg === '--dumpItems') opts.dumpItems = process.argv[++i] || null;
    else if (arg === '--grid') opts.grid = true;
    else files.push(arg);
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
  console.error('Usage: node scripts/eval_live_ocr_reprocess.mjs [--url URL] /path/to/scangrade-live-ocr-debug-*.json');
  process.exit(2);
}

const captures = [];
for (const file of files.sort()) {
  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!debug.capturedImageDataUrl || !Array.isArray(debug.answerKey) || !debug.layoutUrl) continue;
  captures.push({
    file: path.basename(file),
    capturedImageDataUrl: debug.capturedImageDataUrl,
    layoutUrl: debug.layoutUrl,
    answerKey: debug.answerKey,
    savedPredictions: Array.isArray(debug.predictions) ? debug.predictions.map((p) => p?.digit) : null,
    savedPredictionMeta: Array.isArray(debug.predictions) ? debug.predictions.map((p) => ({
      manualCorrected: Boolean(p?.manualCorrected || p?.originalDigit !== undefined),
      originalDigit: p?.originalDigit
    })) : null
  });
}

if (!captures.length) {
  console.error('No usable captures found.');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
await page.goto(appendParams(opts.url, {
  liveOcrDebug: '1',
  modelPath: opts.modelPath,
  rightSlotModelPath: opts.rightSlotModelPath
}), { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction(
  () => !!window.cv && typeof window.cv.Mat !== 'undefined',
  undefined,
  { timeout: 60000 }
);

const result = await page.evaluate(async ({ captures, target, grid }) => {
  const { processWorksheet } = await import('/src/homography.js');
  const { initDigitModel, recognizeDigits, recognizeDigitsWithPreprocessVariants } = await import('/src/ocr-pipeline.js');
  await initDigitModel();

  function rankProbs(probs) {
    return Array.from(probs || [])
      .map((confidence, digit) => ({ digit, confidence }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  function avgProbs(preds, weights = null) {
    const out = new Float32Array(10);
    let totalWeight = 0;
    for (const pred of preds) {
      const weight = weights?.[pred.name] ?? 1;
      if (weight <= 0) continue;
      const probs = pred.probs || [];
      for (let digit = 0; digit < 10; digit += 1) out[digit] += (probs[digit] || 0) * weight;
      totalWeight += weight;
    }
    if (!totalWeight) return out;
    for (let digit = 0; digit < 10; digit += 1) out[digit] /= totalWeight;
    return out;
  }

  function voteDigit(preds, weights = null) {
    const votes = new Map();
    for (const pred of preds) {
      const weight = weights?.[pred.name] ?? 1;
      const gap = pred.topK?.length >= 2 ? pred.topK[0].confidence - pred.topK[1].confidence : 1;
      const score = weight * (0.4 + Math.max(0, pred.confidence || 0)) * (0.55 + Math.max(0, gap));
      votes.set(pred.digit, (votes.get(pred.digit) || 0) + score);
    }
    return Array.from(votes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  }

  async function imageDataUrlToCanvas(dataUrl) {
    const img = new Image();
    img.decoding = 'async';
    img.src = dataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  const rows = [];
  let correct = 0;
  let total = 0;
  let failed = 0;
  const items = [];

  for (const capture of captures) {
    let layoutResponse = await fetch(capture.layoutUrl);
    if (!layoutResponse.ok || !(layoutResponse.headers.get('content-type') || '').includes('json')) {
      const fallbackUrl = capture.layoutUrl.replace(/^\/draft1\/layouts\//, '/layouts/');
      layoutResponse = await fetch(fallbackUrl);
    }
    const layout = await layoutResponse.json();
    const canvas = await imageDataUrlToCanvas(capture.capturedImageDataUrl);
    const processed = processWorksheet(canvas, layout);
    if (!processed?.processedTensors?.length) {
      failed += 1;
      rows.push({ file: capture.file, failed: true, correct: 0, total: capture.answerKey.length, predictions: [] });
      continue;
    }
    const predictions = [];
    let rowCorrect = 0;
    const misses = [];
    for (let i = 0; i < processed.processedTensors.length; i += 1) {
      const proc = processed.processedTensors[i];
      const [pred] = await recognizeDigitsWithPreprocessVariants(
        proc.tensorVariants,
        null,
        { digitIndex: proc.digitIndex, forceReviewOnDisagreement: true }
      );
      const expected = target === 'savedPredictions' && Array.isArray(capture.savedPredictions)
        ? capture.savedPredictions[i]
        : capture.answerKey[i];
      const ok = pred.digit === expected;
      predictions.push(pred.digit);
      correct += Number(ok);
      rowCorrect += Number(ok);
      total += 1;
      if (!ok) {
        misses.push({
          index: i + 1,
          questionNum: proc.questionNum,
          digitIndex: proc.digitIndex,
          expected,
          predicted: pred.digit,
          reason: pred.robustOverride || pred.preprocessReviewReason || 'weighted-average',
          confidence: pred.confidence
        });
      }
      if (grid) {
        const variantPreds = [];
        const variants = Array.isArray(proc.tensorVariants) && proc.tensorVariants.length
          ? proc.tensorVariants
          : [{ name: 'base', tensor: proc.tensor }];
        for (const variant of variants) {
          const [variantPred] = await recognizeDigits(variant.tensor || variant.data || variant);
          variantPreds.push({
            name: variant.name || `variant-${variantPreds.length + 1}`,
            digit: variantPred.digit,
            confidence: variantPred.confidence,
            topK: variantPred.topK || [],
            probs: variantPred.probs || []
          });
        }
        items.push({
          file: capture.file,
          index: i + 1,
          questionNum: proc.questionNum,
          digitIndex: proc.digitIndex,
          expected,
          manualCorrected: Array.isArray(capture.savedPredictionMeta)
            ? Boolean(capture.savedPredictionMeta[i]?.manualCorrected)
            : false,
          originalDigit: Array.isArray(capture.savedPredictionMeta)
            ? capture.savedPredictionMeta[i]?.originalDigit
            : undefined,
          production: pred.digit,
          productionReason: pred.robustOverride || pred.preprocessReviewReason || 'weighted-average',
          productionReview: pred.preprocessDisagreement === true,
          productionTopK: pred.topK || [],
          productionVariants: pred.preprocessVariants || [],
          variantPreds
        });
      }
    }
    processed.warpedImage?.delete?.();
    for (const crop of processed.rawCrops || []) crop.image?.delete?.();
    rows.push({ file: capture.file, failed: false, correct: rowCorrect, total: processed.processedTensors.length, predictions, misses });
  }

  if (!grid) return { correct, total, failed, rows };

  const variantNames = Array.from(new Set(items.flatMap((item) => item.variantPreds.map((pred) => pred.name))));
  const policies = [];
  function scorePolicy(name, choose) {
    let policyCorrect = 0;
    let nonManualCorrect = 0;
    let nonManualTotal = 0;
    const policyMisses = [];
    for (const item of items) {
      const predicted = choose(item);
      const ok = predicted === item.expected;
      if (ok) policyCorrect += 1;
      if (!item.manualCorrected) {
        nonManualTotal += 1;
        if (ok) nonManualCorrect += 1;
      }
      if (!ok) policyMisses.push({ ...item, predicted });
    }
    policies.push({ name, correct: policyCorrect, total: items.length, nonManualCorrect, nonManualTotal, misses: policyMisses });
  }

  scorePolicy('production', (item) => item.production);
  for (const name of variantNames) {
    scorePolicy(`variant:${name}`, (item) => item.variantPreds.find((pred) => pred.name === name)?.digit ?? item.production);
  }

  const groups = [
    ['gentle', 'center-safe-slot', 'expected-slot', 'edge-band-slot', 'boxless-slot', 'wide-slot', 'no-side-erase'],
    ['center-safe-slot', 'edge-band-slot', 'boxless-slot'],
    ['center-safe-slot', 'boxless-slot'],
    ['edge-band-slot', 'boxless-slot'],
    ['boxless-slot', 'wide-slot', 'no-side-erase'],
    variantNames
  ];
  for (const names of groups) {
    const presentNames = names.filter((name) => variantNames.includes(name));
    if (!presentNames.length) continue;
    scorePolicy(`avg:${presentNames.join('+')}`, (item) => {
      const preds = item.variantPreds.filter((pred) => presentNames.includes(pred.name));
      return rankProbs(avgProbs(preds))[0]?.digit ?? item.production;
    });
    scorePolicy(`vote:${presentNames.join('+')}`, (item) => {
      const preds = item.variantPreds.filter((pred) => presentNames.includes(pred.name));
      return voteDigit(preds);
    });
  }

  const slotBest = {};
  for (const slot of [0, 1]) {
    const subset = items.filter((item) => item.digitIndex === slot);
    for (const name of variantNames) {
      const slotCorrect = subset.reduce((sum, item) => {
        const predicted = item.variantPreds.find((pred) => pred.name === name)?.digit;
        return sum + Number(predicted === item.expected);
      }, 0);
      slotBest[`${slot}:${name}`] = { correct: slotCorrect, total: subset.length };
    }
  }
  const bestLeft = variantNames
    .map((name) => ({ name, ...slotBest[`0:${name}`] }))
    .sort((a, b) => b.correct - a.correct)[0];
  const bestRight = variantNames
    .map((name) => ({ name, ...slotBest[`1:${name}`] }))
    .sort((a, b) => b.correct - a.correct)[0];
  scorePolicy(`slot-best:${bestLeft.name}/${bestRight.name}`, (item) => {
    const name = item.digitIndex === 0 ? bestLeft.name : bestRight.name;
    return item.variantPreds.find((pred) => pred.name === name)?.digit ?? item.production;
  });

  const sortedPolicies = policies.sort((a, b) => b.correct - a.correct);
  const bestMissConfusion = {};
  for (const miss of sortedPolicies[0]?.misses || []) {
    const key = `${miss.expected}->${miss.predicted}`;
    bestMissConfusion[key] = (bestMissConfusion[key] || 0) + 1;
  }

  return {
    correct,
    total,
    failed,
    rows,
    items,
    grid: {
      variantNames,
      topPolicies: sortedPolicies.slice(0, 30).map((policy) => ({
        name: policy.name,
        correct: policy.correct,
        total: policy.total,
        nonManualCorrect: policy.nonManualCorrect,
        nonManualTotal: policy.nonManualTotal,
        missCount: policy.misses.length
      })),
      bestLeft,
      bestRight,
      bestPolicyConfusion: Object.entries(bestMissConfusion).sort((a, b) => b[1] - a[1]),
      bestPolicyMisses: (sortedPolicies[0]?.misses || []).slice(0, 80).map((miss) => ({
        file: miss.file,
        index: miss.index,
        questionNum: miss.questionNum,
        digitIndex: miss.digitIndex,
        expected: miss.expected,
        predicted: miss.predicted,
        production: miss.production,
        productionReason: miss.productionReason,
        variants: miss.variantPreds.map((variant) => `${variant.name}:${variant.digit}@${variant.confidence.toFixed(2)}`)
      }))
    }
  };
}, { captures, target: opts.target, grid: opts.grid });

await browser.close();

if (opts.dumpItems && Array.isArray(result.items)) {
  await fs.writeFile(opts.dumpItems, JSON.stringify(result.items, null, 2));
}

console.log(`Score: ${result.correct}/${result.total} (${(100 * result.correct / Math.max(1, result.total)).toFixed(2)}%), failed=${result.failed}`);
for (const row of result.rows) {
  console.log(`\n${row.file}: ${row.failed ? 'FAILED' : `${row.correct}/${row.total}`} pred=${JSON.stringify(row.predictions)}`);
  for (const miss of row.misses || []) {
    console.log(
      `  #${miss.index} q=${miss.questionNum ?? '?'} digit=${miss.digitIndex ?? '?'} ` +
      `${miss.expected}->${miss.predicted} conf=${miss.confidence.toFixed(3)} reason=${miss.reason}`
    );
  }
}

if (result.grid) {
  console.log(`\nTarget: ${opts.target}`);
  console.log(`Variants: ${result.grid.variantNames.join(', ')}`);
  console.log('Top policies:');
  for (const policy of result.grid.topPolicies) {
    const nonManual = policy.nonManualTotal
      ? ` nonmanual=${policy.nonManualCorrect}/${policy.nonManualTotal} (${(100 * policy.nonManualCorrect / policy.nonManualTotal).toFixed(2)}%)`
      : '';
    console.log(`  ${policy.name}: ${policy.correct}/${policy.total} (${(100 * policy.correct / policy.total).toFixed(2)}%)${nonManual} misses=${policy.missCount}`);
  }
  console.log(`Best single left slot: ${result.grid.bestLeft.name} ${result.grid.bestLeft.correct}/${result.grid.bestLeft.total}`);
  console.log(`Best single right slot: ${result.grid.bestRight.name} ${result.grid.bestRight.correct}/${result.grid.bestRight.total}`);
  console.log('Best-policy confusion:', result.grid.bestPolicyConfusion.slice(0, 12).map(([key, value]) => `${key}:${value}`).join(', '));
  console.log('Best-policy misses:');
  for (const miss of result.grid.bestPolicyMisses) {
    console.log(
      `  ${miss.file} #${miss.index} q=${miss.questionNum} digit=${miss.digitIndex} ` +
      `${miss.expected}->${miss.predicted} prod=${miss.production}(${miss.productionReason}) ` +
      miss.variants.join(' ')
    );
  }
}
