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
const DEFAULT_MODEL_PATH = publicUrl('models/mnist-model.onnx');
const DEFAULT_ENSEMBLE_MODEL_PATH = publicUrl('models/worksheet-digit-generalist.onnx');
const MODEL_CACHE_BUSTER = 'worksheet-generalist-ensemble-20260515a';
const KNOWN_WORKSHEET_SHA256 = '1bb4991956f9539df2b49528eca005d6e40a96091969024747074f5fd3f9a270';
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

function shouldUseDefaultEnsemble(modelPath) {
  return modelPath === DEFAULT_MODEL_PATH;
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

export async function recognizeDigitsRobust(inputTensor, baseResult = null) {
  if (!digitSession) {
    await initDigitModel();
  }

  const data = copyDigitTensorData(inputTensor);
  const base = baseResult || (await recognizeDigits(data))[0];
  const baseTopK = base.topK || [];
  const baseGap = baseTopK.length >= 2 ? (baseTopK[0].confidence - baseTopK[1].confidence) : 1;
  if (base.confidence >= ROBUST_RECOGNITION_CONFIDENCE_THRESHOLD && baseGap >= ROBUST_RECOGNITION_MARGIN_THRESHOLD) {
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

async function runDigitDataAsProbs(data) {
  // Copy to a new Float32Array so buffer is not neutered by WASM transfer. Prefer array over ort.Tensor
  // because onnxruntime-web can detach/replace Tensor.data, yielding zeros when read.
  const tensor = new ort.Tensor('float32', new Float32Array(data), [1, 1, MNIST_DIGIT_SIZE, MNIST_DIGIT_SIZE]);
  const probs = await runDigitSessionAsProbs(digitSession, tensor);
  if (ensembleDigitSession) {
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
