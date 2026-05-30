#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas } from 'canvas';

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'datasets', 'worksheet_digits', 'raw');
const files = process.argv.slice(2);

if (!files.length) {
  console.error('Usage: node scripts/import_live_ocr_tensors.mjs /path/to/scangrade-live-ocr-debug.json ...');
  process.exit(1);
}

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

let imported = 0;
for (const file of files) {
  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(debug.answerKey) || debug.answerKey.length !== 10) {
    throw new Error(`Missing answerKey in ${file}`);
  }
  if (!Array.isArray(debug.tensors) || debug.tensors.length !== 10) {
    throw new Error(`Missing tensors in ${file}`);
  }
  const base = sanitizeId(path.basename(file, '.json').replace(/^scangrade-live-ocr-debug-/, 'livetensor-'));
  for (let i = 0; i < 10; i++) {
    const label = Number(debug.answerKey[i]);
    const tensor = debug.tensors[i]?.tensor;
    if (!Number.isInteger(label) || label < 0 || label > 9 || !Array.isArray(tensor) || tensor.length < 784) {
      continue;
    }
    const outDir = path.join(OUT_ROOT, String(label));
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, `${base}-q${i + 1}.png`), tensorPngBuffer(tensor));
    imported++;
  }
}

console.log(`Imported ${imported} live OCR tensors into ${OUT_ROOT}`);
