<template>
  <div class="camera-capture">
    <div class="preview-area">
      <video 
        v-if="streamActive" 
        ref="videoRef" 
        autoplay 
        playsinline 
        muted
        class="video-preview"
      ></video>
      
      <img 
        v-else-if="capturedImage" 
        :src="capturedImage" 
        class="captured-image"
        alt="Captured worksheet"
      >
      
      <div v-else class="placeholder">
        <p>Camera preview will appear here</p>
      </div>
    </div>
    
    <div class="controls">
      <button 
        v-if="!streamActive && !capturedImage" 
        @click="startCamera"
        class="btn btn-primary"
        :disabled="isLoading"
      >
        {{ isLoading ? 'Starting...' : '📷 Start Camera' }}
      </button>
      
      <button 
        v-if="streamActive" 
        @click="capturePhoto"
        class="btn btn-primary"
      >
        📸 Capture
      </button>
      
      <button 
        v-if="capturedImage" 
        @click="retake"
        class="btn btn-secondary"
      >
        ↺ Retake
      </button>
      
      <label class="btn btn-secondary file-btn">
        📁 Choose File
        <input 
          type="file" 
          accept="image/*" 
          @change="handleFileSelect"
          class="file-input"
        >
      </label>
    </div>
    
    <div v-if="error" class="error">
      {{ error }}
    </div>
    
    <div v-if="processing" class="processing">
      <div class="spinner"></div>
      <p>Processing with real OCR...</p>
    </div>
    
    <div v-if="ocrResult" class="ocr-result">
      <h3>🎯 Real OCR Result</h3>
      <div class="digits">
        <div 
          v-for="(digit, i) in ocrResult.digits" 
          :key="i"
          class="digit"
          :class="{ low: ocrResult.confidences[i] < 0.8 }"
        >
          <span class="num">{{ digit }}</span>
          <span class="conf">{{ (ocrResult.confidences[i] * 100).toFixed(0) }}%</span>
        </div>
      </div>
      <p class="flagged" v-if="hasLowConfidence">
        ⚠️ {{ lowCount }} digits flagged for review (confidence &lt; 80%)
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import { processWorksheet } from '../homography.js'
import { initDigitModel, recognizeDigits } from '../ocr-pipeline.js'

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
    {"id": 2, "question_num": 3,  "x": 109, "y": 71,  "cx": 120, "cy": 82,  "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 3, "question_num": 4,  "x": 147, "y": 71,  "cx": 158, "cy": 82,  "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 4, "question_num": 5,  "x": 185, "y": 71,  "cx": 196, "cy": 82,  "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 5, "question_num": 6,  "x": 33,  "y": 141, "cx": 44, "cy": 152,  "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 6, "question_num": 7,  "x": 71,  "y": 141, "cx": 82, "cy": 152,  "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 7, "question_num": 8,  "x": 109, "y": 141, "cx": 120, "cy": 152,  "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 8, "question_num": 9,  "x": 147, "y": 141, "cx": 158, "cy": 152,  "width": 22, "height": 22, "expected_type": "digit"},
    {"id": 9, "question_num": 10, "x": 185, "y": 141, "cx": 196, "cy": 152,  "width": 22, "height": 22, "expected_type": "digit"}
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

const emit = defineEmits(['image-captured', 'ocr-complete'])

const videoRef = ref(null)
const stream = ref(null)
const streamActive = ref(false)
const capturedImage = ref(null)
const isLoading = ref(false)
const error = ref(null)
const processing = ref(false)
const ocrResult = ref(null)

defineExpose({
  capturedImage
})

const hasLowConfidence = computed(() => 
  ocrResult.value?.confidences.some(c => c < 0.8)
)

const lowCount = computed(() => 
  ocrResult.value?.confidences.filter(c => c < 0.8).length || 0
)

const startCamera = async () => {
  isLoading.value = true
  error.value = null
  
  try {
    const constraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    }
    
    stream.value = await navigator.mediaDevices.getUserMedia(constraints)
    
    if (videoRef.value) {
      videoRef.value.srcObject = stream.value
      streamActive.value = true
    }
  } catch (err) {
    error.value = 'Camera access failed. Use file upload instead.'
    console.error('Camera error:', err)
  } finally {
    isLoading.value = false
  }
}

const capturePhoto = () => {
  if (!videoRef.value) return
  
  const video = videoRef.value
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0)
  
  capturedImage.value = canvas.toDataURL('image/jpeg', 0.9)
  streamActive.value = false
  stopStream()
  
  emit('image-captured', capturedImage.value)
  runRealOCR()
}

const handleFileSelect = (e) => {
  const file = e.target.files[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = (event) => {
    capturedImage.value = event.target.result
    stopStream()
    streamActive.value = false
    emit('image-captured', capturedImage.value)
    runRealOCR()
  }
  reader.readAsDataURL(file)
}

const runRealOCR = async () => {
  processing.value = true
  ocrResult.value = null
  
  try {
    // Load image
    const img = new Image()
    img.src = capturedImage.value
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
    
    // Initialize model
    await initDigitModel()
    
    // Run homography + crops
    const result = processWorksheet(src, LAYOUT)
    
    if (!result) {
      throw new Error('Corner marker detection failed. Ensure 4 black square markers are visible.')
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
    
    // Display results
    ocrResult.value = {
      digits: predictions.map(p => p.digit),
      confidences: predictions.map(p => p.confidence),
      predictions: predictions
    }
    
    // Cleanup
    src.delete()
    warpedImage.delete()
    
  } catch (err) {
    console.error('OCR Error:', err)
    ocrResult.value = {
      digits: [],
      confidences: [],
      error: err.message
    }
  } finally {
    processing.value = false
    emit('ocr-complete', ocrResult.value)
  }
}

const retake = () => {
  capturedImage.value = null
  ocrResult.value = null
  error.value = null
}

const stopStream = () => {
  if (stream.value) {
    stream.value.getTracks().forEach(track => track.stop())
    stream.value = null
  }
}

onUnmounted(stopStream)
</script>

<style scoped>
.camera-capture {
  background: white;
  border-radius: 16px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

.preview-area {
  aspect-ratio: 4/3;
  background: #f5f5f7;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-preview, .captured-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  color: #6e6e73;
  text-align: center;
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.btn {
  flex: 1;
  min-width: 120px;
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.btn:active {
  transform: scale(0.98);
}

.btn-primary {
  background: #007aff;
  color: white;
}

.btn-secondary {
  background: #e8e8ed;
  color: #1d1d1f;
}

.file-btn {
  position: relative;
  display: inline-block;
  text-align: center;
}

.file-input {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.error {
  margin-top: 12px;
  padding: 12px;
  background: #ffe5e5;
  color: #dc2626;
  border-radius: 8px;
  font-size: 14px;
}

.processing {
  margin-top: 20px;
  text-align: center;
  color: #6e6e73;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e8e8ed;
  border-top-color: #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 12px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.ocr-result {
  margin-top: 20px;
  padding: 16px;
  background: #f5f5f7;
  border-radius: 12px;
}

.ocr-result h3 {
  font-size: 16px;
  margin-bottom: 12px;
  color: #1d1d1f;
}

.digits {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.digit {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  min-width: 60px;
}

.digit.low {
  border: 2px solid #f59e0b;
  background: #fffbeb;
}

.num {
  font-size: 28px;
  font-weight: 600;
  color: #1d1d1f;
}

.conf {
  font-size: 12px;
  color: #6e6e73;
  margin-top: 4px;
}

.flagged {
  color: #f59e0b;
  font-size: 14px;
  font-weight: 500;
}
</style>