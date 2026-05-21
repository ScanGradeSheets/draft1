#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DATASET_ROOT = path.join(ROOT, 'datasets', 'worksheet_digits');
const RAW_ROOT = path.join(DATASET_ROOT, 'raw');
const TRAIN_ROOT = path.join(DATASET_ROOT, 'train');
const VAL_ROOT = path.join(DATASET_ROOT, 'val');
const SEED = 42;
const TRAIN_PER_CLASS = 7; // with 8 samples/class -> 7 train, 1 val
const IGNORE_SHEETS = new Set(
  (process.env.SG_IGNORE_SHEETS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function listPngs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.png'))
    .filter((e) => {
      const sheetId = e.name.split('-q')[0];
      return !IGNORE_SHEETS.has(sheetId);
    })
    .map((e) => e.name)
    .sort();
}

async function resetDir(dir) {
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  await resetDir(TRAIN_ROOT);
  await resetDir(VAL_ROOT);

  const rng = mulberry32(SEED);
  const summary = {
    seed: SEED,
    trainPerClass: TRAIN_PER_CLASS,
    ignoredSheets: Array.from(IGNORE_SHEETS),
    perDigit: {}
  };

  for (let d = 0; d <= 9; d++) {
    const label = String(d);
    const rawDir = path.join(RAW_ROOT, label);
    const files = await listPngs(rawDir);
    if (files.length < 2) {
      throw new Error(`Need >=2 samples in ${rawDir}, found ${files.length}`);
    }

    // deterministic shuffle
    const arr = [...files];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    const trainCount = Math.min(TRAIN_PER_CLASS, arr.length - 1);
    const train = arr.slice(0, trainCount);
    const val = arr.slice(trainCount);

    const trainDir = path.join(TRAIN_ROOT, label);
    const valDir = path.join(VAL_ROOT, label);
    await fs.mkdir(trainDir, { recursive: true });
    await fs.mkdir(valDir, { recursive: true });

    for (const f of train) {
      await fs.copyFile(path.join(rawDir, f), path.join(trainDir, f));
    }
    for (const f of val) {
      await fs.copyFile(path.join(rawDir, f), path.join(valDir, f));
    }

    summary.perDigit[label] = { raw: arr.length, train: train.length, val: val.length };
  }

  const out = path.join(DATASET_ROOT, 'split-summary.json');
  await fs.writeFile(out, JSON.stringify(summary, null, 2));
  console.log('Wrote', out);
  console.log(JSON.stringify(summary.perDigit));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
