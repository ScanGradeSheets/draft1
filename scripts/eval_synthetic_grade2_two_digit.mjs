#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const DEFAULT_URL = process.env.SG_REPLAY_URL || 'https://127.0.0.1:5175';
const OUT_DIR = process.env.SG_SYNTH_OUT || '/tmp/scangrade-synth-grade2';
const STRICT_CLASSIFIER = process.env.SG_SYNTH_STRICT_CLASSIFIER === '1';
const SHEETS = [
  'g2-add-within-20-v1',
  'g2-sub-within-20-v1',
  'g2-mixed-within-50-v1'
];
const VARIANTS = [
  { name: 'flat' },
  {
    name: 'skew-left',
    dst: [[145, 80], [1585, 165], [1505, 2120], [70, 2025]]
  },
  {
    name: 'skew-right',
    dst: [[90, 150], [1540, 60], [1640, 2030], [175, 2145]]
  },
  {
    name: 'far-low-light',
    dst: [[185, 210], [1515, 180], [1475, 1975], [225, 2025]],
    shade: true
  },
  {
    name: 'center-drift',
    digitShift: 'toward-guide',
    dst: [[115, 110], [1565, 130], [1530, 2060], [125, 2085]]
  },
  {
    name: 'edge-drift-shadow',
    digitShift: 'toward-outer-edge',
    shade: true,
    dst: [[170, 210], [1520, 95], [1635, 2015], [95, 2095]]
  },
  {
    name: 'steep-guide-drift-shadow',
    digitShift: 'toward-guide',
    shade: true,
    dst: [[245, 235], [1495, 120], [1630, 2055], [135, 1985]]
  }
];

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(`${DEFAULT_URL}/?liveOcrDebug=1`, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction(
  () => !!window.cv && typeof window.cv.Mat !== 'undefined',
  undefined,
  { timeout: 60000 }
);

const results = [];
for (const layoutId of SHEETS) {
  for (const variant of VARIANTS) {
    const result = await page.evaluate(async ({ layoutId, variant }) => {
    const { processWorksheet } = await import('/src/homography.js');
    const { initDigitModel, recognizeDigits, recognizeDigitsRobust } = await import('/src/ocr-pipeline.js');
    const layout = await fetch(`/layouts/${layoutId}.json`).then((r) => r.json());
    await initDigitModel();

    const svgUrl = `/worksheets/${layoutId
      .replace('g2-add-within-20-v1', 'grade2-addition-within-20-v1')
      .replace('g2-sub-within-20-v1', 'grade2-subtraction-within-20-v1')
      .replace('g2-mixed-within-50-v1', 'grade2-mixed-within-50-v1')}.svg`;

    const img = new Image();
    img.src = svgUrl;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 1700;
    canvas.height = 2200;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const scaleX = 1700;
    const scaleY = 2200;
    const boxes = Array.isArray(layout.boxes) ? layout.boxes : [];
    ctx.fillStyle = 'rgba(65, 65, 65, 0.88)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    boxes.forEach((box, index) => {
      const left = (box.x - box.width) * scaleX;
      const top = (box.y - box.height) * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;
      const digit = layout.answer_key?.[index];
      if (digit == null) return;
      const fontSize = Math.round(h * 0.92);
      const digitIndex = Number.isFinite(box.digit_index) ? Number(box.digit_index) : index % 2;
      const drift = variant.digitShift === 'toward-guide'
        ? (digitIndex === 0 ? w * 0.22 : -w * 0.22)
        : variant.digitShift === 'toward-outer-edge'
          ? (digitIndex === 0 ? -w * 0.18 : w * 0.18)
          : 0;
      ctx.save();
      ctx.translate(left + w * 0.54 + drift, top + h * (0.51 + ((index % 3) - 1) * 0.025));
      ctx.rotate(((index % 5) - 2) * 0.018);
      ctx.font = `400 ${fontSize}px "Marker Felt", "Comic Sans MS", "Chalkboard SE", sans-serif`;
      ctx.fillText(String(digit), 0, 0);
      ctx.restore();
    });

    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = canvas.width;
    captureCanvas.height = canvas.height;
    if (Array.isArray(variant.dst)) {
      const srcMat = cv.imread(canvas);
      const dstMat = new cv.Mat(canvas.height, canvas.width, cv.CV_8UC4, new cv.Scalar(255, 255, 255, 255));
      const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,
        canvas.width, 0,
        canvas.width, canvas.height,
        0, canvas.height
      ]);
      const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, variant.dst.flat());
      const transform = cv.getPerspectiveTransform(srcTri, dstTri);
      cv.warpPerspective(
        srcMat,
        dstMat,
        transform,
        new cv.Size(canvas.width, canvas.height),
        cv.INTER_LINEAR,
        cv.BORDER_CONSTANT,
        new cv.Scalar(255, 255, 255, 255)
      );
      cv.imshow(captureCanvas, dstMat);
      srcMat.delete();
      dstMat.delete();
      srcTri.delete();
      dstTri.delete();
      transform.delete();
    } else {
      captureCanvas.getContext('2d').drawImage(canvas, 0, 0);
    }
    if (variant.shade) {
      const shadeCtx = captureCanvas.getContext('2d');
      const gradient = shadeCtx.createLinearGradient(0, 0, captureCanvas.width, captureCanvas.height);
      gradient.addColorStop(0, 'rgba(0,0,0,0.18)');
      gradient.addColorStop(0.55, 'rgba(0,0,0,0.02)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.24)');
      shadeCtx.fillStyle = gradient;
      shadeCtx.fillRect(0, 0, captureCanvas.width, captureCanvas.height);
    }

    const src = cv.imread(captureCanvas);
    const processed = processWorksheet(src, layout);
    src.delete();
    if (!processed) return { ok: false, layoutId, reason: 'processWorksheet returned null' };

    const predictions = [];
    const cropQuality = [];
    for (const tensor of processed.processedTensors) {
      let inkPixels = 0;
      let minX = 28;
      let minY = 28;
      let maxX = -1;
      let maxY = -1;
      for (let i = 0; i < tensor.tensor.length; i++) {
        const value = tensor.tensor[i] || 0;
        if (value <= 0.16) continue;
        const y = Math.floor(i / 28);
        const x = i - y * 28;
        inkPixels++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      const inkW = maxX >= minX ? maxX - minX + 1 : 0;
      const inkH = maxY >= minY ? maxY - minY + 1 : 0;
      cropQuality.push({
        id: tensor.id,
        inkPixels,
        inkW,
        inkH,
        ok: inkPixels >= 14 && inkW >= 3 && inkH >= 8
      });

      let [prediction] = await recognizeDigits(tensor.tensor);
      const topK = prediction.topK || [];
      const topGap = topK.length >= 2 ? topK[0].confidence - topK[1].confidence : 1;
      if (prediction.confidence < 0.86 || topGap < 0.18) {
        [prediction] = await recognizeDigitsRobust(tensor.tensor, prediction);
      }
      predictions.push({
        id: tensor.id,
        digit: prediction.digit,
        confidence: prediction.confidence,
        topK: prediction.topK || []
      });
    }

    const tensorPreviewDataUrl = () => {
      const scale = 4;
      const cell = 28 * scale;
      const cols = 10;
      const rows = Math.ceil(processed.processedTensors.length / cols);
      const c = document.createElement('canvas');
      c.width = cols * cell;
      c.height = rows * cell;
      const tctx = c.getContext('2d');
      tctx.fillStyle = '#000';
      tctx.fillRect(0, 0, c.width, c.height);
      processed.processedTensors.forEach((item, index) => {
        const tiny = document.createElement('canvas');
        tiny.width = 28;
        tiny.height = 28;
        const tinyCtx = tiny.getContext('2d');
        const data = tinyCtx.createImageData(28, 28);
        for (let i = 0; i < 784; i++) {
          const v = Math.max(0, Math.min(255, Math.round((item.tensor[i] || 0) * 255)));
          data.data[i * 4] = v;
          data.data[i * 4 + 1] = v;
          data.data[i * 4 + 2] = v;
          data.data[i * 4 + 3] = 255;
        }
        tinyCtx.putImageData(data, 0, 0);
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(tiny, (index % cols) * cell, Math.floor(index / cols) * cell, cell, cell);
      });
      return c.toDataURL('image/png');
    };

    const correct = predictions.reduce(
      (sum, pred, index) => sum + Number(pred.digit === layout.answer_key[index]),
      0
    );
    const preview = tensorPreviewDataUrl();
    processed.rawCrops.forEach((crop) => crop.image.delete());
    processed.warpedImage.delete();

    return {
      ok: true,
      layoutId,
      variant: variant.name,
      correct,
      total: layout.answer_key.length,
      structuralOk: cropQuality.filter((quality) => quality.ok).length,
      cropQuality,
      expected: layout.answer_key,
      predictions: predictions.map((prediction) => prediction.digit),
      minConfidence: Math.min(...predictions.map((prediction) => prediction.confidence)),
      renderedDataUrl: captureCanvas.toDataURL('image/png'),
      preview
    };
    }, { layoutId, variant });

    results.push(result);

    const writeDataUrl = async (filename, dataUrl) => {
      if (!dataUrl) return;
      const data = dataUrl.split(',')[1];
      await fs.writeFile(path.join(OUT_DIR, filename), Buffer.from(data, 'base64'));
    };
    await writeDataUrl(`${layoutId}-${variant.name}.png`, result.renderedDataUrl);
    await writeDataUrl(`${layoutId}-${variant.name}-model-input.png`, result.preview);
  }
}

