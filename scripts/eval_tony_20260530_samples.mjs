#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_URL = process.env.SG_EVAL_URL || 'https://localhost:5174';
const DEFAULT_MODEL = process.env.SG_EVAL_MODEL_PATH || '/models/worksheet-digit-tony-generalist-aug-strong-20260601.onnx';
const FIXTURE_DIR = path.join(
  ROOT,
  'benchmarks',
  'uploaded_student_samples',
  'fixtures',
  'tony-20260530-two-digit-sheets'
);
const DEFAULT_OUT = path.join(
  ROOT,
  'benchmarks',
  'uploaded_student_samples',
  'results-tony-20260530-repeatable'
);

const CASES = [
  {
    id: 'subtraction-within-20',
    file: path.join(FIXTURE_DIR, 'subtraction-within-20.jpg'),
    expected: [17, 15, 12, 12, 12, 12, 12, 12, 14, 11]
  },
  {
    id: 'mixed-within-50',
    file: path.join(FIXTURE_DIR, 'mixed-within-50.jpg'),
    expected: [37, 29, 43, 28, 42, 25, 37, 38, 41, 15]
  },
  {
    id: 'addition-within-20',
    file: path.join(FIXTURE_DIR, 'addition-within-20.jpg'),
    expected: [15, 15, 17, 13, 19, 11, 12, 17, 13, 19]
  }
];

function parseArgs(argv) {
  const opts = {
    url: DEFAULT_URL,
    model: DEFAULT_MODEL,
    outDir: DEFAULT_OUT
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url') {
      opts.url = argv[++i];
    } else if (arg === '--model') {
      opts.model = argv[++i];
    } else if (arg === '--out') {
      opts.outDir = path.resolve(argv[++i]);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

function runNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit'
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: node ${args.join(' ')}`));
      }
    });
  });
}

function pairDigits(predictions) {
  const pairs = [];
  for (let i = 0; i < predictions.length; i += 2) {
    pairs.push(Number(`${predictions[i]?.digit ?? ''}${predictions[i + 1]?.digit ?? ''}`));
  }
  return pairs;
}

function scorePairs(actual, expected) {
  return actual.reduce((sum, value, idx) => sum + Number(value === expected[idx]), 0);
}

function toMarkdown(summary) {
  const lines = [
    '# Tony 2026-05-30 Two-Digit OCR Benchmark',
    '',
    `- URL: ${summary.url}`,
    `- Model: \`${summary.model}\``,
    `- Total: ${summary.totalCorrect}/${summary.totalQuestions}`,
    '',
    '| Sheet | Score | Predicted | Expected |',
    '|---|---:|---|---|'
  ];
  for (const row of summary.rows) {
    lines.push(`| ${row.id} | ${row.correct}/10 | ${row.predicted.join(', ')} | ${row.expected.join(', ')} |`);
  }
  lines.push('');
  lines.push('Note: the underlying evaluator still prints an older digit-level summary. Use this pair-level summary for current two-digit worksheets.');
  return lines.join('\n');
}

const opts = parseArgs(process.argv.slice(2));

await fs.mkdir(opts.outDir, { recursive: true });

const rows = [];
for (const testCase of CASES) {
  const caseOut = path.join(opts.outDir, testCase.id);
  await runNode(
    [
      'scripts/eval_uploaded_worksheets.mjs',
      '--url',
      opts.url,
      '--model',
      opts.model,
      '--out',
      caseOut,
      testCase.file
    ],
    {
      SG_EXPECTED_DIGITS: testCase.expected.join(',')
    }
  );

  const rawRows = JSON.parse(await fs.readFile(path.join(caseOut, 'rows.json'), 'utf8'));
  const predictions = rawRows[0]?.predictions || [];
  const predicted = pairDigits(predictions);
  const correct = scorePairs(predicted, testCase.expected);
  rows.push({
    id: testCase.id,
    file: path.relative(ROOT, testCase.file),
    expected: testCase.expected,
    predicted,
    correct
  });
}

const summary = {
  generatedAt: new Date().toISOString(),
  url: opts.url,
  model: opts.model,
  rows,
  totalCorrect: rows.reduce((sum, row) => sum + row.correct, 0),
  totalQuestions: rows.length * 10
};

await fs.writeFile(path.join(opts.outDir, 'pair-summary.json'), JSON.stringify(summary, null, 2));
await fs.writeFile(path.join(opts.outDir, 'pair-summary.md'), toMarkdown(summary));

console.log('\n=== TWO-DIGIT PAIR SUMMARY ===');
for (const row of rows) {
  console.log(`${row.id}: ${row.correct}/10 predicted=${row.predicted.join(',')} expected=${row.expected.join(',')}`);
}
console.log(`Total: ${summary.totalCorrect}/${summary.totalQuestions}`);
