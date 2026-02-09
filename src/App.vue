<template>
  <div class="scan-grade">
    <header class="header">
      <h1>🐯 ScanGrade</h1>
      <p class="subtitle">Point. Scan. Grade.</p>
    </header>
    
    <main class="main">
      <CameraCapture 
        @image-captured="handleImageCaptured"
        @ocr-complete="handleOCRComplete"
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
import { ref } from 'vue'
import CameraCapture from './components/CameraCapture.vue'

const ocrResult = ref(null)

const handleImageCaptured = (imageData) => {
  console.log('Image captured:', imageData)
}

const handleOCRComplete = (result) => {
  ocrResult.value = result
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