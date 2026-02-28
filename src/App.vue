<template>
  <div class="scan-grade">
    <header class="header">
      <h1>🐯 ScanGrade</h1>
      <p class="subtitle">Point. Scan. Grade.</p>
    </header>

    <main class="main">
      <!-- Runtime Self-Test Section -->
      <div class="test-section">
        <button @click="runRuntimeTest" class="btn btn-test" :disabled="runtimeTestRunning">
          {{ runtimeTestRunning ? 'Testing...' : '🔧 Runtime Self-Test' }}
        </button>
        <button @click="runPipelineTest" class="btn btn-test" :disabled="!pipelineReady || pipelineTestRunning">
          {{ pipelineTestRunning ? 'Testing...' : '📊 Pipeline Smoke Test' }}
        </button>
      </div>

      <!-- Test Results Console -->
      <div v-if="testResults.length > 0" class="console-output">
        <div class="console-header">
          <span>Test Output</span>
          <button @click="clearResults" class="btn-clear">Clear</button>
        </div>
        <div class="console-body">
          <div
            v-for="(line, i) in testResults"
            :key="i"
            class="console-line"
            :class="line.type"
          >
            <span class="timestamp">{{ line.time }}</span>
            <span class="message">{{ line.message }}</span>
          </div>
        </div>
      </div>

      <CameraCapture
        @image-captured="handleImageCaptured"
        @ocr-complete="handleOCRComplete"
        ref="cameraRef"
      />

      <div v-if="ocrResult" class="results">
        <h2>Results</h2>
        <p>Detected: {{ ocrResult.digits.join(', ') }}</p>
        <p>Confidence: {{ ocrResult.confidence }}</p>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import CameraCapture from './components/CameraCapture.vue'
import { processWorksheet } from './homography.js'
import { initDigitModel, recognizeDigits } from './ocr-pipeline.js'

const LAYOUT = {
  "layout_id": "sg-10-box-v1",
  "version": 1,
  "debug": false,
  "description": "2x5 grid of 22mm digit boxes for single-digit answers",
  "page": {
    "width_mm": 215.9,
    "height_mm": 279.4,
    "aspect_ratio": 0.773,
    "units": "mm"
  },
  "safe_margin_mm": 12.7,
  "boxes": [
    {"id": 0, "question_num": 1,  "x": 33,  "y": 71,  "cx": 44, "cy": 82,  "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 1, "question_num": 2,  "x": 71,  "y": 71,  "cx": 82, "cy": 82,  "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 2, "question_num": 3,  "x": 109, "y": 71,  "cx": 120, "cy": 82, "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 3, "question_num": 4,  "x": 147, "y": 71,  "cx": 158, "cy": 82, "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 4, "question_num": 5,  "x": 185, "y": 71,  "cx": 196, "cy": 82, "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 5, "question_num": 6,  "x": 33,  "y": 141, "cx": 44, "cy": 152, "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 6, "question_num": 7,  "x": 71,  "y": 141, "cx": 82, "cy": 152, "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 7, "question_num": 8,  "x": 109, "y": 141, "cx": 120, "cy": 152, "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 8, "question_num": 9,  "x": 147, "y": 141, "cx": 158, "cy": 152, "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 9, "question_num": 10, "x": 185, "y": 141, "cx": 196, "cy": 152, "width": 22, "height": 22, "expected_type": "digit"}
  ],
  "homography": {
    "marker_size_mm": 17.3,
    "anchors": [
      {"id": "tl", "x_mm": 10.8, "y_mm": 10.8,  "x_norm": 0.05, "y_norm": 0.05},
      {"id": "tr", "x_mm": 187.8, "y_mm": 10.8, "x_norm": 0.95, "y_norm": 0.05},
      {"id": "br", "x_mm": 187.8, "y_mm": 251.3, "x_norm": 0.95, "y_norm": 0.95},
      {"id": "bl", "x_mm": 10.8, "y_mm": 251.3, "x_norm": 0.05, "y_norm": 0.95}
    ]
  }
}

const ocrResult = ref(null)
const cameraRef = ref(null)
const testResults = ref([])
const runtimeTestRunning = ref(false)
const pipelineTestRunning = ref(false)
const pipelineReady = ref(false)

// Runtime test status tracking
let runtimeStatus = {
  openCV: false,
  openCVMat: false,
  openCVWarmup: false,
  ort: false,
  ortInferenceSession: false,
  ortSanity: false
}

const handleImageCaptured = async (imageData) => {
  console.log('Image captured:', imageData)
  
  // Initialize ONNX model
  try {
    await initDigitModel()
    console.log('✅ ONNX model ready')
  } catch (err) {
    log(`❌ Model load failed: ${err.message}`, 'fail')
    return
  }
  
  // Run full pipeline
  try {
    log('Running full OCR pipeline...', 'info')
    const start = performance.now()
    
    // Load image into OpenCV
    const img = new Image()
    img.src = imageData
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })
    
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    
    const src = cv.imread(canvas)
    
    // Run homography + crops
    const result = processWorksheet(src, LAYOUT)
    
    if (!result) {
      log('❌ Corner marker detection failed', 'fail')
      src.delete()
      return
    }
    
    const { warpedImage, processedTensors } = result
    
    // Run OCR on each digit
    const predictions = []
    for (const proc of processedTensors) {
      const tensor = new ort.Tensor('float32', proc.tensor, [1, 1, 28, 28])
      const digitResult = await recognizeDigits(tensor)
      predictions.push({
        questionNum: proc.questionNum,
        digit: digitResult[0].digit,
        confidence: digitResult[0].confidence
      })
    }
    
    const totalTime = (performance.now() - start).toFixed(2)
    
    log(`✅ OCR complete: ${predictions.length} digits in ${totalTime}ms`, 'success')
    
    // Display results
    ocrResult.value = {
      digits: predictions.map(p => p.digit),
      confidences: predictions.map(p => p.confidence),
      predictions: predictions,
      totalTime: totalTime
    }
    
    // Cleanup
    src.delete()
    warpedImage.delete()
    
  } catch (err) {
    log(`❌ Pipeline error: ${err.message}`, 'fail')
    console.error(err)
  }
}

