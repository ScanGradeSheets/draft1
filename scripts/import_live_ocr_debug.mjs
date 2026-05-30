#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'datasets', 'worksheet_digits', 'raw');
const files = process.argv.slice(2);

if (!files.length) {
  console.error('Usage: node scripts/import_live_ocr_debug.mjs /path/to/scangrade-live-ocr-debug.json ...');
  process.exit(1);
}

function sanitizeId(v) {
  return String(v).replace(/[^a-zA-Z0-9_-]/g, '');
}

function suppressEdgeLines(ink, w, h) {
  const out = new Uint8ClampedArray(ink);
  const rowLimit = Math.max(6, Math.round(w * 0.38));
  const colLimit = Math.max(6, Math.round(h * 0.38));
  const markRows = new Set();
  const markCols = new Set();

  for (let y = 0; y < h; y++) {
    if (y > h * 0.34 && y < h * 0.66) continue;
    let count = 0;
    for (let x = 0; x < w; x++) {
      if (ink[y * w + x] > 90) count++;
    }
    if (count >= rowLimit) {
      for (let yy = Math.max(0, y - 2); yy <= Math.min(h - 1, y + 2); yy++) markRows.add(yy);
    }
  }

  for (let x = 0; x < w; x++) {
    if (x > w * 0.34 && x < w * 0.66) continue;
    let count = 0;
    for (let y = 0; y < h; y++) {
      if (ink[y * w + x] > 90) count++;
    }
    if (count >= colLimit) {
      for (let xx = Math.max(0, x - 2); xx <= Math.min(w - 1, x + 2); xx++) markCols.add(xx);
    }
  }

  for (const y of markRows) {
    for (let x = 0; x < w; x++) out[y * w + x] = 0;
  }
  for (const x of markCols) {
    for (let y = 0; y < h; y++) out[y * w + x] = 0;
  }
  return out;
}

async function preprocessRawCrop(dataUrl) {
  const img = await loadImage(dataUrl);
  const src = createCanvas(img.width, img.height);
  const sctx = src.getContext('2d');
  sctx.drawImage(img, 0, 0);
  const data = sctx.getImageData(0, 0, img.width, img.height).data;
  const ink = new Uint8ClampedArray(img.width * img.height);
  for (let i = 0; i < ink.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    ink[i] = 255 - gray;
  }
  const cleaned = suppressEdgeLines(ink, img.width, img.height);
  const cleanCanvas = createCanvas(img.width, img.height);
  const cctx = cleanCanvas.getContext('2d');
  const cleanImage = cctx.createImageData(img.width, img.height);
  for (let i = 0; i < cleaned.length; i++) {
    const v = cleaned[i];
    cleanImage.data[i * 4] = v;
    cleanImage.data[i * 4 + 1] = v;
    cleanImage.data[i * 4 + 2] = v;
    cleanImage.data[i * 4 + 3] = 255;
  }
  cctx.putImageData(cleanImage, 0, 0);

  const dst = createCanvas(28, 28);
  const dctx = dst.getContext('2d');
  dctx.imageSmoothingEnabled = true;
  dctx.imageSmoothingQuality = 'high';
  dctx.drawImage(cleanCanvas, 0, 0, 28, 28);
  return dst.toBuffer('image/png');
}

let imported = 0;
for (const file of files) {
  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(debug.answerKey) || debug.answerKey.length !== 10) {
    throw new Error(`Missing answerKey in ${file}`);
  }
  if (!Array.isArray(debug.rawCropDataUrls) || debug.rawCropDataUrls.length !== 10) {
    throw new Error(`Missing rawCropDataUrls in ${file}`);
  }
  const base = sanitizeId(path.basename(file, '.json').replace(/^scangrade-live-ocr-debug-/, 'live-'));
  for (let i = 0; i < 10; i++) {
    const label = Number(debug.answerKey[i]);
    if (!Number.isInteger(label) || label < 0 || label > 9) continue;
    const outDir = path.join(OUT_ROOT, String(label));
    await fs.mkdir(outDir, { recursive: true });
    const outPath = path.join(outDir, `${base}-q${i + 1}.png`);
    await fs.writeFile(outPath, await preprocessRawCrop(debug.rawCropDataUrls[i]));
    imported++;
  }
}

console.log(`Imported ${imported} live OCR crops into ${OUT_ROOT}`);
