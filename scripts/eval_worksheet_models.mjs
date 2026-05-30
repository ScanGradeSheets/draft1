#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const BENCH_DIR = path.join(ROOT, 'benchmarks', 'worksheet_bakeoff');
const IMAGES_DIR = path.join(BENCH_DIR, 'images');
const MANIFEST_PATH = path.join(BENCH_DIR, 'manifest.json');
const OUT_DIR = process.env.SG_BAKEOFF_OUT_DIR
  ? path.resolve(ROOT, process.env.SG_BAKEOFF_OUT_DIR)
  : path.join(BENCH_DIR, 'results');

const BASE_URL = process.env.SG_BAKEOFF_URL || 'https://localhost:5174';
const MODELS = [
  { id: 'current_app_model', modelPath: '/models/mnist-model.onnx', note: 'Current app model (baseline)' },
  { id: 'mnist7_alt', modelPath: '/models/mnist-7.onnx', note: 'ONNX Zoo mnist-7 export' },
  { id: 'mnist12_alt', modelPath: '/models/mnist-12.onnx', note: 'ONNX Zoo mnist-12 export' },
  { id: 'mnist12_int8_ref', modelPath: '/models/mnist-12-int8.onnx', note: 'ONNX Zoo quantized mnist-12-int8' }
];
const MODEL_FILTER = (process.env.SG_EVAL_MODELS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const ACTIVE_MODELS = MODEL_FILTER.length
  ? MODELS.filter((m) => MODEL_FILTER.includes(m.id))
  : MODELS;
const ALIGNMENT_REVIEW_WARNING = 'Alignment fallback was used for this page. Results may be unreliable and should be reviewed manually.';

function confusionKey(expected, predicted) {
  return `${expected}->${predicted}`;
}

function formatPct(n, d) {
  if (!d) return '0.0%';
  return `${(100 * n / d).toFixed(1)}%`;
}

async function loadManifest() {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const obj = JSON.parse(raw);
  if (!Array.isArray(obj.sheets) || obj.sheets.length === 0) {
    throw new Error('manifest.json must contain non-empty "sheets" array');
  }
  for (const s of obj.sheets) {
    if (!s.id || !s.file || !Array.isArray(s.expected_digits) || s.expected_digits.length !== 10) {
      throw new Error(`Invalid manifest entry: ${JSON.stringify(s)}`);
    }
  }
  return obj.sheets;
}

async function runSingle(page, sheet, modelPath) {
  const url = `${BASE_URL}/?mode=teacher&ocrdebug=1&ignoreQrHomography=1&modelPath=${encodeURIComponent(modelPath)}`;
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  // Ensure browser OpenCV runtime is ready (same dependency path as real app).
  await page.waitForFunction(
    () => typeof window !== 'undefined' && !!window.cv && typeof window.cv.Mat !== 'undefined',
    undefined,
    { timeout: 60000 }
  );
  const imgPath = path.join(IMAGES_DIR, sheet.file);
  await fs.access(imgPath);
  await page.setInputFiles('input[type=file]', imgPath);

  await page.waitForTimeout(9000);
  const resultMessages = await page.$$eval('.results-error', (els) => els.map((el) => (el.textContent || '').trim()).filter(Boolean));
  const reviewWarnings = resultMessages.filter((text) => text === ALIGNMENT_REVIEW_WARNING);
  const errorText = resultMessages.find((text) => text !== ALIGNMENT_REVIEW_WARNING) || '';
  const digits = await page.$$eval('.ocr-result .digit .num', (els) => els.map((e) => Number((e.textContent || '').trim())));
  const confidences = await page.$$eval('.ocr-result .digit .conf', (els) =>
    els.map((e) => Number((e.textContent || '').replace('%', '').trim()) / 100)
  );
  const liveDebug = await page.evaluate(() => {
    const debug = window.__SCANGRADE_LIVE_OCR_DEBUG;
    if (!debug || !Array.isArray(debug.predictions)) return null;
    return {
      predictions: debug.predictions.map((prediction) => ({
        id: prediction.id,
        questionNum: prediction.questionNum,
        digit: prediction.digit,
        confidence: prediction.confidence,
        topGap: prediction.topGap,
        reviewNeeded: prediction.reviewNeeded,
        topK: Array.isArray(prediction.topK)
          ? prediction.topK.slice(0, 3).map((item) => ({
              digit: item.digit,
              confidence: item.confidence
            }))
          : []
      }))
    };
  }).catch(() => null);
  const modelShaLine = await page
    .$eval('.marker-debug-kv div:nth-child(11)', (el) => (el.textContent || '').trim())
    .catch(() => '');
  return { errorText, reviewWarnings, digits, confidences, modelShaLine, liveDebug };
}

function summarizeModel(model, rows) {
  const failures = rows.filter((r) => r.errorText);
  const valid = rows.filter((r) => !r.errorText && r.digits.length === 10);
  const reviewWarnings = rows.filter((r) => Array.isArray(r.reviewWarnings) && r.reviewWarnings.length > 0);
  const totalCells = valid.length * 10;
  let correct = 0;
  let confSum = 0;
  let confCount = 0;
  const confusions = new Map();

  for (const r of valid) {
    for (let i = 0; i < 10; i++) {
      const exp = r.expected_digits[i];
      const got = r.digits[i];
      if (exp === got) correct++;
      else {
        const key = confusionKey(exp, got);
        confusions.set(key, (confusions.get(key) || 0) + 1);
      }
      const c = r.confidences[i];
      if (Number.isFinite(c)) {
        confSum += c;
        confCount++;
      }
    }
  }

  const topConfusions = Array.from(confusions.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([k, n]) => ({ pair: k, count: n }));

  return {
    model: model.id,
    modelPath: model.modelPath,
    note: model.note,
    sheetsProcessed: rows.length,
    sheetsSucceeded: valid.length,
    sheetsFailed: failures.length,
    cellAccuracy: totalCells ? Number((correct / totalCells).toFixed(4)) : 0,
    cellAccuracyPct: formatPct(correct, totalCells),
    avgConfidence: confCount ? Number((confSum / confCount).toFixed(4)) : 0,
    avgConfidencePct: confCount ? `${(100 * confSum / confCount).toFixed(1)}%` : 'n/a',
    topConfusions,
    reviewWarnings: reviewWarnings.map((r) => ({ sheet: r.id, warnings: r.reviewWarnings })),
    failures: failures.map((f) => ({ sheet: f.id, error: f.errorText }))
  };
}

function toMarkdown(summary) {
  const lines = [];
  lines.push('# Worksheet OCR Model Bake-off');
  lines.push('');
  for (const m of summary.models) {
    lines.push(`## ${m.model}`);
    lines.push(`- Path: \`${m.modelPath}\``);
    lines.push(`- Note: ${m.note}`);
    lines.push(`- Sheets: ${m.sheetsSucceeded}/${m.sheetsProcessed} succeeded`);
    lines.push(`- Cell accuracy: ${m.cellAccuracyPct}`);
    lines.push(`- Avg confidence: ${m.avgConfidencePct}`);
    if (m.topConfusions.length) {
      lines.push(`- Top confusions: ${m.topConfusions.map((c) => `${c.pair} (${c.count})`).join(', ')}`);
    } else {
      lines.push('- Top confusions: none');
    }
    if (m.failures.length) {
      lines.push(`- Failures: ${m.failures.map((f) => `${f.sheet}: ${f.error}`).join(' | ')}`);
    }
    if (m.reviewWarnings?.length) {
      lines.push(`- Review warnings: ${m.reviewWarnings.map((w) => `${w.sheet}: ${w.warnings.join('; ')}`).join(' | ')}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

async function main() {
  const sheets = await loadManifest();
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  const perModelRows = {};
  for (const model of ACTIVE_MODELS) {
    perModelRows[model.id] = [];
    for (const sheet of sheets) {
      const r = await runSingle(page, sheet, model.modelPath);
      perModelRows[model.id].push({ ...sheet, ...r });
      const reviewCells = r.liveDebug?.predictions?.filter((prediction) => prediction.reviewNeeded).length ?? 0;
      console.log(`[${model.id}] ${sheet.id}: digits=${JSON.stringify(r.digits)} reviewCells=${reviewCells} err=${r.errorText || 'none'}`);
    }
  }

  await browser.close();

  const models = ACTIVE_MODELS.map((m) => summarizeModel(m, perModelRows[m.id]));
  const out = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    sheets: sheets.length,
    models,
    rows: perModelRows
  };
  await fs.writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify(out, null, 2));
  await fs.writeFile(path.join(OUT_DIR, 'summary.md'), toMarkdown(out));
  console.log(`\nSaved: ${path.join(OUT_DIR, 'summary.json')}`);
  console.log(`Saved: ${path.join(OUT_DIR, 'summary.md')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
