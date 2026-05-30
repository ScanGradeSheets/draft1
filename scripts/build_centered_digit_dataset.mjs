#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';

const ROOT = process.cwd();
const ANSWER_KEY = [8, 4, 1, 9, 2, 7, 0, 5, 3, 6];
const DEFAULT_BASE_RAW = path.join(ROOT, 'datasets', 'worksheet_digits_current_pipeline', 'raw');
const DEFAULT_STUDENT_RESULTS = path.join(ROOT, 'benchmarks', 'uploaded_student_samples', 'results-local-rerun');
const DEFAULT_OUT = path.join(ROOT, 'datasets', 'worksheet_digits_centered_20260515');
const DEFAULT_HOLDOUT = [
  'AFAA58CF-6-Photo-6',
  'AFAA58CF-9-Photo-9',
  'F0613532-7-Photo-7',
  '71D954DC-5-Photo-5',
  '71D954DC-8-Photo-8'
];

function parseList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function optsFromEnv() {
  return {
    baseRaw: path.resolve(process.env.SG_BASE_DATASET_RAW || DEFAULT_BASE_RAW),
    studentResults: path.resolve(process.env.SG_STUDENT_RESULTS_DIR || DEFAULT_STUDENT_RESULTS),
    out: path.resolve(process.env.SG_CENTERED_DATASET_OUT || DEFAULT_OUT),
    holdoutSheets: new Set(parseList(process.env.SG_HOLDOUT_SHEETS).length
      ? parseList(process.env.SG_HOLDOUT_SHEETS)
      : DEFAULT_HOLDOUT)
  };
}

async function resetClassDirs(root) {
  await fs.rm(root, { recursive: true, force: true });
  for (const split of ['train', 'val']) {
    for (let digit = 0; digit <= 9; digit++) {
      await fs.mkdir(path.join(root, split, String(digit)), { recursive: true });
    }
  }
}

async function listPngs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

async function loadPixels(file, targetSize = null) {
  const img = await loadImage(file);
  const w = targetSize || img.width;
  const h = targetSize || img.height;
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  return { data, width: w, height: h };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function sourceInkFromPixels(source) {
  const { data, width, height } = source;
  const lightness = new Float32Array(width * height);
  const sat = new Float32Array(width * height);
  const values = [];
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    lightness[i] = lum;
    sat[i] = max - min;
    values.push(lum);
  }

  const bg = percentile(values, 0.82);
  const darkness = new Float32Array(width * height);
  const positives = [];
  for (let i = 0; i < width * height; i++) {
    // Pencil is mostly darker than paper; orange crayon also has useful saturation.
    const v = Math.max(0, bg - lightness[i]) + Math.max(0, sat[i] - 18) * 0.25;
    darkness[i] = v;
    if (v > 2) positives.push(v);
  }
  const scale = Math.max(10, percentile(positives, 0.96));
  const ink = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const x = i % width;
    const y = Math.floor(i / width);
    const edge = x <= 1 || y <= 1 || x >= width - 2 || y >= height - 2;
    const v = Math.min(1, darkness[i] / scale);
    // Very dark edge pixels are usually remnants of the printed answer box.
    ink[i] = edge && v > 0.75 ? 0 : v;
  }
  removeLongEdgeLines(ink, width, height);
  return { ink, width, height };
}

function modelInputInkFromPixels(source) {
  const { data, width, height } = source;
  const ink = new Float32Array(width * height);
  let max = 0;
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const v = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    ink[i] = v;
    if (v > max) max = v;
  }
  if (max > 1e-6) {
    for (let i = 0; i < ink.length; i++) ink[i] /= max;
  }
  return { ink, width, height };
}

function removeLongEdgeLines(ink, width, height) {
  const threshold = 0.35;
  const rowLimit = width * 0.55;
  const colLimit = height * 0.55;
  for (let y = 0; y < height; y++) {
    let count = 0;
    for (let x = 0; x < width; x++) {
      if (ink[y * width + x] > threshold) count++;
    }
    if (count >= rowLimit && (y < height * 0.18 || y > height * 0.82)) {
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
        for (let x = 0; x < width; x++) ink[yy * width + x] = 0;
      }
    }
  }
  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < height; y++) {
      if (ink[y * width + x] > threshold) count++;
    }
    if (count >= colLimit && (x < width * 0.18 || x > width * 0.82)) {
      for (let y = 0; y < height; y++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
          ink[y * width + xx] = 0;
        }
      }
    }
  }
}

