#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_URL = process.env.SG_REPLAY_URL || 'https://localhost:5174';

function parseArgs() {
  const files = [];
  const opts = { url: DEFAULT_URL, modelPath: null, rightSlotModelPath: null, target: 'answerKey', dumpItems: null };
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--url') opts.url = process.argv[++i] || opts.url;
    else if (arg === '--modelPath') opts.modelPath = process.argv[++i] || null;
    else if (arg === '--rightSlotModelPath') opts.rightSlotModelPath = process.argv[++i] || null;
    else if (arg === '--target') opts.target = process.argv[++i] || opts.target;
    else if (arg === '--dumpItems') opts.dumpItems = process.argv[++i] || null;
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
  console.error('Usage: node scripts/eval_live_ocr_variant_grid.mjs [--url URL] [--modelPath PATH] /path/to/scangrade-live-ocr-debug-*.json');
  process.exit(2);
}

const captures = [];
for (const file of files.sort()) {
  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(debug.tensors) || !Array.isArray(debug.answerKey)) continue;
  captures.push({
    file: path.basename(file),
    answerKey: debug.answerKey,
    savedPredictions: Array.isArray(debug.predictions) ? debug.predictions.map((p) => p?.digit) : null,
    savedPredictionMeta: Array.isArray(debug.predictions) ? debug.predictions.map((p) => ({
      manualCorrected: Boolean(p?.manualCorrected || p?.originalDigit !== undefined),
      originalDigit: p?.originalDigit
    })) : null,
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

const grid = await page.evaluate(async ({ captures, target }) => {
  const { initDigitModel, recognizeDigits, recognizeDigitsWithPreprocessVariants } = await import('/src/ocr-pipeline.js');
  await initDigitModel();

  function rankProbs(probs) {
    return Array.from(probs || [])
      .map((confidence, digit) => ({ digit, confidence }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  function avgProbs(preds, weights = null) {
    const out = new Float32Array(10);
    let total = 0;
    for (const pred of preds) {
      const w = weights?.[pred.name] ?? 1;
      if (w <= 0) continue;
      const probs = pred.probs || [];
      for (let i = 0; i < 10; i += 1) out[i] += (probs[i] || 0) * w;
      total += w;
    }
    if (!total) return out;
    for (let i = 0; i < 10; i += 1) out[i] /= total;
    return out;
  }

  function voteDigit(preds, weights = null) {
    const votes = new Map();
    for (const pred of preds) {
      const w = weights?.[pred.name] ?? 1;
      const gap = pred.topK?.length >= 2 ? pred.topK[0].confidence - pred.topK[1].confidence : 1;
      const score = w * (0.4 + Math.max(0, pred.confidence || 0)) * (0.55 + Math.max(0, gap));
      votes.set(pred.digit, (votes.get(pred.digit) || 0) + score);
    }
    return Array.from(votes.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  }

  const items = [];
  for (const capture of captures) {
    for (let i = 0; i < capture.tensors.length; i += 1) {
      const item = capture.tensors[i];
      const variants = Array.isArray(item.tensorVariants) && item.tensorVariants.length
        ? item.tensorVariants
        : [{ name: 'base', tensor: item.tensor }];
      const variantPreds = [];
      for (const variant of variants) {
        const [pred] = await recognizeDigits(variant.tensor || variant.data || variant);
        variantPreds.push({
          name: variant.name || `variant-${variantPreds.length + 1}`,
          digit: pred.digit,
          confidence: pred.confidence,
          topK: pred.topK || [],
          probs: pred.probs || []
        });
      }
      const [production] = await recognizeDigitsWithPreprocessVariants(
        variants,
        null,
        { digitIndex: item.digitIndex, forceReviewOnDisagreement: true }
      );
      items.push({
        file: capture.file,
        index: i + 1,
        questionNum: item.questionNum,
        digitIndex: item.digitIndex,
        expected: target === 'savedPredictions' && Array.isArray(capture.savedPredictions)
          ? capture.savedPredictions[i]
          : capture.answerKey[i],
        manualCorrected: Array.isArray(capture.savedPredictionMeta)
          ? Boolean(capture.savedPredictionMeta[i]?.manualCorrected)
          : false,
        originalDigit: Array.isArray(capture.savedPredictionMeta)
          ? capture.savedPredictionMeta[i]?.originalDigit
          : undefined,
        production: production.digit,
        productionReason: production.robustOverride || production.preprocessReviewReason || 'weighted-average',
        productionReview: production.preprocessDisagreement === true,
        productionTopK: production.topK || [],
        productionVariants: production.preprocessVariants || [],
        variantPreds
      });
    }
  }

  const variantNames = Array.from(new Set(items.flatMap((item) => item.variantPreds.map((pred) => pred.name))));
  const policies = [];
  function scorePolicy(name, choose) {
    let correct = 0;
    let nonManualCorrect = 0;
    let nonManualTotal = 0;
    const misses = [];
    for (const item of items) {
      const predicted = choose(item);
      const ok = predicted === item.expected;
      if (ok) correct += 1;
      if (!item.manualCorrected) {
        nonManualTotal += 1;
        if (ok) nonManualCorrect += 1;
      }
      if (!ok) misses.push({ ...item, predicted });
    }
    policies.push({ name, correct, total: items.length, nonManualCorrect, nonManualTotal, misses });
  }

  scorePolicy('production', (item) => item.production);

  for (const name of variantNames) {
    scorePolicy(`variant:${name}`, (item) => item.variantPreds.find((pred) => pred.name === name)?.digit ?? item.production);
  }

  const groups = [
    ['strict', 'edge-clean', 'no-rule-cleanup', 'no-component-cleanup'],
    ['gentle', 'center-safe-slot', 'expected-slot', 'edge-band-slot', 'wide-slot', 'no-side-erase'],
    ['center-safe-slot', 'expected-slot', 'edge-band-slot', 'wide-slot', 'no-side-erase'],
    ['expected-slot', 'edge-band-slot', 'wide-slot', 'no-side-erase'],
    ['expected-slot', 'wide-slot', 'no-side-erase'],
    ['center-safe-slot', 'edge-band-slot'],
    ['expected-slot', 'edge-band-slot'],
    ['wide-slot', 'no-side-erase'],
    variantNames
  ];
  for (const names of groups) {
    scorePolicy(`avg:${names.join('+')}`, (item) => {
      const preds = item.variantPreds.filter((pred) => names.includes(pred.name));
      return rankProbs(avgProbs(preds))[0]?.digit ?? item.production;
    });
    scorePolicy(`vote:${names.join('+')}`, (item) => {
      const preds = item.variantPreds.filter((pred) => names.includes(pred.name));
      return voteDigit(preds);
    });
  }

  function byName(item, name) {
    return item.variantPreds.find((pred) => pred.name === name) || null;
  }

  function gap(pred) {
    return pred?.topK?.length >= 2 ? pred.topK[0].confidence - pred.topK[1].confidence : 1;
  }

  function pairAgrees(item, names, minConfidence, minGap) {
    const preds = names.map((name) => byName(item, name));
    if (preds.some((pred) => !pred)) return null;
    const digit = preds[0].digit;
    if (!preds.every((pred) => pred.digit === digit)) return null;
    if (!preds.every((pred) => (pred.confidence || 0) >= minConfidence && gap(pred) >= minGap)) return null;
    return digit;
  }

  function slotMajority(item, names, minConfidence, minGap, minCount) {
    const counts = new Map();
    for (const name of names) {
      const pred = byName(item, name);
      if (!pred || (pred.confidence || 0) < minConfidence || gap(pred) < minGap) continue;
      const current = counts.get(pred.digit) || { digit: pred.digit, count: 0, confidence: 0, gap: 0 };
      current.count += 1;
      current.confidence += pred.confidence || 0;
      current.gap += gap(pred);
      counts.set(pred.digit, current);
    }
    return Array.from(counts.values())
      .filter((entry) => entry.count >= minCount)
      .sort((a, b) => (b.count - a.count) || (b.confidence - a.confidence) || (b.gap - a.gap))[0]?.digit ?? null;
  }

  const slotNames = ['gentle', 'center-safe-slot', 'expected-slot', 'edge-band-slot', 'wide-slot', 'no-side-erase'];
  scorePolicy('hybrid:center-edge-strong-else-production', (item) => {
    const digit = pairAgrees(item, ['center-safe-slot', 'edge-band-slot'], 0.58, 0.38);
    return digit ?? item.production;
  });
  scorePolicy('hybrid:center-edge-any-else-production', (item) => {
    const digit = pairAgrees(item, ['center-safe-slot', 'edge-band-slot'], 0.42, 0.06);
    return digit ?? item.production;
  });
  scorePolicy('hybrid:slot-majority-4-else-production', (item) => {
    const digit = slotMajority(item, slotNames, 0.56, 0.22, 4);
    return digit ?? item.production;
  });
  scorePolicy('hybrid:slot-majority-5-else-production', (item) => {
    const digit = slotMajority(item, slotNames, 0.46, 0.12, 5);
    return digit ?? item.production;
  });
  scorePolicy('hybrid:right-center-edge-left-production', (item) => {
    const digit = item.digitIndex === 1
      ? pairAgrees(item, ['center-safe-slot', 'edge-band-slot'], 0.42, 0.06)
      : null;
    return digit ?? item.production;
  });
  scorePolicy('hybrid:left-gentle-center-right-center-edge', (item) => {
    const names = item.digitIndex === 0 ? ['gentle', 'center-safe-slot'] : ['center-safe-slot', 'edge-band-slot'];
    const digit = pairAgrees(item, names, 0.42, 0.06);
    return digit ?? item.production;
  });

  const slotBest = {};
  for (const slot of [0, 1]) {
    for (const name of variantNames) {
      const subset = items.filter((item) => item.digitIndex === slot);
      const correct = subset.reduce((sum, item) => {
        const pred = item.variantPreds.find((v) => v.name === name)?.digit;
        return sum + Number(pred === item.expected);
      }, 0);
      slotBest[`${slot}:${name}`] = { correct, total: subset.length };
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

  const bestVariantByDigit = {};
  for (const slot of [0, 1]) {
    for (let expected = 0; expected <= 9; expected += 1) {
      const subset = items.filter((item) => item.digitIndex === slot && item.expected === expected);
      if (!subset.length) continue;
      bestVariantByDigit[`${slot}:${expected}`] = variantNames
        .map((name) => ({
          name,
          correct: subset.reduce((sum, item) => {
            const pred = item.variantPreds.find((v) => v.name === name)?.digit;
            return sum + Number(pred === item.expected);
          }, 0),
          total: subset.length
        }))
        .sort((a, b) => b.correct - a.correct)[0];
    }
  }
  scorePolicy('oracle-slot-digit-best-variant', (item) => {
    const name = bestVariantByDigit[`${item.digitIndex}:${item.expected}`]?.name;
    return item.variantPreds.find((pred) => pred.name === name)?.digit ?? item.production;
  });

  const sorted = policies.sort((a, b) => b.correct - a.correct);
  const confusion = {};
  for (const miss of sorted[0].misses) {
    const key = `${miss.expected}->${miss.predicted}`;
    confusion[key] = (confusion[key] || 0) + 1;
  }

  return {
    total: items.length,
    variantNames,
    topPolicies: sorted.slice(0, 30).map((p) => ({
      name: p.name,
      correct: p.correct,
      total: p.total,
      nonManualCorrect: p.nonManualCorrect,
      nonManualTotal: p.nonManualTotal,
      missCount: p.misses.length
    })),
    bestLeft,
    bestRight,
    slotBest,
    bestVariantByDigit,
    bestPolicyMisses: sorted[0].misses.map((miss) => ({
      file: miss.file,
      index: miss.index,
      questionNum: miss.questionNum,
      digitIndex: miss.digitIndex,
      expected: miss.expected,
      predicted: miss.predicted,
      production: miss.production,
      productionReason: miss.productionReason,
      variants: miss.variantPreds.map((v) => `${v.name}:${v.digit}@${v.confidence.toFixed(2)}`)
    })),
    bestPolicyConfusion: Object.entries(confusion).sort((a, b) => b[1] - a[1]),
    items: items.map((item) => ({
      file: item.file,
      index: item.index,
      questionNum: item.questionNum,
      digitIndex: item.digitIndex,
      expected: item.expected,
      manualCorrected: item.manualCorrected,
      originalDigit: item.originalDigit,
      production: item.production,
      productionReason: item.productionReason,
      productionReview: item.productionReview,
      productionTopK: item.productionTopK,
      productionVariants: item.productionVariants,
      variantPreds: item.variantPreds
    }))
  };
}, { captures, target: opts.target });

await browser.close();

if (opts.dumpItems) {
  await fs.writeFile(opts.dumpItems, JSON.stringify(grid.items, null, 2));
}

console.log(`Total cells: ${grid.total}`);
console.log(`Target: ${opts.target}`);
console.log(`Variants: ${grid.variantNames.join(', ')}`);
console.log('Top policies:');
for (const p of grid.topPolicies) {
  const nonManual = p.nonManualTotal
    ? ` nonmanual=${p.nonManualCorrect}/${p.nonManualTotal} (${(100 * p.nonManualCorrect / p.nonManualTotal).toFixed(2)}%)`
    : '';
  console.log(`  ${p.name}: ${p.correct}/${p.total} (${(100 * p.correct / p.total).toFixed(2)}%)${nonManual} misses=${p.missCount}`);
}
console.log(`Best single left slot: ${grid.bestLeft.name} ${grid.bestLeft.correct}/${grid.bestLeft.total}`);
console.log(`Best single right slot: ${grid.bestRight.name} ${grid.bestRight.correct}/${grid.bestRight.total}`);
console.log('Best-policy confusion:', grid.bestPolicyConfusion.slice(0, 12).map(([k, v]) => `${k}:${v}`).join(', '));
console.log('Best-policy misses:');
for (const miss of grid.bestPolicyMisses.slice(0, 80)) {
  console.log(
    `  ${miss.file} #${miss.index} q=${miss.questionNum} digit=${miss.digitIndex} ` +
    `${miss.expected}->${miss.predicted} prod=${miss.production}(${miss.productionReason}) ` +
    miss.variants.join(' ')
  );
}