await browser.close();

for (const result of results) {
  if (!result.ok) {
    console.log(`${result.layoutId}/${result.variant || 'unknown'}: failed (${result.reason})`);
    continue;
  }
  console.log(`${result.layoutId}/${result.variant}: ${result.correct}/${result.total} pred=[${result.predictions.join(',')}] min_conf=${result.minConfidence.toFixed(3)}`);
  const weak = result.cropQuality.filter((quality) => !quality.ok);
  console.log(`  structural crops: ${result.structuralOk}/${result.total}${weak.length ? ` weak=${JSON.stringify(weak)}` : ''}`);
}

const tested = results.filter((result) => result.ok);
const structuralOk = tested.reduce((sum, result) => sum + result.structuralOk, 0);
const structuralTotal = tested.reduce((sum, result) => sum + result.total, 0);
const classifierCorrectCells = tested.reduce((sum, result) => sum + result.correct, 0);
const classifierTotalCells = tested.reduce((sum, result) => sum + result.total, 0);
console.log('');
console.log(`Structural crop total: ${structuralOk}/${structuralTotal}`);
console.log(`Synthetic classifier total: ${classifierCorrectCells}/${classifierTotalCells}`);

const structurallySound = results.every((result) => result.ok && result.structuralOk === result.total);
const classifierCorrect = results.every((result) => result.ok && result.correct === result.total);
process.exit(structurallySound && (!STRICT_CLASSIFIER || classifierCorrect) ? 0 : 1);
