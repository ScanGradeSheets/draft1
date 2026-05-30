#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const [debugPath, outDir = '/tmp/scangrade-crop-inspect'] = process.argv.slice(2);

if (!debugPath) {
  console.error('Usage: node scripts/inspect_live_debug_crops.mjs /path/to/scangrade-live-ocr-debug.json [out-dir]');
  process.exit(1);
}

const url = process.env.SG_REPLAY_URL || 'https://127.0.0.1:5174';
const debug = JSON.parse(await fs.readFile(debugPath, 'utf8'));
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.goto(`${url}/?liveOcrDebug=1`, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction(
  () => !!window.cv && typeof window.cv.Mat !== 'undefined',
  undefined,
  { timeout: 60000 }
);

const result = await page.evaluate(async ({ debug }) => {
  const { processWorksheet, preprocessToMNISTWithDebug } = await import('/src/homography.js');
  const { initDigitModel, recognizeDigits, recognizeDigitsRobust } = await import('/src/ocr-pipeline.js');
  await initDigitModel();
  window.__SCANGRADE_DEBUG_ANSWER_BOXES = true;
  const layoutPath = debug.layoutId ? `/layouts/${debug.layoutId}.json` : '/layouts/sg-10-box-v1.json';
  const layout = await fetch(layoutPath).then((r) => r.json());

  const img = new Image();
  img.src = debug.capturedImageDataUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const input = document.createElement('canvas');
  input.width = img.naturalWidth;
  input.height = img.naturalHeight;
  input.getContext('2d').drawImage(img, 0, 0);
  const src = cv.imread(input);
  const processed = processWorksheet(src, layout);
  src.delete();
  if (!processed) return null;

  const matDataUrl = (mat) => {
    const canvas = document.createElement('canvas');
    canvas.width = mat.cols;
    canvas.height = mat.rows;
    cv.imshow(canvas, mat);
    return canvas.toDataURL('image/png');
  };

  const tensorDataUrl = (tensor) => {
    const scale = 4;
    const canvas = document.createElement('canvas');
    canvas.width = 28 * scale;
    canvas.height = 28 * scale;
    const ctx = canvas.getContext('2d');
    const tiny = document.createElement('canvas');
    tiny.width = 28;
    tiny.height = 28;
    const tinyCtx = tiny.getContext('2d');
    const imageData = tinyCtx.createImageData(28, 28);
    for (let i = 0; i < 784; i++) {
      const value = Math.max(0, Math.min(255, Math.round((tensor[i] || 0) * 255)));
      imageData.data[i * 4] = value;
      imageData.data[i * 4 + 1] = value;
      imageData.data[i * 4 + 2] = value;
      imageData.data[i * 4 + 3] = 255;
    }
    tinyCtx.putImageData(imageData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tiny, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  };

  const classifyTensor = async (tensor) => {
    const data = new Float32Array(28 * 28);
    data.set(typeof tensor.subarray === 'function' ? tensor.subarray(0, 28 * 28) : tensor.slice(0, 28 * 28));
    let [prediction] = await recognizeDigits(data);
    const base = prediction;
    const topK = prediction.topK || [];
    const topGap = topK.length >= 2 ? topK[0].confidence - topK[1].confidence : 1;
    if (prediction.confidence < 0.86 || topGap < 0.18) {
      [prediction] = await recognizeDigitsRobust(data, prediction);
    }
    const finalTopK = prediction.topK || [];
    return {
      digit: prediction.digit,
      confidence: prediction.confidence,
      topGap: finalTopK.length >= 2 ? finalTopK[0].confidence - finalTopK[1].confidence : 1,
      topK: finalTopK.slice(0, 3),
      baseDigit: base.digit,
      baseConfidence: base.confidence,
      baseTopK: (base.topK || []).slice(0, 3),
      robust: prediction !== base
    };
  };

  const crops = [];
  const preprocessVariants = [
    {
      name: 'strict',
      options: (crop) => ({
        protectInteriorStrokes: crop.isVirtualDigitBox === true,
        strictLineRemoval: crop.isVirtualDigitBox === true
      })
    },
    {
      name: 'no-rule-cleanup',
      options: (crop) => ({
        protectInteriorStrokes: crop.isVirtualDigitBox === true,
        strictLineRemoval: crop.isVirtualDigitBox === true,
        skipRuleArtifactCleanup: true
      })
    },
    {
      name: 'no-component-cleanup',
      options: (crop) => ({
        protectInteriorStrokes: crop.isVirtualDigitBox === true,
        strictLineRemoval: crop.isVirtualDigitBox === true,
        skipPrintedLineCleanup: true
      })
    },
    {
      name: 'gentle',
      options: (crop) => ({
        protectInteriorStrokes: crop.isVirtualDigitBox === true,
        strictLineRemoval: false,
        skipRuleArtifactCleanup: true,
        skipPrintedLineCleanup: true
      })
    }
  ];
  for (const crop of processed.rawCrops) {
    const debugOut = preprocessToMNISTWithDebug(crop.image, {
      protectInteriorStrokes: crop.isVirtualDigitBox === true,
      strictLineRemoval: crop.isVirtualDigitBox === true
    });
    const variants = [];
    for (const variant of preprocessVariants) {
      const variantOut = preprocessToMNISTWithDebug(crop.image, variant.options(crop));
      variants.push({
        name: variant.name,
        ink: matDataUrl(variantOut.debug.inkMask),
        tensor: tensorDataUrl(variantOut.tensor),
        prediction: await classifyTensor(variantOut.tensor)
      });
      variantOut.debug.gray.delete();
      variantOut.debug.inkMask.delete();
      variantOut.debug.framed.delete();
    }
    crops.push({
      id: crop.id,
      questionNum: crop.questionNum,
      boxRect: crop.boxRect,
      cropRect: crop.cropRect,
      raw: matDataUrl(crop.image),
      gray: matDataUrl(debugOut.debug.gray),
      ink: matDataUrl(debugOut.debug.inkMask),
      tensor: tensorDataUrl(debugOut.tensor),
      prediction: await classifyTensor(debugOut.tensor),
      variants
    });
    debugOut.debug.gray.delete();
    debugOut.debug.inkMask.delete();
    debugOut.debug.framed.delete();
  }

  const warped = matDataUrl(processed.warpedImage);
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = processed.warpedImage.cols;
  overlayCanvas.height = processed.warpedImage.rows;
  cv.imshow(overlayCanvas, processed.warpedImage);
  const overlayCtx = overlayCanvas.getContext('2d');
  overlayCtx.lineWidth = 5;
  overlayCtx.font = '32px sans-serif';
  for (const crop of processed.rawCrops) {
    if (crop.boxRect) {
      overlayCtx.strokeStyle = 'rgba(0, 180, 255, 0.9)';
      overlayCtx.strokeRect(crop.boxRect.x, crop.boxRect.y, crop.boxRect.w, crop.boxRect.h);
    }
    if (crop.cropRect) {
      overlayCtx.strokeStyle = 'rgba(255, 80, 80, 0.95)';
      overlayCtx.strokeRect(crop.cropRect.x, crop.cropRect.y, crop.cropRect.w, crop.cropRect.h);
      overlayCtx.fillStyle = 'rgba(255, 80, 80, 0.95)';
      overlayCtx.fillText(String(crop.id), crop.cropRect.x + 4, crop.cropRect.y - 8);
    }
  }
  const overlay = overlayCanvas.toDataURL('image/png');
  processed.rawCrops.forEach((crop) => crop.image.delete());
  processed.warpedImage.delete();

  const answerBoxCandidates = window.__SCANGRADE_DEBUG_ANSWER_BOX_CANDIDATES || [];
  const answerBoxAssignments = window.__SCANGRADE_DEBUG_ANSWER_BOX_ASSIGNMENTS || [];
  const virtualFrames = window.__SCANGRADE_DEBUG_VIRTUAL_FRAMES || [];
  return { crops, warped, overlay, answerBoxCandidates, answerBoxAssignments, virtualFrames };
}, { debug });

await browser.close();

if (!result) {
  console.error('processWorksheet returned null');
  process.exit(2);
}

const writeDataUrl = async (filename, dataUrl) => {
  const data = dataUrl.split(',')[1];
  await fs.writeFile(path.join(outDir, filename), Buffer.from(data, 'base64'));
};

await writeDataUrl('warped.png', result.warped);
await writeDataUrl('overlay.png', result.overlay);
await fs.writeFile(path.join(outDir, 'crops.json'), JSON.stringify(
  result.crops.map(({ raw, gray, ink, tensor, ...crop }) => crop),
  null,
  2
));
await fs.writeFile(path.join(outDir, 'answer-box-candidates.json'), JSON.stringify(
  result.answerBoxCandidates,
  null,
  2
));
await fs.writeFile(path.join(outDir, 'answer-box-assignments.json'), JSON.stringify(
  result.answerBoxAssignments,
  null,
  2
));
await fs.writeFile(path.join(outDir, 'virtual-frames.json'), JSON.stringify(
  result.virtualFrames,
  null,
  2
));

for (const crop of result.crops) {
  const prefix = `crop-${String(crop.id).padStart(2, '0')}`;
  await writeDataUrl(`${prefix}-raw.png`, crop.raw);
  await writeDataUrl(`${prefix}-gray.png`, crop.gray);
  await writeDataUrl(`${prefix}-ink.png`, crop.ink);
  await writeDataUrl(`${prefix}-tensor.png`, crop.tensor);
  for (const variant of crop.variants || []) {
    await writeDataUrl(`${prefix}-${variant.name}-ink.png`, variant.ink);
    await writeDataUrl(`${prefix}-${variant.name}-tensor.png`, variant.tensor);
  }
}

console.log(outDir);
