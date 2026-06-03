import * as ort from 'onnxruntime-web/wasm';
import { modelUrlFromQuery, publicUrl } from './public-paths.js';

function isWasmSimdSupported() {
  if (typeof WebAssembly === 'undefined' || typeof WebAssembly.validate !== 'function') return false;
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0, 10, 30, 1, 28, 0,
      65, 0, 253, 15, 253, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      253, 186, 1, 26, 11
    ]));
  } catch {
    return false;
  }
}

function shouldForceNoSimd() {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('forceNoSimd') === '1' || params.get('ortNoSimd') === '1';
}

const WASM_SIMD_SUPPORTED = isWasmSimdSupported();
const WASM_SIMD_ENABLED = WASM_SIMD_SUPPORTED && !shouldForceNoSimd();
const ORT_WASM_PATHS = {
  'ort-wasm.wasm': publicUrl('ort-wasm-nosimd.wasm'),
  'ort-wasm-simd.wasm': publicUrl('ort-wasm-simd-1.17.wasm')
};

// Keep OCR on one thread for classroom-device compatibility. Older iPad Safari
// lacks cross-origin isolation and WASM SIMD, so it must use ort-wasm.wasm.
ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = WASM_SIMD_ENABLED;
ort.env.wasm.wasmPaths = ORT_WASM_PATHS;

function getOrtRuntimeConfig() {
  return {
    package: 'onnxruntime-web/wasm',
    ortWebVersion: ort.env?.versions?.web || null,
    wasmPaths: ORT_WASM_PATHS,
    wasmSimdSupported: WASM_SIMD_SUPPORTED,
    wasmSimdEnabled: WASM_SIMD_ENABLED,
    wasmNumThreads: ort.env?.wasm?.numThreads ?? null,
    forcedNoSimd: shouldForceNoSimd()
  };
}

/**
 * ONNX Runtime session (singleton)
 */
let digitSession = null;
let ensembleDigitSession = null;
let rightSlotDigitSession = null;
let rightSlotModelPathLoaded = null;
const LEGACY_MNIST_MODEL_PATH = publicUrl('models/mnist-model.onnx');
const DEFAULT_MODEL_PATH = publicUrl('models/worksheet-digit-tony-generalist-aug-strong-noaug-touch-20260601.onnx');
const DEFAULT_RIGHT_SLOT_MODEL_PATH = null;
const DEFAULT_ENSEMBLE_MODEL_PATH = publicUrl('models/worksheet-digit-generalist.onnx');
const MODEL_CACHE_BUSTER = 'worksheet-slot-models-20260603-noaug-touch-no-right';
const KNOWN_WORKSHEET_SHA256 = 'c8164e86f8d540614fe9f0f3f68c23beb5cf7a776c2dcb5af8460238beeb9e50';
const KNOWN_RIGHT_SLOT_SHA256 = 'e15751df23d9e88f4c103ff1c53f019a66a631dc4926d7091481ebdbacf518da';
const KNOWN_ENSEMBLE_SHA256 = '50e82b5d5569198f326c4c4d127d668b1c4101e5e2aaacf71d07f85b4d193282';
const PRIMARY_MODEL_WEIGHT = 0.75;
const ENSEMBLE_MODEL_WEIGHT = 0.25;
const MNIST_DIGIT_SIZE = 28;
const MNIST_DIGIT_LEN = MNIST_DIGIT_SIZE * MNIST_DIGIT_SIZE;
const ROBUST_RECOGNITION_CONFIDENCE_THRESHOLD = 0.86;
const ROBUST_RECOGNITION_MARGIN_THRESHOLD = 0.18;
const CLEAN_FIVE_SIX_VARIANT_INDEXES = [6, 7, 8, 9, 10, 11, 21, 22, 23, 24];
let modelRuntimeInfo = null;

async function sha256Hex(buffer) {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeShape(dims) {
  if (!Array.isArray(dims)) return null;
  return dims.map((d) => (typeof d === 'number' ? d : (d ?? null)));
}

function shapeDisplay(shape) {
  return Array.isArray(shape) ? shape : 'unknown';
}

function asJson(x) {
  try {
    return JSON.stringify(x);
  } catch {
    return String(x);
  }
}

function getModelPathFromUrl() {
  if (typeof window === 'undefined') return DEFAULT_MODEL_PATH;
  const q = new URLSearchParams(window.location.search).get('modelPath');
  return modelUrlFromQuery(q, DEFAULT_MODEL_PATH);
}

function getRightSlotModelPathFromUrl() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('rightSlotModelPath');
    if (q === '0' || q === 'none' || q === 'off') return null;
    return modelUrlFromQuery(q, DEFAULT_RIGHT_SLOT_MODEL_PATH);
  }
  return DEFAULT_RIGHT_SLOT_MODEL_PATH;
}

function shouldUseDefaultEnsemble(modelPath) {
  return modelPath === LEGACY_MNIST_MODEL_PATH;
}

/**
 * Stable softmax: logits → probabilities in [0, 1], sum to 1.
 * @param {Float32Array|ArrayLike<number>} logits - Raw model output (e.g. length 10)
 * @returns {Float32Array} - Probabilities, same length
 */
function softmax(logits) {
  const arr = logits instanceof Float32Array ? logits : new Float32Array(logits);
  const max = Math.max(...arr);
  const exp = new Float32Array(arr.length);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    exp[i] = Math.exp(arr[i] - max);
    sum += exp[i];
  }
  for (let i = 0; i < arr.length; i++) {
    exp[i] /= sum;
  }
  return exp;
}

function copyDigitTensorData(inputTensor) {
  const raw = inputTensor && typeof inputTensor.data !== 'undefined' ? inputTensor.data : inputTensor;
  const data = new Float32Array(MNIST_DIGIT_LEN);
  if (raw && raw.length >= MNIST_DIGIT_LEN) {
    data.set(typeof raw.subarray === 'function' ? raw.subarray(0, MNIST_DIGIT_LEN) : raw.slice(0, MNIST_DIGIT_LEN));
  }
  return data;
}

function rankDigitProbs(probs) {
  return Array.from(probs)
    .map((p, i) => ({ digit: i, confidence: p }))
    .sort((a, b) => b.confidence - a.confidence);
}

function digitResultFromProbs(probs, extra = {}) {
  const ranked = rankDigitProbs(probs);
  const topK = ranked.slice(0, 3);
  let entropy = 0;
  for (let i = 0; i < probs.length; i++) {
    const p = probs[i];
    if (p > 0) entropy += -p * Math.log(p);
  }
  const entropyNorm = probs.length > 1 ? entropy / Math.log(probs.length) : 0;
  return {
    digit: topK[0].digit,
    confidence: topK[0].confidence,
    topK,
    probs: Array.from(probs),
    entropyNorm,
    ...extra
  };
}

function digitResultFromVotedDigit(probs, digit, extra = {}) {
  const result = digitResultFromProbs(probs, extra);
  if (!Number.isInteger(digit) || digit < 0 || digit > 9 || digit === result.digit) {
    return result;
  }
  const confidence = probs[digit] || 0;
  let topK = result.topK;
  if (!topK.some((item) => item.digit === digit)) {
    topK = [...topK.slice(0, 2), { digit, confidence }]
      .sort((a, b) => b.confidence - a.confidence);
  }
  return {
    ...result,
    digit,
    confidence,
    topK
  };
}

function shiftDigitTensor(src, dx, dy) {
  const out = new Float32Array(MNIST_DIGIT_LEN);
  for (let y = 0; y < MNIST_DIGIT_SIZE; y++) {
    for (let x = 0; x < MNIST_DIGIT_SIZE; x++) {
      const sx = x - dx;
      const sy = y - dy;
      if (sx < 0 || sx >= MNIST_DIGIT_SIZE || sy < 0 || sy >= MNIST_DIGIT_SIZE) continue;
      out[y * MNIST_DIGIT_SIZE + x] = src[sy * MNIST_DIGIT_SIZE + sx];
    }
  }
  return out;
}

