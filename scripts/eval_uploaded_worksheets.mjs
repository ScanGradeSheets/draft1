#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_EXPECTED = [8, 4, 1, 9, 2, 7, 0, 5, 3, 6];
const DEFAULT_URL = process.env.SG_EVAL_URL || 'https://localhost:5174';
const DEFAULT_OUT = path.join(ROOT, 'benchmarks', 'uploaded_student_samples', 'results');
const OUT_DIR = process.env.SG_EVAL_OUT || DEFAULT_OUT;
const MODEL_PATH = process.env.SG_EVAL_MODEL_PATH || '/models/mnist-model.onnx';
const EXPECTED = (process.env.SG_EXPECTED_DIGITS || '')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isInteger(value));
const EXPECTED_DIGITS = EXPECTED.length === 10 ? EXPECTED : DEFAULT_EXPECTED;
const EXPECTED_ANSWERS = (process.env.SG_EXPECTED_ANSWERS || '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

function expectedAnswersForRow(row) {
  if (EXPECTED_ANSWERS.length > 0) return EXPECTED_ANSWERS;
  const groups = Array.isArray(row.questionGroups) ? row.questionGroups : [];
  const answers = groups
    .map((group) => group?.answer)
    .filter((answer) => answer !== undefined && answer !== null)
    .map((answer) => String(answer).trim());
  return answers.length > 0 ? answers : EXPECTED_DIGITS.map((digit) => String(digit));
}

function predictedAnswersForRow(row) {
  const groups = Array.isArray(row.questionGroups) ? row.questionGroups : [];
  const byId = new Map((row.predictions || []).map((prediction) => [prediction.id, prediction]));
  if (groups.length > 0) {
    return groups.map((group) => {
      const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : [];
      return ids.map((id) => byId.get(id)?.digit ?? '').join('');
    });
  }
  const expected = expectedAnswersForRow(row);
  if (expected.length > 0 && row.predictions.length > expected.length) {
    const groupedByQuestion = [];
    for (const prediction of row.predictions) {
      const idx = Number(prediction.questionNum) - 1;
      if (!Number.isInteger(idx) || idx < 0) continue;
      groupedByQuestion[idx] = `${groupedByQuestion[idx] || ''}${prediction.digit ?? ''}`;
    }
    const compact = groupedByQuestion.filter((value) => value !== undefined);
    if (compact.length === expected.length) return compact;
  }
  return (row.predictions || []).map((prediction) => String(prediction.digit));
}

function rowQuestionScore(row) {
  const predicted = predictedAnswersForRow(row);
  const expected = expectedAnswersForRow(row);
  const total = Math.min(predicted.length, expected.length);
  let correct = 0;
  for (let i = 0; i < total; i++) {
    if (String(predicted[i]) === String(expected[i])) correct++;
  }
  return {
    correct,
    total,
    predicted,
    expected
  };
}

function parseArgs(argv) {
  const opts = {
    url: DEFAULT_URL,
    outDir: OUT_DIR,
    modelPath: MODEL_PATH,
    files: []
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url') {
      opts.url = argv[++i];
    } else if (arg === '--out') {
      opts.outDir = path.resolve(argv[++i]);
    } else if (arg === '--model') {
      opts.modelPath = argv[++i];
    } else {
      opts.files.push(path.resolve(arg));
    }
  }
  return opts;
}