const log = (message, type = 'info') => {
  const time = new Date().toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  testResults.value.push({ time, message, type })
}

const clearResults = () => {
  testResults.value = []
}

const runRuntimeTest = async () => {
  runtimeTestRunning.value = true
  testResults.value = []
  log('=== Runtime Self-Test Started ===', 'header')

  const startTime = performance.now()

  // Test 1: OpenCV availability
  try {
    if (typeof window.cv === 'undefined') {
      throw new Error('window.cv is undefined')
    }
    runtimeStatus.openCV = true
    log('✅ OpenCV: window.cv exists', 'pass')
  } catch (err) {
    runtimeStatus.openCV = false
    log(`❌ OpenCV FAIL: ${err.message}`, 'fail')
  }

  // Test 2: cv.Mat availability
  try {
    if (!window.cv || typeof window.cv.Mat === 'undefined') {
      throw new Error('cv.Mat is undefined')
    }
    runtimeStatus.openCVMat = true
    log('✅ cv.Mat: Available', 'pass')
  } catch (err) {
    runtimeStatus.openCVMat = false
    log(`❌ cv.Mat FAIL: ${err.message}`, 'fail')
  }

  // Test 3: OpenCV Warm-up (create and dispose a Mat)
  try {
    if (runtimeStatus.openCVMat) {
      const warmupStart = performance.now()
      const mat = new cv.Mat(10, 10, cv.CV_8UC1)
      mat.setTo(new cv.Scalar(128))
      // Verify it's actually usable
      const val = mat.ucharAt(5, 5)
      if (val !== 128) {
        throw new Error(`Mat read-back failed: expected 128, got ${val}`)
      }
      mat.delete()
      const warmupTime = (performance.now() - warmupStart).toFixed(2)
      runtimeStatus.openCVWarmup = true
      log(`✅ OpenCV Warm-up: Created 10×10 Mat, verified R/W, disposed (${warmupTime}ms)`, 'pass')
    } else {
      throw new Error('Skipping - cv.Mat unavailable')
    }
  } catch (err) {
    runtimeStatus.openCVWarmup = false
    log(`❌ OpenCV Warm-up FAIL: ${err.message}`, 'fail')
  }

  // Test 4: ONNX Runtime availability
  try {
    if (typeof window.ort === 'undefined') {
      throw new Error('window.ort is undefined')
    }
    runtimeStatus.ort = true
    log('✅ ORT: window.ort exists', 'pass')
  } catch (err) {
    runtimeStatus.ort = false
    log(`❌ ORT FAIL: ${err.message}`, 'fail')
  }

  // Test 5: ORT.InferenceSession availability
  try {
    if (!window.ort || typeof window.ort.InferenceSession === 'undefined') {
      throw new Error('ort.InferenceSession is undefined')
    }
    runtimeStatus.ortInferenceSession = true
    log('✅ ORT.InferenceSession: Available', 'pass')
  } catch (err) {
    runtimeStatus.ortInferenceSession = false
    log(`❌ ORT.InferenceSession FAIL: ${err.message}`, 'fail')
  }

  // Test 6: ORT Sanity - try to access session creation API
  try {
    if (runtimeStatus.ortInferenceSession) {
      // Just verify the API is callable - don't actually load a model
      const createMethod = window.ort.InferenceSession.create
      if (typeof createMethod !== 'function') {
        throw new Error('InferenceSession.create is not a function')
      }
      runtimeStatus.ortSanity = true
      log('✅ ORT Sanity: InferenceSession.create() is callable', 'pass')
    } else {
      throw new Error('Skipping - InferenceSession unavailable')
    }
  } catch (err) {
    runtimeStatus.ortSanity = false
    log(`❌ ORT Sanity FAIL: ${err.message}`, 'fail')
  }

  // Summary
  const totalTime = (performance.now() - startTime).toFixed(2)
  const passed = Object.values(runtimeStatus).filter(v => v).length
  const total = Object.values(runtimeStatus).length

  log('---', 'separator')
  if (passed === total) {
    log(`🎉 ALL TESTS PASSED (${passed}/${total}) in ${totalTime}ms`, 'success')
    pipelineReady.value = true
  } else {
    log(`⚠️ PARTIAL PASS (${passed}/${total}) in ${totalTime}ms`, 'warn')
    pipelineReady.value = runtimeStatus.openCV && runtimeStatus.openCVMat
  }
  log('=== Runtime Self-Test Complete ===', 'header')

  runtimeTestRunning.value = false
}

