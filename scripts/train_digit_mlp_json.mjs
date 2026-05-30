#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage } from 'canvas';

const ROOT = process.cwd();
const DEFAULT_DATASET = path.join(ROOT, 'datasets', 'worksheet_digits_combined_20260515');
const DEFAULT_OUT = path.join(ROOT, 'public', 'models', 'worksheet-digit-mlp.json');

function parseArgs(argv) {
  const opts = {
    dataset: DEFAULT_DATASET,
    out: DEFAULT_OUT,
    hidden: 96,
    epochs: 700,
    batch: 64,
    lr: 0.002,
    seed: 17,
    threshold: 0.045,
    augment: true,
    center: false,
    full: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dataset') opts.dataset = path.resolve(argv[++i]);
    else if (arg === '--out') opts.out = path.resolve(argv[++i]);
    else if (arg === '--hidden') opts.hidden = Number(argv[++i]);
    else if (arg === '--epochs') opts.epochs = Number(argv[++i]);
    else if (arg === '--batch') opts.batch = Number(argv[++i]);
    else if (arg === '--lr') opts.lr = Number(argv[++i]);
    else if (arg === '--seed') opts.seed = Number(argv[++i]);
    else if (arg === '--threshold') opts.threshold = Number(argv[++i]);
    else if (arg === '--no-augment') opts.augment = false;
    else if (arg === '--center') opts.center = true;
    else if (arg === '--full') opts.full = true;
  }
  return opts;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function imageVector(file) {
  const img = await loadImage(file);
  const canvas = createCanvas(28, 28);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, 28, 28);
  const data = ctx.getImageData(0, 0, 28, 28).data;
  const out = new Float32Array(28 * 28);
  for (let i = 0; i < out.length; i++) {
    out[i] = data[i * 4] / 255;
  }
  return out;
}

function shiftVector(vec, dx, dy) {
  const out = new Float32Array(vec.length);
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx >= 0 && sx < 28 && sy >= 0 && sy < 28) out[y * 28 + x] = vec[sy * 28 + sx];
    }
  }
  return out;
}

function centerInk(vec) {
  let sum = 0;
  let sx = 0;
  let sy = 0;
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const v = vec[y * 28 + x];
      const w = v * v;
      sum += w;
      sx += x * w;
      sy += y * w;
    }
  }
  if (sum <= 1e-6) return vec;
  return shiftVector(
    vec,
    Math.max(-4, Math.min(4, Math.round(13.5 - sx / sum))),
    Math.max(-4, Math.min(4, Math.round(13.5 - sy / sum)))
  );
}

function downsample2(vec) {
  const out = new Float32Array(14 * 14);
  for (let y = 0; y < 14; y++) {
    for (let x = 0; x < 14; x++) {
      const i = y * 2 * 28 + x * 2;
      out[y * 14 + x] = (vec[i] + vec[i + 1] + vec[i + 28] + vec[i + 29]) / 4;
    }
  }
  return out;
}

function makeFeature(vec, opts) {
  let work = new Float32Array(vec.length);
  let max = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i] < opts.threshold ? 0 : vec[i];
    work[i] = v;
    if (v > max) max = v;
  }
  if (max > 1e-6) {
    for (let i = 0; i < work.length; i++) work[i] /= max;
  }
  if (opts.center) work = centerInk(work);
  return opts.full ? work : downsample2(work);
}

function augmentVector(vec, rand) {
  let out = vec;
  const dx = Math.floor(rand() * 5) - 2;
  const dy = Math.floor(rand() * 5) - 2;
  if (dx || dy) out = shiftVector(out, dx, dy);
  const contrast = 0.72 + rand() * 0.70;
  const fade = 0.62 + rand() * 0.58;
  const noisy = new Float32Array(out.length);
  for (let i = 0; i < out.length; i++) {
    const noise = (rand() - 0.5) * 0.07;
    noisy[i] = Math.max(0, Math.min(1, ((out[i] - 0.5) * contrast + 0.5) * fade + noise));
  }
  return noisy;
}

async function loadDataset(root, opts) {
  const samples = [];
  for (let digit = 0; digit <= 9; digit++) {
    const dir = path.join(root, String(digit));
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.png')) continue;
      const raw = await imageVector(path.join(dir, entry.name));
      samples.push({ label: digit, name: entry.name, raw, feature: makeFeature(raw, opts) });
    }
  }
  return samples;
}

