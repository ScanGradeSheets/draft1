#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_DEBUG_DIR = '/Users/teecush/Downloads';
const DEFAULT_URL = process.env.SG_REPLAY_URL || 'https://localhost:5174';
const DEFAULT_EXCLUDED_IDS = new Set([
  '1777087500592'
]);

function debugId(file) {
  return path.basename(file, '.json').replace(/^scangrade-live-ocr-debug-/, '');
}

async function listDebugJsons(explicitFiles) {
  if (explicitFiles.length) return explicitFiles;
  const names = await fs.readdir(DEFAULT_DEBUG_DIR).catch(() => []);
  return names
    .filter((name) => /^scangrade-live-ocr-debug-\d+\.json$/.test(name))
    .sort()
    .map((name) => path.join(DEFAULT_DEBUG_DIR, name));
}

function parseArgs() {
  const files = [];
  let includeKnownBad = false;
  let allowImperfect = false;
  let url = DEFAULT_URL;
  let outDir = null;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--include-known-bad') {
      includeKnownBad = true;
    } else if (arg === '--allow-imperfect') {
      allowImperfect = true;
    } else if (arg === '--url') {
      url = process.argv[++i] || url;
    } else if (arg === '--out-dir') {
      outDir = process.argv[++i] || outDir;
    } else {
      files.push(arg);
    }
  }
  return { files, includeKnownBad, allowImperfect, url, outDir };
}

const args = parseArgs();
const files = await listDebugJsons(args.files);
const excluded = args.includeKnownBad ? new Set() : DEFAULT_EXCLUDED_IDS;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(`${args.url}/?liveOcrDebug=1`, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction(
  () => !!window.cv && typeof window.cv.Mat !== 'undefined',
  undefined,
  { timeout: 60000 }
);

const rows = [];
let perfect = 0;
let correctCells = 0;
let totalCells = 0;
let skipped = 0;

for (const file of files) {
  const id = debugId(file);
  if (excluded.has(id)) {
    rows.push({ file: path.basename(file), skipped: true, reason: 'known_bad_capture' });
    skipped++;
    continue;
  }

  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!debug.capturedImageDataUrl || !Array.isArray(debug.answerKey) || debug.answerKey.length === 0) {
    rows.push({ file: path.basename(file), skipped: true, reason: 'missing_capture_or_answer_key' });
    skipped++;
    continue;
  }

  const result = await page.evaluate(async ({ debug }) => {
    const { processWorksheet } = await import('/src/homography.js');
    const { initDigitModel, recognizeDigits, recognizeDigitsRobust } = await import('/src/ocr-pipeline.js');
    const layoutPath = debug.layoutId
      ? `/layouts/${debug.layoutId}.json`
      : '/layouts/sg-10-box-v1.json';
    const layout = await fetch(layoutPath).then((r) => r.json());
    await initDigitModel();

    const img = new Image();
    img.src = debug.capturedImageDataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const src = cv.imread(canvas);
    const processed = processWorksheet(src, layout);
    src.delete();
    if (!processed) return { ok: false, predictions: [] };

    const tensorPreviewDataUrl = (items) => {
      const scale = 4;
      const cell = 28 * scale;
      const cols = Math.min(10, Math.max(1, items.length));
      const rows = Math.ceil(items.length / cols);
      const c = document.createElement('canvas');
      c.width = cols * cell;
      c.height = rows * cell;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, c.width, c.height);
      items.forEach((item, index) => {
        const x0 = (index % cols) * cell;
        const y0 = Math.floor(index / cols) * cell;
        const small = document.createElement('canvas');
        small.width = 28;
        small.height = 28;
        const smallCtx = small.getContext('2d');
        const idata = smallCtx.createImageData(28, 28);
        for (let i = 0; i < 784; i++) {
          const u = Math.max(0, Math.min(255, Math.round((item.tensor[i] ?? 0) * 255)));
          idata.data[i * 4] = u;
          idata.data[i * 4 + 1] = u;
          idata.data[i * 4 + 2] = u;
          idata.data[i * 4 + 3] = 255;
        }
        smallCtx.putImageData(idata, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(small, x0, y0, cell, cell);
      });
      return c.toDataURL('image/png');
    };

    const predictions = [];
    for (const tensor of processed.processedTensors) {
      let [prediction] = await recognizeDigits(tensor.tensor);
      const topK = prediction.topK || [];
      const topGap = topK.length >= 2 ? topK[0].confidence - topK[1].confidence : 1;
      if (prediction.confidence < 0.86 || topGap < 0.18) {
        [prediction] = await recognizeDigitsRobust(tensor.tensor, prediction);
      }
      const robustTopK = prediction.topK || [];
      const robustTopGap = robustTopK.length >= 2 ? robustTopK[0].confidence - robustTopK[1].confidence : 1;
      const expected = debug.answerKey[tensor.id ?? predictions.length];
      const correct = expected !== undefined ? prediction.digit === expected : undefined;
      const autoCheck = correct === true && prediction.confidence >= 0.9 && robustTopGap >= 0.25;
      const autoX = correct === false && prediction.confidence >= 0.995 && robustTopGap >= 0.75;
      const reviewNeeded = expected !== undefined
        ? (!autoCheck && !autoX)
        : (prediction.confidence < 0.86 || robustTopGap < 0.18);
      predictions.push({
        id: tensor.id ?? predictions.length,
        digit: prediction.digit,
        confidence: prediction.confidence,
        topGap: robustTopGap,
        robust: prediction.robust === true,
        correct,
        reviewNeeded
      });
    }

    processed.rawCrops.forEach((crop) => crop.image.delete());
    processed.warpedImage.delete();
    return {
      ok: true,
      predictions,
      questionGroups: Array.isArray(layout.question_groups) ? layout.question_groups : [],
      modelInputPreviewDataUrl: tensorPreviewDataUrl(processed.processedTensors)
    };
  }, { debug });

  const preds = result.predictions.map((p) => p.digit);
  const correct = preds.reduce((sum, pred, idx) => sum + Number(pred === debug.answerKey[idx]), 0);
  const reviewCells = result.predictions.reduce((sum, prediction) => sum + Number(prediction.reviewNeeded), 0);
  const groupRows = [];
  if (Array.isArray(result.questionGroups) && result.questionGroups.length) {
    for (const group of result.questionGroups) {
      const ids = Array.isArray(group.digit_box_ids) ? group.digit_box_ids : [];
      const groupPredictions = ids.map((digitId) =>
        result.predictions.find((prediction) => prediction.id === digitId)
      );
      const expectedCells = ids.map((digitId) => debug.answerKey[digitId]);
      const predictedCells = groupPredictions.map((prediction) => prediction?.digit ?? null);
      const expectedText = expectedCells.map((value) => value ?? '_').join('');
      const predictedText = predictedCells.map((value) => value ?? '_').join('');
      groupRows.push({
        label: group.label || String(group.question_num ?? groupRows.length + 1),
        expected: expectedText,
        predicted: predictedText,
        correct: expectedText === predictedText,
        review: groupPredictions.some((prediction) => prediction?.reviewNeeded)
      });
    }
  }
  correctCells += correct;
  totalCells += debug.answerKey.length;
  perfect += Number(correct === debug.answerKey.length);
  rows.push({
    file: path.basename(file),
    score: `${correct}/${debug.answerKey.length}`,
    predictions: preds,
    reviewCells,
    groups: groupRows,
    modelInputPreviewDataUrl: result.modelInputPreviewDataUrl,
    minConfidence: result.predictions.length
      ? Math.min(...result.predictions.map((p) => p.confidence))
      : 0
  });
}