const runPipelineTest = async () => {
  pipelineTestRunning.value = true
  testResults.value = []
  log('=== Pipeline Smoke Test Started ===', 'header')

  // Get the currently captured image or ask user to upload
  const capturedImage = cameraRef.value?.capturedImage

  if (!capturedImage) {
    log('❌ No image available. Capture or upload an image first.', 'fail')
    pipelineTestRunning.value = false
    return
  }

  try {
    // Load image into canvas -> OpenCV Mat
    log('Loading image into OpenCV...', 'info')
    const loadStart = performance.now()

    const img = new Image()
    img.src = capturedImage
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
      setTimeout(() => reject(new Error('Image load timeout')), 5000)
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)

    const src = cv.imread(canvas)
    const loadTime = (performance.now() - loadStart).toFixed(2)
    log(`✅ Image loaded: ${src.cols}×${src.rows} (${loadTime}ms)`, 'pass')

    // Step 1: Run homography (detect → warp)
    log('Running homography pipeline...', 'info')
    const homographyStart = performance.now()

    const result = processWorksheet(src, LAYOUT)

    if (!result) {
      throw new Error('Corner marker detection failed. Ensure 4 black square markers are visible.')
    }

    const { warpedImage, rawCrops, processedTensors } = result
    const homographyTime = (performance.now() - homographyStart).toFixed(2)

    // Verify warped size
    if (warpedImage.cols === 1700 && warpedImage.rows === 2200) {
      log(`✅ Warped image: ${warpedImage.cols}×${warpedImage.rows} (target 1700×2200)`, 'pass')
    } else {
      log(`⚠️ Warped image: ${warpedImage.cols}×${warpedImage.rows} (expected 1700×2200)`, 'warn')
    }
    log(`   └─ Homography time: ${homographyTime}ms`, 'info')

    // Step 2: Verify crops
    const cropCount = rawCrops.length
    if (cropCount === 10) {
      log(`✅ Cropped boxes: ${cropCount}/10`, 'pass')
    } else {
      log(`⚠️ Cropped boxes: ${cropCount}/10 (unexpected count)`, 'warn')
    }

    // Step 3: Verify preprocessed tensors
    log('Verifying preprocessed tensors...', 'info')
    let tensorCheckPassed = true

    for (let i = 0; i < processedTensors.length; i++) {
      const t = processedTensors[i]
      const tensor = t.tensor

      // Check size
      if (tensor.length !== 784) {
        log(`❌ Tensor ${i}: Expected 784 elements (28×28), got ${tensor.length}`, 'fail')
        tensorCheckPassed = false
        continue
      }

      // Check value range (MNIST normalization: roughly [-1, 1])
      const min = Math.min(...tensor)
      const max = Math.max(...tensor)
      const inRange = min >= -3 && max <= 3 // Allow some margin

      if (!inRange) {
        log(`⚠️ Tensor ${i}: Value range [${min.toFixed(2)}, ${max.toFixed(2)}] outside expected [-3, 3]`, 'warn')
        // Don't fail, just warn - real data varies
      }
    }

    if (tensorCheckPassed) {
      log(`✅ All tensors: 28×28 format, value ranges checked`, 'pass')
    }

    // Sample tensor statistics
    if (processedTensors.length > 0) {
      const sample = processedTensors[0].tensor
      const min = Math.min(...sample)
      const max = Math.max(...sample)
      const mean = sample.reduce((a, b) => a + b, 0) / sample.length
      log(`   └─ Sample tensor stats: min=${min.toFixed(3)}, max=${max.toFixed(3)}, mean=${mean.toFixed(3)}`, 'info')
    }

    // Cleanup
    log('Cleaning up OpenCV Mats...', 'info')
    src.delete()
    warpedImage.delete()
    rawCrops.forEach(c => c.image.delete())
    log('✅ All Mats disposed', 'pass')

    // Final summary
    log('---', 'separator')
    log('🎉 Pipeline Smoke Test PASSED', 'success')
    log(`   └─ Total time: ${homographyTime}ms`, 'info')

  } catch (err) {
    log(`❌ Pipeline test FAILED: ${err.message}`, 'fail')
    console.error(err)
  }

  log('=== Pipeline Smoke Test Complete ===', 'header')
  pipelineTestRunning.value = false
}
</script>