function initWeights(input, hidden, output, rand) {
  const w1 = new Float32Array(input * hidden);
  const b1 = new Float32Array(hidden);
  const w2 = new Float32Array(hidden * output);
  const b2 = new Float32Array(output);
  const s1 = Math.sqrt(2 / input);
  const s2 = Math.sqrt(2 / hidden);
  for (let i = 0; i < w1.length; i++) w1[i] = (rand() * 2 - 1) * s1;
  for (let i = 0; i < w2.length; i++) w2[i] = (rand() * 2 - 1) * s2;
  return { w1, b1, w2, b2, input, hidden, output };
}

function forward(model, x, scratch = {}) {
  const h = scratch.h || new Float32Array(model.hidden);
  const logits = scratch.logits || new Float32Array(model.output);
  for (let j = 0; j < model.hidden; j++) {
    let sum = model.b1[j];
    const off = j * model.input;
    for (let i = 0; i < model.input; i++) sum += model.w1[off + i] * x[i];
    h[j] = sum > 0 ? sum : 0;
  }
  let maxLogit = -Infinity;
  for (let k = 0; k < model.output; k++) {
    let sum = model.b2[k];
    const off = k * model.hidden;
    for (let j = 0; j < model.hidden; j++) sum += model.w2[off + j] * h[j];
    logits[k] = sum;
    if (sum > maxLogit) maxLogit = sum;
  }
  let expSum = 0;
  for (let k = 0; k < model.output; k++) {
    const value = Math.exp(logits[k] - maxLogit);
    logits[k] = value;
    expSum += value;
  }
  for (let k = 0; k < model.output; k++) logits[k] /= expSum || 1;
  return { h, probs: logits };
}

function predict(model, feature) {
  const { probs } = forward(model, feature);
  let best = 0;
  for (let k = 1; k < probs.length; k++) if (probs[k] > probs[best]) best = k;
  return best;
}