function sanitizeName(value) {
  return String(value)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function worksheetId(file) {
  const parent = sanitizeName(path.basename(path.dirname(file))).slice(0, 8);
  const base = sanitizeName(path.basename(file));
  return parent ? `${parent}-${base}` : base;
}

function dataUrlToBuffer(dataUrl) {
  if (typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:image\/(?:png|jpeg);base64,(.+)$/);
  return match ? Buffer.from(match[1], 'base64') : null;
}

function pct(value) {
  return Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : 'n/a';
}

function summarize(rows, opts) {
  const processed = rows.filter((row) => row.ok);
  const failed = rows.filter((row) => !row.ok);
  const questionScores = processed.map(rowQuestionScore);
  const totalCells = questionScores.reduce((sum, score) => sum + score.total, 0);
  const confidences = processed.flatMap((row) => row.predictions.map((pred) => pred.confidence));
  const correctCells = questionScores.reduce((sum, score) => sum + score.correct, 0);
  const perfectSheets = questionScores.filter((score) => score.total > 0 && score.correct === score.total).length;
  const lowConfidenceCells = processed.flatMap((row) =>
    row.predictions
      .filter((pred) => pred.confidence < 0.86 || pred.topGap < 0.18)
      .map((pred) => ({ sheet: row.id, questionNum: pred.questionNum, digit: pred.digit, confidence: pred.confidence, topGap: pred.topGap }))
  );
  const confusions = new Map();
  processed.forEach((row, rowIdx) => {
    const score = questionScores[rowIdx];
    score.predicted.forEach((predicted, idx) => {
      const expected = score.expected[idx];
      if (String(predicted) !== String(expected)) {
        const key = `${expected}->${predicted}`;
        confusions.set(key, (confusions.get(key) || 0) + 1);
      }
    });
  });
  const firstExpected = questionScores[0]?.expected || EXPECTED_DIGITS.map((digit) => String(digit));
  const perDigit = firstExpected.map((answer, idx) => {
    const total = processed.length;
    const correct = questionScores.reduce((sum, score) => (
      sum + Number(String(score.predicted[idx]) === String(answer))
    ), 0);
    return {
      questionNum: idx + 1,
      expected: answer,
      correct,
      total,
      accuracy: total ? correct / total : 0,
      accuracyPct: total ? `${(100 * correct / total).toFixed(1)}%` : 'n/a'
    };
  });
  return {
    generatedAt: new Date().toISOString(),
    url: opts.url,
    modelPath: opts.modelPath,
    expectedDigits: firstExpected,
    sheetsTotal: rows.length,
    sheetsProcessed: processed.length,
    sheetsFailed: failed.length,
    perfectSheets,
    cellAccuracy: totalCells ? correctCells / totalCells : 0,
    cellAccuracyPct: totalCells ? `${(100 * correctCells / totalCells).toFixed(1)}%` : 'n/a',
    avgConfidence: confidences.length ? confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length : null,
    avgConfidencePct: confidences.length ? pct(confidences.reduce((sum, confidence) => sum + confidence, 0) / confidences.length) : 'n/a',
    perDigit,
    lowConfidenceCells,
    topConfusions: Array.from(confusions.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([pair, count]) => ({ pair, count })),
    failures: failed.map((row) => ({ id: row.id, file: row.file, error: row.error }))
  };
}

function toMarkdown(summary, rows) {
  const lines = [];
  lines.push('# Uploaded Worksheet OCR Evaluation');
  lines.push('');
  lines.push(`- URL: ${summary.url}`);
  lines.push(`- Model: \`${summary.modelPath}\``);
  lines.push(`- Expected digits: ${summary.expectedDigits.join(', ')}`);
  lines.push(`- Sheets processed: ${summary.sheetsProcessed}/${summary.sheetsTotal}`);
  lines.push(`- Perfect sheets: ${summary.perfectSheets}/${summary.sheetsProcessed}`);
  lines.push(`- Cell accuracy: ${summary.cellAccuracyPct}`);
  lines.push(`- Average confidence: ${summary.avgConfidencePct}`);
  lines.push('');
  lines.push('| Sheet | Score | Predictions | Min Conf | Notes |');
  lines.push('|---|---:|---|---:|---|');
  for (const row of rows) {
    if (!row.ok) {
      lines.push(`| ${row.id} | fail | - | - | ${row.error.replace(/\|/g, '/')} |`);
      continue;
    }
    const score = rowQuestionScore(row);
    const minConf = Math.min(...row.predictions.map((pred) => pred.confidence));
    const notes = score.predicted
      .map((predicted, idx) => String(predicted) === String(score.expected[idx])
        ? null
        : `Q${idx + 1} ${score.expected[idx]}→${predicted}`
      )
      .filter(Boolean)
      .join('; ') || 'ok';
    lines.push(`| ${row.id} | ${score.correct}/${score.total} | ${score.predicted.join(' ')} | ${pct(minConf)} | ${notes} |`);
  }
  if (summary.topConfusions.length) {
    lines.push('');
    lines.push(`Top confusions: ${summary.topConfusions.map((item) => `${item.pair} (${item.count})`).join(', ')}`);
  }
  if (summary.perDigit.length) {
    lines.push('');
    lines.push('| Question | Expected | Accuracy |');
    lines.push('|---:|---:|---:|');
    for (const item of summary.perDigit) {
      lines.push(`| ${item.questionNum} | ${item.expected} | ${item.correct}/${item.total} (${item.accuracyPct}) |`);
    }
  }
  if (summary.failures.length) {
    lines.push('');
    lines.push(`Failures: ${summary.failures.map((item) => `${item.id}: ${item.error}`).join('; ')}`);
  }
  return lines.join('\n');
}

const opts = parseArgs(process.argv.slice(2));
const files = opts.files;
if (!files.length) {
  console.error('Usage: node scripts/eval_uploaded_worksheets.mjs [--url URL] [--model /models/model.onnx] [--out DIR] /path/to/photo1.jpg ...');
  process.exit(1);
}

await fs.mkdir(opts.outDir, { recursive: true });
await fs.mkdir(path.join(opts.outDir, 'debug'), { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(60000);

const rows = [];
for (const file of files) {
  const id = worksheetId(file);
  const debugDir = path.join(opts.outDir, 'debug', id);
  await fs.mkdir(debugDir, { recursive: true });
  const url = `${opts.url}/?mode=teacher&ocrdebug=1&ignoreQrHomography=1&modelPath=${encodeURIComponent(opts.modelPath)}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(
      () => typeof window !== 'undefined' && !!window.cv && typeof window.cv.Mat !== 'undefined',
      undefined,
      { timeout: 60000 }
    );
    await page.setInputFiles('input[type=file]', file);
    await page.waitForFunction(
      () => {
        const resultDigits = document.querySelectorAll('.ocr-result .digit .num').length;
        const errors = Array.from(document.querySelectorAll('.results-error,.error')).map((el) => (el.textContent || '').trim()).filter(Boolean);
        return resultDigits >= 10 || errors.length > 0;
      },
      undefined,
      { timeout: 60000 }
    );
    await page.waitForTimeout(500);
    const data = await page.evaluate(() => {
      const errors = Array.from(document.querySelectorAll('.results-error,.error'))
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean);
      const debug = window.__SCANGRADE_LIVE_OCR_DEBUG || null;
      return { errors, debug };
    });
    if (!data.debug?.predictions?.length) {
      const error = data.errors.join('; ') || 'No OCR debug payload was produced';
      rows.push({ id, file, ok: false, error });
      console.log(`[fail] ${id}: ${error}`);
      continue;
    }
    const row = {
      id,
      file,
      ok: true,
      expectedDigits: EXPECTED_DIGITS,
      predictions: data.debug.predictions.map((pred) => ({
        id: pred.id,
        questionNum: pred.questionNum,
        digit: pred.digit,
        confidence: pred.confidence,
        topGap: pred.topGap,
        topK: pred.topK
      })),
      questionGroups: data.debug.questionGroups || null,
      modelInfo: data.debug.modelInfo || null,
      layoutId: data.debug.layoutId || null
    };
    rows.push(row);
    await fs.writeFile(path.join(debugDir, 'ocr-debug.json'), JSON.stringify(data.debug, null, 2));
    const imageSets = [
      ['captured', [data.debug.capturedImageDataUrl]],
      ['warped', [data.debug.warpedDataUrl]],
      ['raw-q', data.debug.rawCropDataUrls || []],
      ['model-input-q', data.debug.modelInputDataUrls || []]
    ];
    for (const [prefix, dataUrls] of imageSets) {
      for (let i = 0; i < dataUrls.length; i++) {
        const buffer = dataUrlToBuffer(dataUrls[i]);
        if (!buffer) continue;
        const suffix = prefix.endsWith('-q') ? `${prefix}${i + 1}.png` : `${prefix}.png`;
        await fs.writeFile(path.join(debugDir, suffix), buffer);
      }
    }
    const score = rowQuestionScore(row);
    console.log(`[ok] ${id}: ${score.correct}/${score.total} pred=${score.predicted.join(',')}`);
  } catch (error) {
    const message = String(error?.message || error);
    rows.push({ id, file, ok: false, error: message });
    console.log(`[fail] ${id}: ${message}`);
  }
}

await browser.close();

const summary = summarize(rows, opts);
await fs.writeFile(path.join(opts.outDir, 'rows.json'), JSON.stringify(rows, null, 2));
await fs.writeFile(path.join(opts.outDir, 'summary.json'), JSON.stringify(summary, null, 2));
await fs.writeFile(path.join(opts.outDir, 'summary.md'), toMarkdown(summary, rows));
console.log(JSON.stringify(summary, null, 2));