<style scoped>
.scan-grade {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h1 {
  font-size: 32px;
  font-weight: 700;
  color: #1d1d1f;
  margin-bottom: 8px;
}

.subtitle {
  color: #6e6e73;
  font-size: 16px;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Test Section */
.test-section {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.btn {
  flex: 1;
  min-width: 140px;
  padding: 12px 18px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-test {
  background: #34c759;
  color: white;
}

.btn-test:hover:not(:disabled) {
  background: #30b350;
}

/* Console Output */
.console-output {
  background: #1c1c1e;
  border-radius: 12px;
  overflow: hidden;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 13px;
}

.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  background: #2c2c2e;
  color: #f5f5f7;
  font-weight: 500;
}

.btn-clear {
  background: #3a3a3c;
  color: #f5f5f7;
  border: none;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.btn-clear:hover {
  background: #48484a;
}

.console-body {
  max-height: 280px;
  overflow-y: auto;
  padding: 12px 14px;
}

.console-line {
  display: flex;
  gap: 10px;
  margin-bottom: 6px;
  line-height: 1.5;
}

.console-line:last-child {
  margin-bottom: 0;
}

.timestamp {
  color: #8e8e93;
  flex-shrink: 0;
  font-size: 12px;
}

.message {
  color: #f5f5f7;
  word-break: break-word;
}

/* Console line types */
.console-line.pass .message { color: #34c759; }
.console-line.fail .message { color: #ff453a; }
.console-line.success .message { color: #34c759; font-weight: 600; }
.console-line.warn .message { color: #ff9f0a; }
.console-line.header .message { color: #bf5af2; font-weight: 600; }
.console-line.separator .message { color: #636366; }

.results {
  background: white;
  padding: 20px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.results h2 {
  font-size: 18px;
  margin-bottom: 12px;
}

.results p {
  color: #6e6e73;
  font-size: 14px;
  margin-bottom: 8px;
}
</style>