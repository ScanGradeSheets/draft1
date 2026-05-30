#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';

const ROOT = process.cwd();
const DEFAULT_TRAIN = path.join(ROOT, 'datasets', 'worksheet_digits_combined_20260515', 'train');
const DEFAULT_EVAL = path.join(ROOT, 'datasets', 'worksheet_digits_combined_20260515', 'val');

function parseArgs(argv) {
  const opts = {
    train: DEFAULT_TRAIN,
    eval: DEFAULT_EVAL,
    threshold: 0.06,
    center: true,
    k: 4,
    temp: 0.018
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--train') opts.train = path.resolve(argv[++i]);
    else if (arg === '--eval') opts.eval = path.resolve(argv[++i]);
    else if (arg === '--threshold') opts.threshold = Number(argv[++i]);
    else if (arg === '--no-center') opts.center = false;
    else if (arg === '--k') opts.k = Number(argv[++i]);
    else if (arg === '--temp') opts.temp = Number(argv[++i]);
  }
  return opts;
}

async function imageVector(file) {
  const img = await loadImage(file);
  const canvas = createCanvas(28, 28);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 28, 28);
  const data = ctx.getImageData(0, 0, 28, 28).data;
  const out = new Float32Array(28 * 28);
  for (let i = 0; i < out.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    out[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return out;
}

function shiftVector(vec, dx, dy) {
  const out = new Float32Array(vec.length);
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx >= 0 && sx < 28 && sy >= 0 && sy < 28) {
        out[y * 28 + x] = vec[sy * 28 + sx];
      }
    }
  }
  return out;
}

function centerInk(vec) {
  let sum = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const v = Math.max(0, vec[y * 28 + x]);
      const w = v * v;
      sum += w;
      sx += x * w;
      sy += y * w;
    }
  }
  if (sum <= 1e-6) return vec;
  const dx = Math.max(-5, Math.min(5, Math.round(13.5 - sx / sum)));
  const dy = Math.max(-5, Math.min(5, Math.round(13.5 - sy / sum)));
  return shiftVector(vec, dx, dy);
}

function downsample2(vec) {
  const out = new Float32Array(14 * 14);
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 14; x++) {
      const i0 = (y * 2) * 28 + x * 2;
      out[y * 14 + x] = (vec[i0] + vec[i0 + 1] + vec[i0 + 28] + vec[i0 + 29]) / 4;
    }
  }
  return out;
}

function normalizeVector(vec, opts) {
  let out = new Float32Array(vec.length);
  let max = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i] < opts.threshold ? 0 : vec[i];
    out[i] = v;
    if (v > max) max = v;
  }
  if (max > 1e-6) {
    for (let i = 0; i < out.length; i++) out[i] = out[i] / max;
  }
  if (opts.center) out = centerInk(out);
  return {
    full: out,
    half: downsample2(out)
  };
}

function mse(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return sum / a.length;
}

function distance(a, b) {
  return (0.55 * mse(a.full, b.full)) + (0.45 * mse(a.half, b.half));
}

async function loadDataset(root, opts) {
  const samples = [];
  for (let digit = 0; digit <= 9; digit++) {
    const dir = path.join(root, String(digit));
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) continue;
      const file = path.join(dir, entry.name);
      samples.push({
        label: digit,
        name: entry.name,
        file,
        feature: normalizeVector(await imageVector(file), opts)
      });
    }
  }
  return samples;
}

function predict(sample, prototypes, opts) {
  const byLabel = Array.from({ length: 10 }, () => []);
  for (const proto of prototypes) {
    byLabel[proto.label].push(distance(sample.feature, proto.feature));
  }
  const labelRows = byLabel.map((distances, label) => {
    const sorted = distances.sort((a, b) => a - b);
    const k = Math.max(1, Math.min(opts.k, sorted.length));
    const avg = sorted.slice(0, k).reduce((sum, value) => sum + value, 0) / k;
    return { label, distance: avg, nearest: sorted[0] };
  });
  const minDist = Math.min(...labelRows.map((row) => row.distance));
  const weights = labelRows.map((row) => Math.exp(-(row.distance - minDist) / opts.temp));
  const total = weights.reduce((sum, value) => sum + value, 0) || 1;
  const ranked = labelRows
    .map((row, idx) => ({ digit: row.label, confidence: weights[idx] / total, distance: row.distance, nearest: row.nearest }))
    .sort((a, b) => b.confidence - a.confidence);
  return {
    digit: ranked[0].digit,
    confidence: ranked[0].confidence,
    topK: ranked.slice(0, 3)
  };
}

function summarize(evalSamples, prototypes, opts, title) {
  let correct = 0;
  const rows = [];
  const confusions = new Map();
  for (const sample of evalSamples) {
    const pred = predict(sample, prototypes, opts);
    if (pred.digit === sample.label) correct++;
    else {
      const key = `${sample.label}->${pred.digit}`;
      confusions.set(key, (confusions.get(key) || 0) + 1);
    }
    rows.push({ name: sample.name, expected: sample.label, ...pred });
  }
  const topConfusions = Array.from(confusions.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`${title}: ${correct}/${evalSamples.length} (${(100 * correct / Math.max(1, evalSamples.length)).toFixed(1)}%)`);
  if (topConfusions.length) {
    console.log(`  confusions: ${topConfusions.map(([pair, count]) => `${pair} (${count})`).join(', ')}`);
  }
  for (const row of rows.filter((item) => item.digit !== item.expected).slice(0, 30)) {
    console.log(`  miss ${row.name}: ${row.expected}->${row.digit} conf=${(100 * row.confidence).toFixed(1)} top=${row.topK.map((t) => `${t.digit}:${(100 * t.confidence).toFixed(0)}`).join('/')}`);
  }
  return { correct, total: evalSamples.length, rows, topConfusions };
}

const opts = parseArgs(process.argv.slice(2));
const trainSamples = await loadDataset(opts.train, opts);
const evalSamples = await loadDataset(opts.eval, opts);
console.log(`train=${trainSamples.length} eval=${evalSamples.length} threshold=${opts.threshold} center=${opts.center} k=${opts.k} temp=${opts.temp}`);
summarize(trainSamples, trainSamples, opts, 'train');
summarize(evalSamples, trainSamples, opts, 'eval');