function evalModel(model, samples, title) {
  let correct = 0;
  const confusions = new Map();
  for (const sample of samples) {
    const got = predict(model, sample.feature);
    if (got === sample.label) correct++;
    else {
      const key = `${sample.label}->${got}`;
      confusions.set(key, (confusions.get(key) || 0) + 1);
    }
  }
  const pct = (100 * correct / Math.max(1, samples.length)).toFixed(1);
  const top = Array.from(confusions.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  console.log(`${title}: ${correct}/${samples.length} (${pct}%)${top.length ? ` ${top.map(([p, c]) => `${p}(${c})`).join(' ')}` : ''}`);
  return correct / Math.max(1, samples.length);
}

function train(model, trainSamples, valSamples, opts) {
  const rand = mulberry32(opts.seed + 1000);
  const order = Array.from({ length: trainSamples.length }, (_, i) => i);
  const m = {
    w1: new Float32Array(model.w1.length),
    b1: new Float32Array(model.b1.length),
    w2: new Float32Array(model.w2.length),
    b2: new Float32Array(model.b2.length)
  };
  const v = {
    w1: new Float32Array(model.w1.length),
    b1: new Float32Array(model.b1.length),
    w2: new Float32Array(model.w2.length),
    b2: new Float32Array(model.b2.length)
  };
  let step = 0;
  let best = { acc: -1, epoch: 0, state: null };
  const beta1 = 0.9;
  const beta2 = 0.999;
  const eps = 1e-8;

  for (let epoch = 1; epoch <= opts.epochs; epoch++) {
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    for (let start = 0; start < order.length; start += opts.batch) {
      const end = Math.min(order.length, start + opts.batch);
      const batchSize = end - start;
      const gw1 = new Float32Array(model.w1.length);
      const gb1 = new Float32Array(model.b1.length);
      const gw2 = new Float32Array(model.w2.length);
      const gb2 = new Float32Array(model.b2.length);
      const h = new Float32Array(model.hidden);
      const probs = new Float32Array(model.output);
      for (let bi = start; bi < end; bi++) {
        const sample = trainSamples[order[bi]];
        const raw = opts.augment ? augmentVector(sample.raw, rand) : sample.raw;
        const x = opts.augment ? makeFeature(raw, opts) : sample.feature;
        const out = forward(model, x, { h, logits: probs });
        const dlogits = new Float32Array(model.output);
        for (let k = 0; k < model.output; k++) dlogits[k] = out.probs[k] - (k === sample.label ? 1 : 0);
        for (let k = 0; k < model.output; k++) {
          gb2[k] += dlogits[k];
          const off = k * model.hidden;
          for (let j = 0; j < model.hidden; j++) gw2[off + j] += dlogits[k] * out.h[j];
        }
        for (let j = 0; j < model.hidden; j++) {
          let dh = 0;
          for (let k = 0; k < model.output; k++) dh += model.w2[k * model.hidden + j] * dlogits[k];
          if (out.h[j] <= 0) dh = 0;
          gb1[j] += dh;
          const off = j * model.input;
          for (let i = 0; i < model.input; i++) gw1[off + i] += dh * x[i];
        }
      }
      step++;
      const lrT = opts.lr * Math.sqrt(1 - Math.pow(beta2, step)) / (1 - Math.pow(beta1, step));
      const update = (param, grad, mm, vv) => {
        for (let i = 0; i < param.length; i++) {
          const g = grad[i] / batchSize;
          mm[i] = beta1 * mm[i] + (1 - beta1) * g;
          vv[i] = beta2 * vv[i] + (1 - beta2) * g * g;
          param[i] -= lrT * mm[i] / (Math.sqrt(vv[i]) + eps);
        }
      };
      update(model.w1, gw1, m.w1, v.w1);
      update(model.b1, gb1, m.b1, v.b1);
      update(model.w2, gw2, m.w2, v.w2);
      update(model.b2, gb2, m.b2, v.b2);
    }
    if (epoch === 1 || epoch % Math.max(1, Math.floor(opts.epochs / 10)) === 0 || epoch === opts.epochs) {
      const trainAcc = evalModel(model, trainSamples, `epoch ${epoch} train`);
      const valAcc = evalModel(model, valSamples, `epoch ${epoch} val`);
      if (valAcc >= best.acc) {
        best = {
          acc: valAcc,
          epoch,
          state: {
            w1: new Float32Array(model.w1),
            b1: new Float32Array(model.b1),
            w2: new Float32Array(model.w2),
            b2: new Float32Array(model.b2)
          }
        };
      }
      console.log('');
    } else {
      const valAcc = evalAccuracy(model, valSamples);
      if (valAcc >= best.acc) {
        best = {
          acc: valAcc,
          epoch,
          state: {
            w1: new Float32Array(model.w1),
            b1: new Float32Array(model.b1),
            w2: new Float32Array(model.w2),
            b2: new Float32Array(model.b2)
          }
        };
      }
    }
  }
  model.w1.set(best.state.w1);
  model.b1.set(best.state.b1);
  model.w2.set(best.state.w2);
  model.b2.set(best.state.b2);
  console.log(`best val ${(100 * best.acc).toFixed(1)}% at epoch ${best.epoch}`);
}

function evalAccuracy(model, samples) {
  let correct = 0;
  for (const sample of samples) correct += Number(predict(model, sample.feature) === sample.label);
  return correct / Math.max(1, samples.length);
}

function roundArray(values) {
  return Array.from(values, (value) => Number(value.toFixed(6)));
}

const opts = parseArgs(process.argv.slice(2));
const trainSamples = await loadDataset(path.join(opts.dataset, 'train'), opts);
const valSamples = await loadDataset(path.join(opts.dataset, 'val'), opts);
const rand = mulberry32(opts.seed);
const model = initWeights(opts.full ? 28 * 28 : 14 * 14, opts.hidden, 10, rand);
console.log(`train=${trainSamples.length} val=${valSamples.length} hidden=${opts.hidden} input=${model.input} epochs=${opts.epochs} lr=${opts.lr} augment=${opts.augment} center=${opts.center}`);
train(model, trainSamples, valSamples, opts);
const finalTrainAcc = evalModel(model, trainSamples, 'final train');
const finalValAcc = evalModel(model, valSamples, 'final val');

await fs.mkdir(path.dirname(opts.out), { recursive: true });
const payload = {
  type: 'worksheet-digit-mlp-v1',
  generatedAt: new Date().toISOString(),
  dataset: opts.dataset,
  inputSize: model.input,
  hiddenSize: model.hidden,
  outputSize: model.output,
  feature: {
    threshold: opts.threshold,
    downsample: opts.full ? 1 : 2,
    center: opts.center,
    maxNormalize: true
  },
  training: {
    epochs: opts.epochs,
    lr: opts.lr,
    batch: opts.batch,
    seed: opts.seed,
    augment: opts.augment,
    trainSamples: trainSamples.length,
    valSamples: valSamples.length,
    finalTrainAcc,
    finalValAcc
  },
  weights: {
    w1: roundArray(model.w1),
    b1: roundArray(model.b1),
    w2: roundArray(model.w2),
    b2: roundArray(model.b2)
  }
};
await fs.writeFile(opts.out, JSON.stringify(payload));
console.log(`saved ${opts.out}`);
