#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const DEFAULT_URL = process.env.SG_REPLAY_URL || 'https://localhost:5174';

function parseArgs() {
  const files = [];
  let url = DEFAULT_URL;
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--url') {
      url = process.argv[++i] || url;
    } else {
      files.push(arg);
    }
  }
  return { files, url };
}

const args = parseArgs();
if (!args.files.length) {
  console.error('Usage: node scripts/eval_ipad_tta.mjs [--url URL] /path/to/scangrade-live-ocr-debug-*.json');
  process.exit(2);
}

const captures = [];
for (const file of args.files.sort()) {
  const debug = JSON.parse(await fs.readFile(file, 'utf8'));
  if (!Array.isArray(debug.tensors) || !Array.isArray(debug.answerKey)) continue;
  captures.push({
    file: path.basename(file),
    answerKey: debug.answerKey,
    tensors: debug.tensors.map((item) => item.tensor)
  });
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
await page.goto(`${args.url}/?liveOcrDebug=1`, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction(
  () => !!window.cv && typeof window.cv.Mat !== 'undefined',
  undefined,
  { timeout: 60000 }
);

const results = await page.evaluate(async ({ captures }) => {
  const { initDigitModel, recognizeDigits } = await import('/src/ocr-pipeline.js');
  await initDigitModel();

  const SIZE = 28;
  const LEN = SIZE * SIZE;

  function shiftTensor(src, dx, dy) {
    const out = new Float32Array(LEN);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const sx = x - dx;
        const sy = y - dy;
        if (sx < 0 || sx >= SIZE || sy < 0 || sy >= SIZE) continue;
        out[y * SIZE + x] = src[sy * SIZE + sx];
      }
    }
    return out;
  }

  function rescaleTensor(src, scale) {
    const out = new Float32Array(LEN);
    const cx = (SIZE - 1) / 2;
    const cy = (SIZE - 1) / 2;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const sx = cx + (x - cx) / scale;
        const sy = cy + (y - cy) / scale;
        if (sx < 0 || sx > SIZE - 1 || sy < 0 || sy > SIZE - 1) continue;
        const x0 = Math.floor(sx);
        const y0 = Math.floor(sy);
        const x1 = Math.min(SIZE - 1, x0 + 1);
        const y1 = Math.min(SIZE - 1, y0 + 1);
        const fx = sx - x0;
        const fy = sy - y0;
        const top = src[y0 * SIZE + x0] * (1 - fx) + src[y0 * SIZE + x1] * fx;
        const bottom = src[y1 * SIZE + x0] * (1 - fx) + src[y1 * SIZE + x1] * fx;
        out[y * SIZE + x] = top * (1 - fy) + bottom * fy;
      }
    }
    return out;
  }

  function sharpenTensor(src, amount) {
    const out = new Float32Array(LEN);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const c = src[y * SIZE + x];
        let sum = 0;
        let n = 0;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(SIZE - 1, y + 1); yy++) {
          for (let xx = Math.max(0, x - 1); xx <= Math.min(SIZE - 1, x + 1); xx++) {
            sum += src[yy * SIZE + xx];
            n++;
          }
        }
        const blur = sum / n;
        out[y * SIZE + x] = Math.max(0, Math.min(1, c + (c - blur) * amount));
      }
    }
    return out;
  }

  function thresholdFloor(src, floor) {
    const out = new Float32Array(LEN);
    for (let i = 0; i < LEN; i++) {
      const v = src[i] <= floor ? 0 : (src[i] - floor) / (1 - floor);
      out[i] = Math.max(0, Math.min(1, v));
    }
    return out;
  }

  function gammaTensor(src, gamma) {
    const out = new Float32Array(LEN);
    for (let i = 0; i < LEN; i++) {
      out[i] = Math.max(0, Math.min(1, Math.pow(Math.max(0, src[i]), gamma)));
    }
    return out;
  }

  function blurTensor(src) {
    const out = new Float32Array(LEN);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        let sum = 0;
        let weight = 0;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(SIZE - 1, y + 1); yy++) {
          for (let xx = Math.max(0, x - 1); xx <= Math.min(SIZE - 1, x + 1); xx++) {
            const w = (xx === x && yy === y) ? 4 : ((xx === x || yy === y) ? 2 : 1);
            sum += src[yy * SIZE + xx] * w;
            weight += w;
          }
        }
        out[y * SIZE + x] = sum / weight;
      }
    }
    return out;
  }

  function denoiseTensor(src, threshold = 0.12, minNeighborInk = 0.38) {
    const out = new Float32Array(src);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const idx = y * SIZE + x;
        if (src[idx] <= threshold) {
          out[idx] = 0;
          continue;
        }
        let neighborInk = 0;
        for (let yy = Math.max(0, y - 1); yy <= Math.min(SIZE - 1, y + 1); yy++) {
          for (let xx = Math.max(0, x - 1); xx <= Math.min(SIZE - 1, x + 1); xx++) {
            if (xx === x && yy === y) continue;
            neighborInk += src[yy * SIZE + xx];
          }
        }
        if (neighborInk < minNeighborInk) out[idx] = 0;
      }
    }
    return out;
  }

  function recenterTensor(src, threshold = 0.14, targetExtent = 20) {
    let minX = SIZE;
    let minY = SIZE;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (src[y * SIZE + x] > threshold) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < minX || maxY < minY) return new Float32Array(src);
    const width = Math.max(1, maxX - minX + 1);
    const height = Math.max(1, maxY - minY + 1);
    const scale = Math.min(targetExtent / width, targetExtent / height);
    const scaledW = Math.max(1, width * scale);
    const scaledH = Math.max(1, height * scale);
    const dstX = (SIZE - scaledW) / 2;
    const dstY = (SIZE - scaledH) / 2;
    const out = new Float32Array(LEN);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const sx = minX + (x - dstX) / scale;
        const sy = minY + (y - dstY) / scale;
        if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue;
        const x0 = Math.max(minX, Math.min(maxX, Math.floor(sx)));
        const y0 = Math.max(minY, Math.min(maxY, Math.floor(sy)));
        const x1 = Math.min(maxX, x0 + 1);
        const y1 = Math.min(maxY, y0 + 1);
        const fx = sx - x0;
        const fy = sy - y0;
        const top = src[y0 * SIZE + x0] * (1 - fx) + src[y0 * SIZE + x1] * fx;
        const bottom = src[y1 * SIZE + x0] * (1 - fx) + src[y1 * SIZE + x1] * fx;
        out[y * SIZE + x] = top * (1 - fy) + bottom * fy;
      }
    }
    return out;
  }

  function uniqueVariants(variants) {
    const seen = new Set();
    const out = [];
    for (const variant of variants) {
      let hash = '';
      for (let i = 0; i < LEN; i += 13) hash += `${Math.round(variant[i] * 255)},`;
      if (seen.has(hash)) continue;
      seen.add(hash);
      out.push(variant);
    }
    return out;
  }

  const variantSets = [
    {
      name: 'base',
      make: (src) => [src]
    },
    {
      name: 'shift5',
      make: (src) => [
        src,
        shiftTensor(src, -1, 0),
        shiftTensor(src, 1, 0),
        shiftTensor(src, 0, -1),
        shiftTensor(src, 0, 1)
      ]
    },
    {
      name: 'scale3',
      make: (src) => [src, rescaleTensor(src, 0.92), rescaleTensor(src, 1.08)]
    },
    {
      name: 'shift5-scale3',
      make: (src) => [
        src,
        shiftTensor(src, -1, 0),
        shiftTensor(src, 1, 0),
        shiftTensor(src, 0, -1),
        shiftTensor(src, 0, 1),
        rescaleTensor(src, 0.92),
        rescaleTensor(src, 1.08)
      ]
    },
    {
      name: 'cleanup-vote',
      make: (src) => [
        src,
        sharpenTensor(src, 0.6),
        thresholdFloor(src, 0.08),
        thresholdFloor(src, 0.12),
        rescaleTensor(thresholdFloor(src, 0.08), 1.08),
        shiftTensor(thresholdFloor(src, 0.08), 0, -1)
      ]
    },
    {
      name: 'cleanup-wide',
      make: (src) => uniqueVariants([
        src,
        blurTensor(src),
        sharpenTensor(src, 0.35),
        sharpenTensor(src, 0.7),
        gammaTensor(src, 0.85),
        gammaTensor(src, 1.15),
        thresholdFloor(src, 0.04),
        thresholdFloor(src, 0.08),
        thresholdFloor(src, 0.12),
        thresholdFloor(src, 0.16),
        denoiseTensor(thresholdFloor(src, 0.06), 0.08, 0.28),
        denoiseTensor(thresholdFloor(src, 0.1), 0.08, 0.28),
        recenterTensor(src, 0.1, 18),
        recenterTensor(src, 0.12, 20),
        recenterTensor(thresholdFloor(src, 0.08), 0.1, 20),
        rescaleTensor(src, 0.9),
        rescaleTensor(src, 1.1),
        shiftTensor(src, -1, 0),
        shiftTensor(src, 1, 0),
        shiftTensor(src, 0, -1),
        shiftTensor(src, 0, 1),
        shiftTensor(thresholdFloor(src, 0.08), -1, 0),
        shiftTensor(thresholdFloor(src, 0.08), 1, 0),
        shiftTensor(thresholdFloor(src, 0.08), 0, -1),
        shiftTensor(thresholdFloor(src, 0.08), 0, 1)
      ])
    }
  ];

  function rankProbs(probs) {
    return Array.from(probs).map((confidence, digit) => ({ digit, confidence }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  function combineVariantPredictions(preds, strategy) {
    const summed = new Float32Array(10);
    const votes = new Array(10).fill(0);
    let bestConfidence = null;
    let bestMargin = null;
    for (const pred of preds) {
      const probs = pred.probs || [];
      const ranked = rankProbs(probs);
      votes[ranked[0].digit]++;
      if (!bestConfidence || ranked[0].confidence > bestConfidence.confidence) {
        bestConfidence = { probs, confidence: ranked[0].confidence };
      }
      const margin = ranked[0].confidence - (ranked[1]?.confidence || 0);
      if (!bestMargin || margin > bestMargin.margin) {
        bestMargin = { probs, margin };
      }
      for (let i = 0; i < 10; i++) summed[i] += probs[i] || 0;
    }
    for (let i = 0; i < 10; i++) summed[i] /= Math.max(1, preds.length);
    if (strategy === 'best-confidence') {
      const ranked = rankProbs(bestConfidence.probs);
      return { digit: ranked[0].digit, confidence: ranked[0].confidence, topK: ranked.slice(0, 3) };
    }
    if (strategy === 'best-margin') {
      const ranked = rankProbs(bestMargin.probs);
      return { digit: ranked[0].digit, confidence: ranked[0].confidence, topK: ranked.slice(0, 3) };
    }
    if (strategy === 'vote') {
      const avgRanked = rankProbs(summed);
      const voteRanked = votes.map((voteCount, digit) => ({
        digit,
        voteCount,
        confidence: summed[digit]
      })).sort((a, b) => (b.voteCount - a.voteCount) || (b.confidence - a.confidence));
      const winner = voteRanked[0].digit;
      const topK = avgRanked.slice(0, 3);
      if (!topK.some((item) => item.digit === winner)) {
        topK[2] = { digit: winner, confidence: summed[winner] };
      }
      return { digit: winner, confidence: summed[winner], topK };
    }
    if (strategy === 'average-clean-5v6') {
      const ranked = rankProbs(summed);
      const cleanIndexes = [6, 7, 8, 9, 10, 11, 21, 22, 23, 24];
      const cleanSummed = new Float32Array(10);
      let cleanCount = 0;
      for (const idx of cleanIndexes) {
        const probs = preds[idx]?.probs || null;
        if (!probs) continue;
        for (let i = 0; i < 10; i++) cleanSummed[i] += probs[i] || 0;
        cleanCount++;
      }
      if (cleanCount) {
        for (let i = 0; i < 10; i++) cleanSummed[i] /= cleanCount;
        const cleanRanked = rankProbs(cleanSummed);
        const baseRanked = rankProbs(preds[0]?.probs || []);
        const baseGap = baseRanked[0]?.confidence - (baseRanked[1]?.confidence || 0);
        const cleanGap = cleanRanked[0].confidence - (cleanRanked[1]?.confidence || 0);
        if (
          ranked[0].digit === 5 &&
          cleanRanked[0].digit === 6 &&
          cleanRanked[0].confidence >= 0.45 &&
          cleanGap >= 0.05 &&
          baseGap < 0.65
        ) {
          return { digit: 6, confidence: cleanRanked[0].confidence, topK: cleanRanked.slice(0, 3) };
        }
      }
      return { digit: ranked[0].digit, confidence: ranked[0].confidence, topK: ranked.slice(0, 3) };
    }
    const ranked = rankProbs(summed);
    return { digit: ranked[0].digit, confidence: ranked[0].confidence, topK: ranked.slice(0, 3) };
  }

  async function predictWithVariants(src, variantSet, strategy) {
    const variants = variantSet.make(new Float32Array(src));
    const preds = [];
    for (const variant of variants) {
      const [pred] = await recognizeDigits(variant);
      preds.push(pred);
    }
    const combined = combineVariantPredictions(preds, strategy);
    combined.variantCount = variants.length;
    combined.variantPredictions = preds.map((pred, i) => ({
      variant: i,
      digit: pred.digit,
      confidence: pred.confidence,
      topK: pred.topK || []
    }));
    return combined;
  }

  const out = [];
  const strategies = ['average', 'vote', 'best-confidence', 'best-margin', 'average-clean-5v6'];
  for (const variantSet of variantSets) {
    for (const strategy of strategies) {
      if (variantSet.name === 'base' && strategy !== 'average') continue;
    let correct = 0;
    let total = 0;
    let perfect = 0;
    const rows = [];
    for (const capture of captures) {
      const preds = [];
      const misses = [];
      for (let i = 0; i < capture.tensors.length; i++) {
        const pred = await predictWithVariants(capture.tensors[i], variantSet, strategy);
        preds.push(pred);
        const ok = pred.digit === capture.answerKey[i];
        correct += Number(ok);
        total++;
        if (!ok) {
          misses.push({
            question: i + 1,
            expected: capture.answerKey[i],
            predicted: pred.digit,
            confidence: pred.confidence,
            topK: pred.topK,
            variantPredictions: pred.variantPredictions || []
          });
        }
      }
      const score = preds.reduce((sum, pred, idx) => sum + Number(pred.digit === capture.answerKey[idx]), 0);
      perfect += Number(score === capture.answerKey.length);
      rows.push({
        file: capture.file,
        score,
        predictions: preds.map((pred) => pred.digit),
        minConfidence: Math.min(...preds.map((pred) => pred.confidence)),
        misses
      });
    }
    out.push({ name: `${variantSet.name}:${strategy}`, correct, total, perfect, rows });
    }
  }
  return out;
}, { captures });

await browser.close();

for (const result of results) {
  console.log(`\n${result.name}: ${result.correct}/${result.total} (${(100 * result.correct / result.total).toFixed(2)}%), perfect ${result.perfect}/${captures.length}`);
  for (const row of result.rows) {
    const miss = row.misses.length
      ? ` misses=${row.misses.map((m) => {
        const expectedHits = (m.variantPredictions || [])
          .filter((v) => v.digit === m.expected)
          .map((v) => `v${v.variant}@${v.confidence.toFixed(2)}`);
        const expectedInTop = (m.variantPredictions || [])
          .filter((v) => v.topK?.some((t) => t.digit === m.expected))
          .map((v) => `v${v.variant}:${(v.topK.find((t) => t.digit === m.expected)?.confidence || 0).toFixed(2)}`);
        const oracle = expectedHits.length
          ? ` expected-wins=${expectedHits.join(',')}`
          : (expectedInTop.length ? ` expected-top=${expectedInTop.join(',')}` : '');
        return `Q${m.question}:${m.expected}->${m.predicted}@${m.confidence.toFixed(3)} top=${m.topK.map((t) => `${t.digit}:${t.confidence.toFixed(2)}`).join('/')}${oracle}`;
      }).join(';')}`
      : '';
    console.log(`  ${row.file}: ${row.score}/10 pred=${JSON.stringify(row.predictions)} min=${row.minConfidence.toFixed(3)}${miss}`);
  }
}
