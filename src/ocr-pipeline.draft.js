import * as ort from 'onnxruntime-web';

/**
 * ONNX Runtime session (singleton)
 */
let digitSession = null;
const MODEL_PATH = '/models/mnist-model.onnx';

/**
 * Initialize ONNX session (load model once)
 */
export async function initDigitModel() {
  if (digitSession) return digitSession;

  try {
    digitSession = await ort.InferenceSession.create(MODEL_PATH);
    console.log('✅ ONNX digit model loaded:', digitSession.inputNames, '→', digitSession.outputNames);
    return digitSession;
  } catch (err) {
    console.error('❌ Failed to load ONNX model:', err);
    throw new Error('ONNX model not found at ' + MODEL_PATH);
  }
}

/**
 * Recognize digits from 28x28 grayscale crops
 * @param {ArrayLike|Tensor} inputTensor - Float32 array or ONNX Tensor of shape [1, 1, 28, 28]
 * @returns {{ digit: number, confidence: number }[]}
 */
export async function recognizeDigits(inputTensor) {
  if (!digitSession) {
    await initDigitModel();
  }

  // Normalize input to [1, 1, 28, 28] float32 tensor
  let tensor;
  if (inputTensor instanceof ort.Tensor) {
    tensor = inputTensor;
  } else {
    tensor = new ort.Tensor('float32', new Float32Array(inputTensor), [1, 1, 28, 28]);
  }

  try {
    const feeds = { [digitSession.inputNames[0]]: tensor };
    const results = await digitSession.run(feeds);
    const output = results[digitSession.outputNames[0]].data;

    // Argmax + confidence
    const maxIdx = output.indexOf(Math.max(...output));
    const confidence = output[maxIdx];

    return [{ digit: maxIdx, confidence }];
  } catch (err) {
    console.error('OCR Inference Error:', err);
    throw err;
  }
}
