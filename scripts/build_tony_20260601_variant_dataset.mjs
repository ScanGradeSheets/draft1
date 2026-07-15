import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SOURCE_RAW = path.join(ROOT, 'datasets', 'worksheet_digits_tony_20260601', 'raw');
const OUT_ROOT = path.join(ROOT, 'datasets', 'worksheet_digits_tony_20260601_variants');
const OUT_RAW = path.join(OUT_ROOT, 'raw');

const CASES = [
  {
    slug: 'sub',
    debug: path.join(
      ROOT,
      'benchmarks',
      'uploaded_student_samples',
      'results-20260601-stable1-subtraction',
      'debug',
      'B4230AEB-1-Photo-1',
      'ocr-debug.json'
    ),
    answers: ['17', '16', '13', '12', '13', '13', '12', '12', '16', '12']
  },
  {
    slug: 'add',
    debug: path.join(
      ROOT,
      'benchmarks',
      'uploaded_student_samples',
      'results-20260601-stable1-addition',
      'debug',
      'B4230AEB-2-Photo-2',
      'ocr-debug.json'
    ),
    answers: ['15', '15', '17', '13', '19', '11', '12', '17', '13', '19']
  },
  {
    slug: 'mixed',
    debug: path.join(
      ROOT,
      'benchmarks',
      'uploaded_student_samples',
      'results-20260601-stable1-mixed',
      'debug',
      'B4230AEB-3-Photo-3',
      'ocr-debug.json'
    ),
    answers: ['37', '29', '33', '28', '44', '24', '37', '38', '41', '15']
  }
];

function sanitize(value) {
  return String(value || 'variant').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '') || 'variant';
}

function tensorToPngBuffer(values) {
  if (!Array.isArray(values) || values.length !== 28 * 28) {
    throw new Error(`Expected a 28x28 tensor, got ${Array.isArray(values) ? values.length : typeof values}`);
  }
  const png = new PNG({ width: 28, height: 28, colorType: 0 });
  for (let i = 0; i < values.length; i += 1) {
    const value = Math.max(0, Math.min(255, Math.round((Number(values[i]) || 0) * 255)));
    png.data[i] = value;
  }
  return PNG.sync.write(png);
}

async function ensureClassDirs() {
  await fs.mkdir(OUT_RAW, { recursive: true });
  for (let digit = 0; digit <= 9; digit += 1) {
    await fs.mkdir(path.join(OUT_RAW, String(digit)), { recursive: true });
  }
}

function labelForTensor(tensor, answers) {
  const questionIndex = Number(tensor.questionNum) - 1;
  const answer = answers[questionIndex];
  if (!answer || !Array.isArray(answer.split(''))) return null;
  const digitIndex = Number(tensor.id) % 2;
  const label = answer[digitIndex];
  return /^[0-9]$/.test(label) ? label : null;
}

async function writeTensor(label, filename, tensor) {
  const outPath = path.join(OUT_RAW, label, filename);
  await fs.writeFile(outPath, tensorToPngBuffer(tensor));
}

async function importCase(sample) {
  const data = JSON.parse(await fs.readFile(sample.debug, 'utf8'));
  let written = 0;
  for (const tensorRow of data.tensors || []) {
    const label = labelForTensor(tensorRow, sample.answers);
    if (!label) continue;
    const baseName = `tony-20260601-${sample.slug}-q${tensorRow.questionNum}-cell${tensorRow.id}`;
    if (Array.isArray(tensorRow.tensor)) {
      await writeTensor(label, `${baseName}-base.png`, tensorRow.tensor);
      written += 1;
    }
    for (const variant of tensorRow.tensorVariants || []) {
      if (!Array.isArray(variant.tensor)) continue;
      await writeTensor(label, `${baseName}-${sanitize(variant.name)}.png`, variant.tensor);
      written += 1;
    }
  }
  return written;
}

await fs.mkdir(OUT_ROOT, { recursive: true });
await fs.cp(SOURCE_RAW, OUT_RAW, { recursive: true, force: true });
await ensureClassDirs();

const imports = {};
for (const sample of CASES) {
  imports[sample.slug] = await importCase(sample);
}

const perDigit = {};
for (let digit = 0; digit <= 9; digit += 1) {
  const label = String(digit);
  const files = await fs.readdir(path.join(OUT_RAW, label));
  perDigit[label] = files.filter((file) => file.endsWith('.png')).length;
}

const summary = {
  generatedAt: new Date().toISOString(),
  sourceRaw: SOURCE_RAW,
  outRaw: OUT_RAW,
  imports,
  perDigit,
  total: Object.values(perDigit).reduce((sum, count) => sum + count, 0)
};

await fs.writeFile(path.join(OUT_ROOT, 'variant-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
