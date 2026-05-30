#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE_RAW = process.env.SG_BASE_DATASET_RAW ||
  path.join(ROOT, 'datasets', 'worksheet_digits_current_pipeline', 'raw');
const STUDENT_RAW = process.env.SG_STUDENT_DATASET_RAW ||
  path.join(ROOT, 'datasets', 'worksheet_digits_student_20260515', 'raw');
const EXTRA_RAWS = (process.env.SG_EXTRA_DATASET_RAWS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => path.resolve(ROOT, value));
const OUT_ROOT = process.env.SG_COMBINED_DATASET_OUT ||
  path.join(ROOT, 'datasets', 'worksheet_digits_combined_20260515');
const DEFAULT_HOLDOUT = [
  'AFAA58CF-6-Photo-6',
  'AFAA58CF-9-Photo-9',
  'F0613532-7-Photo-7',
  '71D954DC-5-Photo-5',
  '71D954DC-8-Photo-8'
];
const HOLDOUT_IDS = new Set(
  (process.env.SG_HOLDOUT_SHEETS || DEFAULT_HOLDOUT.join(','))
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
);

async function resetClassTree(root) {
  await fs.rm(root, { recursive: true, force: true });
  for (let digit = 0; digit <= 9; digit++) {
    await fs.mkdir(path.join(root, String(digit)), { recursive: true });
  }
}

async function listPngs(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.png'))
    .map((entry) => entry.name)
    .sort();
}

function sheetIdFromCropName(name) {
  return name.replace(/-q\d+\.png$/i, '');
}

async function copyRawTree(sourceRoot, targetRawRoot, prefix, summary) {
  for (let digit = 0; digit <= 9; digit++) {
    const label = String(digit);
    const sourceDir = path.join(sourceRoot, label);
    const targetDir = path.join(targetRawRoot, label);
    for (const name of await listPngs(sourceDir)) {
      const outName = `${prefix}-${name}`;
      await fs.copyFile(path.join(sourceDir, name), path.join(targetDir, outName));
      summary.raw[label] = (summary.raw[label] || 0) + 1;
    }
  }
}

async function copyToSplit(sourceRoot, splitRoot, prefix, chooseSplit, summary) {
  for (let digit = 0; digit <= 9; digit++) {
    const label = String(digit);
    const sourceDir = path.join(sourceRoot, label);
    for (const name of await listPngs(sourceDir)) {
      const split = chooseSplit(name);
      const targetDir = path.join(splitRoot, split, label);
      await fs.mkdir(targetDir, { recursive: true });
      await fs.copyFile(path.join(sourceDir, name), path.join(targetDir, `${prefix}-${name}`));
      summary[split][label] = (summary[split][label] || 0) + 1;
    }
  }
}

async function main() {
  const rawRoot = path.join(OUT_ROOT, 'raw');
  const trainRoot = path.join(OUT_ROOT, 'train');
  const valRoot = path.join(OUT_ROOT, 'val');
  await resetClassTree(rawRoot);
  await resetClassTree(trainRoot);
  await resetClassTree(valRoot);

  const summary = {
    generatedAt: new Date().toISOString(),
    baseRaw: BASE_RAW,
    studentRaw: STUDENT_RAW,
    extraRaws: EXTRA_RAWS,
    outRoot: OUT_ROOT,
    holdoutSheetIds: Array.from(HOLDOUT_IDS).sort(),
    raw: {},
    train: {},
    val: {}
  };

  await copyRawTree(BASE_RAW, rawRoot, 'base', summary);
  await copyRawTree(STUDENT_RAW, rawRoot, 'student', summary);
  for (let index = 0; index < EXTRA_RAWS.length; index++) {
    await copyRawTree(EXTRA_RAWS[index], rawRoot, `extra${index + 1}`, summary);
  }
  await copyToSplit(BASE_RAW, OUT_ROOT, 'base', () => 'train', summary);
  await copyToSplit(
    STUDENT_RAW,
    OUT_ROOT,
    'student',
    (name) => HOLDOUT_IDS.has(sheetIdFromCropName(name)) ? 'val' : 'train',
    summary
  );
  for (let index = 0; index < EXTRA_RAWS.length; index++) {
    await copyToSplit(EXTRA_RAWS[index], OUT_ROOT, `extra${index + 1}`, () => 'train', summary);
  }

  await fs.writeFile(path.join(OUT_ROOT, 'combined-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
