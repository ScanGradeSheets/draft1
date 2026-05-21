#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'benchmarks', 'ocr_sanity', 'results');
const BASE_URL = process.env.SG_SANITY_URL || 'https://localhost:5175';

function dataUrlToBuffer(dataUrl) {
  const idx = dataUrl.indexOf(',');
  return Buffer.from(dataUrl.slice(idx + 1), 'base64');
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const worksheetFiles = ['sheet03.jpg', 'sheet06.jpg'];
  const worksheetData = {};
  for (const f of worksheetFiles) {
    const p = path.join(ROOT, 'benchmarks', 'worksheet_bakeoff', 'images', f);
    const b = await fs.readFile(p);
    worksheetData[f] = `data:image/jpeg;base64,${b.toString('base64')}`;
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/?mode=teacher&ocrdebug=1&ignoreQrHomography=1`, {
    waitUntil: 'networkidle',
    timeout: 45000
  });
  await page.waitForFunction(
    () => !!window.cv && typeof window.cv.Mat !== 'undefined',
    undefined,
    { timeout: 60000 }
  );

  const results = await page.evaluate(async ({ worksheetData }) => {
    const { preprocessToMNISTWithDebug, processWorksheet } = await import('/src/homography.js');
    const { initDigitModel, recognizeDigits } = await import('/src/ocr-pipeline.js');
    await initDigitModel();

    const matToDataUrl = (mat) => {
      const c = document.createElement('canvas');
      c.width = mat.cols;
      c.height = mat.rows;
      cv.imshow(c, mat);
      return c.toDataURL('image/png');
    };

    const runSample = async (id, sourceKind, rawMat, originalDataUrl, contextDataUrl = null) => {
      const rawDataUrl = matToDataUrl(rawMat);
      const prep = preprocessToMNISTWithDebug(rawMat);
      const finalDataUrl = (() => {
        const t = prep.tensor;
        const c = document.createElement('canvas');
        c.width = 28;
        c.height = 28;
        const ctx = c.getContext('2d');
        const idata = ctx.createImageData(28, 28);
        for (let i = 0; i < 784; i++) {
          const u = Math.max(0, Math.min(255, Math.round((t[i] ?? 0) * 255)));
          idata.data[i * 4] = u;
          idata.data[i * 4 + 1] = u;
          idata.data[i * 4 + 2] = u;
          idata.data[i * 4 + 3] = 255;
        }
        ctx.putImageData(idata, 0, 0);
        return c.toDataURL('image/png');
      })();
      const pred = await recognizeDigits(prep.tensor);
      const out = {
        id,
        sourceKind,
        original: originalDataUrl,
        context: contextDataUrl,
        raw: rawDataUrl,
        gray: prep.debug?.gray ? matToDataUrl(prep.debug.gray) : null,
        inkMask: prep.debug?.inkMask ? matToDataUrl(prep.debug.inkMask) : null,
        final28: finalDataUrl,
        predicted: pred[0].digit,
        confidence: pred[0].confidence,
        top3: pred[0].topK || [],
        probs: pred[0].probs || [],
        entropyNorm: pred[0].entropyNorm ?? null
      };
      if (prep.debug?.gray) prep.debug.gray.delete();
      if (prep.debug?.inkMask) prep.debug.inkMask.delete();
      if (prep.debug?.framed) prep.debug.framed.delete();
      return out;
    };

    const samples = [];

    // Clean synthetic digits
    for (const d of [0, 1, 4, 8, 9]) {
      const c = document.createElement('canvas');
      c.width = 180;
      c.height = 180;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 180, 180);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 132px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(d), 90, 98);
      const rawMat = cv.imread(c);
      samples.push(await runSample(`synthetic-${d}`, 'synthetic_clean', rawMat, c.toDataURL('image/png')));
      rawMat.delete();
    }

    // Adult-style handwritten-ish (font-based)
    for (const d of [0, 1, 4, 8, 9]) {
      const c = document.createElement('canvas');
      c.width = 180;
      c.height = 180;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 180, 180);
      ctx.save();
      ctx.translate(90, 90);
      ctx.rotate((d % 2 === 0 ? -1 : 1) * Math.PI / 40);
      ctx.translate(-90, -90);
      ctx.fillStyle = '#111';
      ctx.font = 'normal 134px \"Patrick Hand\", \"Comic Sans MS\", cursive';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(d), 90, 96);
      ctx.restore();
      const rawMat = cv.imread(c);
      samples.push(await runSample(`handstyle-${d}`, 'synthetic_handstyle', rawMat, c.toDataURL('image/png')));
      rawMat.delete();
    }

    // A few real worksheet cells (manual crop samples from actual sheets)
    const layout = await fetch('/layouts/sg-10-box-v1.json').then((r) => r.json());
    for (const [file, qList] of Object.entries({ 'sheet03.jpg': [1, 2, 4], 'sheet06.jpg': [1, 4, 10] })) {
      const img = new Image();
      img.src = worksheetData[file];
      await new Promise((res, rej) => {
        img.onload = res;
        img.onerror = rej;
      });
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const src = cv.imread(c);
      const result = processWorksheet(src, layout);
      src.delete();
      if (!result) continue;
      const { warpedImage, rawCrops } = result;
      for (const q of qList) {
        const idx = q - 1;
        const crop = rawCrops[idx];
        if (!crop) continue;
        const pad = Math.round(crop.cropRect.w * 0.35);
        const x = Math.max(0, crop.cropRect.x - pad);
        const y = Math.max(0, crop.cropRect.y - pad);
        const x2 = Math.min(warpedImage.cols, crop.cropRect.x + crop.cropRect.w + pad);
        const y2 = Math.min(warpedImage.rows, crop.cropRect.y + crop.cropRect.h + pad);
        const contextRoi = warpedImage.roi(new cv.Rect(x, y, Math.max(1, x2 - x), Math.max(1, y2 - y)));
        const contextMat = contextRoi.clone();
        contextRoi.delete();
        const contextUrl = matToDataUrl(contextMat);
        contextMat.delete();
        samples.push(
          await runSample(
            `${file.replace('.jpg', '')}-q${q}`,
            'worksheet_cell',
            crop.image,
            worksheetData[file],
            contextUrl
          )
        );
      }
      rawCrops.forEach((c0) => c0.image.delete());
      warpedImage.delete();
    }

    return samples;
  }, { worksheetData });

  const summary = [];
  for (const s of results) {
    const base = `${s.id}`;
    const files = {};
    const writeStage = async (key, dataUrl) => {
      if (!dataUrl) return null;
      const name = `${base}-${key}.png`;
      await fs.writeFile(path.join(OUT_DIR, name), dataUrlToBuffer(dataUrl));
      return name;
    };
    files.original = await writeStage('original', s.original);
    files.context = await writeStage('context', s.context);
    files.raw = await writeStage('raw', s.raw);
    files.gray = await writeStage('gray', s.gray);
    files.inkMask = await writeStage('inkmask', s.inkMask);
    files.final28 = await writeStage('final28', s.final28);
    summary.push({
      id: s.id,
      sourceKind: s.sourceKind,
      predicted: s.predicted,
      confidence: Number((s.confidence * 100).toFixed(1)),
      entropyNorm: s.entropyNorm == null ? null : Number((s.entropyNorm * 100).toFixed(1)),
      top3: s.top3?.map((t) => ({ digit: t.digit, confidence: Number((t.confidence * 100).toFixed(1)) })),
      probs: s.probs?.map((p) => Number((p * 100).toFixed(1))),
      files
    });
  }

  await fs.writeFile(path.join(OUT_DIR, 'summary.json'), JSON.stringify({ samples: summary }, null, 2));
  await browser.close();
  console.log(`Saved ${summary.length} sanity samples to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
