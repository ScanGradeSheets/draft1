#!/usr/bin/env node
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_URL = process.env.SG_EVAL_URL || 'https://localhost:5174';
const DEFAULT_MODEL = process.env.SG_EVAL_MODEL_PATH || '/models/mnist-model.onnx';

function parseArgs(argv) {
  const opts = {
    url: DEFAULT_URL,
    modelPath: DEFAULT_MODEL,
    files: []
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--url') {
      opts.url = argv[++i];
    } else if (arg === '--model') {
      opts.modelPath = argv[++i];
    } else {
      opts.files.push(path.resolve(arg));
    }
  }
  return opts;
}

const opts = parseArgs(process.argv.slice(2));
if (!opts.files.length) {
  console.error('Usage: node scripts/inspect_uploaded_worksheet.mjs [--url URL] [--model /models/model.onnx] /path/to/photo.jpg [...]');
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.setDefaultTimeout(60000);

const results = [];
for (const file of opts.files) {
  const url = `${opts.url}/?mode=teacher&ocrdebug=1&ignoreQrHomography=1&modelPath=${encodeURIComponent(opts.modelPath)}`;
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
      const errors = Array.from(document.querySelectorAll('.results-error,.error'))
        .map((el) => (el.textContent || '').trim())
        .filter(Boolean);
      return resultDigits >= 10 || errors.length > 0;
    },
    undefined,
    { timeout: 60000 }
  );
  await page.waitForTimeout(500);

  const data = await page.evaluate(() => {
    const debug = window.__SCANGRADE_LIVE_OCR_DEBUG || {};
    const snapshot = window.__SCANGRADE_MARKER_DEBUG_LAST || {};
    const preds = Array.isArray(debug.predictions)
      ? debug.predictions.map((pred) => ({
          questionNum: pred.questionNum,
          digit: pred.digit,
          confidence: pred.confidence,
          topGap: pred.topGap
        }))
      : [];
    return {
      predictions: preds,
      markerDebug: {
        fullFrameAnchors: window.__SCANGRADE_DEBUG_FULL_FRAME_ANCHORS || null,
        fullFrameValid: window.__SCANGRADE_DEBUG_FULL_FRAME_VALID ?? null,
        fullFrameMarkersUsed: window.__SCANGRADE_DEBUG_FULL_FRAME_MARKERS_USED ?? null,
        fallbackUsed: window.__SCANGRADE_DEBUG_FALLBACK_USED ?? null,
        fallbackValid: window.__SCANGRADE_DEBUG_FALLBACK_VALID ?? null,
        pageRectEstimateUsed: window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_USED ?? null,
        pageRectEstimateRejected: window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_REJECTED ?? null,
        pageRoi: window.__SCANGRADE_DEBUG_PAGE_ROI || null,
        pageQuad: window.__SCANGRADE_DEBUG_PAGE_QUAD || null,
        position: window.__SCANGRADE_DEBUG_POSITION || null,
        contours: Array.isArray(window.__SCANGRADE_DEBUG_CONTOURS)
          ? window.__SCANGRADE_DEBUG_CONTOURS
              .filter((item) => item.passedApprox || !item.reject)
              .slice(0, 20)
          : null,
        snapshot
      },
      cropRects: Array.isArray(window.__SCANGRADE_LIVE_OCR_DEBUG?.tensors)
        ? window.__SCANGRADE_LIVE_OCR_DEBUG.tensors.map((item) => ({
            id: item.id,
            questionNum: item.questionNum
          }))
        : []
    };
  });
  results.push({ file, ...data });
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
