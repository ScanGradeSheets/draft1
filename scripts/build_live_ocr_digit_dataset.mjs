#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

function parseArgs() {
  const files = [];
  const opts = {
    out: '/tmp/scangrade-live-ocr-digits',
    labelMode: 'trusted',
    variants: 'all',
    baseRaw: ''
  };
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (arg === '--out') opts.out = process.argv[++i] || opts.out;
    else if (arg === '--label-mode') opts.labelMode = process.argv[++i] || opts.labelMode;
    else if (arg === '--variants') opts.variants = process.argv[++i] || opts.variants;
    else if (arg === '--base-raw') opts.baseRaw = process.argv[++i] || opts.baseRaw;
    else files.push(arg);
  }
  return { files, opts };
}

function sanitize(value) {
  return String(value || 'item')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-|-$/g, '') || 'item';
}

function tensorToPngBuffer(values) {
  if (!Array.isArray(values) || values.length !== 28 * 28) {
    throw new Error(`Expected 784 tensor values, got ${Array.isArray(values) ? values.length : typeof values}`);
  }
  const png = new PNG({ width: 28, height: 28, colorType: 0 });
  for (let i = 0; i < values.length; i += 1) {
    const value = Math.max(0, Math.min(255, Math.round((Number(values[i]) || 0) * 255)));
    png.data[i] = value;
  }
  return PNG.sync.write(png);
}

function isManualCorrection(prediction) {
  return Boolean(prediction?.manualCorrected || Object.prototype.hasOwnProperty.call(prediction || {}, 'originalDigit'));
}

function labelFor({ labelMode, prediction, answerKeyDigit }) {
  const savedDigit = Number(prediction?.digit);
  const keyDigit = Number(answerKeyDigit);
  const manual = isManualCorrection(prediction);
  if (labelMode === 'answerKey') return Number.isInteger(keyDigit) ? keyDigit : null;
  if (labelMode === 'savedPredictions') return Number.isInteger(savedDigit) ? savedDigit : null;
  if (labelMode === 'manualOnly') return manual && Number.isInteger(savedDigit) ? savedDigit : null;
  if (labelMode === 'trusted') {
    if (manual && Number.isInteger(savedDigit)) return savedDigit;
    if (Number.isInteger(savedDigit) && Number.isInteger(keyDigit) && savedDigit === keyDigit) return keyDigit;
    return null;
  }
  throw new Error(`Unknown --label-mode ${labelMode}`);
}

function tensorsFor(row, variants) {
  const out = [];
  if (variants === 'base' || variants === 'all') {
    if (Array.isArray(row?.tensor)) out.push({ name: 'base', tensor: row.tensor });
  }
  if (variants === 'all') {
    for (const variant of row?.tensorVariants || []) {
      if (Array.isArray(variant?.tensor)) out.push({ name: sanitize(variant.name), tensor: variant.tensor });
    }
  }
  if (variants !== 'base' && variants !== 'all') {
    throw new Error(`Unknown --variants ${variants}`);
  }
  return out;
}

const { files, opts } = parseArgs();
if (!files.length) {
  console.error('Usage: node scripts/build_live_ocr_digit_dataset.mjs [--out /tmp/out] [--label-mode trusted|manualOnly|savedPredictions|answerKey] [--variants all|base] /path/to/scangrade-live-ocr-debug-*.json');
  process.exit(2);
}

await fs.rm(opts.out, { recursive: true, force: true });
if (opts.baseRaw) {
  await fs.cp(opts.baseRaw, path.join(opts.out, 'raw'), { recursive: true, force: true });
}
for (let digit = 0; digit <= 9; digit += 1) {
  await fs.mkdir(path.join(opts.out, 'raw', String(digit)), { recursive: true });
}

const summary = {
  generatedAt: new Date().toISOString(),
  out: opts.out,
  labelMode: opts.labelMode,
  variants: opts.variants,
  baseRaw: opts.baseRaw,
  files: [],
  perDigit: Object.fromEntries(Array.from({ length: 10 }, (_, digit) => [String(digit), 0])),
  importedDigits: 0,
  importedImages: 0,
  skippedDigits: 0,
  manualDigits: 0
};

for (const file of files.sort()) {
  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  const predictions = Array.isArray(debug.predictions) ? debug.predictions : [];
  const answerKey = Array.isArray(debug.answerKey) ? debug.answerKey : [];
  const tensors = Array.isArray(debug.tensors) ? debug.tensors : [];
  const fileSummary = {
    file: path.basename(file),
    importedDigits: 0,
    importedImages: 0,
    skippedDigits: 0,
    manualDigits: 0
  };
  const base = sanitize(path.basename(file, '.json').replace(/^scangrade-live-ocr-debug-/, 'live'));
  for (let index = 0; index < tensors.length; index += 1) {
    const prediction = predictions[index];
    const label = labelFor({ labelMode: opts.labelMode, prediction, answerKeyDigit: answerKey[index] });
    const manual = isManualCorrection(prediction);
    if (!Number.isInteger(label) || label < 0 || label > 9) {
      summary.skippedDigits += 1;
      fileSummary.skippedDigits += 1;
      continue;
    }
    const images = tensorsFor(tensors[index], opts.variants);
    if (!images.length) {
      summary.skippedDigits += 1;
      fileSummary.skippedDigits += 1;
      continue;
    }
    summary.importedDigits += 1;
    fileSummary.importedDigits += 1;
    if (manual) {
      summary.manualDigits += 1;
      fileSummary.manualDigits += 1;
    }
    for (const image of images) {
      const filename = `${base}-d${index + 1}-${sanitize(image.name)}.png`;
      await fs.writeFile(path.join(opts.out, 'raw', String(label), filename), tensorToPngBuffer(image.tensor));
      summary.perDigit[String(label)] += 1;
      summary.importedImages += 1;
      fileSummary.importedImages += 1;
    }
  }
  summary.files.push(fileSummary);
}

await fs.writeFile(path.join(opts.out, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