function centered28(mask) {
  const { ink, width, height } = mask;
  const points = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = ink[y * width + x];
      if (v > 0.16) points.push({ x, y, v });
    }
  }
  const out = createCanvas(28, 28);
  const ctx = out.getContext('2d');
  const image = ctx.createImageData(28, 28);
  if (!points.length) {
    ctx.putImageData(image, 0, 0);
    return out;
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const padX = Math.max(2, Math.round((maxX - minX + 1) * 0.18));
  const padY = Math.max(2, Math.round((maxY - minY + 1) * 0.18));
  minX = Math.max(0, minX - padX);
  minY = Math.max(0, minY - padY);
  maxX = Math.min(width - 1, maxX + padX);
  maxY = Math.min(height - 1, maxY + padY);
  const boxW = Math.max(1, maxX - minX + 1);
  const boxH = Math.max(1, maxY - minY + 1);
  const scale = Math.min(20 / boxW, 20 / boxH);
  const drawW = Math.max(1, boxW * scale);
  const drawH = Math.max(1, boxH * scale);
  const offsetX = (28 - drawW) / 2;
  const offsetY = (28 - drawH) / 2;

  for (let oy = 0; oy < 28; oy++) {
    for (let ox = 0; ox < 28; ox++) {
      const sx = minX + (ox + 0.5 - offsetX) / scale;
      const sy = minY + (oy + 0.5 - offsetY) / scale;
      let value = 0;
      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
        const x0 = Math.max(0, Math.min(width - 1, Math.floor(sx)));
        const y0 = Math.max(0, Math.min(height - 1, Math.floor(sy)));
        const x1 = Math.max(0, Math.min(width - 1, x0 + 1));
        const y1 = Math.max(0, Math.min(height - 1, y0 + 1));
        const fx = sx - x0;
        const fy = sy - y0;
        const a = ink[y0 * width + x0];
        const b = ink[y0 * width + x1];
        const c = ink[y1 * width + x0];
        const d = ink[y1 * width + x1];
        value = a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
      }
      const byte = Math.max(0, Math.min(255, Math.round(value * 255)));
      const idx = (oy * 28 + ox) * 4;
      image.data[idx] = byte;
      image.data[idx + 1] = byte;
      image.data[idx + 2] = byte;
      image.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  return out;
}

async function writeCanvasPng(canvas, file) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, canvas.toBuffer('image/png'));
}

async function copyBaseSamples(opts, counts) {
  for (let digit = 0; digit <= 9; digit++) {
    const files = await listPngs(path.join(opts.baseRaw, String(digit)));
    for (const file of files) {
      const pixels = await loadPixels(file, 28);
      const canvas = centered28(modelInputInkFromPixels(pixels));
      const name = `base-${path.basename(file)}`;
      await writeCanvasPng(canvas, path.join(opts.out, 'train', String(digit), name));
      counts.train[digit]++;
      counts.base++;
    }
  }
}

async function copyStudentSamples(opts, counts) {
  const debugDir = path.join(opts.studentResults, 'debug');
  const sheetEntries = await fs.readdir(debugDir, { withFileTypes: true });
  for (const entry of sheetEntries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const sheetId = entry.name;
    const split = opts.holdoutSheets.has(sheetId) ? 'val' : 'train';
    for (let q = 1; q <= 10; q++) {
      const label = ANSWER_KEY[q - 1];
      const file = path.join(debugDir, sheetId, `raw-q${q}.png`);
      const pixels = await loadPixels(file);
      const canvas = centered28(sourceInkFromPixels(pixels));
      const name = `student-${sheetId}-q${q}.png`;
      await writeCanvasPng(canvas, path.join(opts.out, split, String(label), name));
      counts[split][label]++;
      counts.student++;
    }
  }
}

const opts = optsFromEnv();
await resetClassDirs(opts.out);
const counts = {
  train: Array.from({ length: 10 }, () => 0),
  val: Array.from({ length: 10 }, () => 0),
  base: 0,
  student: 0
};
await copyBaseSamples(opts, counts);
await copyStudentSamples(opts, counts);
const summary = {
  generatedAt: new Date().toISOString(),
  baseRaw: opts.baseRaw,
  studentResults: opts.studentResults,
  out: opts.out,
  holdoutSheets: Array.from(opts.holdoutSheets),
  counts
};
await fs.writeFile(path.join(opts.out, 'centered-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