await browser.close();

for (const row of rows) {
  if (row.skipped) {
    console.log(`${row.file}: SKIP ${row.reason}`);
  } else {
    const reviewText = Number.isFinite(row.reviewCells) ? ` review_cells=${row.reviewCells}` : '';
    console.log(`${row.file}: ${row.score} pred=${JSON.stringify(row.predictions)} min_conf=${row.minConfidence.toFixed(3)}${reviewText}`);
    if (Array.isArray(row.groups) && row.groups.length) {
      const groupText = row.groups
        .map((group) => `${group.label}:${group.predicted}/${group.expected}${group.review ? '*' : ''}${group.correct ? '' : '!'}`)
        .join(' ');
      console.log(`  groups ${groupText}`);
    }
  }
}

if (args.outDir) {
  await fs.mkdir(args.outDir, { recursive: true });
  await Promise.all(rows.map(async (row) => {
    if (!row.modelInputPreviewDataUrl) return;
    const base = path.basename(row.file || 'capture', '.json');
    const data = row.modelInputPreviewDataUrl.split(',')[1];
    if (!data) return;
    await fs.writeFile(path.join(args.outDir, `${base}-model-input-preview.png`), Buffer.from(data, 'base64'));
  }));
  console.log(`Saved model-input previews to ${args.outDir}`);
}

const tested = files.length - skipped;
const accuracy = totalCells ? correctCells / totalCells : 0;
console.log('');
console.log(`Tested captures: ${tested}`);
console.log(`Skipped captures: ${skipped}`);
console.log(`Perfect captures: ${perfect}/${tested}`);
console.log(`Cell accuracy: ${correctCells}/${totalCells} (${(accuracy * 100).toFixed(2)}%)`);

if (!args.allowImperfect && tested && (perfect !== tested || correctCells !== totalCells)) {
  process.exit(1);
}
