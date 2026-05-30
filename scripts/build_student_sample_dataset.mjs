#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const RESULTS_DIR = process.env.SG_STUDENT_RESULTS_DIR ||
  path.join(ROOT, 'benchmarks', 'uploaded_student_samples', 'results');
const OUT_ROOT = process.env.SG_STUDENT_DATASET_OUT ||
  path.join(ROOT, 'datasets', 'worksheet_digits_student_20260515', 'raw');

async function ensureClassDirs(root) {
  await fs.rm(root, { recursive: true, force: true });
  for (let digit = 0; digit <= 9; digit++) {
    await fs.mkdir(path.join(root, String(digit)), { recursive: true });
  }
}

async function main() {
  const rowsPath = path.join(RESULTS_DIR, 'rows.json');
  const rows = JSON.parse(await fs.readFile(rowsPath, 'utf8'));
  await ensureClassDirs(OUT_ROOT);

  const counts = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), 0]));
  const skipped = [];

  for (const row of rows) {
    if (!row.ok || !Array.isArray(row.expectedDigits) || row.expectedDigits.length !== 10) {
      skipped.push({ id: row.id, reason: row.error || 'missing_expected_digits' });
      continue;
    }
    const debugDir = path.join(RESULTS_DIR, 'debug', row.id);
    for (let idx = 0; idx < 10; idx++) {
      const label = Number(row.expectedDigits[idx]);
      if (!Number.isInteger(label) || label < 0 || label > 9) {
        skipped.push({ id: row.id, questionNum: idx + 1, reason: `bad_label_${row.expectedDigits[idx]}` });
        continue;
      }
      const inputPath = path.join(debugDir, `model-input-q${idx + 1}.png`);
      const outName = `${row.id}-q${idx + 1}.png`;
      await fs.copyFile(inputPath, path.join(OUT_ROOT, String(label), outName));
      counts[String(label)] += 1;
    }
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    resultsDir: RESULTS_DIR,
    outRoot: OUT_ROOT,
    sheets: rows.filter((row) => row.ok).length,
    cells: Object.values(counts).reduce((sum, count) => sum + count, 0),
    perDigitCounts: counts,
    skipped
  };
  await fs.writeFile(path.join(OUT_ROOT, 'student-sample-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