function rescaleDigitTensor(src, scale) {
  const out = new Float32Array(MNIST_DIGIT_LEN);
  const c = (MNIST_DIGIT_SIZE - 1) / 2;
  for (let y = 0; y < MNIST_DIGIT_SIZE; y++) {
    for (let x = 0; x < MNIST_DIGIT_SIZE; x++) {
      const sx = c + (x - c) / scale;
      const sy = c + (y - c) / scale;
      if (sx < 0 || sx > MNIST_DIGIT_SIZE - 1 || sy < 0 || sy > MNIST_DIGIT_SIZE - 1) continue;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = Math.min(MNIST_DIGIT_SIZE - 1, x0 + 1);
      const y1 = Math.min(MNIST_DIGIT_SIZE - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const top = src[y0 * MNIST_DIGIT_SIZE + x0] * (1 - fx) + src[y0 * MNIST_DIGIT_SIZE + x1] * fx;
      const bottom = src[y1 * MNIST_DIGIT_SIZE + x0] * (1 - fx) + src[y1 * MNIST_DIGIT_SIZE + x1] * fx;
      out[y * MNIST_DIGIT_SIZE + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
}

function sharpenDigitTensor(src, amount) {
  const out = new Float32Array(MNIST_DIGIT_LEN);
  for (let y = 0; y < MNIST_DIGIT_SIZE; y++) {
    for (let x = 0; x < MNIST_DIGIT_SIZE; x++) {
      const c = src[y * MNIST_DIGIT_SIZE + x];
      let sum = 0;
      let n = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(MNIST_DIGIT_SIZE - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(MNIST_DIGIT_SIZE - 1, x + 1); xx++) {
          sum += src[yy * MNIST_DIGIT_SIZE + xx];
          n++;
        }
      }
      const blur = sum / n;
      out[y * MNIST_DIGIT_SIZE + x] = Math.max(0, Math.min(1, c + (c - blur) * amount));
    }
  }
  return out;
}

function blurDigitTensor(src) {
  const out = new Float32Array(MNIST_DIGIT_LEN);
  for (let y = 0; y < MNIST_DIGIT_SIZE; y++) {
    for (let x = 0; x < MNIST_DIGIT_SIZE; x++) {
      let sum = 0;
      let weight = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(MNIST_DIGIT_SIZE - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(MNIST_DIGIT_SIZE - 1, x + 1); xx++) {
          const w = (xx === x && yy === y) ? 4 : ((xx === x || yy === y) ? 2 : 1);
          sum += src[yy * MNIST_DIGIT_SIZE + xx] * w;
          weight += w;
        }
      }
      out[y * MNIST_DIGIT_SIZE + x] = sum / weight;
    }
  }
  return out;
}

function thresholdFloorDigitTensor(src, floor) {
  const out = new Float32Array(MNIST_DIGIT_LEN);
  for (let i = 0; i < MNIST_DIGIT_LEN; i++) {
    const v = src[i] <= floor ? 0 : (src[i] - floor) / (1 - floor);
    out[i] = Math.max(0, Math.min(1, v));
  }
  return out;
}

function gammaDigitTensor(src, gamma) {
  const out = new Float32Array(MNIST_DIGIT_LEN);
  for (let i = 0; i < MNIST_DIGIT_LEN; i++) {
    out[i] = Math.max(0, Math.min(1, Math.pow(Math.max(0, src[i]), gamma)));
  }
  return out;
}

function stripRuleArtifactsDigitTensor(src, threshold = 0.10) {
  const out = new Float32Array(src);
  const size = MNIST_DIGIT_SIZE;
  const edgeSpan = 3;
  const rowRadius = 1;
  const colRadius = 1;
  const centerX = (size - 1) / 2;

  const eraseRow = (y) => {
    for (let yy = Math.max(0, y - rowRadius); yy <= Math.min(size - 1, y + rowRadius); yy++) {
      const offset = yy * size;
      for (let x = 0; x < size; x++) {
        if (out[offset + x] > threshold) out[offset + x] = 0;
      }
    }
  };

  const eraseCol = (x) => {
    for (let y = 0; y < size; y++) {
      const offset = y * size;
      for (let xx = Math.max(0, x - colRadius); xx <= Math.min(size - 1, x + colRadius); xx++) {
        if (out[offset + xx] > threshold) out[offset + xx] = 0;
      }
    }
  };

  for (let y = 0; y < size; y++) {
    const inRuleBand = y <= 8 || y >= size - 9;
    if (!inRuleBand) continue;
    let active = 0;
    let minX = size;
    let maxX = -1;
    let leftEdge = 0;
    let rightEdge = 0;
    for (let x = 0; x < size; x++) {
      if (out[y * size + x] <= threshold) continue;
      active += 1;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      if (x < edgeSpan) leftEdge += 1;
      if (x >= size - edgeSpan) rightEdge += 1;
    }
    const span = maxX >= minX ? maxX - minX + 1 : 0;
    const edgeAnchored = leftEdge > 0 && rightEdge > 0;
    if (active >= 8 && (edgeAnchored || span >= 21)) eraseRow(y);
  }

  for (let x = 0; x < size; x++) {
    const nearEdge = x <= 4 || x >= size - 5;
    if (!nearEdge) continue;
    let active = 0;
    let minY = size;
    let maxY = -1;
    for (let y = 0; y < size; y++) {
      if (out[y * size + x] <= threshold) continue;
      active += 1;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    const span = maxY >= minY ? maxY - minY + 1 : 0;
    if (active >= 8 && span >= 13) eraseCol(x);
  }

  const slopes = [-0.32, -0.24, -0.16, -0.08, 0, 0.08, 0.16, 0.24, 0.32];
  const bands = [
    { minY: 0, maxY: 10 },
    { minY: size - 11, maxY: size - 1 }
  ];
  for (const band of bands) {
    const candidates = [];
    for (const slope of slopes) {
      for (let centerY = band.minY; centerY <= band.maxY; centerY++) {
        let hits = 0;
        let leftEdge = 0;
        let rightEdge = 0;
        for (let x = 0; x < size; x++) {
          const y = Math.round(centerY + slope * (x - centerX));
          if (y < 0 || y >= size) continue;
          let best = 0;
          for (let yy = Math.max(0, y - 1); yy <= Math.min(size - 1, y + 1); yy++) {
            best = Math.max(best, out[yy * size + x]);
          }
          if (best <= threshold) continue;
          hits += 1;
          if (x < edgeSpan) leftEdge += 1;
          if (x >= size - edgeSpan) rightEdge += 1;
        }
        if (hits >= 13 && (leftEdge > 0 || rightEdge > 0)) {
          candidates.push({
            slope,
            centerY,
            score: hits + (leftEdge + rightEdge) * 2
          });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    for (const candidate of candidates.slice(0, 1)) {
      for (let x = 0; x < size; x++) {
        const y = Math.round(candidate.centerY + candidate.slope * (x - centerX));
        for (let yy = Math.max(0, y - 1); yy <= Math.min(size - 1, y + 1); yy++) {
          const idx = yy * size + x;
          if (out[idx] > threshold) out[idx] = 0;
        }
      }
    }
  }

  return out;
}

function denoiseDigitTensor(src, threshold = 0.12, minNeighborInk = 0.38) {
  const out = new Float32Array(src);
  for (let y = 0; y < MNIST_DIGIT_SIZE; y++) {
    for (let x = 0; x < MNIST_DIGIT_SIZE; x++) {
      const idx = y * MNIST_DIGIT_SIZE + x;
      if (src[idx] <= threshold) {
        out[idx] = 0;
        continue;
      }
      let neighborInk = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(MNIST_DIGIT_SIZE - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(MNIST_DIGIT_SIZE - 1, x + 1); xx++) {
          if (xx === x && yy === y) continue;
          neighborInk += src[yy * MNIST_DIGIT_SIZE + xx];
        }
      }
      if (neighborInk < minNeighborInk) out[idx] = 0;
    }
  }
  return out;
}

function recenterDigitTensor(src, threshold = 0.14, targetExtent = 20) {
  let minX = MNIST_DIGIT_SIZE;
  let minY = MNIST_DIGIT_SIZE;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < MNIST_DIGIT_SIZE; y++) {
    for (let x = 0; x < MNIST_DIGIT_SIZE; x++) {
      if (src[y * MNIST_DIGIT_SIZE + x] > threshold) {
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
  const dstX = (MNIST_DIGIT_SIZE - scaledW) / 2;
  const dstY = (MNIST_DIGIT_SIZE - scaledH) / 2;
  const out = new Float32Array(MNIST_DIGIT_LEN);
  for (let y = 0; y < MNIST_DIGIT_SIZE; y++) {
    for (let x = 0; x < MNIST_DIGIT_SIZE; x++) {
      const sx = minX + (x - dstX) / scale;
      const sy = minY + (y - dstY) / scale;
      if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue;
      const x0 = Math.max(minX, Math.min(maxX, Math.floor(sx)));
      const y0 = Math.max(minY, Math.min(maxY, Math.floor(sy)));
      const x1 = Math.min(maxX, x0 + 1);
      const y1 = Math.min(maxY, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const top = src[y0 * MNIST_DIGIT_SIZE + x0] * (1 - fx) + src[y0 * MNIST_DIGIT_SIZE + x1] * fx;
      const bottom = src[y1 * MNIST_DIGIT_SIZE + x0] * (1 - fx) + src[y1 * MNIST_DIGIT_SIZE + x1] * fx;
      out[y * MNIST_DIGIT_SIZE + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
}

function uniqueDigitVariants(variants) {
  const seen = new Set();
  const out = [];
  for (const variant of variants) {
    let hash = '';
    for (let i = 0; i < MNIST_DIGIT_LEN; i += 13) hash += `${Math.round(variant[i] * 255)},`;
    if (seen.has(hash)) continue;
    seen.add(hash);
    out.push(variant);
  }
  return out;
}

function makeRobustDigitVariants(src) {
  const floor08 = thresholdFloorDigitTensor(src, 0.08);
  const ruleClean = stripRuleArtifactsDigitTensor(src, 0.10);
  const ruleCleanFloor = thresholdFloorDigitTensor(ruleClean, 0.06);
  return uniqueDigitVariants([
    src,
    blurDigitTensor(src),
    sharpenDigitTensor(src, 0.35),
    sharpenDigitTensor(src, 0.7),
    gammaDigitTensor(src, 0.85),
    gammaDigitTensor(src, 1.15),
    thresholdFloorDigitTensor(src, 0.04),
    floor08,
    thresholdFloorDigitTensor(src, 0.12),
    thresholdFloorDigitTensor(src, 0.16),
    ruleClean,
    ruleCleanFloor,
    recenterDigitTensor(ruleCleanFloor, 0.1, 20),
    denoiseDigitTensor(ruleCleanFloor, 0.08, 0.28),
    denoiseDigitTensor(thresholdFloorDigitTensor(src, 0.06), 0.08, 0.28),
    denoiseDigitTensor(thresholdFloorDigitTensor(src, 0.1), 0.08, 0.28),
    recenterDigitTensor(src, 0.1, 18),
    recenterDigitTensor(src, 0.12, 20),
    recenterDigitTensor(floor08, 0.1, 20),
    rescaleDigitTensor(src, 0.9),
    rescaleDigitTensor(src, 1.1),
    shiftDigitTensor(src, -1, 0),
    shiftDigitTensor(src, 1, 0),
    shiftDigitTensor(src, 0, -1),
    shiftDigitTensor(src, 0, 1),
    shiftDigitTensor(floor08, -1, 0),
    shiftDigitTensor(floor08, 1, 0),
    shiftDigitTensor(floor08, 0, -1),
    shiftDigitTensor(floor08, 0, 1)
  ]);
}

/**
 * Initialize ONNX session (load model once)
 */
export async function initDigitModel() {
  if (digitSession) return digitSession;

  try {
    const modelPath = getModelPathFromUrl();
    const primary = await loadDigitSession(modelPath);
    digitSession = primary.session;
    const firstInput = digitSession.inputNames?.[0] || null;
    const firstOutput = digitSession.outputNames?.[0] || null;
    const inputMeta = firstInput && digitSession.inputMetadata ? digitSession.inputMetadata[firstInput] : null;
    const outputMeta = firstOutput && digitSession.outputMetadata ? digitSession.outputMetadata[firstOutput] : null;
    const inputShape = normalizeShape(inputMeta?.dimensions);
    const outputShape = normalizeShape(outputMeta?.dimensions);
    const appFeedShape = [1, 1, 28, 28];
    const shapeMatchesApp =
      !Array.isArray(inputShape) ||
      (inputShape.length === appFeedShape.length &&
        inputShape.every((d, i) => d == null || Number(d) === appFeedShape[i]));
    const inputType = inputMeta?.type || null;
    const typeMatchesApp = inputType == null || String(inputType).toLowerCase().includes('float');
    const useEnsemble = shouldUseDefaultEnsemble(modelPath);
    let ensembleInfo = null;
    if (useEnsemble) {
      const aux = await loadDigitSession(DEFAULT_ENSEMBLE_MODEL_PATH);
      ensembleDigitSession = aux.session;
      ensembleInfo = {
        modelPath: DEFAULT_ENSEMBLE_MODEL_PATH,
        requestedUrl: aux.modelUrl,
        fetchedUrl: aux.fetchedUrl,
        byteLength: aux.byteLength,
        sha256: aux.sha256,
        sha256Short: aux.sha256 ? aux.sha256.slice(0, 12) : null,
        knownSha256: KNOWN_ENSEMBLE_SHA256,
        matchesKnownModel: !!aux.sha256 && aux.sha256 === KNOWN_ENSEMBLE_SHA256,
        weight: ENSEMBLE_MODEL_WEIGHT
      };
      if (aux.sha256 && aux.sha256 !== KNOWN_ENSEMBLE_SHA256) {
        digitSession = null;
        ensembleDigitSession = null;
        rightSlotDigitSession = null;
        rightSlotModelPathLoaded = null;
        throw new Error(
          `Loaded OCR ensemble model SHA ${aux.sha256.slice(0, 12)} does not match the expected model ` +
          `${KNOWN_ENSEMBLE_SHA256.slice(0, 12)}. Reload the page to clear the stale model cache.`
        );
      }
    }
    modelRuntimeInfo = {
      modelPath,
      requestedUrl: primary.modelUrl,
      fetchedUrl: primary.fetchedUrl,
      loadedAt: new Date().toISOString(),
      cacheBuster: MODEL_CACHE_BUSTER,
      byteLength: primary.byteLength,
      sha256: primary.sha256,
      sha256Short: primary.sha256 ? primary.sha256.slice(0, 12) : null,
      knownWorksheetSha256: KNOWN_WORKSHEET_SHA256,
      matchesKnownWorksheet: !!primary.sha256 && primary.sha256 === KNOWN_WORKSHEET_SHA256,
      ensemble: useEnsemble
        ? {
            enabled: true,
            method: 'weighted probability average',
            primaryWeight: PRIMARY_MODEL_WEIGHT,
            auxiliaryWeight: ENSEMBLE_MODEL_WEIGHT,
            auxiliary: ensembleInfo
          }
        : { enabled: false },
      rightSlot: {
        enabled: !!getRightSlotModelPathFromUrl(),
        modelPath: getRightSlotModelPathFromUrl(),
        loaded: false,
        routing: 'digitIndex === 1'
      },
      inputNames: digitSession.inputNames || [],
      outputNames: digitSession.outputNames || [],
      inputType,
      outputType: outputMeta?.type || null,
      inputShape: shapeDisplay(inputShape),
      outputShape: shapeDisplay(outputShape),
      classIndexOrder: '0..9 (logit index = digit label)',
      appFeed: {
        order: 'NCHW',
        shape: appFeedShape,
        type: 'float32',
        range: '0..1'
      },
      contractChecks: {
        shapeMatchesApp,
        typeMatchesApp,
        overall: shapeMatchesApp && typeMatchesApp
      },
      contractSummary: `model expects type=${inputType}, shape=${asJson(inputShape)}; app feeds float32 NCHW [1,1,28,28] in 0..1`,
      runtime: getOrtRuntimeConfig()
    };
    if (modelPath === DEFAULT_MODEL_PATH && primary.sha256 && primary.sha256 !== KNOWN_WORKSHEET_SHA256) {
      digitSession = null;
      ensembleDigitSession = null;
      rightSlotDigitSession = null;
      rightSlotModelPathLoaded = null;
      throw new Error(
        `Loaded OCR model SHA ${primary.sha256.slice(0, 12)} does not match the expected worksheet model ` +
        `${KNOWN_WORKSHEET_SHA256.slice(0, 12)}. Reload the page to clear the stale model cache.`
      );
    }
    console.log('✅ ONNX digit model loaded:', digitSession.inputNames, '→', digitSession.outputNames);
    return digitSession;
  } catch (err) {
    console.error('❌ Failed to load ONNX model:', err);
    throw new Error('ONNX model not found at ' + getModelPathFromUrl() + ': ' + (err?.message || String(err)));
  }
}

async function getRightSlotDigitSession() {
  const modelPath = getRightSlotModelPathFromUrl();
  if (!modelPath) return null;
  if (rightSlotDigitSession && rightSlotModelPathLoaded === modelPath) return rightSlotDigitSession;

  const loaded = await loadDigitSession(modelPath);
  if (modelPath === DEFAULT_RIGHT_SLOT_MODEL_PATH && loaded.sha256 && loaded.sha256 !== KNOWN_RIGHT_SLOT_SHA256) {
    rightSlotDigitSession = null;
    rightSlotModelPathLoaded = null;
    throw new Error(
      `Loaded OCR right-slot model SHA ${loaded.sha256.slice(0, 12)} does not match the expected model ` +
      `${KNOWN_RIGHT_SLOT_SHA256.slice(0, 12)}. Reload the page to clear the stale model cache.`
    );
  }

  rightSlotDigitSession = loaded.session;
  rightSlotModelPathLoaded = modelPath;
  if (modelRuntimeInfo) {
    modelRuntimeInfo.rightSlot = {
      enabled: true,
      modelPath,
      requestedUrl: loaded.modelUrl,
      fetchedUrl: loaded.fetchedUrl,
      byteLength: loaded.byteLength,
      sha256: loaded.sha256,
      sha256Short: loaded.sha256 ? loaded.sha256.slice(0, 12) : null,
      knownSha256: KNOWN_RIGHT_SLOT_SHA256,
      matchesKnownModel: !!loaded.sha256 && loaded.sha256 === KNOWN_RIGHT_SLOT_SHA256,
      loaded: true,
      routing: 'digitIndex === 1'
    };
  }
  return rightSlotDigitSession;
}

async function loadDigitSession(modelPath) {
  const modelUrl = `${modelPath}?v=${encodeURIComponent(MODEL_CACHE_BUSTER)}`;
  const response = await fetch(modelUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Model fetch failed: ${response.status} ${response.statusText} for ${modelPath}`);
  }
  const buffer = await response.arrayBuffer();
  const sha256 = await sha256Hex(buffer);
  const session = await ort.InferenceSession.create(buffer, {
    executionProviders: ['wasm'],
  });
  return {
    session,
    modelUrl,
    fetchedUrl: response.url || modelUrl,
    byteLength: buffer.byteLength,
    sha256
  };
}

export function getDigitModelInfo() {
  return modelRuntimeInfo;
}

/**
 * Recognize digits from 28x28 grayscale crops
 * @param {ArrayLike|Tensor} inputTensor - Float32 array or ONNX Tensor of shape [1, 1, 28, 28]
 * @returns {{ digit: number, confidence: number, topK: {digit:number, confidence:number}[] }[]}
 */
export async function recognizeDigits(inputTensor) {
  if (!digitSession) {
    await initDigitModel();
  }

  const data = copyDigitTensorData(inputTensor);

  try {
    const probs = await runDigitDataAsProbs(data);
    return [digitResultFromProbs(probs)];
  } catch (err) {
    console.error('OCR Inference Error:', err);
    throw err;
  }
}

export async function recognizeDigitsRobust(inputTensor, baseResult = null, options = {}) {
  if (!digitSession) {
    await initDigitModel();
  }

  const data = copyDigitTensorData(inputTensor);
  const base = baseResult || (await recognizeDigits(data))[0];
  const force = options.force === true;
  const baseTopK = base.topK || [];
  const baseGap = baseTopK.length >= 2 ? (baseTopK[0].confidence - baseTopK[1].confidence) : 1;
  if (!force && base.confidence >= ROBUST_RECOGNITION_CONFIDENCE_THRESHOLD && baseGap >= ROBUST_RECOGNITION_MARGIN_THRESHOLD) {
    return [{
      ...base,
      robust: false,
      variantCount: 1
    }];
  }

  const variants = makeRobustDigitVariants(data);
  const summed = new Float32Array(10);
  const variantProbs = [];
  let used = 0;
  for (let i = 0; i < variants.length; i++) {
    const probs = i === 0 && Array.isArray(base.probs)
      ? new Float32Array(base.probs)
      : await runDigitDataAsProbs(variants[i]);
    variantProbs.push(probs);
    for (let j = 0; j < 10; j++) summed[j] += probs[j] || 0;
    used++;
  }
  for (let j = 0; j < 10; j++) summed[j] /= Math.max(1, used);

  const commonExtra = {
    robust: true,
    variantCount: used,
    baseDigit: base.digit,
    baseConfidence: base.confidence,
    baseTopK
  };

  const overrideProbs = maybeApplyCleanFiveSixOverride(summed, variantProbs, base);
  if (overrideProbs) {
    return [digitResultFromProbs(overrideProbs, {
      ...commonExtra,
      robustOverride: 'clean-5v6'
    })];
  }

  const votedDigit = maybeApplyLowConfidenceSixVoteOverride(summed, variantProbs);
  if (votedDigit != null) {
    return [digitResultFromVotedDigit(summed, votedDigit, {
      ...commonExtra,
      robustOverride: 'vote-5v6'
    })];
  }

  return [digitResultFromProbs(summed, {
    ...commonExtra,
    robustOverride: null
  })];
}

function preprocessVariantWeight(name) {
  switch (name) {
    case 'strict':
      return 1.08;
    case 'edge-clean':
      return 1.0;
    case 'line-masked-slot':
      return 0.35;
    case 'center-safe-slot':
      return 1.05;
    case 'expected-slot':
      return 1.02;
    case 'edge-band-slot':
      return 1.04;
    case 'wide-slot':
      return 0.58;
    case 'no-rule-cleanup':
      return 0.96;
    case 'no-component-cleanup':
      return 0.96;
    case 'no-side-erase':
      return 0.42;
    case 'gentle':
      return 0.58;
    default:
      return 0.9;
  }
}

function digitTopGap(result) {
  const topK = result?.topK || [];
  return topK.length >= 2 ? topK[0].confidence - topK[1].confidence : 1;
}

function compactVariantDetails(variantResults) {
  return variantResults.map((variant) => ({
    name: variant.name,
    digit: variant.result.digit,
    confidence: variant.result.confidence,
    topGap: digitTopGap(variant.result),
    topK: (variant.result.topK || []).slice(0, 3)
  }));
}

function capDigitResultForReview(result, reason, variantDetails) {
  const chosenDigit = result.digit;
  const ranked = result.topK || [];
  const runner = ranked.find((item) => item.digit !== chosenDigit) || { digit: (chosenDigit + 1) % 10, confidence: 0.18 };
  const third = ranked.find((item) => item.digit !== chosenDigit && item.digit !== runner.digit) || { digit: (chosenDigit + 2) % 10, confidence: 0.1 };
  const topConfidence = Math.min(result.confidence || 0.55, 0.55);
  const reviewTopK = [
    { digit: chosenDigit, confidence: topConfidence },
    { digit: runner.digit, confidence: Math.max(0.01, topConfidence - 0.03) },
    { digit: third.digit, confidence: Math.max(0.01, topConfidence - 0.12) }
  ];
  return {
    ...result,
    confidence: reviewTopK[0].confidence,
    topK: reviewTopK,
    preprocessDisagreement: true,
    preprocessReviewReason: reason,
    preprocessVariants: variantDetails
  };
}

function makeWeightedVoteSummary(variantResults) {
  const votes = new Array(10).fill(0);
  let total = 0;
  for (const variant of variantResults) {
    const result = variant.result;
    const weight = preprocessVariantWeight(variant.name) * Math.max(0.35, Math.min(1, result.confidence || 0));
    votes[result.digit] += weight;
    total += weight;
  }
  const ranked = votes
    .map((vote, digit) => ({ digit, vote, share: total ? vote / total : 0 }))
    .sort((a, b) => b.vote - a.vote);
  return {
    ranked,
    total,
    top: ranked[0],
    runnerUp: ranked[1],
    margin: (ranked[0]?.share || 0) - (ranked[1]?.share || 0)
  };
}

function averageVariantProbsWeighted(variantResults, names = null) {
  const nameSet = names ? new Set(names) : null;
  const summed = new Float32Array(10);
  let totalWeight = 0;
  for (const variant of variantResults) {
    if (nameSet && !nameSet.has(variant.name)) continue;
    const weight = preprocessVariantWeight(variant.name);
    const probs = variant.result.probs || [];
    for (let i = 0; i < 10; i++) summed[i] += (probs[i] || 0) * weight;
    totalWeight += weight;
  }
  if (totalWeight <= 0) return null;
  for (let i = 0; i < 10; i++) summed[i] /= totalWeight;
  return summed;
}

function findVariant(variantResults, name) {
  return variantResults.find((variant) => variant.name === name) || null;
}

function variantMeets(variant, minConfidence, minGap) {
  return Boolean(
    variant &&
    (variant.result.confidence || 0) >= minConfidence &&
    digitTopGap(variant.result) >= minGap
  );
}

function findVariantAgreement(variantResults, names, minConfidence, minGap) {
  const variants = names.map((name) => findVariant(variantResults, name));
  if (variants.some((variant) => !variant)) return null;
  const digit = variants[0].result.digit;
  if (!variants.every((variant) => variant.result.digit === digit)) return null;
  if (!variants.every((variant) => variantMeets(variant, minConfidence, minGap))) return null;
  return { digit, variants };
}

function findStrongSlotMajority(variantResults, options = {}) {
  const slotNames = new Set([
    'gentle',
    'center-safe-slot',
    'expected-slot',
    'edge-band-slot',
    'wide-slot',
    'no-side-erase'
  ]);
  const minConfidence = options.minConfidence ?? 0.70;
  const minGap = options.minGap ?? 0.45;
  const minCount = options.minCount ?? 5;
  const byDigit = new Map();

  for (const variant of variantResults) {
    const name = variant?.name || '';
    if (!slotNames.has(name)) continue;
    if (!variantMeets(variant, minConfidence, minGap)) continue;
    const digit = variant.result.digit;
    if (!byDigit.has(digit)) byDigit.set(digit, []);
    byDigit.get(digit).push(variant);
  }

  const candidates = Array.from(byDigit.entries())
    .filter(([, variants]) => variants.length >= minCount)
    .map(([digit, variants]) => {
      const meanConfidence = variants.reduce((sum, variant) => sum + (variant.result.confidence || 0), 0) / variants.length;
      const meanGap = variants.reduce((sum, variant) => sum + digitTopGap(variant.result), 0) / variants.length;
      return {
        digit,
        variants,
        names: variants.map((variant) => variant.name),
        meanConfidence,
        meanGap,
        score: variants.length * 3 + meanConfidence + meanGap
      };
    })
    .sort((a, b) => b.score - a.score);

  return candidates[0] || null;
}

function findCleanupQuad(variantResults) {
  return ['strict', 'edge-clean', 'no-rule-cleanup', 'no-component-cleanup']
    .map((name) => findVariant(variantResults, name))
    .filter(Boolean);
}

function cleanupQuadAgreesOnDigit(cleanupVariants) {
  if (cleanupVariants.length < 4) return null;
  const digit = cleanupVariants[0].result.digit;
  if (!cleanupVariants.every((variant) => variant.result.digit === digit)) return null;
  return {
    digit,
    meanConfidence: cleanupVariants.reduce((sum, variant) => sum + (variant.result.confidence || 0), 0) / cleanupVariants.length,
    meanGap: cleanupVariants.reduce((sum, variant) => sum + digitTopGap(variant.result), 0) / cleanupVariants.length,
    maxConfidence: Math.max(...cleanupVariants.map((variant) => variant.result.confidence || 0))
  };
}

function hasStrongAlternativeCleanupConsensus(variantResults, candidateDigit) {
  const alternatives = [
    { names: ['edge-clean', 'no-rule-cleanup'], minConfidence: 0.52, minGap: 0.22 },
    { names: ['no-rule-cleanup', 'gentle'], minConfidence: 0.58, minGap: 0.30 },
    { names: ['no-rule-cleanup', 'center-safe-slot'], minConfidence: 0.58, minGap: 0.30 },
    { names: ['gentle', 'center-safe-slot'], minConfidence: 0.60, minGap: 0.34 },
    { names: ['gentle', 'edge-band-slot'], minConfidence: 0.78, minGap: 0.70 },
    { names: ['edge-band-slot', 'wide-slot'], minConfidence: 0.70, minGap: 0.55 },
    { names: ['edge-band-slot', 'no-side-erase'], minConfidence: 0.60, minGap: 0.34 },
    { names: ['expected-slot', 'edge-band-slot'], minConfidence: 0.70, minGap: 0.50 },
    { names: ['expected-slot', 'no-side-erase'], minConfidence: 0.62, minGap: 0.35 },
    { names: ['gentle', 'expected-slot'], minConfidence: 0.78, minGap: 0.65 }
  ];

  return alternatives.some((alternative) => {
    const agreement = findVariantAgreement(
      variantResults,
      alternative.names,
      alternative.minConfidence,
      alternative.minGap
    );
    return agreement && agreement.digit !== candidateDigit;
  });
}

function findTrustedCleanupMajorityAgainst(variantResults, candidateDigit) {
  const cleanupMajorities = [
    ['strict', 'no-rule-cleanup', 'no-component-cleanup'],
    ['strict', 'edge-clean', 'no-component-cleanup'],
    ['strict', 'edge-clean', 'no-rule-cleanup']
  ];

  for (const names of cleanupMajorities) {
    const agreement = findVariantAgreement(variantResults, names, 0.72, 0.36);
    if (!agreement) continue;
    // A strong cleanup "1" can still be the printed guide/divider, so do not let
    // that alone block wider slot evidence. Non-1 cleanup majorities are usually
    // real handwriting shape that the wider crops can distort with box structure.
    if (agreement.digit !== 1 && agreement.digit !== candidateDigit) return agreement;
  }

  return null;
}

function slotConsensusBlockedByCleanup(variantResults, candidateDigit) {
  return Boolean(findTrustedCleanupMajorityAgainst(variantResults, candidateDigit));
}

function buildVariantConsensus(variantResults, names, digit, reason, alwaysReview = true) {
  const probs = averageVariantProbsWeighted(variantResults, names);
  if (!probs) return null;
  return {
    digit,
    probs,
    reason,
    alwaysReview
  };
}

function choosePreprocessConsensus(variantResults, options = {}) {
  const strict = findVariant(variantResults, 'strict') || variantResults[0] || null;
  const strictGap = digitTopGap(strict?.result);
  const strictWeak =
    !strict ||
    (strict.result.confidence || 0) < 0.76 ||
    strictGap < 0.24;
  const digitIndex = Number(options.digitIndex);
  const isLeftVirtualDigit = Number.isFinite(digitIndex) && digitIndex === 0;
  const isRightVirtualDigit = Number.isFinite(digitIndex) && digitIndex === 1;
  const cleanupQuad = findCleanupQuad(variantResults);
  const cleanupAgreement = cleanupQuadAgreesOnDigit(cleanupQuad);

  const strictNoComponentWide = findVariantAgreement(
    variantResults,
    ['strict', 'no-component-cleanup', 'wide-slot'],
    0.80,
    0.60
  );
  if (strictNoComponentWide) {
    return buildVariantConsensus(
      variantResults,
      ['strict', 'no-component-cleanup', 'wide-slot'],
      strictNoComponentWide.digit,
      'strict-no-component-wide-consensus',
      true
    );
  }

  const strongSlotMajority = findStrongSlotMajority(variantResults, {
    minConfidence: 0.70,
    minGap: 0.45,
    minCount: 5
  });
  if (
    strongSlotMajority &&
    cleanupAgreement &&
    cleanupAgreement.digit !== strongSlotMajority.digit &&
    cleanupAgreement.meanConfidence < 0.90
  ) {
    return buildVariantConsensus(
      variantResults,
      strongSlotMajority.names,
      strongSlotMajority.digit,
      'strong-slot-majority-consensus',
      true
    );
  }

  const weakCleanupRightSlotMajority = isRightVirtualDigit
    ? findStrongSlotMajority(variantResults, {
      minConfidence: 0.86,
      minGap: 0.70,
      minCount: 4
    })
    : null;
  if (
    weakCleanupRightSlotMajority &&
    cleanupAgreement &&
    cleanupAgreement.digit !== weakCleanupRightSlotMajority.digit &&
    cleanupAgreement.maxConfidence < 0.56
  ) {
    return buildVariantConsensus(
      variantResults,
      weakCleanupRightSlotMajority.names,
      weakCleanupRightSlotMajority.digit,
      'right-slot-weak-cleanup-slot-majority',
      true
    );
  }

  const trustedCleanupQuad = findVariantAgreement(
    variantResults,
    ['strict', 'edge-clean', 'no-rule-cleanup', 'no-component-cleanup'],
    0.70,
    0.40
  );
  if (trustedCleanupQuad && isLeftVirtualDigit) {
    return buildVariantConsensus(
      variantResults,
      ['strict', 'edge-clean', 'no-rule-cleanup', 'no-component-cleanup'],
      trustedCleanupQuad.digit,
      'trusted-cleanup-quad-consensus',
      true
    );
  }

  const slotTriple = findVariantAgreement(
    variantResults,
    ['expected-slot', 'wide-slot', 'no-side-erase'],
    0.48,
    0.18
  );
  if (
    slotTriple &&
    !slotConsensusBlockedByCleanup(variantResults, slotTriple.digit) &&
    variantMeets(findVariant(variantResults, 'wide-slot'), 0.82, 0.68) &&
    variantMeets(findVariant(variantResults, 'no-side-erase'), 0.82, 0.68)
  ) {
    return buildVariantConsensus(
      variantResults,
      ['expected-slot', 'wide-slot', 'no-side-erase'],
      slotTriple.digit,
      'expected-wide-no-side-slot-consensus',
      true
    );
  }

  const noComponentExpectedPair = findVariantAgreement(
    variantResults,
    ['no-component-cleanup', 'expected-slot'],
    0.58,
    0.35
  );
  if (noComponentExpectedPair) {
    return buildVariantConsensus(
      variantResults,
      ['no-component-cleanup', 'expected-slot'],
      noComponentExpectedPair.digit,
      'no-component-expected-slot-consensus',
      true
    );
  }

  const edgeCleanCenterPair = findVariantAgreement(
    variantResults,
    ['edge-clean', 'center-safe-slot'],
    0.62,
    0.40
  );
  const rightSlotShapeTriple = isRightVirtualDigit && edgeCleanCenterPair?.digit === 1
    ? findVariantAgreement(
      variantResults,
      ['strict', 'no-component-cleanup', 'wide-slot'],
      0.30,
      0.04
    )
    : null;
  if (rightSlotShapeTriple && rightSlotShapeTriple.digit !== 1) {
    return buildVariantConsensus(
      variantResults,
      ['strict', 'no-component-cleanup', 'wide-slot'],
      rightSlotShapeTriple.digit,
      'right-slot-shape-triple-review-consensus',
      true
    );
  }

  if (edgeCleanCenterPair) {
    return buildVariantConsensus(
      variantResults,
      ['edge-clean', 'center-safe-slot'],
      edgeCleanCenterPair.digit,
      'edge-clean-center-slot-consensus',
      true
    );
  }

  const gentleEdgeNoSide = findVariantAgreement(
    variantResults,
    ['gentle', 'edge-band-slot', 'no-side-erase'],
    0.78,
    0.70
  );
  if (gentleEdgeNoSide && !slotConsensusBlockedByCleanup(variantResults, gentleEdgeNoSide.digit)) {
    return buildVariantConsensus(
      variantResults,
      ['gentle', 'edge-band-slot', 'no-side-erase'],
      gentleEdgeNoSide.digit,
      'gentle-edge-no-side-slot-consensus',
      true
    );
  }

  const edgeBandWideStrong = findVariantAgreement(
    variantResults,
    ['edge-band-slot', 'wide-slot'],
    0.70,
    0.55
  );
  const edgeBandWideNoSide = findVariant(variantResults, 'no-side-erase');
  const edgeBandWideHasNoSideSupport =
    edgeBandWideStrong &&
    edgeBandWideNoSide &&
    edgeBandWideNoSide.result.digit === edgeBandWideStrong.digit &&
    (edgeBandWideNoSide.result.confidence || 0) >= 0.45 &&
    digitTopGap(edgeBandWideNoSide.result) >= 0.10;
  if (
    edgeBandWideStrong &&
    edgeBandWideHasNoSideSupport &&
    !slotConsensusBlockedByCleanup(variantResults, edgeBandWideStrong.digit)
  ) {
    return buildVariantConsensus(
      variantResults,
      ['edge-band-slot', 'wide-slot'],
      edgeBandWideStrong.digit,
      'edge-band-wide-slot-consensus',
      true
    );
  }

  const edgeBandNoSidePair = findVariantAgreement(
    variantResults,
    ['edge-band-slot', 'no-side-erase'],
    0.60,
    0.34
  );
  if (edgeBandNoSidePair && !slotConsensusBlockedByCleanup(variantResults, edgeBandNoSidePair.digit)) {
    return buildVariantConsensus(
      variantResults,
      ['edge-band-slot', 'no-side-erase'],
      edgeBandNoSidePair.digit,
      'edge-band-no-side-slot-consensus',
      true
    );
  }

  const expectedNoSideLoose = findVariantAgreement(
    variantResults,
    ['expected-slot', 'no-side-erase'],
    0.46,
    0.16
  );
  const strictBlocksExpectedNoSide =
    expectedNoSideLoose &&
    strict &&
    strict.result.digit !== expectedNoSideLoose.digit &&
    (strict.result.confidence || 0) >= 0.70 &&
    digitTopGap(strict.result) >= 0.42;
  if (
    expectedNoSideLoose &&
    !strictBlocksExpectedNoSide &&
    !slotConsensusBlockedByCleanup(variantResults, expectedNoSideLoose.digit)
  ) {
    return buildVariantConsensus(
      variantResults,
      ['expected-slot', 'no-side-erase'],
      expectedNoSideLoose.digit,
      'expected-no-side-loose-slot-consensus',
      true
    );
  }

  const edgeBandSlotTriple = findVariantAgreement(
    variantResults,
    ['center-safe-slot', 'expected-slot', 'edge-band-slot'],
    0.44,
    0.08
  );
  if (
    edgeBandSlotTriple &&
    strictWeak &&
    !slotConsensusBlockedByCleanup(variantResults, edgeBandSlotTriple.digit)
  ) {
    return buildVariantConsensus(
      variantResults,
      ['center-safe-slot', 'expected-slot', 'edge-band-slot'],
      edgeBandSlotTriple.digit,
      'center-expected-edge-band-slot-consensus',
      true
    );
  }

  const strongCenterEdgeSlotPair = findVariantAgreement(
    variantResults,
    ['center-safe-slot', 'edge-band-slot'],
    0.60,
    0.45
  );
  if (
    strongCenterEdgeSlotPair &&
    !slotConsensusBlockedByCleanup(variantResults, strongCenterEdgeSlotPair.digit)
  ) {
    return buildVariantConsensus(
      variantResults,
      ['center-safe-slot', 'edge-band-slot'],
      strongCenterEdgeSlotPair.digit,
      'strong-center-edge-slot-consensus',
      true
    );
  }

  const cleanupConsensus = findVariantAgreement(
    variantResults,
    ['edge-clean', 'no-rule-cleanup'],
    0.52,
    0.22
  );
  if (cleanupConsensus && !hasStrongAlternativeCleanupConsensus(variantResults, cleanupConsensus.digit)) {
    return buildVariantConsensus(
      variantResults,
      ['edge-clean', 'no-rule-cleanup'],
      cleanupConsensus.digit,
      'edge-no-rule-cleanup-consensus',
      true
    );
  }

  const cleanupTriple = findVariantAgreement(
    variantResults,
    ['no-rule-cleanup', 'gentle', 'center-safe-slot'],
    0.56,
    0.30
  );
  if (cleanupTriple) {
    return buildVariantConsensus(
      variantResults,
      ['no-rule-cleanup', 'gentle', 'center-safe-slot'],
      cleanupTriple.digit,
      'no-rule-gentle-center-consensus',
      true
    );
  }

  const pairs = [
    {
      names: ['edge-clean', 'no-component-cleanup'],
      reason: 'edge-clean-no-component-consensus',
      minConfidence: 0.38,
      minGap: 0.035,
      respectCleanupAlternative: true
    },
    {
      names: ['no-rule-cleanup', 'no-component-cleanup'],
      reason: 'cleanup-skip-consensus',
      minConfidence: 0.40,
      minGap: 0.04,
      respectCleanupAlternative: true
    },
    {
      names: ['no-rule-cleanup', 'gentle'],
      reason: 'gentle-no-rule-consensus',
      minConfidence: 0.34,
      minGap: 0.025,
      alwaysReview: true
    },
    {
      names: ['expected-slot', 'wide-slot'],
      reason: 'expected-wide-slot-consensus',
      minConfidence: 0.45,
      minGap: 0.10,
      allowStrictOverride: true,
      overrideMinConfidence: 0.58,
      overrideMinGap: 0.22,
      alwaysReview: true,
      respectCleanupAlternative: true
    },
    {
      names: ['expected-slot', 'edge-band-slot'],
      reason: 'expected-edge-band-slot-consensus',
      minConfidence: 0.42,
      minGap: 0.07,
      allowStrictOverride: true,
      overrideMinConfidence: 0.56,
      overrideMinGap: 0.18,
      alwaysReview: true,
      respectCleanupAlternative: true
    },
    {
      names: ['center-safe-slot', 'edge-band-slot'],
      reason: 'center-edge-band-slot-consensus',
      minConfidence: 0.46,
      minGap: 0.09,
      allowStrictOverride: true,
      overrideMinConfidence: 0.58,
      overrideMinGap: 0.20,
      alwaysReview: true,
      respectCleanupAlternative: true
    },
    {
      names: ['expected-slot', 'no-side-erase'],
      reason: 'expected-no-side-slot-consensus',
      minConfidence: 0.54,
      minGap: 0.18,
      allowStrictOverride: true,
      overrideMinConfidence: 0.62,
      overrideMinGap: 0.26,
      alwaysReview: true,
      respectCleanupAlternative: true
    },
    {
      names: ['wide-slot', 'no-side-erase'],
      reason: 'wide-no-side-slot-consensus',
      minConfidence: 0.54,
      minGap: 0.18,
      allowStrictOverride: true,
      overrideMinConfidence: 0.62,
      overrideMinGap: 0.26,
      alwaysReview: true,
      respectCleanupAlternative: true
    }
  ];

  for (const pair of pairs) {
    const variants = pair.names.map((name) => findVariant(variantResults, name));
    if (variants.some((variant) => !variant)) continue;
    const digits = variants.map((variant) => variant.result.digit);
    if (!digits.every((digit) => digit === digits[0])) continue;
    const allStrongEnough = variants.every((variant) => (
      (variant.result.confidence || 0) >= pair.minConfidence &&
      digitTopGap(variant.result) >= pair.minGap
    ));
    if (!allStrongEnough) continue;
    if (pair.respectCleanupAlternative && hasStrongAlternativeCleanupConsensus(variantResults, digits[0])) {
      continue;
    }
    if (
      pair.allowStrictOverride &&
      pair.names.some((name) => ['center-safe-slot', 'expected-slot', 'edge-band-slot', 'wide-slot', 'no-side-erase'].includes(name)) &&
      slotConsensusBlockedByCleanup(variantResults, digits[0])
    ) {
      continue;
    }
    if (!strictWeak && strict.result.digit !== digits[0]) {
      if (!pair.allowStrictOverride) continue;
      const overrideStrongEnough = variants.every((variant) => (
        (variant.result.confidence || 0) >= (pair.overrideMinConfidence || pair.minConfidence) &&
        digitTopGap(variant.result) >= (pair.overrideMinGap || pair.minGap)
      ));
      if (!overrideStrongEnough) continue;
    }
    const probs = averageVariantProbsWeighted(variantResults, pair.names);
    if (!probs) continue;
    return {
      digit: digits[0],
      probs,
      reason: pair.reason,
      alwaysReview: pair.alwaysReview === true || (strict && strict.result.digit !== digits[0])
    };
  }

  return null;
}

function chooseDominantPreprocessVariant(variantResults) {
  const ranked = variantResults
    .map((variant) => ({
      variant,
      confidence: variant.result.confidence || 0,
      gap: digitTopGap(variant.result)
    }))
    .filter((item) => item.confidence >= 0.72 && item.gap >= 0.55)
    .sort((a, b) => (b.confidence - a.confidence) || (b.gap - a.gap));

  const best = ranked[0];
  if (!best) return null;

  const next = ranked.find((item) => item.variant.result.digit !== best.variant.result.digit) || ranked[1] || null;
  const confidenceLead = best.confidence - (next?.confidence || 0);
  const gapLead = best.gap - (next?.gap || 0);
  const clearLead =
    confidenceLead >= 0.18 ||
    (confidenceLead >= 0.10 && gapLead >= 0.24) ||
    (best.confidence >= 0.92 && best.gap >= 0.80 && confidenceLead >= 0.08);

  if (!clearLead) return null;

  const strict = findVariant(variantResults, 'strict') || variantResults[0] || null;
  const highRiskDominantNames = new Set(['line-masked-slot', 'center-safe-slot', 'edge-band-slot', 'wide-slot', 'no-side-erase', 'gentle']);
  if (highRiskDominantNames.has(best.variant.name)) {
    const trustedSupportCount = variantResults.filter((variant) => (
      ['strict', 'edge-clean', 'expected-slot', 'edge-band-slot', 'no-rule-cleanup', 'no-component-cleanup'].includes(variant.name) &&
      variant.result.digit === best.variant.result.digit &&
      (variant.result.confidence || 0) >= 0.50 &&
      digitTopGap(variant.result) >= 0.16
    )).length;
    if (trustedSupportCount < 2) return null;
  }
  const strongDisagreements = variantResults.filter((variant) => (
    variant.result.digit !== best.variant.result.digit &&
    ((variant.result.confidence || 0) >= 0.70 || digitTopGap(variant.result) >= 0.50)
  ));

  if (
    strict &&
    strict.result.digit !== best.variant.result.digit &&
    (strict.result.confidence || 0) >= 0.86 &&
    digitTopGap(strict.result) >= 0.72
  ) {
    return null;
  }

  return {
    digit: best.variant.result.digit,
    probs: best.variant.result.probs,
    reason: `dominant-${best.variant.name}`,
    alwaysReview: strongDisagreements.length > 0
  };
}

export async function recognizeDigitsWithPreprocessVariants(tensorVariants, baseResult = null, options = {}) {
  if (!digitSession) {
    await initDigitModel();
  }

  const variants = Array.isArray(tensorVariants)
    ? tensorVariants.filter((variant) => variant && (variant.tensor || variant.data || variant.length))
    : [];
  if (variants.length <= 1) {
    const tensor = variants[0]?.tensor || variants[0]?.data || variants[0] || tensorVariants;
    return recognizeDigitsRobust(tensor, baseResult, { force: options.force === true });
  }

  const variantResults = [];
  for (const variant of variants) {
    const name = variant.name || `variant-${variantResults.length + 1}`;
    const data = copyDigitTensorData(variant.tensor || variant.data || variant);
    const probs = await runDigitDataAsProbs(data, options);
    variantResults.push({
      name,
      result: digitResultFromProbs(probs, { preprocessVariantName: name })
    });
  }

  const variantDetails = compactVariantDetails(variantResults);
  const consensus = choosePreprocessConsensus(variantResults, options);
  const dominant = chooseDominantPreprocessVariant(variantResults);
  const votes = makeWeightedVoteSummary(variantResults);
  const averagedProbs = averageVariantProbsWeighted(variantResults) || new Float32Array(10);
  const strict = findVariant(variantResults, 'strict') || variantResults[0] || null;
  let result;
  let selectionReason = 'weighted-average';

  if (consensus) {
    result = digitResultFromVotedDigit(consensus.probs, consensus.digit, {
      robust: true,
      variantCount: variants.length,
      robustOverride: consensus.reason
    });
    selectionReason = consensus.reason;
  } else if (dominant) {
    result = digitResultFromVotedDigit(dominant.probs, dominant.digit, {
      robust: true,
      variantCount: variants.length,
      robustOverride: dominant.reason
    });
    selectionReason = dominant.reason;
  } else if (votes.top && votes.top.share >= 0.62 && votes.margin >= 0.18) {
    result = digitResultFromVotedDigit(averagedProbs, votes.top.digit, {
      robust: true,
      variantCount: variants.length,
      robustOverride: 'preprocess-weighted-vote'
    });
    selectionReason = 'preprocess-weighted-vote';
  } else {
    result = digitResultFromProbs(averagedProbs, {
      robust: true,
      variantCount: variants.length,
      robustOverride: null
    });
  }

  const uniqueStrongDigits = new Set(
    variantResults
      .filter((variant) => (variant.result.confidence || 0) >= 0.34 || digitTopGap(variant.result) >= 0.03)
      .map((variant) => variant.result.digit)
  );
  const strictDisagrees = strict && strict.result.digit !== result.digit;
  const resultGap = digitTopGap(result);
  const shouldForceReview =
    options.forceReviewOnDisagreement !== false &&
    (
      consensus?.alwaysReview === true ||
      dominant?.alwaysReview === true ||
      uniqueStrongDigits.size >= 3 ||
      (votes.top?.share || 0) < 0.62 ||
      resultGap < 0.12 ||
      result.confidence < 0.78 ||
      (strictDisagrees && digitTopGap(strict.result) >= 0.06)
    );

  const withDetails = {
    ...result,
    preprocessDisagreement: shouldForceReview,
    preprocessReviewReason: shouldForceReview ? selectionReason : null,
    preprocessVariants: variantDetails,
    preprocessVoteSummary: {
      top: votes.top || null,
      runnerUp: votes.runnerUp || null,
      margin: votes.margin
    }
  };

  return [
    shouldForceReview
      ? capDigitResultForReview(withDetails, selectionReason, variantDetails)
      : withDetails
  ];
}

function averageDigitProbs(variantProbs, indexes) {
  const summed = new Float32Array(10);
  let count = 0;
  for (const idx of indexes) {
    const probs = variantProbs[idx] || null;
    if (!probs) continue;
    for (let i = 0; i < 10; i++) summed[i] += probs[i] || 0;
    count++;
  }
  if (!count) return null;
  for (let i = 0; i < 10; i++) summed[i] /= count;
  return summed;
}

function maybeApplyCleanFiveSixOverride(averagedProbs, variantProbs, base) {
  const ranked = rankDigitProbs(averagedProbs);
  if (ranked[0]?.digit !== 5) return null;

  const cleanProbs = averageDigitProbs(variantProbs, CLEAN_FIVE_SIX_VARIANT_INDEXES);
  if (!cleanProbs) return null;

  const cleanRanked = rankDigitProbs(cleanProbs);
  const baseRanked = rankDigitProbs(base?.probs || []);
  const baseGap = (baseRanked[0]?.confidence || 0) - (baseRanked[1]?.confidence || 0);
  const cleanGap = (cleanRanked[0]?.confidence || 0) - (cleanRanked[1]?.confidence || 0);

  if (
    cleanRanked[0]?.digit === 6 &&
    cleanRanked[0].confidence >= 0.45 &&
    cleanGap >= 0.05 &&
    baseGap < 0.65
  ) {
    return cleanProbs;
  }

  return null;
}

function maybeApplyLowConfidenceSixVoteOverride(averagedProbs, variantProbs) {
  const ranked = rankDigitProbs(averagedProbs);
  const top = ranked[0];
  const runnerUp = ranked[1];
  if (top?.digit !== 5 || runnerUp?.digit !== 6) return null;

  const gap = top.confidence - runnerUp.confidence;
  if (top.confidence > 0.35 || gap > 0.06) return null;

  const votes = new Array(10).fill(0);
  for (const probs of variantProbs) {
    const winner = rankDigitProbs(probs)[0]?.digit;
    if (Number.isInteger(winner)) votes[winner]++;
  }
  const winner = votes
    .map((voteCount, digit) => ({ digit, voteCount, confidence: averagedProbs[digit] || 0 }))
    .sort((a, b) => (b.voteCount - a.voteCount) || (b.confidence - a.confidence))[0];

  if (
    winner?.digit === 6 &&
    winner.voteCount >= 4 &&
    votes[6] >= votes[5] + 1 &&
    votes[6] >= votes[8] + 1
  ) {
    return 6;
  }

  return null;
}

async function runDigitDataAsProbs(data, options = {}) {
  // Copy to a new Float32Array so buffer is not neutered by WASM transfer. Prefer array over ort.Tensor
  // because onnxruntime-web can detach/replace Tensor.data, yielding zeros when read.
  const tensor = new ort.Tensor('float32', new Float32Array(data), [1, 1, MNIST_DIGIT_SIZE, MNIST_DIGIT_SIZE]);
  const digitIndex = Number(options.digitIndex);
  const rightSlotSession = digitIndex === 1 ? await getRightSlotDigitSession() : null;
  const activeSession = rightSlotSession || digitSession;
  const probs = await runDigitSessionAsProbs(activeSession, tensor);
  if (!rightSlotSession && ensembleDigitSession) {
    const ensembleTensor = new ort.Tensor('float32', new Float32Array(data), [1, 1, MNIST_DIGIT_SIZE, MNIST_DIGIT_SIZE]);
    const auxProbs = await runDigitSessionAsProbs(ensembleDigitSession, ensembleTensor);
    for (let i = 0; i < probs.length; i++) {
      probs[i] = probs[i] * PRIMARY_MODEL_WEIGHT + auxProbs[i] * ENSEMBLE_MODEL_WEIGHT;
    }
  }
  return probs;
}

async function runDigitSessionAsProbs(session, tensor) {
  const feeds = { [session.inputNames[0]]: tensor };
  const results = await session.run(feeds);
  const outTensor = results[session.outputNames[0]];
  return softmax(outTensor.data);
}

/**
 * Recognize a grid of digits from a worksheet image
 * @param {ArrayBuffer} worksheetImage - Binary image data (JPG/PNG)
 * @param {number[][]} boxCoordinates - Array of [x, y, width, height] for each digit box
 * @returns {{ digit: number, confidence: number, boxIndex: number }[]}
 */
export async function recognizeDigitGrid(worksheetImage, boxCoordinates) {
  if (!digitSession) {
    await initDigitModel();
  }

  const results = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  const imgSrc = 'data:image/jpeg;base64,' + bufferToBase64(worksheetImage);

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imgSrc;
  });

  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);

  for (let i = 0; i < boxCoordinates.length; i++) {
    const [x, y, width, height] = boxCoordinates[i];

    // Crop the digit region
    const cropped = ctx.getImageData(x, y, width, height);

    // Resize to 28x28 and convert to grayscale
    const resized = resizeTo28x8(cropped);

    // Normalize to [0, 1] range
    const normalized = normalizeInput(resized);

    // Run inference
    const tensor = new ort.Tensor('float32', normalized, [1, 1, 28, 28]);
    const feeds = { [digitSession.inputNames[0]]: tensor };
    const inference = await digitSession.run(feeds);
    const logits = inference[digitSession.outputNames[0]].data;
    const probs = softmax(logits);
    const maxIdx = probs.indexOf(Math.max(...probs));
    const confidence = probs[maxIdx]; // probability in [0, 1]

    results.push({
      digit: maxIdx,
      confidence,
      boxIndex: i
    });
  }

  return results;
}

/**
 * Convert ArrayBuffer to base64 string
 */
function bufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Resize image data to 28x28 grayscale
 */
function resizeTo28x8(imageData) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 28;
  canvas.height = 28;

  const newImageData = ctx.createImageData(28, 28);

  // Simple nearest-neighbor resize
  const scaleX = imageData.width / 28;
  const scaleY = imageData.height / 28;

  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const srcIdx = (srcY * imageData.width + srcX) * 4;
      const dstIdx = (y * 28 + x) * 4;

      // Convert to grayscale (average of RGB)
      newImageData.data[dstIdx] = imageData.data[srcIdx];
      newImageData.data[dstIdx + 1] = imageData.data[srcIdx + 1];
      newImageData.data[dstIdx + 2] = imageData.data[srcIdx + 2];
      newImageData.data[dstIdx + 3] = 255; // Alpha
    }
  }

  return newImageData.data.slice(0, 28 * 28); // Return grayscale values only
}

/**
 * Normalize pixel values to [0, 1] range
 */
function normalizeInput(pixels) {
  return new Float32Array(pixels.map(p => p / 255.0));
}
