#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from 'canvas';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'datasets', 'worksheet_digits_current_pipeline', 'raw');
const DEBUG_OUT = path.join(ROOT, 'datasets', 'worksheet_digits_current_pipeline', 'debug');
const DEFAULT_DEBUG_DIR = '/Users/teecush/Downloads';
const BAKEOFF_MANIFEST = path.join(ROOT, 'benchmarks', 'worksheet_bakeoff', 'manifest.json');
const BAKEOFF_IMAGES = path.join(ROOT, 'benchmarks', 'worksheet_bakeoff', 'images');
const DEFAULT_URL = process.env.SG_DATASET_URL || 'https://localhost:5174';
const EXCLUDED_DEBUG_IDS = new Set([
  '1777087500592'
]);

function sanitizeId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '');
}

function tensorPngBuffer(tensor) {
  const canvas = createCanvas(28, 28);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(28, 28);
  for (let i = 0; i < 28 * 28; i++) {
    const value = Math.max(0, Math.min(1, Number(tensor[i] ?? 0)));
    const u = Math.round(value * 255);
    img.data[i * 4] = u;
    img.data[i * 4 + 1] = u;
    img.data[i * 4 + 2] = u;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toBuffer('image/png');
}

async function resetOutputDirs() {
  await fs.rm(OUT_ROOT, { recursive: true, force: true });
  await fs.rm(DEBUG_OUT, { recursive: true, force: true });
  for (let digit = 0; digit <= 9; digit++) {
    await fs.mkdir(path.join(OUT_ROOT, String(digit)), { recursive: true });
  }
  await fs.mkdir(DEBUG_OUT, { recursive: true });
}

async function dataUrlFromFile(filePath) {
  const buffer = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.png' ? 'image/png' : 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

async function listDebugJsons() {
  const names = await fs.readdir(DEFAULT_DEBUG_DIR).catch(() => []);
  return names
    .filter((name) => /^scangrade-live-ocr-debug-\d+\.json$/.test(name))
    .sort()
    .map((name) => path.join(DEFAULT_DEBUG_DIR, name));
}

async function loadSamples() {
  const samples = [];

  const manifestRaw = await fs.readFile(BAKEOFF_MANIFEST, 'utf8').catch(() => null);
  if (manifestRaw) {
    const manifest = JSON.parse(manifestRaw);
    for (const sheet of manifest.sheets || []) {
      if (!sheet.id || !sheet.file || !Array.isArray(sheet.expected_digits)) continue;
      samples.push({
        id: `bakeoff-${sanitizeId(sheet.id)}`,
        source: 'bakeoff',
        imageDataUrl: await dataUrlFromFile(path.join(BAKEOFF_IMAGES, sheet.file)),
        answerKey: sheet.expected_digits
      });
    }
  }

  for (const file of await listDebugJsons()) {
    const debugId = path.basename(file, '.json').replace(/^scangrade-live-ocr-debug-/, '');
    if (EXCLUDED_DEBUG_IDS.has(debugId)) continue;
    const debug = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!debug.capturedImageDataUrl || !Array.isArray(debug.answerKey) || debug.answerKey.length !== 10) continue;
    samples.push({
      id: `live-${sanitizeId(debugId)}`,
      source: 'live',
      imageDataUrl: debug.capturedImageDataUrl,
      answerKey: debug.answerKey
    });
  }

  return samples;
}

const samples = await loadSamples();
await resetOutputDirs();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });

async function preparePage() {
  await page.goto(`${DEFAULT_URL}/?liveOcrDebug=1`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForFunction(
    () => !!window.cv && typeof window.cv.Mat !== 'undefined',
    undefined,
    { timeout: 60000 }
  );
}

const summary = {
  generatedAt: new Date().toISOString(),
  url: DEFAULT_URL,
  samplesTotal: samples.length,
  importedCells: 0,
  skipped: []
};

for (const sample of samples) {
  let processed;
  try {
    await preparePage();
    processed = await page.evaluate(async ({ sample }) => {
    const { processWorksheet } = await import('/src/homography.js');
    const layout = await fetch('/layouts/sg-10-box-v1.json').then((r) => r.json());
    const img = new Image();
    img.src = sample.imageDataUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);
    const src = cv.imread(canvas);
    const result = processWorksheet(src, layout);
    src.delete();
    if (!result || result.processedTensors.length !== 10) {
      return { ok: false, reason: result ? `tensor_count_${result.processedTensors.length}` : 'process_failed' };
    }

    const matToDataUrl = (mat) => {
      const c = document.createElement('canvas');
      c.width = mat.cols;
      c.height = mat.rows;
      cv.imshow(c, mat);
      return c.toDataURL('image/png');
    };

    const tensors = result.processedTensors.map((item) => Array.from(item.tensor));
    const cropRects = result.rawCrops.map((crop) => ({
      questionNum: crop.questionNum,
      boxRect: crop.boxRect,
      cropRect: crop.cropRect
    }));
    const rawCrops = result.rawCrops.map((crop) => matToDataUrl(crop.image));
    result.rawCrops.forEach((crop) => crop.image.delete());
    result.warpedImage.delete();
    return { ok: true, tensors, cropRects, rawCrops };
    }, { sample });
  } catch (error) {
    processed = {
      ok: false,
      reason: `browser_error_${String(error?.message || error).slice(0, 80)}`
    };
  }

  if (!processed.ok) {
    summary.skipped.push({ id: sample.id, source: sample.source, reason: processed.reason });
    console.log(`[skip] ${sample.id}: ${processed.reason}`);
    continue;
  }

  const sampleDebugDir = path.join(DEBUG_OUT, sample.id);
  await fs.mkdir(sampleDebugDir, { recursive: true });
  await fs.writeFile(
    path.join(sampleDebugDir, 'debug.json'),
    JSON.stringify({
      id: sample.id,
      source: sample.source,
      answerKey: sample.answerKey,
      cropRects: processed.cropRects
    }, null, 2)
  );

  for (let i = 0; i < processed.tensors.length; i++) {
    const label = Number(sample.answerKey[i]);
    if (!Number.isInteger(label) || label < 0 || label > 9) {
      summary.skipped.push({ id: sample.id, question: i + 1, reason: `bad_label_${sample.answerKey[i]}` });
      continue;
    }
    const fileName = `${sample.id}-q${i + 1}.png`;
    await fs.writeFile(path.join(OUT_ROOT, String(label), fileName), tensorPngBuffer(processed.tensors[i]));
    if (processed.rawCrops[i]?.startsWith('data:image/png;base64,')) {
      await fs.writeFile(
        path.join(sampleDebugDir, `raw-q${i + 1}.png`),
        Buffer.from(processed.rawCrops[i].split(',')[1], 'base64')
      );
    }
    summary.importedCells++;
  }
  console.log(`[ok] ${sample.id}: imported 10 cells`);
}

await browser.close();
await fs.writeFile(path.join(OUT_ROOT, 'current-pipeline-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
