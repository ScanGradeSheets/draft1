#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from 'canvas';

const ROOT = process.cwd();
const SOURCE_RAW = path.join(ROOT, 'datasets', 'worksheet_digits', 'raw');
const OUT_ROOT = path.join(ROOT, 'datasets', 'worksheet_digits_curated', 'raw');
const DEFAULT_DEBUG_DIR = '/Users/teecush/Downloads';
const EXCLUDED_DEBUG_IDS = new Set([
  // This capture was visibly off-page/blank in the exported model-input preview.
  // Exclude the whole scan instead of silently training on mislabeled blanks.
  '1777087500592',
]);

function sanitizeId(v) {
  return String(v).replace(/[^a-zA-Z0-9_-]/g, '');
}

function tensorPngBuffer(tensor) {
  const canvas = createCanvas(28, 28);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(28, 28);
  for (let i = 0; i < 28 * 28; i++) {
    const value = Number(tensor[i] ?? 0);
    const u = Math.max(0, Math.min(255, Math.round(value * 255)));
    img.data[i * 4] = u;
    img.data[i * 4 + 1] = u;
    img.data[i * 4 + 2] = u;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toBuffer('image/png');
}

function tensorQuality(tensor) {
  let sum = 0;
  let sum2 = 0;
  let max = -Infinity;
  let bright = 0;
  let veryBright = 0;
  for (const x of tensor) {
    const v = Number(x ?? 0);
    sum += v;
    sum2 += v * v;
    if (v > max) max = v;
    if (v > 0.35) bright++;
    if (v > 0.55) veryBright++;
  }
  const n = Math.max(1, tensor.length);
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
  return { mean, sd, max, bright, veryBright };
}

function hasTensorShape(tensor) {
  if (!Array.isArray(tensor) || tensor.length < 784) return false;
  return true;
}

async function ensureClassDirs() {
  await fs.rm(OUT_ROOT, { recursive: true, force: true });
  for (let d = 0; d <= 9; d++) {
    await fs.mkdir(path.join(OUT_ROOT, String(d)), { recursive: true });
  }
}

async function copyControlledSheetCrops() {
  let copied = 0;
  for (let d = 0; d <= 9; d++) {
    const inDir = path.join(SOURCE_RAW, String(d));
    const outDir = path.join(OUT_ROOT, String(d));
    const entries = await fs.readdir(inDir).catch(() => []);
    for (const name of entries) {
      if (!/^sheet\d+-q\d+\.png$/.test(name)) continue;
      await fs.copyFile(path.join(inDir, name), path.join(outDir, name));
      copied++;
    }
  }
  return copied;
}

async function listDebugJsons() {
  const explicit = process.argv.slice(2);
  if (explicit.length) return explicit;
  const names = await fs.readdir(DEFAULT_DEBUG_DIR).catch(() => []);
  return names
    .filter((name) => /^scangrade-live-ocr-debug-\d+\.json$/.test(name))
    .sort()
    .map((name) => path.join(DEFAULT_DEBUG_DIR, name));
}

async function importLiveTensors(files) {
  let imported = 0;
  let skipped = 0;
  const skippedDetails = [];
  const qualityWarnings = [];
  for (const file of files) {
    const debug = JSON.parse(await fs.readFile(file, 'utf8'));
    const debugId = path.basename(file, '.json').replace(/^scangrade-live-ocr-debug-/, '');
    if (EXCLUDED_DEBUG_IDS.has(debugId)) {
      skipped += Array.isArray(debug.tensors) ? Math.min(debug.tensors.length, 10) : 0;
      skippedDetails.push({ file: path.basename(file), reason: 'excluded_bad_scan' });
      continue;
    }
    if (!Array.isArray(debug.answerKey) || debug.answerKey.length !== 10 || !Array.isArray(debug.tensors)) {
      skippedDetails.push({ file, reason: 'missing_answer_key_or_tensors' });
      continue;
    }
    const base = sanitizeId(path.basename(file, '.json').replace(/^scangrade-live-ocr-debug-/, 'livetensor-'));
    for (let i = 0; i < 10; i++) {
      const label = Number(debug.answerKey[i]);
      const tensor = debug.tensors[i]?.tensor;
      if (!Number.isInteger(label) || label < 0 || label > 9 || !hasTensorShape(tensor)) {
        skipped++;
        skippedDetails.push({ file: path.basename(file), question: i + 1, reason: 'invalid_tensor' });
        continue;
      }
      const q = tensorQuality(tensor);
      if (q.max < 0.28 || q.sd < 0.025 || q.bright > 190 || q.veryBright > 160) {
        qualityWarnings.push({
          file: path.basename(file),
          question: i + 1,
          quality: {
            mean: Number(q.mean.toFixed(4)),
            sd: Number(q.sd.toFixed(4)),
            max: Number(q.max.toFixed(4)),
            bright: q.bright,
            veryBright: q.veryBright,
          },
        });
      }
      await fs.writeFile(
        path.join(OUT_ROOT, String(label), `${base}-q${i + 1}.png`),
        tensorPngBuffer(tensor)
      );
      imported++;
    }
  }
  return { imported, skipped, skippedDetails, qualityWarnings };
}

const files = await listDebugJsons();
await ensureClassDirs();
const controlled = await copyControlledSheetCrops();
const live = await importLiveTensors(files);
const summary = {
  generatedAt: new Date().toISOString(),
  controlled,
  liveImported: live.imported,
  liveSkipped: live.skipped,
  debugJsons: files.length,
  skippedDetails: live.skippedDetails,
  qualityWarnings: live.qualityWarnings,
};
await fs.writeFile(path.join(OUT_ROOT, 'curated-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
