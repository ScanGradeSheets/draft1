#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const MANIFEST_PATH = path.join(ROOT, 'benchmarks', 'worksheet_bakeoff', 'manifest.json');
const IMAGES_DIR = path.join(ROOT, 'benchmarks', 'worksheet_bakeoff', 'images');
const OUT_ROOT = path.join(ROOT, 'datasets', 'worksheet_digits', 'raw');
const DEBUG_ROOT = path.join(ROOT, 'benchmarks', 'worksheet_bakeoff', 'results', 'export_debug');

const BASE_URL = process.env.SG_EXPORT_URL || 'https://localhost:5175';
const MODEL_PATH = process.env.SG_EXPORT_MODEL_PATH || '/models/mnist-model.onnx';
const PAGE_URL = `${BASE_URL}/?mode=teacher&ocrdebug=1&ignoreQrHomography=1&modelPath=${encodeURIComponent(MODEL_PATH)}`;
const ALIGNMENT_REVIEW_WARNING = 'Alignment fallback was used for this page. Results may be unreliable and should be reviewed manually.';

async function readManifest() {
  const raw = await fs.readFile(MANIFEST_PATH, 'utf8');
  const m = JSON.parse(raw);
  if (!Array.isArray(m.sheets) || m.sheets.length === 0) {
    throw new Error('Manifest must contain non-empty sheets array.');
  }
  for (const s of m.sheets) {
    if (!s.id || !s.file || !Array.isArray(s.expected_digits) || s.expected_digits.length !== 10) {
      throw new Error(`Invalid sheet entry in manifest: ${JSON.stringify(s)}`);
    }
  }
  return m.sheets;
}

function sanitizeId(v) {
  return String(v).replace(/[^a-zA-Z0-9_-]/g, '');
}

async function ensureDirs() {
  for (let d = 0; d <= 9; d++) {
    await fs.mkdir(path.join(OUT_ROOT, String(d)), { recursive: true });
  }
  await fs.mkdir(DEBUG_ROOT, { recursive: true });
}

async function writeDataUrl(filePath, dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
    return false;
  }
  const b64 = dataUrl.split(',')[1];
  await fs.writeFile(filePath, Buffer.from(b64, 'base64'));
  return true;
}

async function run() {
  const sheets = await readManifest();
  await ensureDirs();

  const counts = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [String(i), 0]));
  const skipped = [];

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();

  for (const sheet of sheets) {
    const sheetId = sanitizeId(sheet.id);
    const imgPath = path.join(IMAGES_DIR, sheet.file);
    await fs.access(imgPath);

    await page.addInitScript(() => {
      window.__SCANGRADE_DEBUG_OCR_INPUTS = true;
    });
    await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForFunction(
      () => !!window.cv && typeof window.cv.Mat !== 'undefined',
      undefined,
      { timeout: 60000 }
    );

    await page.setInputFiles('input[type=file]', imgPath);
    await page.waitForTimeout(9000);

    const state = await page.evaluate((alignmentReviewWarning) => {
      const messages = Array.from(document.querySelectorAll('.results-error'))
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean);
      const err = messages.find((text) => text !== alignmentReviewWarning) || '';
      const warnings = messages.filter((text) => text === alignmentReviewWarning);
      const pre = Array.isArray(window.__SCANGRADE_DEBUG_PREPROCESSED)
        ? window.__SCANGRADE_DEBUG_PREPROCESSED
        : [];
      const raw = Array.isArray(window.__SCANGRADE_DEBUG_RAW_CROPS)
        ? window.__SCANGRADE_DEBUG_RAW_CROPS
        : [];
      return {
        err,
        warnings,
        preLen: pre.length,
        rawLen: raw.length,
        pre,
        raw,
        warped: window.__SCANGRADE_DEBUG_WARPED || null,
        markerDebug: {
          fallbackUsed: !!window.__SCANGRADE_DEBUG_FALLBACK_USED,
          fallbackValid: !!window.__SCANGRADE_DEBUG_FALLBACK_VALID,
          pageRectEstimateUsed: !!window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_USED,
          markerCountAfterLoop: Number(window.__SCANGRADE_DEBUG_MARKER_COUNT_AFTER_LOOP ?? 0),
          pageRoi: window.__SCANGRADE_DEBUG_PAGE_ROI || null,
          pageQuad: window.__SCANGRADE_DEBUG_PAGE_QUAD || null,
          position: window.__SCANGRADE_DEBUG_POSITION || null,
          minMaxArea: window.__SCANGRADE_DEBUG_MIN_MAX_AREA || null,
          contours: Array.isArray(window.__SCANGRADE_DEBUG_CONTOURS)
            ? window.__SCANGRADE_DEBUG_CONTOURS
            : []
        }
      };
    }, ALIGNMENT_REVIEW_WARNING);

    const debugDir = path.join(DEBUG_ROOT, sheetId);
    await fs.mkdir(debugDir, { recursive: true });
    await fs.writeFile(
      path.join(debugDir, 'debug.json'),
      JSON.stringify(
        {
          sheet: sheetId,
          file: sheet.file,
          expectedDigits: sheet.expected_digits,
          error: state.err || null,
          warnings: state.warnings || [],
          rawLen: state.rawLen,
          preLen: state.preLen,
          markerDebug: state.markerDebug
        },
        null,
        2
      )
    );
    await writeDataUrl(path.join(debugDir, 'warped.png'), state.warped);
    for (let i = 0; i < state.raw.length; i++) {
      await writeDataUrl(path.join(debugDir, `raw-q${i + 1}.png`), state.raw[i]);
    }
    for (let i = 0; i < state.pre.length; i++) {
      await writeDataUrl(path.join(debugDir, `pre-q${i + 1}.png`), state.pre[i]);
    }

    if (state.err || state.preLen < 10) {
      skipped.push({
        sheet: sheetId,
        file: sheet.file,
        reason: state.err || `preprocessed_count_${state.preLen}`
      });
      console.log(`[skip] ${sheetId}: ${state.err || `preprocessed_count_${state.preLen}`}`);
      continue;
    }

    for (let i = 0; i < 10; i++) {
      const label = Number(sheet.expected_digits[i]);
      if (!Number.isInteger(label) || label < 0 || label > 9) {
        skipped.push({
          sheet: sheetId,
          file: sheet.file,
          reason: `invalid_label_q${i + 1}_${sheet.expected_digits[i]}`
        });
        continue;
      }
      const dataUrl = state.pre[i];
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,')) {
        skipped.push({
          sheet: sheetId,
          file: sheet.file,
          reason: `missing_preprocessed_q${i + 1}`
        });
        continue;
      }

      const outName = `${sheetId}-q${i + 1}.png`;
      const outPath = path.join(OUT_ROOT, String(label), outName);
      const b64 = dataUrl.split(',')[1];
      await fs.writeFile(outPath, Buffer.from(b64, 'base64'));
      counts[String(label)] += 1;
    }
    console.log(`[ok] ${sheetId}: exported 10 labeled crops`);
  }

  await browser.close();

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    modelPath: MODEL_PATH,
    sheetsTotal: sheets.length,
    perDigitCounts: counts,
    skipped
  };
  const summaryPath = path.join(OUT_ROOT, 'export-summary.json');
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  console.log('\nExport complete.');
  console.log('Per-digit counts:', JSON.stringify(counts));
  console.log('Skipped:', skipped.length);
  console.log('Summary:', summaryPath);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
