<template>
  <div class="camera-capture" :class="[{ 'camera-capture--student': studentMode }, studentCaptureStateClass]">
    <p v-if="studentMode && !captureEnabled && captureBlockedReason" class="student-blocked">
      {{ captureBlockedReason }}
    </p>
    <div class="preview-area" :class="{ 'preview-area--portrait': studentMode }">
      <video
        v-if="streamActive"
        ref="videoRef"
        autoplay
        playsinline
        muted
        class="video-preview"
      ></video>
      <div v-if="streamActive" class="overlay-frame" :class="overlayFrameStateClass" aria-hidden="true">
        <div class="overlay-sheet" :class="{ 'overlay-sheet--full': studentMode }"></div>
        <p class="overlay-frame-text">{{ studentMode ? studentAutoStatus : 'Line up your sheet' }}</p>
      </div>

      <div v-else-if="displayedResultImage" ref="capturedImageWrapRef" class="captured-image-wrap">
        <img
          :src="displayedResultImage"
          class="captured-image"
          alt="Captured worksheet"
        >
        <button
          v-for="region in correctionRegions"
          :key="region.key"
          type="button"
          class="annotation-hotspot"
          :class="{ 'annotation-hotspot--active': activeCorrectionQuestion?.questionNum === region.questionNum }"
          :style="correctionHotspotStyle(region)"
          :aria-label="`Fix ${region.label} answer`"
          @click="openCorrection(region)"
        >
          <span>{{ region.label }}</span>
        </button>
        <div
          v-if="activeCorrectionQuestion"
          class="student-correction-panel student-correction-panel--image"
          :style="correctionPanelStyle"
          @click.stop
        >
          <div class="student-correction-title">
            <span class="student-correction-label" :aria-label="activeCorrectionQuestion.label">
              {{ scantronAnswerLabel(activeCorrectionQuestion.label) }}
            </span>
            <strong>Fix</strong>
            <span class="student-correction-current">{{ activeCorrectionCurrentText }}</span>
            <button
              type="button"
              class="student-correction-close"
              aria-label="Close"
              @click="cancelCorrection"
            >
              &times;
            </button>
          </div>
          <div class="student-correction-manual">
            <input
              v-model="manualCorrectionText"
              type="text"
              aria-label="Enter answer"
              autocomplete="off"
              autocorrect="off"
              autocapitalize="off"
              enterkeyhint="done"
              inputmode="numeric"
              pattern="[0-9]*"
              :maxlength="activeCorrectionMaxLength"
              :placeholder="activeCorrectionPlaceholder"
              @input="normalizeManualCorrectionInput"
              @keydown.enter.prevent="applyManualCorrectionText"
            >
            <button type="button" class="btn btn-primary student-correction-save" @click="applyManualCorrectionText">
              Save
            </button>
          </div>
          <div v-if="activeCorrectionChoices.length" class="student-correction-choices">
            <button
              v-for="choice in activeCorrectionChoices"
              :key="choice.key"
              type="button"
              class="btn btn-secondary correction-choice-btn"
              @click="applyCorrectionChoice(choice)"
            >
              {{ choice.text }}
            </button>
          </div>
          <p v-if="correctionError" class="student-correction-error">{{ correctionError }}</p>
        </div>
      </div>

      <div v-else class="placeholder">
        <p>{{ studentMode ? 'Camera will open here' : 'Camera preview will appear here' }}</p>
      </div>
    </div>

    <div v-if="!studentMode" class="ocr-debug-controls">
      <label class="ocr-debug-toggle">
        <input type="checkbox" v-model="ocrDebugEnabled" />
        OCR debug panel (warped sheet, crops, model input)
      </label>
    </div>

    <div class="controls" :class="{ 'controls--student': studentMode }">
      <button
        v-if="!streamActive && !capturedImage"
        @click="startCamera"
        class="btn btn-primary"
        :disabled="isLoading || !captureEnabled"
      >
        {{ studentMode ? (isLoading ? 'Opening camera...' : 'Open camera') : (isLoading ? 'Starting...' : 'Start Camera') }}
      </button>

      <button
        v-if="streamActive"
        @click="capturePhoto"
        class="btn btn-primary"
        :disabled="!captureEnabled || !cameraReady"
      >
        {{ studentMode ? (cameraReady ? 'Scan now' : 'Camera warming up...') : (cameraReady ? 'Capture' : 'Camera warming up...') }}
      </button>

      <button
        v-if="capturedImage && !(studentMode && ocrResult)"
        @click="retake"
        class="btn btn-secondary"
      >
        Retake
      </button>

      <label
        v-if="showFilePicker"
        class="btn btn-secondary file-btn"
        :class="{ 'file-btn--disabled': !captureEnabled, 'file-btn--student': studentMode }"
      >
        {{ studentMode ? 'Use photo instead' : 'Choose File' }}
        <input
          type="file"
          accept="image/*"
          @change="handleFileSelect"
          class="file-input"
          :disabled="!captureEnabled"
        >
      </label>
    </div>

    <div v-if="error" class="error">
      {{ studentMode ? studentFriendlyError : error }}
    </div>

    <section
      v-if="!studentMode && ocrDebugEnabled"
      class="ocr-debug-panel marker-debug-panel"
      aria-label="Model runtime debug"
    >
      <h3 class="ocr-debug-title">Model runtime</h3>
      <div v-if="modelInfoSnapshot" class="marker-debug-kv">
        <div><strong>Model path</strong>: {{ modelInfoSnapshot.modelPath }}</div>
        <div><strong>Requested URL</strong>: {{ modelInfoSnapshot.requestedUrl }}</div>
        <div><strong>Fetched URL</strong>: {{ modelInfoSnapshot.fetchedUrl }}</div>
        <div><strong>Loaded at</strong>: {{ modelInfoSnapshot.loadedAt }}</div>
        <div><strong>Input</strong>: {{ modelInfoSnapshot.inputNames.join(', ') }} {{ modelInfoSnapshot.inputShape }} ({{ modelInfoSnapshot.inputType }})</div>
        <div><strong>Output</strong>: {{ modelInfoSnapshot.outputNames.join(', ') }} {{ modelInfoSnapshot.outputShape }} ({{ modelInfoSnapshot.outputType }})</div>
        <div><strong>App feed</strong>: {{ modelInfoSnapshot.appFeed.order }} {{ modelInfoSnapshot.appFeed.shape }} {{ modelInfoSnapshot.appFeed.type }} range {{ modelInfoSnapshot.appFeed.range }}</div>
        <div><strong>Class mapping</strong>: {{ modelInfoSnapshot.classIndexOrder }}</div>
        <div><strong>Contract match</strong>: {{ modelInfoSnapshot.contractChecks.overall ? 'yes' : 'no' }}</div>
        <div><strong>Model bytes</strong>: {{ modelInfoSnapshot.byteLength }}</div>
        <div>
          <strong>Model SHA</strong>: {{ modelInfoSnapshot.sha256Short }}...
          (matches worksheet model: {{ modelInfoSnapshot.matchesKnownWorksheet ? 'yes' : 'no' }})
        </div>
      </div>
      <div v-else class="marker-debug-kv">
        <div>Model not loaded yet. Run OCR once or click sanity test.</div>
      </div>
      <div class="model-sanity-controls">
        <button type="button" class="btn btn-secondary" :disabled="modelSanityRunning" @click="runModelSanityTest">
          {{ modelSanityRunning ? 'Running sanity...' : 'Run model sanity digits (0,1,4,8)' }}
        </button>
      </div>
      <div v-if="modelSanityResults?.length" class="marker-debug-candidates">
        <p class="ocr-debug-label">Sanity digits through browser inference path</p>
        <div class="marker-debug-grid">
          <div v-for="item in modelSanityResults" :key="item.label" class="marker-debug-item">
            <div>expected={{ item.label }} predicted={{ item.predicted }} ({{ item.confidencePct }}%)</div>
            <div>top3={{ item.top3 }}</div>
            <img :src="item.previewUrl" alt="" class="ocr-debug-pre" />
          </div>
        </div>
      </div>
    </section>

    <section
      v-if="!studentMode && ocrDebugEnabled && markerDebugSnapshot"
      class="ocr-debug-panel marker-debug-panel"
      aria-label="Marker detection debug"
    >
      <h3 class="ocr-debug-title">Marker detection debug</h3>
      <p class="ocr-debug-summary">
        Failure reason: {{ markerDebugSnapshot.failureKind }}
      </p>
      <div v-if="markerDebugSnapshot.ignoreQrHomography" class="marker-debug-kv">
        <div><strong>ignoreQrHomography</strong>: active</div>
        <div><strong>marker_size (used)</strong>: {{ markerDebugSnapshot.activeMarkerSize ?? '—' }}</div>
        <div><strong>anchors (used)</strong>: {{ markerDebugSnapshot.activeAnchorsText }}</div>
      </div>
      <div class="marker-debug-kv">
        <div><strong>Total contours</strong>: {{ markerDebugSnapshot.totalContours }}</div>
        <div><strong>Marker candidates after filters</strong>: {{ markerDebugSnapshot.markerCandidates }}</div>
        <div>
          <strong>Area filter</strong>: min {{ markerDebugSnapshot.minArea }} / max {{ markerDebugSnapshot.maxArea }}
        </div>
      </div>
      <div class="ocr-debug-warped-wrap">
        <p class="ocr-debug-label">Binary image used for marker detection</p>
        <img
          v-if="markerDebugSnapshot.binaryImageUrl"
          :src="markerDebugSnapshot.binaryImageUrl"
          alt="Marker detection binary image"
          class="ocr-debug-warped"
        />
      </div>
      <div v-if="markerDebugSnapshot.candidates.length" class="marker-debug-candidates">
        <p class="ocr-debug-label">Candidate contours (top 12 by area)</p>
        <div class="marker-debug-grid">
          <div v-for="(c, i) in markerDebugSnapshot.candidates" :key="i" class="marker-debug-item">
            <div>#{{ i + 1 }} area={{ c.area }}</div>
            <div>bbox=({{ c.x }},{{ c.y }},{{ c.w }},{{ c.h }})</div>
            <div>center={{ c.centerText }}</div>
            <div>status={{ c.status }}</div>
          </div>
        </div>
      </div>
    </section>

    <div v-if="processing" class="processing">
      <div class="spinner"></div>
      <p>{{ studentMode ? 'Checking your scan...' : 'Processing with real OCR...' }}</p>
    </div>

    <!-- Student Mode: show grade outcome or teacher-review outcome, never a dead-end "all set" screen -->
    <div v-if="studentMode && ocrResult" class="student-result" :class="studentResultClass">
      <p v-if="ocrResult.error" class="student-result-message">Try again</p>
      <p
        v-if="ocrResult.error && liveOcrDebugExportEnabled"
        class="student-result-subtext student-result-debug-error"
      >
        Debug: {{ ocrResult.error }}
      </p>
      <template v-else>
        <p v-if="studentScoreText" class="student-result-message">{{ studentScoreText }}</p>
        <p v-else class="student-result-message">Scan saved for teacher review</p>
        <p v-if="studentResultSubtext" class="student-result-subtext">{{ studentResultSubtext }}</p>
        <div v-if="studentAnswerGroups.length" class="student-answer-grid">
          <div
            v-for="group in studentAnswerGroups"
            :key="group.key"
            class="student-answer-item"
            :class="[
              `student-answer-item--${group.status}`,
              { 'student-answer-item--clickable': isAnswerGroupEditable(group) }
            ]"
            :role="isAnswerGroupEditable(group) ? 'button' : undefined"
            :tabindex="isAnswerGroupEditable(group) ? 0 : undefined"
            @click="openCorrectionByGroup(group)"
            @keydown.enter.prevent="openCorrectionByGroup(group)"
            @keydown.space.prevent="openCorrectionByGroup(group)"
          >
            <span class="student-answer-label" :aria-label="group.label">{{ scantronAnswerLabel(group.label) }}</span>
            <span class="student-answer-pills" :class="{ 'student-answer-pills--double': group.displayDigits.length > 1 }">
              <span
                v-for="(digit, digitIndex) in group.displayDigits"
                :key="digitIndex"
                class="student-answer-pill"
                :class="{ 'student-answer-pill--blank': digit === null || digit === undefined || digit === '' }"
              >
                {{ digit === null || digit === undefined || digit === '' ? '' : digit }}
              </span>
            </span>
          </div>
        </div>
      </template>
      <div class="student-result-actions">
        <button
          v-if="liveOcrDebugExportEnabled && lastProcessedTensors?.length"
          type="button"
          class="btn btn-secondary"
          @click="exportCropPreview"
        >
          Download model-input preview
        </button>
        <button
          v-if="liveOcrDebugExportEnabled && lastLiveOcrDebug"
          type="button"
          class="btn btn-secondary"
          @click="exportLiveOcrDebugJson"
        >
          Download OCR debug JSON
        </button>
        <button
          v-if="!ocrResult.error"
          type="button"
          class="btn btn-secondary"
          @click="emit('student-done')"
        >
          Done
        </button>
      </div>
    </div>

    <!-- Teacher / Review Mode: full OCR result -->
    <div v-if="!studentMode && ocrResult" class="ocr-result">
      <h3>Real OCR Result</h3>
      <div class="digits">
        <div
          v-for="(digit, i) in ocrResult.digits"
          :key="i"
          class="digit"
          :class="{
            low: ocrResult.predictions?.[i]?.reviewNeeded || ocrResult.confidences[i] < LOW_CONFIDENCE_THRESHOLD,
            correct: ocrResult.correct && ocrResult.correct[i] === true,
            incorrect: ocrResult.correct && ocrResult.correct[i] === false
          }"
        >
          <span class="num">{{ digit }}</span>
          <span class="conf">{{ (ocrResult.confidences[i] * 100).toFixed(0) }}%</span>
        </div>
      </div>
      <p class="flagged" v-if="hasLowConfidence">
        {{ lowCount }} digits flagged for teacher review
      </p>
      <button v-if="lastProcessedTensors?.length" type="button" class="btn btn-secondary" @click="exportCropPreview">
        Export crop preview (what model sees)
      </button>
      <button v-if="lastProcessedTensors?.length" type="button" class="btn btn-secondary" @click="exportTensorsJson">
        Export tensors JSON (for Python verify)
      </button>
    </div>

    <section
      v-if="!studentMode && ocrDebugEnabled && ocrDebugSnapshot && !ocrResult?.error"
      class="ocr-debug-panel"
      aria-label="OCR debug"
    >
      <h3 class="ocr-debug-title">OCR debug</h3>
      <p class="ocr-debug-summary">
        Avg confidence {{ (ocrDebugSnapshot.avgConfidence * 100).toFixed(0) }}% ·
        vs test sheet expected {{ ocrDebugSnapshot.expectedCorrectCount }}/10
      </p>
      <div class="ocr-debug-warped-wrap">
        <p class="ocr-debug-label">
          Warped sheet with OCR crop rectangles (Q1–Q10), downscaled for display
        </p>
        <img
          v-if="ocrDebugSnapshot.warpedOverlayDataUrl || ocrDebugSnapshot.warpedDataUrl"
          :src="ocrDebugSnapshot.warpedOverlayDataUrl || ocrDebugSnapshot.warpedDataUrl"
          alt="Warped worksheet and OCR crop overlays"
          class="ocr-debug-warped"
        />
      </div>
      <div class="ocr-debug-grid">
        <div
          v-for="cell in ocrDebugSnapshot.cells"
          :key="cell.index"
          class="ocr-debug-cell"
          :class="{ 'ocr-debug-cell--bad': !cell.expectedMatch }"
        >
          <div class="ocr-debug-cell-head">Q{{ cell.questionNum }} ({{ cell.index }}/10)</div>
          <div class="ocr-debug-cell-images">
            <figure>
              <figcaption>Warped region</figcaption>
              <img v-if="cell.warpedRegionDataUrl" :src="cell.warpedRegionDataUrl" alt="" class="ocr-debug-raw" />
            </figure>
            <figure>
              <figcaption>Raw crop</figcaption>
              <img v-if="cell.rawDataUrl" :src="cell.rawDataUrl" alt="" class="ocr-debug-raw" />
            </figure>
            <figure>
              <figcaption>28×28 input</figcaption>
              <img
                v-if="cell.preprocessedDataUrl"
                :src="cell.preprocessedDataUrl"
                alt=""
                class="ocr-debug-pre"
              />
            </figure>
          </div>
          <div class="ocr-debug-cell-meta">
            <span>Detected: <strong>{{ cell.digit }}</strong> ({{ (cell.confidence * 100).toFixed(0) }}%)</span>
            <span>Expected: <strong>{{ cell.expected }}</strong></span>
            <span v-if="cell.top3Text">Top-3: {{ cell.top3Text }}</span>
            <span v-if="cell.entropyText">Uniformity: {{ cell.entropyText }}</span>
            <span v-if="cell.probsText">P(0-9): {{ cell.probsText }}</span>
            <span v-if="cell.inkFitText">Fit: {{ cell.inkFitText }}</span>
            <span class="ocr-debug-match" :class="cell.expectedMatch ? 'ok' : 'no'">
              {{ cell.expectedMatch ? 'Match' : 'Mismatch' }}
            </span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted, nextTick, watch } from 'vue'
import { processWorksheet, detectCornerMarkers } from '../homography.js'
import { initDigitModel, recognizeDigits, recognizeDigitsRobust, getDigitModelInfo } from '../ocr-pipeline.js'
import { decodeQrFromCanvas } from '../qr-decode.js'
import { publicUrl } from '../public-paths.js'

const props = defineProps({
  studentMode: { type: Boolean, default: false },
  captureEnabled: { type: Boolean, default: true },
  captureBlockedReason: { type: String, default: '' },
  autoStart: { type: Boolean, default: false }
})
const DEFAULT_LAYOUT_URL = publicUrl('layouts/sg-10-box-v1.json')
const ROBUST_RETRY_CONFIDENCE_THRESHOLD = 0.86
const ROBUST_RETRY_MARGIN_THRESHOLD = 0.18
const LOW_CONFIDENCE_THRESHOLD = 0.78
const LOW_MARGIN_THRESHOLD = 0.08
const AUTO_CHECK_CONFIDENCE_THRESHOLD = 0.45
const AUTO_CHECK_MARGIN_THRESHOLD = 0.06
const AUTO_X_CONFIDENCE_THRESHOLD = 0.995
const AUTO_X_MARGIN_THRESHOLD = 0.75

/** Golden digits for the primary printed test worksheet (index = box id 0–9 = questions 1–10). */
const DEBUG_REAL_WORKSHEET_EXPECTED = Object.freeze([8, 4, 1, 9, 2, 7, 0, 5, 3, 6])

// Auto-capture: layered page-present gate (variance pre-filter + contour) + stability hold
const STABILITY_HOLD_MS = 1500
const STABILITY_HOLD_MS_PORTRAIT = 450
const CHECK_INTERVAL_MS = 300
const SAMPLE_W = 48
const SAMPLE_H = 36
const SAD_THRESHOLD = 48 * 36 * 20
// Pre-filter: reject obviously blank (variance alone not sufficient for page)
const VARIANCE_PREFILTER_MIN = 50
const VARIANCE_PREFILTER_MIN_PORTRAIT = 8
// Contour gate: full-frame so sheet can be anywhere in viewfinder
const CONTOUR_W = 160
const CONTOUR_H = 120
// Portrait crop (8.5:11) for Student Mode viewfinder and gate
const PORTRAIT_ASPECT = 8.5 / 11
const CONTOUR_P_W = 216
const CONTOUR_P_H = 280
// Minimal layouts for Student Mode sheet confirmation (4 black corner markers).
// The original prototype sheet used larger markers; the Grade 2 QR worksheets use
// smaller markers to reclaim page space, so the camera gate tries both sizes.
const STUDENT_MARKER_LAYOUTS = Object.freeze([
  { homography: { marker_size: 0.0528 } },
  { homography: { marker_size: 0.08 } }
])
const SAD_THRESHOLD_PORTRAIT = CONTOUR_P_W * CONTOUR_P_H * 40
const PAGE_ASPECT_MIN = 1.0
const PAGE_ASPECT_MAX = 2.6
const PAGE_MIN_AREA_FRAC = 0.1
const PAGE_CENTER_MARGIN = 0.15

const emit = defineEmits(['image-captured', 'ocr-complete', 'student-done'])

const videoRef = ref(null)
const stream = ref(null)
const streamActive = ref(false)
const capturedImage = ref(null)
const isLoading = ref(false)
const cameraReady = ref(false)
const error = ref(null)
const processing = ref(false)
const ocrResult = ref(null)
const lastProcessedTensors = ref(null)
const lastLiveOcrDebug = ref(null)
const autoStartCameraBlocked = ref(false)
const ocrDebugEnabled = ref(
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('ocrdebug') === '1'
)
const liveOcrDebugExportEnabled = computed(() => {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('ocrdebug') === '1' || params.get('liveOcrDebug') === '1'
})
const ocrDebugSnapshot = ref(null)
const markerDebugSnapshot = ref(null)
const modelInfoSnapshot = ref(null)
const modelSanityRunning = ref(false)
const modelSanityResults = ref(null)
const capturedImageWrapRef = ref(null)
const activeCorrectionQuestion = ref(null)
const manualCorrectionText = ref('')
const correctionError = ref('')
let autoCaptureIntervalId = null
let stableSince = null
let previousFrameGray = null
let consecutiveFailures = 0
const studentAutoStatus = ref('Put worksheet in frame')

defineExpose({
  capturedImage
})

const hasLowConfidence = computed(() =>
  ocrResult.value?.predictions?.some((p) => p.reviewNeeded) ||
  ocrResult.value?.confidences.some(c => c < LOW_CONFIDENCE_THRESHOLD)
)

const lowCount = computed(() =>
  ocrResult.value?.predictions?.filter((p) => p.reviewNeeded).length || 0
)

const displayedResultImage = computed(() =>
  ocrResult.value?.annotatedImageUrl || capturedImage.value
)

const studentAnswerGroups = computed(() => {
  const groups = ocrResult.value?.answerGroups
  if (Array.isArray(groups) && groups.length > 0) return groups
  const digits = Array.isArray(ocrResult.value?.digits) ? ocrResult.value.digits : []
  const predictions = Array.isArray(ocrResult.value?.predictions) ? ocrResult.value.predictions : []
  return digits.map((digit, index) => {
    const prediction = predictions[index]
    const correct = prediction?.correct
    const status =
      prediction?.reviewNeeded ? 'review' :
      correct === true ? 'correct' :
      correct === false ? 'incorrect' :
      'review'
    return {
      key: `digit-${index}`,
      label: `${questionLetter(index)})`,
      displayDigits: [digit],
      status
    }
  })
})

const allAnnotationRegions = computed(() => (
  Array.isArray(ocrResult.value?.annotationRegions)
    ? ocrResult.value.annotationRegions
    : []
))

const correctionRegions = computed(() => {
  const regions = Array.isArray(ocrResult.value?.annotationRegions)
    ? ocrResult.value.annotationRegions
    : []
  const seenQuestions = new Set()
  return regions.filter((region) => {
    if (!isCorrectionRegionEditable(region)) return false
    const key = region.questionNum ?? region.key
    if (seenQuestions.has(key)) return false
    seenQuestions.add(key)
    return true
  })
})

const activeCorrectionRegion = computed(() => {
  const question = activeCorrectionQuestion.value
  if (!question) return null
  return allAnnotationRegions.value.find((region) => region.questionNum === question.questionNum) || question
})

const correctionPanelStyle = computed(() => {
  const region = activeCorrectionRegion.value
  if (!region) return {}
  const panelWidthPct = 48
  const centerY = region.topPct + region.heightPct / 2
  const spaceRight = 100 - (region.leftPct + region.widthPct)
  const placeRight = spaceRight >= panelWidthPct + 4 || region.leftPct < 48
  const left = placeRight
    ? Math.min(100 - panelWidthPct - 2, region.leftPct + region.widthPct + 2.5)
    : Math.max(2, region.leftPct - panelWidthPct - 2.5)

  return {
    left: `${left}%`,
    top: `${Math.min(88, Math.max(12, centerY))}%`
  }
})

const activeCorrectionGroup = computed(() => {
  const question = activeCorrectionQuestion.value
  if (!question) return null
  const groups = Array.isArray(ocrResult.value?.layoutSnapshot?.question_groups)
    ? ocrResult.value.layoutSnapshot.question_groups
    : []
  return groups.find((group, index) =>
    (group?.question_num ?? index + 1) === question.questionNum
  ) || null
})

const activeCorrectionPredictions = computed(() => {
  const group = activeCorrectionGroup.value
  if (!group) return []
  const byId = new Map((ocrResult.value?.predictions || []).map((prediction) => [prediction.id, prediction]))
  return (group.digit_box_ids || []).map((id) => byId.get(id)).filter(Boolean)
})

const activeCorrectionCurrentText = computed(() => {
  const predictions = activeCorrectionPredictions.value
  if (!predictions.length) return 'not sure'
  const text = predictions
    .map((prediction) => {
      if (prediction?.blank === true || prediction?.empty === true) return ''
      return prediction?.digit == null ? '' : String(prediction.digit)
    })
    .join('')
  return text || 'blank'
})

const activeCorrectionChoices = computed(() => {
  const group = activeCorrectionGroup.value
  if (!group) return []
  return topAnswerChoicesForGroup(group, ocrResult.value?.predictions || [], 2)
})

const activeCorrectionMaxLength = computed(() => {
  const group = activeCorrectionGroup.value
  const count = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids.length : 1
  return Math.max(1, count)
})

const activeCorrectionPlaceholder = computed(() =>
  activeCorrectionMaxLength.value > 1 ? '37' : '8'
)

const studentScoreText = computed(() => {
  if (ocrResult.value?.predictions?.some((p) => p.reviewNeeded)) return ''
  const questionCorrect = ocrResult.value?.questionCorrect
  if (Array.isArray(questionCorrect) && questionCorrect.length > 0) {
    const score = questionCorrect.filter(Boolean).length
    return `Score: ${score}/${questionCorrect.length}`
  }
  const correct = ocrResult.value?.correct
  if (!Array.isArray(correct) || correct.length === 0) return ''
  const score = correct.filter(Boolean).length
  return `Score: ${score}/${correct.length}`
})

const studentResultSubtext = computed(() => {
  if (ocrResult.value?.error) return ''
  if (studentScoreText.value) {
    return ocrResult.value?.needsReview
      ? 'Please ask your teacher to check this scan.'
      : 'Your work has been graded and saved.'
  }
  return 'Your work has been saved for teacher review.'
})

const studentCaptureStateClass = computed(() => {
  if (!props.studentMode) return ''
  if (processing.value) return 'capture-state-processing'
  if (ocrResult.value) return 'capture-state-result'
  if (!streamActive.value || !cameraReady.value) return 'capture-state-warming'
  const status = studentAutoStatus.value.toLowerCase()
  if (status.includes('hold')) return 'capture-state-ready'
  if (status.includes('center') || status.includes('closer') || status.includes('inside')) return 'capture-state-adjust'
  return 'capture-state-looking'
})

const overlayFrameStateClass = computed(() => {
  if (!props.studentMode) return ''
  return `overlay-frame--${studentCaptureStateClass.value.replace('capture-state-', '')}`
})

const showFilePicker = computed(() => {
  if (props.studentMode && ocrResult.value) return false
  if (!props.studentMode) return true
  return !streamActive.value || !!error.value || autoStartCameraBlocked.value
})

const studentFriendlyError = computed(() => {
  if (!error.value) return ''
  const message = String(error.value)
  if (message.includes('Camera access failed')) return 'Camera could not open. Use a photo instead.'
  if (message.includes('Camera captured a blank frame')) return 'The camera caught a blank picture. Try again.'
  if (message.includes('warming up') || message.includes('not ready')) return 'The camera is still getting ready. Try again.'
  if (message.includes('corner') || message.includes('sheet') || message.includes('worksheet')) {
    return 'Put the whole worksheet inside the frame and try again.'
  }
  return 'Try again.'
})

const studentResultClass = computed(() => {
  if (ocrResult.value?.error) return 'student-result--error'
  if (ocrResult.value?.needsReview || !studentScoreText.value) return 'student-result--review'
  return 'student-result--success'
})

function correctionHotspotStyle(region) {
  return {
    left: `${region.leftPct}%`,
    top: `${region.topPct}%`,
    width: `${region.widthPct}%`,
    height: `${region.heightPct}%`
  }
}

function isCorrectionRegionEditable(region) {
  return !!(region?.reviewNeeded || region?.manualCorrected)
}

function isAnswerGroupEditable(group) {
  return !!(group && !ocrResult.value?.error && Array.isArray(group.digitBoxIds) && group.digitBoxIds.length)
}

function openCorrection(region) {
  if (!isCorrectionRegionEditable(region)) return
  activeCorrectionQuestion.value = region
  const currentText = activeCorrectionCurrentText.value
  manualCorrectionText.value = currentText === 'blank' || currentText === 'not sure' ? '' : currentText
  normalizeManualCorrectionInput()
  correctionError.value = ''
}

function openCorrectionByGroup(group) {
  if (!isAnswerGroupEditable(group)) return
  const region = allAnnotationRegions.value.find((item) => item.questionNum === group.questionNum) || {
    key: `question-region-${group.questionNum}`,
    label: group.label,
    questionNum: group.questionNum,
    reviewNeeded: group.reviewNeeded,
    manualCorrected: group.manualCorrected,
    correct: group.correct
  }
  activeCorrectionQuestion.value = region
  const currentText = activeCorrectionCurrentText.value
  manualCorrectionText.value = currentText === 'blank' || currentText === 'not sure' ? '' : currentText
  normalizeManualCorrectionInput()
  correctionError.value = ''
  nextTick(() => {
    capturedImageWrapRef.value?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  })
}

function cancelCorrection() {
  activeCorrectionQuestion.value = null
  manualCorrectionText.value = ''
  correctionError.value = ''
}

async function applyCorrectionChoice(choice) {
  await applyManualCorrectionCells(choice.cells)
}

async function applyManualCorrectionText() {
  normalizeManualCorrectionInput()
  const group = activeCorrectionGroup.value
  const slotCount = Math.max(1, Array.isArray(group?.digit_box_ids) ? group.digit_box_ids.length : 1)
  const cells = parseManualAnswerText(manualCorrectionText.value, slotCount)
  if (!cells) {
    correctionError.value = slotCount > 1
      ? 'Enter one or two digits.'
      : 'Enter one digit.'
    return
  }
  await applyManualCorrectionCells(cells)
}

function normalizeManualCorrectionInput(event) {
  const maxLength = activeCorrectionMaxLength.value
  const rawText = event?.target?.value ?? manualCorrectionText.value
  const normalized = String(rawText || '')
    .replace(/[^\d_]/g, '')
    .slice(0, maxLength)
  if (event?.target && event.target.value !== normalized) event.target.value = normalized
  manualCorrectionText.value = normalized
  if (correctionError.value) correctionError.value = ''
}

async function applyManualCorrectionCells(cells) {
  const result = ocrResult.value
  const group = activeCorrectionGroup.value
  const layoutSnapshot = result?.layoutSnapshot
  const questionGroups = Array.isArray(layoutSnapshot?.question_groups) ? layoutSnapshot.question_groups : []
  const annotationGeometry = result?.annotationGeometry
  if (!result || !group || !annotationGeometry || !Array.isArray(result.predictions)) return

  const ids = Array.isArray(group.digit_box_ids) ? group.digit_box_ids : []
  if (!ids.length) return
  const normalizedCells = cells.slice(0, ids.length)
  while (normalizedCells.length < ids.length) normalizedCells.unshift(null)
  const answerText = cellsToAnswerText(normalizedCells)
  const predictionIndexById = new Map(result.predictions.map((prediction, index) => [prediction.id, index]))
  const nextPredictions = result.predictions.map((prediction) => ({
    ...prediction,
    topK: clonePlain(prediction.topK || []),
    probs: clonePlain(prediction.probs || [])
  }))

  ids.forEach((id, slotIndex) => {
    const predictionIndex = predictionIndexById.get(id)
    if (predictionIndex == null) return
    const previous = nextPredictions[predictionIndex]
    const digit = normalizedCells[slotIndex]
    const previousTopK = Array.isArray(previous.topK) ? previous.topK : []
    nextPredictions[predictionIndex] = {
      ...previous,
      digit,
      blank: digit === null,
      empty: digit === null,
      confidence: 1,
      topGap: 1,
      reviewNeeded: false,
      manualCorrected: true,
      manualAnswerText: answerText,
      originalDigit: previous.originalDigit ?? previous.digit,
      originalConfidence: previous.originalConfidence ?? previous.confidence,
      topK: digit === null
        ? []
        : [
            { digit, confidence: 1 },
            ...previousTopK
              .filter((item) => normalizeGradingDigit(item.digit) !== digit)
              .slice(0, 2)
          ]
    }
  })

  const questionCorrect = buildQuestionCorrect(questionGroups, nextPredictions)
  const questionReview = buildQuestionReviewFlags(questionGroups, nextPredictions)
  const answerGroups = buildAnswerGroups(questionGroups, nextPredictions, questionCorrect)
  const correctionKey = String(group.question_num ?? activeCorrectionQuestion.value?.questionNum ?? 'question')
  const manualCorrections = {
    ...(result.manualCorrections || {}),
    [correctionKey]: {
      questionNum: group.question_num ?? activeCorrectionQuestion.value?.questionNum ?? null,
      label: activeCorrectionQuestion.value?.label || '',
      cells: normalizedCells,
      text: answerText
    }
  }

  let annotatedImageUrl = result.annotatedImageUrl
  try {
    annotatedImageUrl = await composeStudentAnnotatedImage(
      result.annotationBaseUrl || result.annotatedImageUrl || capturedImage.value,
      annotationGeometry.warpedW,
      annotationGeometry.warpedH,
      nextPredictions,
      annotationGeometry.crops,
      layoutSnapshot,
      questionCorrect,
      manualCorrections
    )
  } catch (e) {
    console.warn('[ScanGrade] correction annotation render failed:', e)
  }

  const annotationRegions = buildAnnotationRegions(
    questionGroups,
    annotationGeometry,
    nextPredictions,
    questionCorrect
  )
  const needsReview = !!result.baseNeedsReview || nextPredictions.some((prediction) => prediction.reviewNeeded)
  const nextResult = {
    ...result,
    predictions: nextPredictions,
    digits: nextPredictions.map((prediction) => prediction.digit),
    confidences: nextPredictions.map((prediction) => prediction.confidence ?? 0),
    needsReview,
    questionCorrect,
    questionReview,
    questionCount: Array.isArray(questionCorrect) ? questionCorrect.length : result.questionCount,
    questionScore: Array.isArray(questionCorrect) ? questionCorrect.filter(Boolean).length : result.questionScore,
    questionReviewCount: Array.isArray(questionReview) ? questionReview.filter(Boolean).length : result.questionReviewCount,
    answerGroups: answerGroups || result.answerGroups,
    annotatedImageUrl,
    annotationRegions,
    manualCorrections
  }
  if (Array.isArray(result.correct) && result.correct.length === nextPredictions.length) {
    nextResult.correct = nextPredictions.map((prediction) => prediction.correct)
  }
  ocrResult.value = nextResult
  if (lastLiveOcrDebug.value) {
    lastLiveOcrDebug.value = {
      ...lastLiveOcrDebug.value,
      predictions: nextPredictions,
      answerGroups: nextResult.answerGroups,
      questionCorrect,
      questionReview,
      annotationGeometry,
      annotationRegions,
      manualCorrections,
      correctedAt: new Date().toISOString()
    }
    if (typeof window !== 'undefined') {
      window.__SCANGRADE_LIVE_OCR_DEBUG = lastLiveOcrDebug.value
    }
  }
  cancelCorrection()
  emit('ocr-complete', nextResult)
}

function clearAutoCaptureInterval() {
  if (autoCaptureIntervalId != null) {
    clearInterval(autoCaptureIntervalId)
    autoCaptureIntervalId = null
  }
  stableSince = null
  previousFrameGray = null
  consecutiveFailures = 0
}

function getVariance(ctx, width, height) {
  const data = ctx.getImageData(0, 0, width, height).data
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i] + data[i + 1] + data[i + 2]) / 3
    sum += g
    sumSq += g * g
    n++
  }
  const mean = sum / n
  return sumSq / n - mean * mean
}

function getCanvasPixelReader(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = image.data
  const lumaAt = (x, y) => {
    const xx = Math.max(0, Math.min(canvas.width - 1, Math.round(x)))
    const yy = Math.max(0, Math.min(canvas.height - 1, Math.round(y)))
    const i = (yy * canvas.width + xx) * 4
    return (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114)
  }
  return { lumaAt, width: canvas.width, height: canvas.height }
}

function measureMarkerPatch(reader, marker, side) {
  const half = side / 2
  let n = 0
  let dark = 0
  let sum = 0
  const step = Math.max(1, Math.round(side / 8))
  for (let y = marker.y - half; y <= marker.y + half; y += step) {
    for (let x = marker.x - half; x <= marker.x + half; x += step) {
      const luma = reader.lumaAt(x, y)
      sum += luma
      if (luma < 105) dark++
      n++
    }
  }
  return {
    mean: n ? sum / n : 255,
    darkFraction: n ? dark / n : 0
  }
}

function measurePaperPatch(reader, markers) {
  const xs = markers.map((m) => m.x)
  const ys = markers.map((m) => m.y)
  const minX = Math.max(0, Math.min(...xs))
  const maxX = Math.min(reader.width - 1, Math.max(...xs))
  const minY = Math.max(0, Math.min(...ys))
  const maxY = Math.min(reader.height - 1, Math.max(...ys))
  const markerClearance = Math.max(8, Math.min(reader.width, reader.height) * 0.11)
  const stepX = Math.max(2, Math.round((maxX - minX) / 18))
  const stepY = Math.max(2, Math.round((maxY - minY) / 24))
  let n = 0
  let bright = 0
  let dark = 0
  let sum = 0
  for (let y = minY; y <= maxY; y += stepY) {
    for (let x = minX; x <= maxX; x += stepX) {
      const nearMarker = markers.some((marker) =>
        Math.abs(x - marker.x) <= markerClearance && Math.abs(y - marker.y) <= markerClearance
      )
      if (nearMarker) continue
      const luma = reader.lumaAt(x, y)
      sum += luma
      if (luma >= 128) bright++
      if (luma < 80) dark++
      n++
    }
  }
  return {
    mean: n ? sum / n : 0,
    brightFraction: n ? bright / n : 0,
    darkFraction: n ? dark / n : 1
  }
}

function validateStudentSheetAppearance(canvas, markers) {
  if (!Array.isArray(markers) || markers.length !== 4) {
    return { ok: false, status: 'Find all 4 corner squares' }
  }
  const reader = getCanvasPixelReader(canvas)
  const markerSide = Math.max(7, Math.min(reader.width, reader.height) * 0.075)
  const markerStats = markers.map((marker) => measureMarkerPatch(reader, marker, markerSide))
  const darkMarkerCount = markerStats.filter((stat) =>
    stat.darkFraction >= 0.12 && stat.mean <= 190
  ).length
  const paperStats = measurePaperPatch(reader, markers)
  const paperLooksBright =
    paperStats.mean >= 125 &&
    paperStats.brightFraction >= 0.52 &&
    paperStats.darkFraction <= 0.20
  if (darkMarkerCount < 4) {
    return { ok: false, status: 'Find all 4 black squares', markerStats, paperStats }
  }
  if (!paperLooksBright) {
    return { ok: false, status: 'Find the worksheet page', markerStats, paperStats }
  }
  return { ok: true, status: 'Hold steady', markerStats, paperStats }
}

/**
 * Student Mode sheet confirmation: the portrait crop must contain 4 black corner markers
 * (ScanGrade sheet). Uses same detection as full OCR so we do not auto-capture faces/blank scenes.
 */
function analyzeStudentSheetInPortraitCrop(canvas) {
  if (typeof window === 'undefined' || !window.cv || typeof window.cv.Mat === 'undefined') {
    return { ok: false, status: 'Camera warming up' }
  }
  let src = null
  try {
    src = window.cv.imread(canvas)
    if (!src || src.empty()) return { ok: false, status: 'Camera warming up' }
    let markers = null
    for (const markerLayout of STUDENT_MARKER_LAYOUTS) {
      markers = detectCornerMarkers(src, markerLayout)
      if (Array.isArray(markers) && markers.length === 4) break
    }
    if (markers == null || markers.length !== 4) {
      return { ok: false, status: 'Find all 4 corner squares' }
    }
    const byId = Object.fromEntries(markers.map((marker) => [marker.id, marker]))
    const ids = ['tl', 'tr', 'br', 'bl']
    if (!ids.every((id) => byId[id])) return { ok: false, status: 'Find all 4 corner squares' }
    const w = src.cols
    const h = src.rows
    const spanX = Math.max(...markers.map((m) => m.x)) - Math.min(...markers.map((m) => m.x))
    const spanY = Math.max(...markers.map((m) => m.y)) - Math.min(...markers.map((m) => m.y))
    const topWidth = Math.hypot(byId.tr.x - byId.tl.x, byId.tr.y - byId.tl.y)
    const bottomWidth = Math.hypot(byId.br.x - byId.bl.x, byId.br.y - byId.bl.y)
    const leftHeight = Math.hypot(byId.bl.x - byId.tl.x, byId.bl.y - byId.tl.y)
    const rightHeight = Math.hypot(byId.br.x - byId.tr.x, byId.br.y - byId.tr.y)
    const centerX = markers.reduce((sum, marker) => sum + marker.x, 0) / markers.length
    const centerY = markers.reduce((sum, marker) => sum + marker.y, 0) / markers.length
    const centered =
      Math.abs(centerX - w / 2) <= w * 0.28 &&
      Math.abs(centerY - h / 2) <= h * 0.28
    const spansEnough = spanX >= w * 0.34 && spanY >= h * 0.42
    const cornersLookPlaced =
      byId.tl.x < w * 0.43 && byId.tl.y < h * 0.35 &&
      byId.tr.x > w * 0.57 && byId.tr.y < h * 0.35 &&
      byId.bl.x < w * 0.43 && byId.bl.y > h * 0.62 &&
      byId.br.x > w * 0.57 && byId.br.y > h * 0.62
    const widthBalance = Math.min(topWidth, bottomWidth) / Math.max(topWidth, bottomWidth, 1)
    const heightBalance = Math.min(leftHeight, rightHeight) / Math.max(leftHeight, rightHeight, 1)
    const topTilt = Math.abs(byId.tr.y - byId.tl.y) / Math.max(1, topWidth)
    const bottomTilt = Math.abs(byId.br.y - byId.bl.y) / Math.max(1, bottomWidth)
    const leftLean = Math.abs(byId.bl.x - byId.tl.x) / Math.max(1, leftHeight)
    const rightLean = Math.abs(byId.br.x - byId.tr.x) / Math.max(1, rightHeight)
    const perspectiveOkay =
      widthBalance >= 0.72 &&
      heightBalance >= 0.74 &&
      topTilt <= 0.16 &&
      bottomTilt <= 0.16 &&
      leftLean <= 0.16 &&
      rightLean <= 0.16
    const softPerspectiveOkay =
      widthBalance >= 0.66 &&
      heightBalance >= 0.70 &&
      topTilt <= 0.195 &&
      bottomTilt <= 0.195 &&
      leftLean <= 0.195 &&
      rightLean <= 0.195
    const appearance = validateStudentSheetAppearance(canvas, markers)
    const ok = centered && spansEnough && cornersLookPlaced && (perspectiveOkay || softPerspectiveOkay) && appearance.ok
    let status = 'Hold steady'
    if (!spansEnough) status = 'Move sheet closer'
    else if (!centered) status = 'Center the sheet'
    else if (!cornersLookPlaced) status = 'Keep all corners inside'
    else if (!(perspectiveOkay || softPerspectiveOkay)) status = 'Flatten the sheet a bit'
    else if (!appearance.ok) status = appearance.status
    return { ok, status, markers, appearance }
  } finally {
    if (src) src.delete()
  }
}

/** Single source of truth for Student Mode: portrait (8.5:11) center crop of the video frame.
 *  This exact region is: (1) what the outline frames, (2) what auto-capture analyzes, (3) what manual Capture captures. */
function getPortraitCropRect(vw, vh) {
  if (!vw || !vh) {
    return { cropW: 0, cropH: 0, cropX: 0, cropY: 0 }
  }
  const videoAspect = vw / vh
  const cropW = Math.max(1, Math.min(vw, Math.round(
    videoAspect > PORTRAIT_ASPECT ? vh * PORTRAIT_ASPECT : vw
  )))
  const cropH = Math.max(1, Math.min(vh, Math.round(
    videoAspect > PORTRAIT_ASPECT ? vh : vw / PORTRAIT_ASPECT
  )))
  const cropX = Math.max(0, Math.min(vw - cropW, Math.round((vw - cropW) / 2)))
  const cropY = Math.max(0, Math.min(vh - cropH, Math.round((vh - cropH) / 2)))
  return { cropW, cropH, cropX, cropY }
}

function isPagePresentContour(video, portraitCanvas = null) {
  try {
  if (typeof window === 'undefined' || !window.cv || typeof window.cv.Mat === 'undefined') return false
  const cv = window.cv
  const c = portraitCanvas || document.createElement('canvas')
  if (!portraitCanvas) {
    c.width = CONTOUR_W
    c.height = CONTOUR_H
    const ctx = c.getContext('2d')
    const vw = video.videoWidth
    const vh = video.videoHeight
    ctx.drawImage(video, 0, 0, vw, vh, 0, 0, CONTOUR_W, CONTOUR_H)
  }
  const cw = c.width
  const ch = c.height
  let src, gray, blur, edges, contours, hierarchy
  try {
    src = cv.imread(c)
    gray = new cv.Mat()
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
    blur = new cv.Mat()
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)
    edges = new cv.Mat()
    cv.Canny(blur, edges, 40, 120)
    contours = new cv.MatVector()
    hierarchy = new cv.Mat()
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    const totalPixels = cw * ch
    const minArea = totalPixels * PAGE_MIN_AREA_FRAC
    const cxLo = cw * PAGE_CENTER_MARGIN
    const cxHi = cw * (1 - PAGE_CENTER_MARGIN)
    const cyLo = ch * PAGE_CENTER_MARGIN
    const cyHi = ch * (1 - PAGE_CENTER_MARGIN)
    let found = false
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i)
      const area = cv.contourArea(cnt)
      if (area < minArea) {
        cnt.delete()
        continue
      }
      const rect = cv.boundingRect(cnt)
      const rw = rect.width
      const rh = rect.height
      if (rw < 10 || rh < 10) {
        cnt.delete()
        continue
      }
      const aspect = rh / rw
      if (aspect < PAGE_ASPECT_MIN || aspect > PAGE_ASPECT_MAX) {
        cnt.delete()
        continue
      }
      const centerX = rect.x + rw / 2
      const centerY = rect.y + rh / 2
      if (centerX >= cxLo && centerX <= cxHi && centerY >= cyLo && centerY <= cyHi) {
        found = true
        cnt.delete()
        for (let j = i + 1; j < contours.size(); j++) contours.get(j).delete()
        break
      }
      cnt.delete()
    }
    return found
  } finally {
    if (src) src.delete()
    if (gray) gray.delete()
    if (blur) blur.delete()
    if (edges) edges.delete()
    if (contours) contours.delete()
    if (hierarchy) hierarchy.delete()
  }
  } catch (_) {
    return false
  }
}

function getGrayAndSAD(ctx, width, height) {
  const data = ctx.getImageData(0, 0, width, height).data
  const gray = new Uint8Array(width * height)
  for (let i = 0; i < gray.length; i++) {
    gray[i] = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3
  }
  let sad = previousFrameGray ? 0 : Infinity
  if (previousFrameGray && previousFrameGray.length === gray.length) {
    for (let i = 0; i < gray.length; i++) sad += Math.abs(gray[i] - previousFrameGray[i])
  }
  return { gray, sad }
}

function nextDrawableFrame(video) {
  return new Promise((resolve) => {
    if (video && typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => resolve())
      return
    }
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

function getCanvasLumaStats(canvas) {
  const ctx = canvas.getContext('2d')
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  let sum = 0
  let sumSq = 0
  let n = 0
  for (let i = 0; i < data.length; i += 4) {
    const g = (data[i] + data[i + 1] + data[i + 2]) / 3
    sum += g
    sumSq += g * g
    n++
  }
  const mean = n ? sum / n : 0
  return { mean, variance: n ? (sumSq / n - mean * mean) : 0 }
}

function frameLooksDrawable(video) {
  if (!video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return false
  const sample = document.createElement('canvas')
  sample.width = 24
  sample.height = 24
  const ctx = sample.getContext('2d')
  try {
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, sample.width, sample.height)
    const stats = getCanvasLumaStats(sample)
    return stats.mean > 3 || stats.variance > 4
  } catch (_) {
    return false
  }
}

async function waitForDrawableVideoFrame(video, timeoutMs = 5000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (frameLooksDrawable(video)) return true
    await nextDrawableFrame(video)
  }
  return false
}

function runAutoCaptureCheck() {
  const video = videoRef.value
  if (!video || video.readyState < 2 || !streamActive.value) return
  if (!cameraReady.value) {
    cameraReady.value = frameLooksDrawable(video)
    if (!cameraReady.value) {
      if (props.studentMode) studentAutoStatus.value = 'Camera warming up'
      return
    }
  }
  const isPortrait = props.studentMode
  const vw = video.videoWidth
  const vh = video.videoHeight

  const c = document.createElement('canvas')
  let sampleW, sampleH
  if (isPortrait) {
    const { cropW, cropH, cropX, cropY } = getPortraitCropRect(vw, vh)
    c.width = CONTOUR_P_W
    c.height = CONTOUR_P_H
    sampleW = CONTOUR_P_W
    sampleH = CONTOUR_P_H
    const ctx = c.getContext('2d')
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, CONTOUR_P_W, CONTOUR_P_H)
  } else {
    c.width = SAMPLE_W
    c.height = SAMPLE_H
    sampleW = SAMPLE_W
    sampleH = SAMPLE_H
    const ctx = c.getContext('2d')
    ctx.drawImage(video, 0, 0, vw, vh, 0, 0, SAMPLE_W, SAMPLE_H)
  }
  const ctx = c.getContext('2d')
  const variance = getVariance(ctx, sampleW, sampleH)
  const varianceMin = isPortrait ? VARIANCE_PREFILTER_MIN_PORTRAIT : VARIANCE_PREFILTER_MIN
  const studentSheet = isPortrait ? analyzeStudentSheetInPortraitCrop(c) : null
  if (isPortrait) {
    studentAutoStatus.value = studentSheet?.status || 'Put worksheet in frame'
  }
  const pagePresent = isPortrait
    ? !!studentSheet?.ok
    : variance >= varianceMin && isPagePresentContour(video)
  const { gray, sad } = getGrayAndSAD(ctx, sampleW, sampleH)
  previousFrameGray = gray
  const sadThreshold = isPortrait ? SAD_THRESHOLD_PORTRAIT : SAD_THRESHOLD
  const stable = pagePresent && variance >= varianceMin && sad < sadThreshold
  const holdMs = isPortrait ? STABILITY_HOLD_MS_PORTRAIT : STABILITY_HOLD_MS
  if (isPortrait && typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_AUTO) {
    console.log('AutoCapture (portrait)', { sheetConfirmed: pagePresent, sad, sadThreshold, stable })
  }
  if (stable) {
    consecutiveFailures = 0
    const now = Date.now()
    if (stableSince == null) stableSince = now
    else if (now - stableSince >= holdMs) {
      clearAutoCaptureInterval()
      doCapture({ source: 'auto' })
    }
  } else {
    consecutiveFailures += 1
    if (consecutiveFailures >= 2) stableSince = null
  }
}

function startAutoCaptureLoop() {
  clearAutoCaptureInterval()
  autoCaptureIntervalId = setInterval(runAutoCaptureCheck, CHECK_INTERVAL_MS)
}

async function doCapture({ source = 'manual' } = {}) {
  clearAutoCaptureInterval()
  if (!videoRef.value) return
  const video = videoRef.value
  if (props.studentMode) {
    const drawable = await waitForDrawableVideoFrame(video, 4500)
    if (!drawable) {
      studentAutoStatus.value = 'Camera warming up'
      error.value = 'Camera is still warming up. Try again.'
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (vw === 0 || vh === 0) {
      error.value = 'Camera not ready. Try again.'
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    const { cropW, cropH, cropX, cropY } = getPortraitCropRect(vw, vh)
    if (cropW < 1 || cropH < 1) {
      error.value = 'Camera not ready. Try again.'
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = cropW
    canvas.height = cropH
    const ctx = canvas.getContext('2d')
    await nextDrawableFrame(video)
    ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
    const stats = getCanvasLumaStats(canvas)
    if (stats.mean < 4 && stats.variance < 6) {
      studentAutoStatus.value = 'Camera warming up'
      error.value = 'Camera captured a blank frame. Try again.'
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    const sheetCheck = analyzeStudentSheetInPortraitCrop(canvas)
    if (!sheetCheck.ok) {
      studentAutoStatus.value = sheetCheck.status || 'Put worksheet in frame'
      error.value = source === 'manual'
        ? `${studentAutoStatus.value}. Hold the worksheet inside the frame and try again.`
        : null
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    capturedImage.value = canvas.toDataURL('image/png')
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_CAPTURE) {
      window.__SCANGRADE_DEBUG_CAPTURE_URL = capturedImage.value
      window.__SCANGRADE_DEBUG_CAPTURE_DIMS = { cropW, cropH, cropX, cropY, vw, vh, lumaMean: stats.mean, lumaVariance: stats.variance }
      console.log('[ScanGrade] Student capture debug: dims', { cropW, cropH, cropX, cropY, vw, vh, stats }, '- view image: window.__SCANGRADE_DEBUG_CAPTURE_URL')
    }
    streamActive.value = false
    stopStream()
    emit('image-captured', capturedImage.value)
    runRealOCR()
    return
  }
  const drawable = await waitForDrawableVideoFrame(video, 4500)
  if (!drawable) {
    error.value = 'Camera is still warming up. Try again.'
    if (streamActive.value) startAutoCaptureLoop()
    return
  }
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, 0, 0)
  capturedImage.value = canvas.toDataURL('image/jpeg', 0.96)
  streamActive.value = false
  stopStream()
  emit('image-captured', capturedImage.value)
  runRealOCR()
}

function getCameraConstraints() {
  const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {}
  const video = {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1920 },
    height: { ideal: 1440 }
  }
  if (supported.aspectRatio) {
    video.aspectRatio = { ideal: 4 / 3 }
  }
  if (supported.resizeMode) {
    video.resizeMode = { ideal: 'none' }
  }
  return { video, audio: false }
}

const startCamera = async (options = {}) => {
  const fromAutoStart = options?.fromAutoStart === true
  if (!fromAutoStart) {
    autoStartCameraBlocked.value = false
  }
  if (!props.captureEnabled) {
    error.value = props.captureBlockedReason || 'Choose your name first.'
    return
  }
  isLoading.value = true
  cameraReady.value = false
  error.value = null
  stopStream()

  try {
    try {
      stream.value = await navigator.mediaDevices.getUserMedia(getCameraConstraints())
    } catch (primaryErr) {
      console.warn('[ScanGrade] preferred camera constraints failed, retrying default environment camera:', primaryErr)
      stream.value = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false
      })
    }
    streamActive.value = true
    await nextTick()
    if (videoRef.value) {
      const video = videoRef.value
      video.muted = true
      video.playsInline = true
      video.setAttribute('playsinline', '')
      video.setAttribute('webkit-playsinline', '')
      video.srcObject = stream.value
      await video.play().catch(() => {})
      const drawable = await waitForDrawableVideoFrame(video, 5000)
      cameraReady.value = drawable
      studentAutoStatus.value = drawable ? 'Put worksheet in frame' : 'Camera warming up'
      setTimeout(() => startAutoCaptureLoop(), drawable ? 250 : 900)
    }
  } catch (err) {
    error.value = 'Camera access failed. Use file upload instead.'
    if (fromAutoStart) {
      autoStartCameraBlocked.value = true
    }
    console.error('Camera error:', err)
  } finally {
    isLoading.value = false
  }
}

const capturePhoto = () => {
  if (!props.captureEnabled) return
  doCapture({ source: 'manual' })
}

watch(
  () => [props.autoStart, props.captureEnabled, streamActive.value, capturedImage.value, processing.value, ocrResult.value, isLoading.value, autoStartCameraBlocked.value],
  async ([autoStart, captureEnabled, isStreamActive, currentCapturedImage, isProcessing, currentOcrResult, loading, autoBlocked]) => {
    if (!autoStart || !captureEnabled) return
    if (autoBlocked) return
    if (isStreamActive || currentCapturedImage || isProcessing || currentOcrResult || loading) return
    await nextTick()
    if (!streamActive.value && !capturedImage.value && !processing.value && !ocrResult.value && !isLoading.value && !autoStartCameraBlocked.value) {
      startCamera({ fromAutoStart: true })
    }
  },
  { immediate: true }
)

const handleFileSelect = (e) => {
  if (!props.captureEnabled) {
    error.value = props.captureBlockedReason || 'Choose your name first.'
    return
  }
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

/** Convert cv.Mat (4-channel BGRA) to PNG data URL for debug export. */
function matToDataURL(mat, _label = '') {
  if (!mat || mat.rows === 0 || mat.cols === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = mat.cols
  canvas.height = mat.rows
  try {
    if (typeof cv !== 'undefined' && typeof cv.imshow === 'function') {
      cv.imshow(canvas, mat)
      return canvas.toDataURL('image/png')
    }
  } catch (_) {
    // Fallback below
  }
  const ctx = canvas.getContext('2d')
  const id = ctx.createImageData(mat.cols, mat.rows)
  const ch = mat.channels ? mat.channels() : 4
  for (let i = 0; i < mat.cols * mat.rows; i++) {
    const si = i * ch
    const di = i * 4
    if (ch === 4) {
      id.data[di] = mat.data[si]
      id.data[di + 1] = mat.data[si + 1]
      id.data[di + 2] = mat.data[si + 2]
      id.data[di + 3] = mat.data[si + 3]
    } else {
      id.data[di] = id.data[di + 1] = id.data[di + 2] = mat.data[si]
      id.data[di + 3] = 255
    }
  }
  ctx.putImageData(id, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Thumbnail of warped Mat for debug UI; returns pixel sizes so crop rects can be drawn to match.
 * @returns {{ url: string, thumbW: number, thumbH: number, warpedW: number, warpedH: number } | null}
 */
function matToThumbnailDataURL(mat, maxSide = 520) {
  if (!mat || mat.rows === 0 || mat.cols === 0) return null
  const warpedW = mat.cols
  const warpedH = mat.rows
  const pack = (url) =>
    url ? { url, thumbW: warpedW, thumbH: warpedH, warpedW, warpedH } : null
  if (typeof cv === 'undefined') return pack(matToDataURL(mat))
  const scale = Math.min(maxSide / mat.cols, maxSide / mat.rows, 1)
  if (scale >= 0.999) return pack(matToDataURL(mat))
  const tw = Math.max(1, Math.round(mat.cols * scale))
  const th = Math.max(1, Math.round(mat.rows * scale))
  const resized = new cv.Mat()
  try {
    cv.resize(mat, resized, new cv.Size(tw, th), 0, 0, cv.INTER_AREA)
    const url = matToDataURL(resized)
    return url ? { url, thumbW: tw, thumbH: th, warpedW, warpedH } : null
  } finally {
    resized.delete()
  }
}

/**
 * Draw labeled OCR crop ROIs on the warped thumbnail (same scale as matToThumbnailDataURL).
 */
function composeWarpedCropOverlay(thumbUrl, warpedW, warpedH, thumbW, thumbH, rects) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = thumbW
      canvas.height = thumbH
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const sx = thumbW / warpedW
      const sy = thumbH / warpedH
      const hues = [175, 200, 130, 45, 300, 340, 20, 260, 85, 310]
      rects.forEach((r, i) => {
        const x = r.x * sx
        const y = r.y * sy
        const w = r.w * sx
        const h = r.h * sy
        ctx.save()
        ctx.strokeStyle = '#0a0a0a'
        ctx.lineWidth = Math.max(4, 5 * ((sx + sy) / 2))
        ctx.strokeRect(x, y, w, h)
        const hue = hues[i % hues.length]
        ctx.strokeStyle = `hsl(${hue}, 100%, 52%)`
        ctx.lineWidth = Math.max(2, 3 * ((sx + sy) / 2))
        ctx.strokeRect(x, y, w, h)
        const label = `Q${r.questionNum}`
        ctx.font = 'bold 14px system-ui, -apple-system, sans-serif'
        ctx.textBaseline = 'top'
        const tx = x + 4
        const ty = y + 4
        ctx.lineJoin = 'round'
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 5
        ctx.strokeText(label, tx, ty)
        ctx.fillStyle = '#fff'
        ctx.fillText(label, tx, ty)
        ctx.restore()
      })
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('warped thumbnail load failed'))
    img.src = thumbUrl
  })
}

function composeStudentAnnotatedImage(
  baseUrl,
  warpedW,
  warpedH,
  predictions,
  rawCrops,
  layout = null,
  questionCorrect = null,
  manualCorrections = {}
) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = warpedW
      canvas.height = warpedH
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, warpedW, warpedH)

      const seededUnit = (seed) => {
        const x = Math.sin(seed * 12.9898) * 43758.5453
        return x - Math.floor(x)
      }

      const jitter = (seed, amount) => (seededUnit(seed) - 0.5) * 2 * amount

      const TEACHER_INK = {
        green: '#207a4d',
        red: '#b33d35',
        amber: '#c66f22',
        blue: '#245aa4'
      }

      const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
      const hexToRgb = (hex) => {
        const clean = String(hex).replace('#', '')
        const value = Number.parseInt(clean, 16)
        return {
          r: (value >> 16) & 255,
          g: (value >> 8) & 255,
          b: value & 255
        }
      }

      const varyInk = (hex, seed, amount = 14) => {
        const base = hexToRgb(hex)
        const warm = jitter(seed + 401, amount)
        const cool = jitter(seed + 409, amount * 0.7)
        return `rgb(${Math.round(clamp(base.r + warm, 0, 255))}, ${Math.round(clamp(base.g + jitter(seed + 407, amount * 0.75), 0, 255))}, ${Math.round(clamp(base.b + cool, 0, 255))})`
      }

      const transformLocalPoints = (cx, cy, size, points, angle, scaleX = 1, scaleY = 1) => {
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        return points.map(([px, py]) => {
          const sx = px * size * scaleX
          const sy = py * size * scaleY
          return [
            cx + sx * cos - sy * sin,
            cy + sx * sin + sy * cos
          ]
        })
      }

      const drawHandStroke = (segments, { color, width, seed = 1, passes = null }) => {
        const strokePasses = passes || [
          { alpha: 0.12, widthScale: 1.72, spread: 0.24 },
          { alpha: 0.7, widthScale: 1, spread: 0.11 },
          { alpha: 0.26, widthScale: 0.5, spread: 0.06 }
        ]
        ctx.save()
        ctx.strokeStyle = color
        ctx.globalCompositeOperation = 'multiply'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        strokePasses.forEach((passConfig, pass) => {
          ctx.globalAlpha = passConfig.alpha
          ctx.lineWidth = Math.max(1, width * passConfig.widthScale)
          segments.forEach((segment, segmentIndex) => {
            ctx.beginPath()
            const start = [
              segment[0][0] + jitter(seed + pass * 17 + segmentIndex * 5, width * passConfig.spread),
              segment[0][1] + jitter(seed + pass * 23 + segmentIndex * 7, width * passConfig.spread)
            ]
            ctx.moveTo(start[0], start[1])
            for (let i = 1; i < segment.length; i++) {
              const px = segment[i][0] + jitter(seed + pass * 29 + i * 11 + segmentIndex, width * passConfig.spread)
              const py = segment[i][1] + jitter(seed + pass * 31 + i * 13 + segmentIndex, width * passConfig.spread)
              ctx.lineTo(px, py)
            }
            ctx.stroke()
          })
        })
        ctx.restore()
      }

      const drawInkDot = (cx, cy, radius, color, seed) => {
        ctx.save()
        ctx.fillStyle = color
        ctx.globalCompositeOperation = 'multiply'
        for (let pass = 0; pass < 4; pass++) {
          ctx.globalAlpha = pass === 0 ? 0.34 : 0.16
          ctx.beginPath()
          ctx.ellipse(
            cx + jitter(seed + pass * 17, radius * 0.22),
            cy + jitter(seed + pass * 19, radius * 0.18),
            Math.max(1.5, radius * (1.08 + jitter(seed + pass * 23, 0.2))),
            Math.max(1.5, radius * (0.82 + jitter(seed + pass * 29, 0.18))),
            jitter(seed + pass * 31, 0.35),
            0,
            Math.PI * 2
          )
          ctx.fill()
        }
        ctx.restore()
      }

      const indicatorAnchor = (rect, seed) => {
        const size = Math.max(30, Math.min(rect.h * 1.02, warpedW * 0.058))
        let x = rect.x + rect.w + size * (0.48 + seededUnit(seed + 71) * 0.08) + jitter(seed + 79, size * 0.045)
        let y = rect.y + rect.h * (0.52 + jitter(seed + 73, 0.025)) + jitter(seed + 83, size * 0.025)
        const rightLimit = warpedW - size * 0.72
        if (x > rightLimit) {
          x = rightLimit + jitter(seed + 89, size * 0.025)
        }
        y = Math.max(size * 0.65, Math.min(warpedH - size * 0.65, y))
        return { x, y, size }
      }

      const drawReviewMark = (rect, seed) => {
        const reviewInk = '#d6a63a'
        const cx = rect.x + rect.w * (0.5 + jitter(seed + 205, 0.01))
        const cy = rect.y + rect.h * (0.5 + jitter(seed + 207, 0.014))
        const rx = Math.max(
          rect.h * 0.68,
          Math.min(rect.w * 0.62, rect.w * (0.5 + seededUnit(seed + 211) * 0.04) + rect.h * 0.16)
        )
        const ry = Math.max(
          rect.h * 0.42,
          Math.min(rect.h * 0.62, rect.h * (0.5 + seededUnit(seed + 213) * 0.06))
        )
        const angle = jitter(seed + 193, 0.055)
        const pointsPerLoop = 42

        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        for (let pass = 0; pass < 2; pass++) {
          const passSeed = seed + pass * 97
          const start = -Math.PI * 0.08 + jitter(passSeed + 1, 0.16)
          const end = Math.PI * 2 + start + jitter(passSeed + 3, 0.14)
          ctx.beginPath()
          for (let i = 0; i <= pointsPerLoop; i++) {
            const t = start + ((end - start) * i) / pointsPerLoop
            const wobbleX = 1 + jitter(passSeed + i * 7, 0.045)
            const wobbleY = 1 + jitter(passSeed + i * 11, 0.055)
            const localX = Math.cos(t) * rx * wobbleX
            const localY = Math.sin(t) * ry * wobbleY
            const x = cx + localX * Math.cos(angle) - localY * Math.sin(angle) + jitter(passSeed + i * 13, 0.75)
            const y = cy + localX * Math.sin(angle) + localY * Math.cos(angle) + jitter(passSeed + i * 17, 0.75)
            if (i === 0) ctx.moveTo(x, y)
            else ctx.lineTo(x, y)
          }
          ctx.strokeStyle = varyInk(reviewInk, passSeed + 23, 9)
          ctx.globalAlpha = pass === 0 ? 0.72 : 0.42
          ctx.lineWidth = Math.max(2.8, Math.min(5.4, rect.h * (0.058 + seededUnit(passSeed + 29) * 0.014)))
          ctx.stroke()
        }
        ctx.restore()
      }

      const drawCheck = (rect, seed) => {
        const { x, y, size } = indicatorAnchor(rect, seed)
        const color = varyInk(TEACHER_INK.green, seed + 17, 20)
        const angle = jitter(seed + 101, 0.22)
        const scaleX = 0.86 + seededUnit(seed + 103) * 0.32
        const scaleY = 0.84 + seededUnit(seed + 107) * 0.28
        const points = transformLocalPoints(
          x,
          y,
          size,
          [
            [-0.4 + jitter(seed + 1, 0.03), 0.06 + jitter(seed + 2, 0.06)],
            [-0.25 + jitter(seed + 3, 0.04), 0.18 + jitter(seed + 4, 0.045)],
            [-0.11 + jitter(seed + 5, 0.04), 0.32 + jitter(seed + 6, 0.055)],
            [0.12 + jitter(seed + 7, 0.05), -0.01 + jitter(seed + 8, 0.04)],
            [0.48 + jitter(seed + 9, 0.055), -0.41 + jitter(seed + 10, 0.055)]
          ],
          angle,
          scaleX,
          scaleY
        )
        drawHandStroke(
          [points],
          {
            color,
            width: Math.max(3.8, size * (0.092 + seededUnit(seed + 109) * 0.03)),
            seed,
            passes: [
              { alpha: 0.08, widthScale: 1.9, spread: 0.34 },
              { alpha: 0.17, widthScale: 1.34, spread: 0.22 },
              { alpha: 0.58, widthScale: 0.92, spread: 0.13 },
              { alpha: 0.2, widthScale: 0.42, spread: 0.06 }
            ]
          }
        )
      }

      const drawX = (rect, seed) => {
        const { x, y, size } = indicatorAnchor(rect, seed)
        const color = varyInk(TEACHER_INK.red, seed + 23, 14)
        const angle = jitter(seed + 131, 0.12)
        const first = transformLocalPoints(
          x,
          y,
          size,
          [
            [-0.35 + jitter(seed + 1, 0.035), -0.31 + jitter(seed + 2, 0.04)],
            [0.02 + jitter(seed + 3, 0.04), -0.01 + jitter(seed + 4, 0.03)],
            [0.29 + jitter(seed + 5, 0.04), 0.3 + jitter(seed + 6, 0.04)]
          ],
          angle
        )
        const second = transformLocalPoints(
          x,
          y,
          size,
          [
            [0.3 + jitter(seed + 7, 0.04), -0.34 + jitter(seed + 8, 0.04)],
            [-0.02 + jitter(seed + 9, 0.035), 0.01 + jitter(seed + 10, 0.035)],
            [-0.32 + jitter(seed + 11, 0.04), 0.31 + jitter(seed + 12, 0.04)]
          ],
          angle + jitter(seed + 133, 0.05)
        )
        drawHandStroke(
          [first, second],
          {
            color,
            width: Math.max(3.2, size * 0.075),
            seed,
            passes: [
              { alpha: 0.16, widthScale: 1.24, spread: 0.12 },
              { alpha: 0.7, widthScale: 1, spread: 0.06 },
              { alpha: 0.24, widthScale: 0.44, spread: 0.04 }
            ]
          }
        )
      }

      const drawStampedText = (text, startX, y, spacing, seed, fontSize, opacityScale = 1) => {
        let x = startX
        for (let i = 0; i < text.length; i++) {
          const ch = text[i]
          const width = ctx.measureText(ch).width
          if (ch !== ' ') {
            for (let pass = 0; pass < 3; pass++) {
              const charSeed = seed + i * 37 + pass * 11
              ctx.save()
              ctx.globalAlpha = Math.min(
                0.76,
                (pass === 0 ? 0.4 : 0.16) * (0.55 + seededUnit(charSeed + 5) * 0.62) * opacityScale
              )
              ctx.translate(
                x + jitter(charSeed + 1, fontSize * 0.04),
                y + jitter(charSeed + 3, fontSize * 0.04)
              )
              ctx.scale(0.76 + jitter(charSeed + 7, 0.035), 1.04 + jitter(charSeed + 9, 0.02))
              ctx.fillText(ch, 0, 0)
              ctx.restore()
            }
          }
          x += width * 0.82 + spacing + jitter(seed + i * 13, 0.32)
        }
      }

      const drawDateStamp = (questionRects) => {
        if (!Array.isArray(questionRects) || questionRects.length === 0) return
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
        const now = new Date()
        const text = `${String(now.getDate()).padStart(2, '0')} ${months[now.getMonth()]} ${now.getFullYear()}`
        const topQuestionY = Math.min(...questionRects.map((rect) => rect.y))
        const fontSize = Math.max(28, Math.min(42, warpedW * 0.021))
        const spacing = Math.max(2.2, fontSize * 0.18)
        const estimatedW = text.length * fontSize * 0.62 + (text.length - 1) * spacing
        const topRightAnchor = Array.isArray(layout?.homography?.anchors)
          ? layout.homography.anchors.find((anchor) => anchor?.id === 'tr')
          : null
        const markerSize = Number.isFinite(layout?.homography?.marker_size) ? layout.homography.marker_size : 0.08
        const markerCenterX = topRightAnchor ? topRightAnchor.x * warpedW : null
        const markerCenterY = topRightAnchor ? topRightAnchor.y * warpedH : null
        const markerBottom = topRightAnchor ? markerCenterY + markerSize * warpedH * 0.58 : null
        const x = topRightAnchor
          ? Math.max(warpedW * 0.54, Math.min(warpedW - estimatedW - warpedW * 0.05, markerCenterX - estimatedW * 0.9))
          : Math.min(warpedW * 0.84, warpedW - estimatedW - warpedW * 0.055)
        const minStampY = topRightAnchor ? markerBottom + fontSize * 2.55 : null
        const targetStampY = topRightAnchor ? markerBottom + fontSize * 3.05 : null
        const maxStampY = topRightAnchor ? Math.max(minStampY, topQuestionY - fontSize * 0.25) : null
        const y = topRightAnchor
          ? Math.min(maxStampY, Math.max(minStampY, targetStampY))
          : Math.max(warpedH * 0.068, Math.min(warpedH * 0.145, topQuestionY - warpedH * 0.09))
        ctx.save()
        ctx.translate(x + jitter(707, 2.5), y + jitter(709, 1.8))
        ctx.rotate(-0.048 + jitter(711, 0.02))
        ctx.font = `500 ${fontSize}px "Courier New", "Lucida Console", Menlo, Monaco, monospace`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = varyInk(TEACHER_INK.blue, 701, 10)
        ctx.globalCompositeOperation = 'multiply'
        drawStampedText(text, 0, 0, spacing, 719, fontSize, 1.28)
        ctx.restore()
      }

      const scoreGlyphs = {
        '0': [[[-0.06, -0.42], [-0.24, -0.31], [-0.31, -0.05], [-0.25, 0.24], [-0.05, 0.42], [0.17, 0.32], [0.27, 0.06], [0.19, -0.27], [-0.06, -0.42]]],
        '1': [[[-0.16, -0.22], [0.03, -0.39], [0.02, 0.39]], [[-0.12, 0.4], [0.18, 0.39]]],
        '2': [[[-0.23, -0.27], [-0.08, -0.42], [0.14, -0.4], [0.28, -0.24], [0.18, -0.04], [-0.12, 0.18], [-0.25, 0.39], [0.28, 0.38]]],
        '3': [[[-0.22, -0.32], [-0.03, -0.43], [0.2, -0.32], [0.1, -0.08], [-0.04, -0.01], [0.15, 0.04], [0.25, 0.25], [0.05, 0.42], [-0.22, 0.32]]],
        '4': [[[0.18, -0.42], [-0.23, 0.1], [0.25, 0.08]], [[0.16, -0.39], [0.13, 0.42]]],
        '5': [[[0.24, -0.39], [-0.17, -0.38], [-0.22, -0.05], [-0.04, -0.11], [0.19, -0.02], [0.26, 0.23], [0.07, 0.41], [-0.22, 0.33]]],
        '6': [[[0.18, -0.34], [-0.05, -0.39], [-0.25, -0.12], [-0.22, 0.21], [0, 0.43], [0.25, 0.27], [0.2, 0.04], [-0.03, -0.03], [-0.21, 0.12]]],
        '7': [[[-0.25, -0.36], [0.29, -0.37], [0.02, 0.05], [-0.13, 0.43]]],
        '8': [[[-0.02, -0.42], [-0.22, -0.31], [-0.19, -0.09], [0.03, -0.01], [0.23, -0.13], [0.19, -0.34], [-0.02, -0.42]], [[0.03, -0.01], [-0.22, 0.09], [-0.22, 0.31], [0.01, 0.43], [0.24, 0.31], [0.21, 0.09], [0.03, -0.01]]],
        '9': [[[0.19, 0.38], [0.12, 0.03], [0.24, -0.23], [0.04, -0.42], [-0.19, -0.34], [-0.24, -0.1], [-0.04, 0.05], [0.16, -0.02]]],
        '/': [[[0.2, -0.44], [-0.18, 0.46]]]
      }

      const drawScoreMark = (text, centerX, y, { color, fontSize, seed }) => {
        const chars = Array.from(text)
        const advances = chars.map((ch) => ch === '/' ? fontSize * 0.34 : fontSize * 0.48)
        const spacing = fontSize * 0.07
        const totalWidth = advances.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, chars.length - 1)
        let cursor = -totalWidth / 2
        const baseAngle = -0.11 + jitter(seed + 1, 0.045)
        ctx.save()
        ctx.translate(centerX + jitter(seed + 3, fontSize * 0.14), y + jitter(seed + 5, fontSize * 0.08))
        ctx.rotate(baseAngle)
        chars.forEach((ch, index) => {
          const glyph = scoreGlyphs[ch]
          const advance = advances[index]
          if (!glyph) {
            cursor += advance + spacing
            return
          }
          const charSeed = seed + index * 53
          const charCenterX = cursor + advance / 2 + jitter(charSeed + 7, fontSize * 0.045)
          const charCenterY = jitter(charSeed + 9, fontSize * 0.055)
          const charAngle = jitter(charSeed + 11, 0.08)
          const scaleX = ch === '/' ? 0.82 : 0.92 + seededUnit(charSeed + 13) * 0.18
          const scaleY = 0.9 + seededUnit(charSeed + 17) * 0.16
          const segments = glyph.map((segment, segmentIndex) => transformLocalPoints(
            charCenterX + jitter(charSeed + segmentIndex * 7, fontSize * 0.01),
            charCenterY + jitter(charSeed + segmentIndex * 11, fontSize * 0.012),
            fontSize,
            segment,
            charAngle,
            scaleX,
            scaleY
          ))
          drawHandStroke(segments, {
            color: varyInk(color, charSeed + 19, color === TEACHER_INK.green ? 18 : 12),
            width: Math.max(4, fontSize * (0.078 + seededUnit(charSeed + 23) * 0.018)),
            seed: charSeed,
            passes: [
              { alpha: 0.07, widthScale: 1.8, spread: 0.24 },
              { alpha: 0.2, widthScale: 1.22, spread: 0.15 },
              { alpha: 0.54, widthScale: 0.86, spread: 0.09 },
              { alpha: 0.18, widthScale: 0.42, spread: 0.04 }
            ]
          })
          cursor += advance + spacing
        })
        ctx.restore()
      }

      const drawManualAnswer = (rects, cells, seed) => {
        const validRects = rects.filter(Boolean)
        if (!validRects.length || !Array.isArray(cells)) return
        ctx.save()
        validRects.forEach((rect, index) => {
          const digit = cells[index]
          if (digit === null || digit === undefined || digit === '') return
          const insetX = rect.w * 0.08
          const insetY = rect.h * 0.08
          ctx.save()
          ctx.globalAlpha = 0.76
          ctx.fillStyle = '#f7f5ed'
          ctx.fillRect(rect.x + insetX, rect.y + insetY, rect.w - insetX * 2, rect.h - insetY * 2)
          ctx.restore()

          const fontSize = Math.max(38, Math.min(rect.h * 0.86, rect.w * 1.05))
          const x = rect.x + rect.w * 0.52 + jitter(seed + index * 17, rect.w * 0.035)
          const y = rect.y + rect.h * 0.58 + jitter(seed + index * 19, rect.h * 0.035)
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(jitter(seed + index * 23, 0.03))
          ctx.font = `800 ${fontSize}px "Marker Felt", "Comic Sans MS", "Chalkboard SE", system-ui, sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.lineJoin = 'round'
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
          ctx.lineWidth = Math.max(3, fontSize * 0.08)
          ctx.strokeText(String(digit), 0, 0)
          ctx.fillStyle = '#171717'
          ctx.globalAlpha = 0.96
          ctx.fillText(String(digit), 0, 0)
          ctx.globalAlpha = 0.28
          ctx.fillText(String(digit), jitter(seed + index * 29, 1.3), jitter(seed + index * 31, 1.1))
          ctx.restore()
        })
        ctx.restore()
      }

      const unionRects = (rects) => {
        const valid = rects.filter(Boolean)
        if (!valid.length) return null
        const x0 = Math.min(...valid.map((rect) => rect.x))
        const y0 = Math.min(...valid.map((rect) => rect.y))
        const x1 = Math.max(...valid.map((rect) => rect.x + rect.w))
        const y1 = Math.max(...valid.map((rect) => rect.y + rect.h))
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
      }

      const cropById = new Map(rawCrops.map((crop, index) => [crop.id ?? index, crop]))
      const predictionById = new Map(predictions.map((prediction, index) => [prediction.id ?? index, prediction]))
      const questionGroups = Array.isArray(layout?.question_groups) ? layout.question_groups : []
      const questionRectsByIndex = questionGroups.map((group) => {
        const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
        return unionRects(ids.map((id) => {
          const crop = cropById.get(id)
          return annotationRectForCrop(crop)
        }))
      })
      const questionRects = questionRectsByIndex.filter(Boolean)

      if (questionGroups.length > 0) {
        drawDateStamp(questionRects)
        questionGroups.forEach((group, index) => {
          const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
          const rect = questionRectsByIndex[index]
          if (!rect) return
          const groupPredictions = ids.map((id) => predictionById.get(id)).filter(Boolean)
          const correct = Array.isArray(questionCorrect) ? questionCorrect[index] : undefined
          const hasReview = groupPredictions.some((prediction) => prediction.reviewNeeded)
          const seed = (index + 1) * 131
          const correction = manualCorrections[String(group?.question_num ?? index + 1)]

          ctx.save()
          if (correction?.cells) {
            drawManualAnswer(
              ids.map((id) => {
                const crop = cropById.get(id)
                return annotationRectForCrop(crop)
              }),
              correction.cells,
              seed + 47
            )
          }
          if (hasReview) {
            drawReviewMark(rect, seed)
          } else if (correct === true) {
            drawCheck(rect, seed)
          } else if (correct === false) {
            drawX(rect, seed)
          }
          ctx.restore()
        })
      } else {
        const grouped = new Map()
        rawCrops.forEach((crop, index) => {
          const prediction = predictions[index]
          const questionNum = crop.questionNum ?? prediction?.questionNum ?? index + 1
          if (!grouped.has(questionNum)) grouped.set(questionNum, [])
          grouped.get(questionNum).push({ crop, prediction, index })
        })
        Array.from(grouped.entries()).forEach(([questionNum, items], groupIndex) => {
          const rect = unionRects(items.map(({ crop }) => annotationRectForCrop(crop)))
          const groupPredictions = items.map(({ prediction }) => prediction).filter(Boolean)
          if (!rect || !groupPredictions.length) return
          const numericQuestionNum = Number(questionNum)
          const seed = (groupIndex + 1) * 97 + (Number.isFinite(numericQuestionNum) ? numericQuestionNum : 0)
          const hasReview = groupPredictions.some((prediction) => prediction.reviewNeeded)
          const correctPredictions = groupPredictions.filter((prediction) => typeof prediction.correct === 'boolean')
          ctx.save()

          if (hasReview) {
            drawReviewMark(rect, seed)
          } else if (correctPredictions.length > 0) {
            if (correctPredictions.every((prediction) => prediction.correct === true)) drawCheck(rect, seed)
            else if (correctPredictions.some((prediction) => prediction.correct === false)) drawX(rect, seed)
          }
          ctx.restore()
        })
      }

      if (Array.isArray(questionCorrect) && questionCorrect.length > 0) {
        const score = questionCorrect.filter(Boolean).length
        const total = questionCorrect.length
        const reviewCount = questionGroups.length > 0
          ? questionGroups.filter((group) => {
              const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
              return ids.some((id) => predictionById.get(id)?.reviewNeeded)
            }).length
          : 0
        const tooUncertainForScore = reviewCount >= Math.ceil(total * 0.7) && score <= Math.floor(total * 0.3)
        if (tooUncertainForScore) {
          resolve(canvas.toDataURL('image/jpeg', 0.92))
          return
        }
        const ratio = score / total
        const scoreText = `${score}/${total}`
        const maxQuestionBottom = questionRects.length
          ? Math.max(...questionRects.map((rect) => rect.y + rect.h))
          : warpedH * 0.56
        const qr = layout?.metadata?.qr_position
        const hasQr = qr && Number.isFinite(qr.x) && Number.isFinite(qr.y)
        const qrTop = hasQr ? qr.y * warpedH : warpedH * 0.8
        const qrRight = hasQr && Number.isFinite(qr.width) ? (qr.x + qr.width) * warpedW : warpedW * 0.57
        const x = hasQr
          ? Math.min(warpedW * 0.735, Math.max(qrRight + warpedW * 0.075, warpedW * 0.675))
          : warpedW * 0.67
        const y = hasQr
          ? Math.min(qrTop - warpedH * 0.025, Math.max(maxQuestionBottom + warpedH * 0.09, qrTop - warpedH * 0.045))
          : Math.min(warpedH * 0.82, Math.max(maxQuestionBottom + warpedH * 0.08, warpedH * 0.59))
        const fontSize = Math.max(58, Math.min(96, warpedW * 0.052))
        drawScoreMark(scoreText, x, y, {
          color: ratio >= 0.7 ? TEACHER_INK.green : ratio >= 0.5 ? TEACHER_INK.amber : TEACHER_INK.red,
          fontSize,
          seed: 9001
        })
      }

      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = reject
    img.src = baseUrl
  })
}

function warpedRegionDataURL(warpedMat, rect, padFrac = 0.35) {
  if (!warpedMat || !rect) return null
  const px = Math.round(rect.w * padFrac)
  const py = Math.round(rect.h * padFrac)
  const x = Math.max(0, rect.x - px)
  const y = Math.max(0, rect.y - py)
  const x2 = Math.min(warpedMat.cols, rect.x + rect.w + px)
  const y2 = Math.min(warpedMat.rows, rect.y + rect.h + py)
  const w = Math.max(1, x2 - x)
  const h = Math.max(1, y2 - y)
  const roi = warpedMat.roi(new cv.Rect(x, y, w, h))
  const cloned = roi.clone()
  roi.delete()
  const out = matToDataURL(cloned)
  cloned.delete()
  return out
}

/** Convert 28×28 float tensor (0–1) to PNG data URL for debug (what the model sees). */
function tensorToDataURL(tensor, _label = '') {
  if (!tensor || tensor.length < 784) return null
  const scale = 8
  const cell = 28
  const canvas = document.createElement('canvas')
  canvas.width = cell * scale
  canvas.height = cell * scale
  const ctx = canvas.getContext('2d')
  const imgData = ctx.createImageData(cell * scale, cell * scale)
  for (let py = 0; py < cell * scale; py++) {
    for (let px = 0; px < cell * scale; px++) {
      const sy = Math.floor(py / scale)
      const sx = Math.floor(px / scale)
      const v = tensor[sy * 28 + sx] ?? 0
      const u = Math.max(0, Math.min(255, Math.round(v * 255)))
      const idx = (py * cell * scale + px) * 4
      imgData.data[idx] = imgData.data[idx + 1] = imgData.data[idx + 2] = u
      imgData.data[idx + 3] = 255
    }
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL('image/png')
}

function summarizeAnchors(anchors) {
  if (!Array.isArray(anchors) || !anchors.length) return '—'
  return anchors
    .map((a) => `${a.id}:${Number(a.x).toFixed(4)},${Number(a.y).toFixed(4)}`)
    .join(' | ')
}

function collectMarkerDebugSnapshot(activeHomography, ignoreQrHomography) {
  if (typeof window === 'undefined') return null
  const contours = Array.isArray(window.__SCANGRADE_DEBUG_CONTOURS) ? window.__SCANGRADE_DEBUG_CONTOURS : []
  const markerCandidates = Number(window.__SCANGRADE_DEBUG_MARKER_COUNT_AFTER_LOOP ?? 0)
  const minMax = window.__SCANGRADE_DEBUG_MIN_MAX_AREA || {}
  const position = window.__SCANGRADE_DEBUG_POSITION || null
  const areaRejected = contours.filter((c) => c.reject === 'area_too_small' || c.reject === 'area_too_large').length
  const approxRejected = contours.filter((c) => c.reject === 'approx_not_4_corners').length
  const passedApprox = contours.filter((c) => c.passedApprox).length
  let failureKind = 'too few candidates'
  if (position && position.allValid === false && markerCandidates >= 4) {
    failureKind = 'position validation failure'
  } else if (markerCandidates < 4 && areaRejected >= contours.length && contours.length > 0) {
    failureKind = 'size filter rejection'
  } else if (markerCandidates < 4 && approxRejected > 0 && passedApprox === 0) {
    failureKind = 'approx-not-4-corners'
  }
  const candidates = contours
    .slice()
    .sort((a, b) => (b.area || 0) - (a.area || 0))
    .slice(0, 12)
    .map((c) => ({
      area: Math.round(c.area ?? 0),
      x: c.x ?? 0,
      y: c.y ?? 0,
      w: c.w ?? 0,
      h: c.h ?? 0,
      centerText:
        typeof c.cx === 'number' && typeof c.cy === 'number'
          ? `${Math.round(c.cx)},${Math.round(c.cy)}`
          : '—',
      status: c.reject || (c.passedApprox ? 'candidate_4_corner' : 'candidate')
    }))
  return {
    failureKind,
    binaryImageUrl: window.__SCANGRADE_DEBUG_BINARY_URL || null,
    totalContours: contours.length,
    markerCandidates,
    usedPageRectEstimate: !!window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_USED,
    minArea: Math.round(minMax.minArea ?? 0),
    maxArea: Math.round(minMax.maxArea ?? 0),
    candidates,
    ignoreQrHomography,
    activeMarkerSize: activeHomography?.marker_size,
    activeAnchorsText: summarizeAnchors(activeHomography?.anchors)
  }
}

function getRuntimeDebugInfo() {
  if (typeof window === 'undefined') return {}
  const nav = window.navigator || {}
  const screen = window.screen || {}
  return {
    href: window.location?.href || '',
    userAgent: nav.userAgent || '',
    platform: nav.platform || '',
    vendor: nav.vendor || '',
    language: nav.language || '',
    viewport: {
      width: window.innerWidth || 0,
      height: window.innerHeight || 0,
      devicePixelRatio: window.devicePixelRatio || 1
    },
    screen: {
      width: screen.width || 0,
      height: screen.height || 0,
      availWidth: screen.availWidth || 0,
      availHeight: screen.availHeight || 0
    },
    cvReady: !!(window.cv && window.cv.Mat),
    ortReady: !!(window.ort && window.ort.InferenceSession)
  }
}

function normalizeGradingDigit(value) {
  if (value == null || value === '' || value === '_') return null
  const digit = Number(value)
  return Number.isInteger(digit) && digit >= 0 && digit <= 9 ? digit : undefined
}

function normalizeGradingCells(cells) {
  if (!Array.isArray(cells)) return null
  const out = []
  for (const cell of cells) {
    const normalized = normalizeGradingDigit(cell)
    if (normalized === undefined) return null
    out.push(normalized)
  }
  return out
}

function questionLetter(index) {
  if (!Number.isFinite(index) || index < 0) return '?'
  let n = Math.floor(index)
  let label = ''
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

function scantronAnswerLabel(label) {
  const text = String(label ?? '').trim()
  const match = text.match(/[A-Za-z]/)
  if (match) return match[0].toUpperCase()
  return text.replace(/[).:]/g, '').trim() || '?'
}

function acceptedResponsesFromAnswer(answer, slotCount) {
  if (answer == null) return []
  const text = String(answer).trim()
  if (!/^\d+$/.test(text)) return []
  const digits = text.split('').map((digit) => Number(digit))
  if (slotCount === 2 && digits.length === 1) {
    const digit = digits[0]
    return [
      [null, digit],
      [digit, null],
      [0, digit]
    ]
  }
  if (digits.length === slotCount) return [digits]
  if (digits.length < slotCount) {
    return [Array(slotCount - digits.length).fill(null).concat(digits)]
  }
  return []
}

function acceptedResponsesForGroup(group, slotCount) {
  const configured = Array.isArray(group?.accepted_digit_responses)
    ? group.accepted_digit_responses
      .map((response) => normalizeGradingCells(Array.isArray(response) ? response : response?.digits))
      .filter(Boolean)
    : []
  if (configured.length > 0) return configured
  return acceptedResponsesFromAnswer(group?.answer, slotCount)
}

function predictionCellsForIds(ids, byId) {
  const cells = []
  for (const id of ids) {
    const prediction = byId.get(id)
    if (!prediction) return null
    const normalized = normalizeGradingDigit(
      prediction.blank === true || prediction.empty === true ? null : prediction.digit
    )
    if (normalized === undefined) return null
    cells.push(normalized)
  }
  return cells
}

function gradingCellsMatch(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  return a.every((value, index) => value === b[index])
}

function buildQuestionCorrect(questionGroups, predictions) {
  if (!Array.isArray(questionGroups) || questionGroups.length === 0) return null
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  const out = []
  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    if (ids.length === 0) return null
    const predictionCells = predictionCellsForIds(ids, byId)
    if (!predictionCells) return null
    const acceptedResponses = acceptedResponsesForGroup(group, ids.length)
    if (acceptedResponses.length > 0) {
      out.push(acceptedResponses.some((response) => gradingCellsMatch(predictionCells, response)))
      continue
    }
    const groupPredictions = ids.map((id) => byId.get(id))
    if (groupPredictions.some((prediction) => prediction?.correct === undefined)) return null
    out.push(groupPredictions.every((prediction) => prediction.correct === true))
  }
  return out
}

function buildQuestionReviewFlags(questionGroups, predictions) {
  if (!Array.isArray(questionGroups) || questionGroups.length === 0) return null
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  return questionGroups.map((group) => {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    return ids.some((id) => byId.get(id)?.reviewNeeded)
  })
}

function buildAnswerGroups(questionGroups, predictions, questionCorrect = null) {
  if (!Array.isArray(questionGroups) || questionGroups.length === 0) return null
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  return questionGroups.map((group, index) => {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const groupPredictions = ids.map((id) => byId.get(id)).filter(Boolean)
    const predictionCells = ids.map((id) => {
      const prediction = byId.get(id)
      const normalized = normalizeGradingDigit(
        prediction?.blank === true || prediction?.empty === true ? null : prediction?.digit
      )
      return normalized === undefined ? '' : normalized
    })
    const answerText = group?.answer == null ? '' : String(group.answer).trim()
    const expectedDigitCount = /^\d+$/.test(answerText) ? answerText.length : predictionCells.length
    const correct = Array.isArray(questionCorrect) ? questionCorrect[index] : undefined
    const hasReview = groupPredictions.some((prediction) => prediction.reviewNeeded)
    const manualCorrected = groupPredictions.some((prediction) => prediction.manualCorrected)
    const status =
      hasReview ? 'review' :
      correct === true ? 'correct' :
      correct === false ? 'incorrect' :
      'review'
    const displayDigits =
      ids.length === 2 && expectedDigitCount === 1 && correct === true
        ? [Number(answerText)]
        : predictionCells
    const predictedAnswerText = cellsToAnswerText(predictionCells)

    return {
      key: `question-${group?.question_num ?? index + 1}`,
      label: `${questionLetter(index)})`,
      questionNum: group?.question_num ?? index + 1,
      problem: group?.problem || '',
      answer: group?.answer ?? null,
      digitBoxIds: ids,
      displayDigits,
      answerText: predictedAnswerText,
      correct,
      reviewNeeded: hasReview || correct !== true,
      manualCorrected,
      status
    }
  })
}

function clonePlain(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

function cloneRect(rect) {
  if (!rect) return null
  return {
    x: Number(rect.x) || 0,
    y: Number(rect.y) || 0,
    w: Number(rect.w) || 0,
    h: Number(rect.h) || 0
  }
}

function unionRects(rects) {
  const valid = (rects || []).filter(Boolean)
  if (!valid.length) return null
  const x0 = Math.min(...valid.map((rect) => rect.x))
  const y0 = Math.min(...valid.map((rect) => rect.y))
  const x1 = Math.max(...valid.map((rect) => rect.x + rect.w))
  const y1 = Math.max(...valid.map((rect) => rect.y + rect.h))
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function layoutBoxRect(box, warpedW, warpedH, layout) {
  if (!box || !Number.isFinite(warpedW) || !Number.isFinite(warpedH)) return null
  const normalized = layout?.page?.units === 'normalized'
  if (normalized) {
    const x = (Number(box.x) - Number(box.width)) * warpedW
    const y = (Number(box.y) - Number(box.height)) * warpedH
    const w = Number(box.width) * warpedW
    const h = Number(box.height) * warpedH
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null
    return { x, y, w, h }
  }
  const pageW = Number(layout?.page?.width_mm)
  const pageH = Number(layout?.page?.height_mm)
  if (!pageW || !pageH) return null
  const scaleX = warpedW / pageW
  const scaleY = warpedH / pageH
  const w = Number(box.width) * scaleX
  const h = Number(box.height) * scaleY
  const x = Number(box.cx) * scaleX - w / 2
  const y = Number(box.cy) * scaleY - h / 2
  if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

function layoutBoxRectMap(layout, warpedW, warpedH) {
  const out = new Map()
  if (!Array.isArray(layout?.boxes)) return out
  for (const box of layout.boxes) {
    const rect = layoutBoxRect(box, warpedW, warpedH, layout)
    if (rect) out.set(box.id, rect)
  }
  return out
}

function annotationRectForCrop(crop) {
  return crop?.layoutBoxRect || crop?.boxRect || crop?.cropRect || null
}

function buildLayoutSnapshot(layout) {
  if (!layout) return null
  return {
    layout_id: layout.layout_id || null,
    question_groups: clonePlain(layout.question_groups || []),
    metadata: clonePlain(layout.metadata || {})
  }
}

function buildAnnotationGeometry(rawCrops, warpedW, warpedH, layout = null) {
  const expectedById = layoutBoxRectMap(layout, warpedW, warpedH)
  return {
    warpedW,
    warpedH,
    crops: (rawCrops || []).map((crop, index) => ({
      id: crop.id ?? index,
      questionNum: crop.questionNum ?? index + 1,
      cropRect: cloneRect(crop.cropRect),
      boxRect: cloneRect(crop.boxRect),
      layoutBoxRect: cloneRect(expectedById.get(crop.id ?? index))
    }))
  }
}

function buildAnnotationRegions(questionGroups, annotationGeometry, predictions, questionCorrect = null) {
  const crops = Array.isArray(annotationGeometry?.crops) ? annotationGeometry.crops : []
  const warpedW = annotationGeometry?.warpedW || 1
  const warpedH = annotationGeometry?.warpedH || 1
  const cropById = new Map(crops.map((crop, index) => [crop.id ?? index, crop]))
  const predictionById = new Map((predictions || []).map((prediction, index) => [prediction.id ?? index, prediction]))
  if (!Array.isArray(questionGroups) || !questionGroups.length) return []

  return questionGroups.map((group, index) => {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const rect = unionRects(ids.map((id) => {
      const crop = cropById.get(id)
      return annotationRectForCrop(crop)
    }))
    if (!rect) return null
    const groupPredictions = ids.map((id) => predictionById.get(id)).filter(Boolean)
    const hasReview = groupPredictions.some((prediction) => prediction?.reviewNeeded)
    const manualCorrected = groupPredictions.some((prediction) => prediction?.manualCorrected)
    const correct = Array.isArray(questionCorrect) ? questionCorrect[index] : undefined
    const padX = Math.max(rect.h * 0.42, rect.w * 0.14)
    const padY = Math.max(rect.h * 0.38, rect.w * 0.06)
    const target = {
      x: Math.max(0, rect.x - padX),
      y: Math.max(0, rect.y - padY),
      w: Math.min(warpedW, rect.x + rect.w + padX) - Math.max(0, rect.x - padX),
      h: Math.min(warpedH, rect.y + rect.h + padY) - Math.max(0, rect.y - padY)
    }
    return {
      key: `question-region-${group?.question_num ?? index + 1}`,
      label: `${questionLetter(index)})`,
      questionNum: group?.question_num ?? index + 1,
      reviewNeeded: hasReview,
      correct,
      x: target.x,
      y: target.y,
      w: target.w,
      h: target.h,
      leftPct: (target.x / warpedW) * 100,
      topPct: (target.y / warpedH) * 100,
      widthPct: (target.w / warpedW) * 100,
      heightPct: (target.h / warpedH) * 100,
      manualCorrected
    }
  }).filter(Boolean)
}

function tensorInkQuality(tensor, id = null) {
  const values = tensor && typeof tensor.length === 'number' ? tensor : []
  let inkPixels = 0
  let minX = 28
  let minY = 28
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < Math.min(values.length, 28 * 28); i++) {
    const value = Number(values[i]) || 0
    if (value <= 0.16) continue
    const y = Math.floor(i / 28)
    const x = i - y * 28
    inkPixels += 1
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const inkW = maxX >= minX ? maxX - minX + 1 : 0
  const inkH = maxY >= minY ? maxY - minY + 1 : 0
  const density = inkW > 0 && inkH > 0 ? inkPixels / (inkW * inkH) : 0
  const lineArtifactLikely =
    inkPixels >= 10 &&
    inkPixels <= 90 &&
    inkW <= 7 &&
    inkH >= 12 &&
    density <= 0.72
  return {
    id,
    inkPixels,
    inkW,
    inkH,
    density,
    lineArtifactLikely,
    ok: inkPixels >= 14 && inkW >= 3 && inkH >= 8
  }
}

function detectTwoDigitCropFailure(questionGroups, cropQuality) {
  if (!Array.isArray(questionGroups) || !questionGroups.length || !Array.isArray(cropQuality)) return null
  const qualityById = new Map(cropQuality.map((quality) => [quality.id, quality]))
  let expectedTwoDigitGroups = 0
  let missingLeft = 0
  let missingRight = 0
  let oneSidedGroups = 0

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const answer = group?.answer == null ? '' : String(group.answer).trim()
    if (ids.length !== 2 || !/^\d{2,}$/.test(answer)) continue
    expectedTwoDigitGroups += 1
    const left = qualityById.get(ids[0])
    const right = qualityById.get(ids[1])
    if (!left || !right) continue
    if (!left.ok && right.ok) {
      missingLeft += 1
      oneSidedGroups += 1
    } else if (left.ok && !right.ok) {
      missingRight += 1
      oneSidedGroups += 1
    }
  }

  if (expectedTwoDigitGroups < 4) return null
  const repeatedOneSided = oneSidedGroups >= Math.max(3, Math.ceil(expectedTwoDigitGroups * 0.35))
  const sidePattern = Math.max(missingLeft, missingRight) >= Math.max(3, Math.ceil(expectedTwoDigitGroups * 0.3))
  if (!repeatedOneSided || !sidePattern) return null
  return {
    expectedTwoDigitGroups,
    missingLeft,
    missingRight,
    oneSidedGroups
  }
}

function detectTwoDigitRecognitionFailure(questionGroups, cropQuality, predictions, answerKey) {
  if (
    !Array.isArray(questionGroups) ||
    !questionGroups.length ||
    !Array.isArray(cropQuality) ||
    !Array.isArray(predictions) ||
    !Array.isArray(answerKey)
  ) {
    return null
  }

  const qualityById = new Map(cropQuality.map((quality) => [quality.id, quality]))
  const predictionById = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  let expectedTwoDigitGroups = 0
  let reviewGroups = 0
  let guideOneMismatchGroups = 0
  let guideOneMismatchCells = 0

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const answer = group?.answer == null ? '' : String(group.answer).trim()
    if (ids.length !== 2 || !/^\d{2,}$/.test(answer)) continue
    expectedTwoDigitGroups += 1
    let groupHasReview = false
    let groupHasGuideOneMismatch = false
    for (const id of ids) {
      const quality = qualityById.get(id)
      const prediction = predictionById.get(id)
      const expectedDigit = answerKey[id]
      if (!quality || !prediction) continue
      if (prediction.reviewNeeded) groupHasReview = true
      const guideOnlyOne =
        quality.lineArtifactLikely &&
        prediction.digit === 1 &&
        expectedDigit !== 1 &&
        (prediction.confidence ?? 0) < 0.86
      if (guideOnlyOne) {
        guideOneMismatchCells += 1
        groupHasGuideOneMismatch = true
      }
    }
    if (groupHasReview) reviewGroups += 1
    if (groupHasGuideOneMismatch) guideOneMismatchGroups += 1
  }

  if (expectedTwoDigitGroups < 4) return null
  const repeatedReview = reviewGroups >= Math.max(5, Math.ceil(expectedTwoDigitGroups * 0.58))
  const repeatedGuideOnes = guideOneMismatchGroups >= Math.max(3, Math.ceil(expectedTwoDigitGroups * 0.34))
  if (!repeatedReview || !repeatedGuideOnes) return null
  return {
    expectedTwoDigitGroups,
    reviewGroups,
    guideOneMismatchGroups,
    guideOneMismatchCells
  }
}

function detectUnusableTwoDigitScan(questionGroups, cropQuality, predictions, questionCorrect, questionReview) {
  if (
    !Array.isArray(questionGroups) ||
    !Array.isArray(cropQuality) ||
    !Array.isArray(predictions) ||
    !Array.isArray(questionCorrect) ||
    !Array.isArray(questionReview)
  ) {
    return null
  }

  const qualityById = new Map(cropQuality.map((quality) => [quality.id, quality]))
  const predictionById = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  const total = questionGroups.length
  const score = questionCorrect.filter(Boolean).length
  const reviewCount = questionReview.filter(Boolean).length
  let expectedTwoDigitGroups = 0
  let suspiciousTwoDigitGroups = 0
  let oneOrBlankDominatedGroups = 0

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const answer = group?.answer == null ? '' : String(group.answer).trim()
    if (ids.length !== 2 || !/^\d{2,}$/.test(answer)) continue
    expectedTwoDigitGroups += 1
    let suspiciousCells = 0
    let oneOrBlankCells = 0
    for (const id of ids) {
      const quality = qualityById.get(id)
      const prediction = predictionById.get(id)
      if (!quality || !prediction) continue
      const confidence = Number(prediction.confidence) || 0
      const topGap = Number(prediction.topGap) || 0
      const skinnySignal =
        quality.lineArtifactLikely ||
        (quality.inkPixels <= 115 && quality.inkW <= 8 && quality.inkH >= 10 && quality.density <= 0.78)
      if (skinnySignal && (prediction.reviewNeeded || confidence < 0.92 || topGap < 0.5)) suspiciousCells += 1
      if (prediction.digit === 1 || !quality.ok || quality.inkPixels < 18) oneOrBlankCells += 1
    }
    if (suspiciousCells > 0) suspiciousTwoDigitGroups += 1
    if (oneOrBlankCells >= 1) oneOrBlankDominatedGroups += 1
  }

  if (expectedTwoDigitGroups < 5 || total < 8) return null
  const catastrophicLowScore = score <= Math.max(1, Math.floor(total * 0.15))
  const mostlyReview = reviewCount >= Math.ceil(total * 0.72)
  const repeatedSuspicious = suspiciousTwoDigitGroups >= Math.ceil(expectedTwoDigitGroups * 0.35)
  const repeatedOneOrBlank = oneOrBlankDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.65)
  if (!(catastrophicLowScore && mostlyReview && (repeatedSuspicious || repeatedOneOrBlank))) return null

  return {
    total,
    score,
    reviewCount,
    expectedTwoDigitGroups,
    suspiciousTwoDigitGroups,
    oneOrBlankDominatedGroups
  }
}

function cellsToAnswerText(cells) {
  const text = (cells || [])
    .filter((cell) => cell !== null && cell !== undefined && cell !== '')
    .join('')
  return text || 'blank'
}

function predictionDigitCandidates(prediction) {
  const candidates = []
  const seen = new Set()
  const add = (digit, confidence = 0.01) => {
    const normalized = normalizeGradingDigit(digit)
    if (normalized === undefined || normalized === null || seen.has(normalized)) return
    seen.add(normalized)
    candidates.push({ digit: normalized, confidence: Math.max(0.01, Number(confidence) || 0.01) })
  }
  for (const item of prediction?.topK || []) {
    add(item.digit, item.confidence)
    if (candidates.length >= 3) break
  }
  add(prediction?.digit, prediction?.confidence)
  return candidates.length ? candidates : [{ digit: null, confidence: 0.01 }]
}

function topAnswerChoicesForGroup(group, predictions, maxChoices = 2) {
  const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
  if (!ids.length) return []
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  const perSlot = ids.map((id) => predictionDigitCandidates(byId.get(id)).slice(0, 3))
  let combos = [{ cells: [], confidence: 1 }]
  for (const candidates of perSlot) {
    const next = []
    for (const combo of combos) {
      for (const candidate of candidates) {
        next.push({
          cells: combo.cells.concat(candidate.digit),
          confidence: combo.confidence * candidate.confidence
        })
      }
    }
    combos = next
  }
  const seen = new Set()
  return combos
    .sort((a, b) => b.confidence - a.confidence)
    .map((combo) => ({
      ...combo,
      text: cellsToAnswerText(combo.cells)
    }))
    .filter((combo) => {
      if (combo.text === 'blank' || seen.has(combo.text)) return false
      seen.add(combo.text)
      return true
    })
    .slice(0, maxChoices)
    .map((combo, index) => ({
      key: `${group?.question_num ?? 'q'}-${index}-${combo.text}`,
      text: combo.text,
      cells: combo.cells
    }))
}

function parseManualAnswerText(text, slotCount) {
  const cleaned = String(text || '').trim()
  if (!cleaned) return null
  const chars = cleaned
    .split('')
    .filter((char) => /\d|_/.test(char))
  if (!chars.length || chars.length > slotCount) return null
  const cells = chars.map((char) => char === '_' ? null : Number(char))
  if (cells.some((cell) => cell !== null && !Number.isInteger(cell))) return null
  if (cells.length === slotCount) return cells
  return Array(slotCount - cells.length).fill(null).concat(cells)
}

function buildLiveOcrErrorDebugPackage(err, partialDebug) {
  const message = String(err?.message || err || 'Unknown OCR error')
  const debug = {
    capturedImageDataUrl: capturedImage.value,
    error: {
      message,
      name: err?.name || null,
      stack: err?.stack || null
    },
    stage: partialDebug?.stage || 'unknown',
    layoutUrl: partialDebug?.layoutUrl || null,
    layoutId: partialDebug?.layoutId || null,
    qrPayload: partialDebug?.qrPayload || null,
    activeHomography: partialDebug?.activeHomography || null,
    ignoreQrHomography: !!partialDebug?.ignoreQrHomography,
    imageSize: partialDebug?.imageSize || null,
    warpedDataUrl: partialDebug?.warpedDataUrl || null,
    rawCropDataUrls: partialDebug?.rawCropDataUrls || [],
    modelInputDataUrls: partialDebug?.modelInputDataUrls || [],
    tensors: partialDebug?.tensors || [],
    preprocessStats: partialDebug?.preprocessStats || [],
    predictions: partialDebug?.predictions || [],
    answerKey: partialDebug?.answerKey || null,
    markerDebugSnapshot: markerDebugSnapshot.value || null,
    modelInfo: modelInfoSnapshot.value || null,
    runtime: getRuntimeDebugInfo(),
    generatedAt: new Date().toISOString()
  }
  if (typeof window !== 'undefined') {
    window.__SCANGRADE_LIVE_OCR_DEBUG = debug
  }
  return debug
}

function formatTopK(topK) {
  if (!Array.isArray(topK) || topK.length === 0) return ''
  return topK
    .map((t) => `${t.digit} (${Math.round((t.confidence ?? 0) * 100)}%)`)
    .join(' · ')
}

function formatProbs(probs) {
  if (!Array.isArray(probs) || probs.length !== 10) return ''
  return probs.map((p, i) => `${i}:${Math.round(p * 100)}%`).join(' ')
}

function computeInkFitText(tensor) {
  if (!tensor || tensor.length < 784) return ''
  let minX = 28
  let minY = 28
  let maxX = -1
  let maxY = -1
  const thr = 0.15
  for (let y = 0; y < 28; y++) {
    for (let x = 0; x < 28; x++) {
      const v = tensor[y * 28 + x] ?? 0
      if (v > thr) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return 'no-ink'
  const l = minX
  const t = minY
  const r = 27 - maxX
  const b = 27 - maxY
  const clipped = l <= 1 || t <= 1 || r <= 1 || b <= 1
  return `margins L${l} T${t} R${r} B${b}${clipped ? ' (edge-clipped?)' : ''}`
}

function drawCanonicalDigitTensor(label) {
  const c = document.createElement('canvas')
  c.width = 28
  c.height = 28
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'black'
  ctx.fillRect(0, 0, 28, 28)
  ctx.fillStyle = 'white'
  ctx.font = 'bold 24px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(label), 14, 15)
  const id = ctx.getImageData(0, 0, 28, 28).data
  const tensor = new Float32Array(28 * 28)
  for (let i = 0; i < 28 * 28; i++) {
    tensor[i] = id[i * 4] / 255
  }
  return { tensor, previewUrl: c.toDataURL('image/png') }
}

async function runModelSanityTest() {
  modelSanityRunning.value = true
  modelSanityResults.value = null
  try {
    await initDigitModel()
    modelInfoSnapshot.value = getDigitModelInfo()
    const labels = [0, 1, 4, 8]
    const out = []
    for (const label of labels) {
      const sample = drawCanonicalDigitTensor(label)
      const pred = await recognizeDigits(sample.tensor)
      out.push({
        label,
        predicted: pred[0].digit,
        confidencePct: Math.round((pred[0].confidence ?? 0) * 100),
        top3: formatTopK(pred[0].topK),
        previewUrl: sample.previewUrl
      })
    }
    modelSanityResults.value = out
  } finally {
    modelSanityRunning.value = false
  }
}

const runRealOCR = async () => {
  processing.value = true
  ocrResult.value = null
  activeCorrectionQuestion.value = null
  manualCorrectionText.value = ''
  correctionError.value = ''
  markerDebugSnapshot.value = null
  modelInfoSnapshot.value = null
  modelSanityResults.value = null
  lastProcessedTensors.value = null
  lastLiveOcrDebug.value = null
  if (typeof window !== 'undefined') {
    window.__scangradeLastTensors = null
    window.__SCANGRADE_LIVE_OCR_DEBUG = null
  }
  const start = performance.now()
  const partialDebug = {
    stage: 'starting',
    layoutUrl: null,
    layoutId: null,
    qrPayload: null,
    activeHomography: null,
    ignoreQrHomography: false,
    imageSize: null,
    warpedDataUrl: null,
    rawCropDataUrls: [],
    modelInputDataUrls: [],
    tensors: [],
    preprocessStats: [],
    predictions: [],
    answerKey: null
  }

  try {
    // Load image
    partialDebug.stage = 'loading image'
    const img = new Image()
    img.src = capturedImage.value
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = reject
    })

    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    partialDebug.imageSize = { width: canvas.width, height: canvas.height }
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)

    partialDebug.stage = 'reading image pixels'
    const src = cv.imread(canvas)

    // Try to decode QR from image (payload-only); fallback to default layout when no QR
    partialDebug.stage = 'decoding QR'
    const qrPayload = decodeQrFromCanvas(canvas)
    partialDebug.qrPayload = qrPayload || null
    let layoutUrl = qrPayload?.layout_id
      ? publicUrl(`layouts/${qrPayload.layout_id}.json`)
      : DEFAULT_LAYOUT_URL
    partialDebug.layoutUrl = layoutUrl
    partialDebug.stage = 'loading layout'
    let layoutRes = await fetch(layoutUrl)
    if (!layoutRes.ok) {
      layoutUrl = DEFAULT_LAYOUT_URL
      partialDebug.layoutUrl = layoutUrl
      layoutRes = await fetch(layoutUrl)
    }
    if (!layoutRes.ok) {
      throw new Error('Layout not found. Ensure ' + DEFAULT_LAYOUT_URL + ' is available.')
    }
    const layout = await layoutRes.json()
    partialDebug.layoutId = layout.layout_id || null
    // TEMPORARY (retest): ?ignoreQrHomography=1 keeps fetched layout anchors only; QR answer_key + other homography (e.g. marker_size) still merge.
    const ignoreQrHomography =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('ignoreQrHomography') === '1'
    partialDebug.ignoreQrHomography = ignoreQrHomography
    if (qrPayload) {
      if (Array.isArray(qrPayload.answer_key)) layout.answer_key = qrPayload.answer_key
      if (qrPayload.homography && typeof qrPayload.homography === 'object') {
        if (ignoreQrHomography) {
          const { anchors: _qrAnchors, ...qrHomographySansAnchors } = qrPayload.homography
          layout.homography = { ...layout.homography, ...qrHomographySansAnchors }
        } else {
          layout.homography = { ...layout.homography, ...qrPayload.homography }
        }
      }
    }
    const activeHomography = {
      anchors: layout?.homography?.anchors,
      marker_size: layout?.homography?.marker_size
    }
    partialDebug.activeHomography = activeHomography

    // Initialize model
    partialDebug.stage = 'initializing digit model'
    await initDigitModel()
    modelInfoSnapshot.value = getDigitModelInfo()

    if ((ocrDebugEnabled.value || liveOcrDebugExportEnabled.value) && typeof window !== 'undefined') {
      window.__SCANGRADE_DEBUG_MARKERS = true
      window.__SCANGRADE_DEBUG_PREPROCESS_STATS = []
    }

    // Run homography + crops with normalized layout
    partialDebug.stage = 'finding worksheet markers'
    const result = processWorksheet(src, layout)

    if (!result) {
      if (ocrDebugEnabled.value || liveOcrDebugExportEnabled.value) {
        markerDebugSnapshot.value = collectMarkerDebugSnapshot(activeHomography, ignoreQrHomography)
      }
      throw new Error('Corner marker detection failed. Ensure 4 black square markers are visible.')
    }

    const { warpedImage, rawCrops, processedTensors } = result
    const annotationGeometry = buildAnnotationGeometry(rawCrops, warpedImage.cols, warpedImage.rows, layout)
    const layoutSnapshot = buildLayoutSnapshot(layout)
    partialDebug.stage = 'preparing OCR crops'
    const cropQuality = processedTensors.map((proc) => tensorInkQuality(proc.tensor, proc.id))
    partialDebug.cropQuality = cropQuality
    const twoDigitCropFailure = detectTwoDigitCropFailure(layout.question_groups, cropQuality)
    partialDebug.twoDigitCropFailure = twoDigitCropFailure
    if (twoDigitCropFailure) {
      rawCrops.forEach((crop) => crop.image.delete())
      warpedImage.delete()
      src.delete()
      throw new Error('Answer boxes were not captured clearly. Hold the sheet flatter and try again.')
    }
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_OCR_INPUTS) {
      try {
        window.__SCANGRADE_DEBUG_RAW_CROPS = rawCrops.map((c, i) => matToDataURL(c.image, `box-${i + 1}`))
        window.__SCANGRADE_DEBUG_PREPROCESSED = processedTensors.map((p, i) => tensorToDataURL(p.tensor, `box-${i + 1}`))
        window.__SCANGRADE_DEBUG_WARPED = matToDataURL(warpedImage, 'warped')
        console.log('[ScanGrade] OCR inputs debug: raw crops in __SCANGRADE_DEBUG_RAW_CROPS, preprocessed in __SCANGRADE_DEBUG_PREPROCESSED, warped in __SCANGRADE_DEBUG_WARPED')
      } catch (e) {
        console.warn('[ScanGrade] OCR debug export failed:', e)
      }
    }

    const tensors = processedTensors.map(p => ({
      id: p.id,
      tensor: new Float32Array(p.tensor)
    }))
    lastProcessedTensors.value = tensors
    if (typeof window !== 'undefined') window.__scangradeLastTensors = tensors
    if (liveOcrDebugExportEnabled.value) {
      try {
        partialDebug.warpedDataUrl = matToDataURL(warpedImage, 'warped-debug')
      } catch (e) {
        console.warn('[ScanGrade] warped debug image export failed:', e)
      }
      try {
        partialDebug.rawCropDataUrls = rawCrops.map((c, i) => matToDataURL(c.image, `raw-${i + 1}`))
      } catch (e) {
        console.warn('[ScanGrade] raw crop debug image export failed:', e)
      }
      try {
        partialDebug.modelInputDataUrls = processedTensors.map((p, i) => tensorToDataURL(p.tensor, `input-${i + 1}`))
      } catch (e) {
        console.warn('[ScanGrade] model input debug image export failed:', e)
      }
      try {
        partialDebug.tensors = processedTensors.map((p) => ({
          id: p.id,
          questionNum: p.questionNum,
          tensor: Array.from(p.tensor)
        }))
      } catch (e) {
        console.warn('[ScanGrade] tensor debug export failed:', e)
      }
    }

    // Use QR answer_key when available; otherwise fall back to the current template's answer_key.
    // This keeps the built-in test sheet gradeable before QR is added, while production sheets can override via QR.
    const answerKey = Array.isArray(qrPayload?.answer_key)
      ? qrPayload.answer_key
      : (Array.isArray(layout.answer_key) ? layout.answer_key : null)
    partialDebug.answerKey = answerKey
    if (typeof window !== 'undefined' && Array.isArray(window.__SCANGRADE_DEBUG_PREPROCESS_STATS)) {
      partialDebug.preprocessStats = window.__SCANGRADE_DEBUG_PREPROCESS_STATS
    }
    const predictions = []
    const MNIST_LEN = 28 * 28
    partialDebug.stage = 'running digit model'
    for (const proc of processedTensors) {
      const src = proc.tensor
      const data = new Float32Array(MNIST_LEN)
      if (src && src.length >= MNIST_LEN) {
        data.set(typeof src.subarray === 'function' ? src.subarray(0, MNIST_LEN) : src.slice(0, MNIST_LEN))
      }
      // Pass the Float32Array so inference copies it; passing ort.Tensor can expose neutered .data in onnxruntime-web
      let digitResult = await recognizeDigits(data)
      const baseTopK = digitResult[0].topK || []
      const baseTopGap = baseTopK.length >= 2 ? (baseTopK[0].confidence - baseTopK[1].confidence) : 1
      if (digitResult[0].confidence < ROBUST_RETRY_CONFIDENCE_THRESHOLD || baseTopGap < ROBUST_RETRY_MARGIN_THRESHOLD) {
        digitResult = await recognizeDigitsRobust(data, digitResult[0])
      }
      const digit = digitResult[0].digit
      const topK = digitResult[0].topK || []
      const topGap = topK.length >= 2 ? (topK[0].confidence - topK[1].confidence) : 1
      const correct = answerKey != null && proc.id < answerKey.length && answerKey[proc.id] != null
        ? digit === answerKey[proc.id]
        : undefined
      const autoCheckAllowed =
        digitResult[0].confidence >= AUTO_CHECK_CONFIDENCE_THRESHOLD &&
        topGap >= AUTO_CHECK_MARGIN_THRESHOLD
      const autoXAllowed =
        digitResult[0].confidence >= AUTO_X_CONFIDENCE_THRESHOLD &&
        topGap >= AUTO_X_MARGIN_THRESHOLD
      const lowSignal =
        digitResult[0].confidence < LOW_CONFIDENCE_THRESHOLD ||
        topGap < LOW_MARGIN_THRESHOLD
      const reviewNeeded = correct === true
        ? !autoCheckAllowed
        : correct === false
          ? !autoXAllowed
          : lowSignal
      predictions.push({
        id: proc.id,
        questionNum: proc.questionNum,
        digit,
        confidence: digitResult[0].confidence,
        topK,
        topGap,
        reviewNeeded,
        probs: digitResult[0].probs || [],
        entropyNorm: digitResult[0].entropyNorm ?? null,
        robust: digitResult[0].robust === true,
        robustOverride: digitResult[0].robustOverride || null,
        variantCount: digitResult[0].variantCount || 1,
        baseDigit: digitResult[0].baseDigit ?? null,
        baseConfidence: digitResult[0].baseConfidence ?? null,
        baseTopK: digitResult[0].baseTopK || null,
        ...(correct !== undefined && { correct })
      })
    }
    partialDebug.predictions = predictions
    const twoDigitRecognitionFailure = detectTwoDigitRecognitionFailure(
      layout.question_groups,
      cropQuality,
      predictions,
      answerKey
    )
    partialDebug.twoDigitRecognitionFailure = twoDigitRecognitionFailure
    if (twoDigitRecognitionFailure) {
      rawCrops.forEach((crop) => crop.image.delete())
      warpedImage.delete()
      src.delete()
      throw new Error('Answer boxes were not captured clearly. Hold the sheet flatter and try again.')
    }

    const totalTime = (performance.now() - start).toFixed(2)
    const baseNeedsReview =
      typeof window !== 'undefined' &&
      !!window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_USED
    const questionCorrect = buildQuestionCorrect(layout.question_groups, predictions)
    const questionReview = buildQuestionReviewFlags(layout.question_groups, predictions)
    const answerGroups = buildAnswerGroups(layout.question_groups, predictions, questionCorrect)
    const annotationRegions = buildAnnotationRegions(
      layout.question_groups,
      annotationGeometry,
      predictions,
      questionCorrect
    )
    const unusableTwoDigitScan = detectUnusableTwoDigitScan(
      layout.question_groups,
      cropQuality,
      predictions,
      questionCorrect,
      questionReview
    )
    partialDebug.questionCorrect = questionCorrect
    partialDebug.questionReview = questionReview
    partialDebug.answerGroups = answerGroups
    partialDebug.unusableTwoDigitScan = unusableTwoDigitScan
    if (unusableTwoDigitScan) {
      rawCrops.forEach((crop) => crop.image.delete())
      warpedImage.delete()
      src.delete()
      throw new Error('Answer boxes were not captured clearly. Hold the sheet flatter and try again.')
    }

    // Build result; include per-box correctness only when answer_key was present.
    // Low-confidence captures are still useful in a classroom: save them for teacher review
    // instead of forcing repeated retries on older iPad cameras.
    const payload = {
      digits: predictions.map(p => p.digit),
      confidences: predictions.map(p => p.confidence),
      predictions,
      totalTime,
      needsReview: baseNeedsReview || predictions.some((p) => p.reviewNeeded),
      baseNeedsReview,
      annotationGeometry,
      annotationRegions,
      layoutSnapshot,
      manualCorrections: {}
    }
    if (answerKey != null && predictions.every(p => p.correct !== undefined)) {
      payload.correct = predictions.map(p => p.correct)
    }
    if (questionCorrect) {
      payload.questionCorrect = questionCorrect
      payload.questionCount = questionCorrect.length
      payload.questionScore = questionCorrect.filter(Boolean).length
    }
    if (questionReview) {
      payload.questionReview = questionReview
      payload.questionReviewCount = questionReview.filter(Boolean).length
    }
    if (answerGroups) {
      payload.answerGroups = answerGroups
    }
    if (qrPayload) {
      if (qrPayload.template_id != null) payload.template_id = qrPayload.template_id
      if (qrPayload.sheet_instance_id != null) payload.sheet_instance_id = qrPayload.sheet_instance_id
    }
    try {
      const warpedBaseUrl = matToDataURL(warpedImage)
      if (warpedBaseUrl) {
        payload.annotationBaseUrl = warpedBaseUrl
        payload.annotatedImageUrl = await composeStudentAnnotatedImage(
          warpedBaseUrl,
          warpedImage.cols,
          warpedImage.rows,
          predictions,
          rawCrops,
          layout,
          questionCorrect,
          payload.manualCorrections
        )
      }
    } catch (e) {
      console.warn('[ScanGrade] student annotation render failed:', e)
    }

    if (liveOcrDebugExportEnabled.value) {
      lastLiveOcrDebug.value = {
        capturedImageDataUrl: capturedImage.value,
        warpedDataUrl: partialDebug.warpedDataUrl,
        rawCropDataUrls: partialDebug.rawCropDataUrls,
        modelInputDataUrls: partialDebug.modelInputDataUrls,
        tensors: partialDebug.tensors,
        preprocessStats: partialDebug.preprocessStats,
        cropQuality: partialDebug.cropQuality,
        twoDigitCropFailure: partialDebug.twoDigitCropFailure,
        twoDigitRecognitionFailure: partialDebug.twoDigitRecognitionFailure,
        unusableTwoDigitScan: partialDebug.unusableTwoDigitScan,
        predictions,
        answerGroups,
        questionCorrect,
        questionReview,
        questionReviewCount: questionReview ? questionReview.filter(Boolean).length : 0,
        annotationGeometry,
        annotationRegions,
        answerKey,
        layoutUrl: partialDebug.layoutUrl,
        layoutId: layout.layout_id || null,
        qrPayload: partialDebug.qrPayload,
        activeHomography: partialDebug.activeHomography,
        imageSize: partialDebug.imageSize,
        markerDebugSnapshot: markerDebugSnapshot.value || null,
        modelInfo: modelInfoSnapshot.value,
        runtime: getRuntimeDebugInfo(),
        generatedAt: new Date().toISOString()
      }
      if (typeof window !== 'undefined') {
        window.__SCANGRADE_LIVE_OCR_DEBUG = lastLiveOcrDebug.value
      }
    } else {
      lastLiveOcrDebug.value = null
    }

    ocrResult.value = payload

    if (!props.studentMode && ocrDebugEnabled.value) {
      const thumb = matToThumbnailDataURL(warpedImage, 520)
      const cropRectsForOverlay = rawCrops.map((c) => ({
        questionNum: c.questionNum,
        x: c.cropRect.x,
        y: c.cropRect.y,
        w: c.cropRect.w,
        h: c.cropRect.h
      }))
      let warpedOverlayDataUrl = null
      if (thumb?.url && cropRectsForOverlay.length) {
        try {
          warpedOverlayDataUrl = await composeWarpedCropOverlay(
            thumb.url,
            thumb.warpedW,
            thumb.warpedH,
            thumb.thumbW,
            thumb.thumbH,
            cropRectsForOverlay
          )
        } catch (e) {
          console.warn('[ScanGrade] warped crop overlay failed:', e)
        }
      }
      const cells = rawCrops.map((c, i) => {
        const proc = processedTensors[i]
        const pred = predictions[i]
        const expected = DEBUG_REAL_WORKSHEET_EXPECTED[i]
        return {
          index: i + 1,
          questionNum: c.questionNum,
          warpedRegionDataUrl: warpedRegionDataURL(warpedImage, c.cropRect),
          rawDataUrl: matToDataURL(c.image),
          preprocessedDataUrl: tensorToDataURL(proc.tensor),
          digit: pred.digit,
          confidence: pred.confidence,
          top3Text: formatTopK(pred.topK),
          probsText: formatProbs(pred.probs),
          entropyText: pred.entropyNorm == null ? '' : `${(pred.entropyNorm * 100).toFixed(0)}%`,
          inkFitText: computeInkFitText(proc.tensor),
          expected,
          expectedMatch: pred.digit === expected
        }
      })
      ocrDebugSnapshot.value = {
        warpedDataUrl: thumb?.url ?? null,
        warpedOverlayDataUrl,
        cells,
        avgConfidence: predictions.length
          ? predictions.reduce((a, p) => a + p.confidence, 0) / predictions.length
          : 0,
        expectedCorrectCount: cells.filter((x) => x.expectedMatch).length
      }
    } else {
      ocrDebugSnapshot.value = null
    }

    for (const c of rawCrops) {
      try {
        c.image.delete()
      } catch (_) {}
    }
    warpedImage.delete()

  } catch (err) {
    console.error('OCR Error:', err)
    if (
      (ocrDebugEnabled.value || liveOcrDebugExportEnabled.value) &&
      String(err?.message || '').includes('Corner marker detection failed') &&
      !markerDebugSnapshot.value
    ) {
      markerDebugSnapshot.value = collectMarkerDebugSnapshot(
        partialDebug.activeHomography,
        partialDebug.ignoreQrHomography
      )
    }
    ocrDebugSnapshot.value = null
    if (typeof window !== 'undefined' && Array.isArray(window.__SCANGRADE_DEBUG_PREPROCESS_STATS)) {
      partialDebug.preprocessStats = window.__SCANGRADE_DEBUG_PREPROCESS_STATS
    }
    if (liveOcrDebugExportEnabled.value) {
      lastLiveOcrDebug.value = buildLiveOcrErrorDebugPackage(err, partialDebug)
    } else {
      lastLiveOcrDebug.value = null
    }
    if (!lastProcessedTensors.value?.length && typeof window !== 'undefined') {
      window.__scangradeLastTensors = null
    }
    const message = String(err?.message || err || 'OCR failed')
    ocrResult.value = {
      digits: [],
      confidences: [],
      error: message,
      totalTime: (performance.now() - start).toFixed(2)
    }
  } finally {
    processing.value = false
    emit('ocr-complete', ocrResult.value)
  }
}

function exportCropPreview() {
  const list = lastProcessedTensors.value
  if (!list?.length) return
  const scale = 8
  const cell = 28
  const cols = Math.min(5, list.length)
  const rows = Math.ceil(list.length / cols)
  const canvas = document.createElement('canvas')
  canvas.width = cols * cell * scale
  canvas.height = rows * cell * scale
  const ctx = canvas.getContext('2d')
  for (let i = 0; i < list.length; i++) {
    const t = list[i].tensor
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * cell * scale
    const y = row * cell * scale
    const imgData = ctx.createImageData(cell * scale, cell * scale)
    for (let py = 0; py < cell * scale; py++) {
      for (let px = 0; px < cell * scale; px++) {
        const sy = Math.floor(py / scale)
        const sx = Math.floor(px / scale)
        const v = t[sy * 28 + sx] ?? 0
        const u = Math.max(0, Math.min(255, Math.round(v * 255)))
        const idx = (py * cell * scale + px) * 4
        imgData.data[idx] = u
        imgData.data[idx + 1] = u
        imgData.data[idx + 2] = u
        imgData.data[idx + 3] = 255
      }
    }
    ctx.putImageData(imgData, x, y)
  }
  const link = document.createElement('a')
  link.download = `scangrade-crops-${Date.now()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

function exportTensorsJson() {
  const list = lastProcessedTensors.value
  if (!list?.length) return
  const data = list.map(t => ({ id: t.id, tensor: Array.from(t.tensor) }))
  const link = document.createElement('a')
  link.download = `scangrade-tensors-${Date.now()}.json`
  link.href = 'data:application/json,' + encodeURIComponent(JSON.stringify(data))
  link.click()
}

function exportLiveOcrDebugJson() {
  const data = lastLiveOcrDebug.value
  if (!data) return
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = `scangrade-live-ocr-debug-${Date.now()}.json`
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

const retake = () => {
  capturedImage.value = null
  ocrResult.value = null
  activeCorrectionQuestion.value = null
  manualCorrectionText.value = ''
  correctionError.value = ''
  lastProcessedTensors.value = null
  lastLiveOcrDebug.value = null
  ocrDebugSnapshot.value = null
  markerDebugSnapshot.value = null
  modelInfoSnapshot.value = null
  modelSanityResults.value = null
  error.value = null
}

const stopStream = () => {
  clearAutoCaptureInterval()
  cameraReady.value = false
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
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.08);
}

/* Student Mode: no card; dedicated portrait capture layout */
.camera-capture--student {
  background: transparent;
  border-radius: 0;
  padding: 0;
  box-shadow: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 100%;
}

.preview-area {
  position: relative;
  aspect-ratio: 4/3;
  background: #f5f5f7;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Student Mode: large portrait stage = same 8.5x11 region that capture/analysis uses */
.camera-capture--student .preview-area--portrait {
  aspect-ratio: 8.5 / 11;
  width: min(100%, calc(72vh * 8.5 / 11));
  height: auto;
  max-height: 72vh;
  max-width: min(100%, calc(72vh * 8.5 / 11));
  margin-bottom: 16px;
  border-radius: 8px;
  flex: none;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14);
}

.preview-area--portrait .video-preview {
  object-fit: cover;
  position: relative;
  z-index: 0;
}

/* Default (Teacher): centered portrait rect inside landscape preview */
.overlay-frame {
  position: absolute;
  inset: 0;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Student Mode: overlay on top of video so outline is visible */
.preview-area--portrait .overlay-frame {
  display: block;
  z-index: 2;
}

.overlay-sheet {
  flex: 0 0 auto;
  height: 100%;
  width: auto;
  aspect-ratio: 8.5 / 11;
  border: 3px solid rgba(255, 255, 255, 0.95);
  border-radius: 6px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
  box-sizing: border-box;
}

/* Student Mode: transparent sheet outline inside the live preview = "put your sheet here" (same region as capture/analysis) */
.overlay-sheet--full {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  flex: none;
  border-radius: 0;
  background: transparent;
  border: 3px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.55);
  box-sizing: border-box;
  pointer-events: none;
}

.capture-state-ready .overlay-sheet--full {
  border-color: rgba(18, 108, 57, 0.96);
  box-shadow:
    0 0 0 1px rgba(18, 108, 57, 0.72),
    0 0 18px rgba(18, 108, 57, 0.30),
    inset 0 0 0 1px rgba(255, 255, 255, 0.78),
    inset 0 0 18px rgba(18, 108, 57, 0.12);
}

.capture-state-adjust .overlay-sheet--full {
  border-color: rgba(255, 204, 0, 0.95);
}

.capture-state-looking .overlay-sheet--full,
.capture-state-warming .overlay-sheet--full {
  border-color: rgba(255, 255, 255, 0.9);
}

.overlay-frame-text {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: 10px 18px;
  background: rgba(0, 0, 0, 0.52);
  color: white;
  font-size: 22px;
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: 0;
  border-radius: 8px;
  text-align: center;
  max-width: calc(100% - 24px);
}

.overlay-frame--ready .overlay-frame-text {
  background: rgba(18, 108, 57, 0.9);
}

.overlay-frame--adjust .overlay-frame-text {
  background: rgba(116, 80, 0, 0.86);
}

.overlay-frame--warming .overlay-frame-text,
.overlay-frame--looking .overlay-frame-text {
  background: rgba(0, 0, 0, 0.56);
}

.captured-image-wrap {
  position: relative;
  width: 100%;
  height: 100%;
}

.video-preview, .captured-image {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.preview-area--portrait .captured-image {
  object-fit: contain;
}

.annotation-hotspot {
  position: absolute;
  border: 2px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: transparent;
  padding: 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.annotation-hotspot:hover,
.annotation-hotspot--active {
  background: rgba(240, 199, 68, 0.08);
}

.annotation-hotspot:focus-visible {
  outline: 3px solid #007aff;
  outline-offset: 3px;
}

.annotation-hotspot span {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}

.placeholder {
  color: #6e6e73;
  text-align: center;
}

.student-blocked {
  margin: 0 0 12px;
  text-align: center;
  color: #6e6e73;
  font-size: 14px;
  font-weight: 500;
}

.controls {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.controls--student {
  width: min(100%, calc(72vh * 8.5 / 11));
  max-width: min(100%, calc(72vh * 8.5 / 11));
  justify-content: stretch;
}

.btn {
  flex: 1;
  min-width: 120px;
  padding: 14px 20px;
  border: none;
  border-radius: 8px;
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

.file-btn--student {
  flex: 0 0 100%;
  background: transparent;
  color: #007aff;
  padding: 8px 10px;
}

.file-btn--disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.student-result {
  margin-top: 20px;
  padding: 22px 18px;
  background: #ffffff;
  border-radius: 8px;
  text-align: center;
  width: min(100%, calc(72vh * 8.5 / 11));
  max-width: min(100%, calc(72vh * 8.5 / 11));
  border: 1px solid #e3e5e8;
}

.student-result--success {
  background: #fbfdfb;
  border-color: #c7e3ce;
}

.student-result--review {
  background: #fffdf7;
  border-color: #eadcae;
}

.student-result--error {
  background: #fff1f0;
  border-color: #ffd0cc;
}

.student-result-message {
  font-size: 28px;
  line-height: 1.15;
  font-weight: 750;
  color: #202124;
  margin: 0 0 16px;
}

.student-result-subtext {
  color: #5f6368;
  font-size: 16px;
  line-height: 1.4;
  margin: -6px 0 14px;
}

.student-result-debug-error {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.35;
  text-align: left;
  overflow-wrap: anywhere;
}

.student-answer-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(5, auto);
  grid-auto-flow: column;
  gap: 9px 18px;
  margin: 2px auto 20px;
  max-width: 430px;
  text-align: left;
}

.student-answer-item {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 6px 8px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(218, 220, 224, 0.82);
}

.student-answer-item--clickable {
  cursor: pointer;
}

.student-answer-item--clickable:active {
  transform: scale(0.98);
}

.student-answer-item--clickable:focus-visible {
  outline: 3px solid rgba(0, 122, 255, 0.32);
  outline-offset: 2px;
}

.student-answer-label {
  width: 24px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid #c7ccd1;
  border-radius: 999px;
  color: #4f565f;
  background: #ffffff;
  font-size: 12px;
  line-height: 1;
  font-weight: 650;
  justify-self: center;
}

.student-answer-pills {
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: 34px;
  align-items: center;
  justify-content: start;
  gap: 5px;
}

.student-answer-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: white;
  border: 1.25px solid #cfd3d8;
  font-size: 17px;
  font-weight: 750;
  color: #202124;
}

.student-answer-item--correct .student-answer-pill {
  border-color: #a8d8b5;
  background: #f7fff8;
}

.student-answer-item--incorrect .student-answer-pill {
  border-color: #ffd0cc;
  background: #fff6f5;
}

.student-answer-item--review .student-answer-pill {
  border-color: #e7c13d;
  background: #fffdf4;
}

.student-correction-panel {
  margin: 0 auto 18px;
  padding: 14px;
  max-width: 390px;
  border: 1px solid #f0c744;
  border-radius: 8px;
  background: rgba(255, 253, 244, 0.96);
  text-align: left;
}

.student-correction-panel--image {
  position: absolute;
  z-index: 4;
  width: min(236px, 44%);
  min-width: 186px;
  max-width: calc(100% - 20px);
  max-height: min(76%, 286px);
  overflow: auto;
  margin: 0;
  padding: 10px 10px 11px;
  transform: translateY(-50%);
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.18);
}

.student-correction-panel--image .student-correction-title {
  font-size: 15px;
}

.student-correction-panel--image .student-correction-choices,
.student-correction-panel--image .student-correction-actions {
  gap: 6px;
}

.student-correction-panel--image .correction-choice-btn {
  flex: 1 1 calc(50% - 3px);
  min-width: 0;
  padding: 8px 12px;
}

.student-correction-panel--image .student-correction-manual input {
  padding: 8px 9px;
  font-size: 20px;
}

.student-correction-title {
  display: flex;
  align-items: center;
  gap: 7px;
  margin: 0 0 9px;
  color: #1d1d1f;
  font-size: 18px;
  font-weight: 800;
}

.student-correction-label {
  width: 25px;
  height: 18px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border: 1.5px solid #c7ccd1;
  border-radius: 999px;
  color: #4f565f;
  background: #fff;
  font-size: 12px;
  line-height: 1;
  font-weight: 650;
}

.student-correction-current {
  margin-left: auto;
  padding: 3px 7px;
  border: 1px solid #e0d28b;
  border-radius: 999px;
  color: #4f565f;
  background: #fffef8;
  font-size: 13px;
  font-weight: 750;
}

.student-correction-close {
  appearance: none;
  border: 0;
  background: transparent;
  color: #6e6e73;
  font-size: 20px;
  line-height: 1;
  padding: 0 1px;
  cursor: pointer;
}

.student-correction-subtext {
  margin: 0 0 12px;
  color: #6e6e73;
  font-size: 14px;
}

.student-correction-choices,
.student-correction-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.student-correction-choices {
  margin-top: 7px;
}

.correction-choice-btn {
  min-width: 48px;
  padding: 10px 14px;
  font-weight: 800;
}

.student-correction-manual {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 7px;
  margin: 0;
  color: #1d1d1f;
  font-size: 14px;
  font-weight: 700;
}

.student-correction-manual input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  padding: 12px 14px;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0;
}

.student-correction-save {
  min-width: 0;
  padding: 8px 12px;
}

.student-correction-panel--image .student-correction-save {
  flex: 0 0 auto;
  min-width: 64px;
  padding: 8px 11px;
}

@media (max-width: 430px) {
  .student-correction-panel--image {
    width: min(232px, 50%);
    min-width: 178px;
  }

  .student-correction-panel--image .student-correction-manual {
    grid-template-columns: 1fr;
  }

  .student-correction-panel--image .student-correction-save {
    width: 100%;
  }
}

.student-correction-error {
  margin: 7px 0 0;
  color: #b42318;
  font-size: 13px;
  font-weight: 700;
}

.student-result-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
}

.ocr-result {
  margin-top: 20px;
  padding: 16px;
  background: #f5f5f7;
  border-radius: 8px;
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

.digit.correct {
  border: 2px solid #28a745;
  background: #e8f5e9;
}

.digit.incorrect {
  border: 2px solid #dc3545;
  background: #ffebee;
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

.ocr-debug-controls {
  margin-top: 12px;
  padding: 10px 0;
  border-top: 1px solid #e8e8ed;
}

.ocr-debug-toggle {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #3a3a3c;
  cursor: pointer;
  user-select: none;
}

.ocr-debug-panel {
  margin-top: 20px;
  padding: 16px;
  background: #1c1c1e;
  color: #f5f5f7;
  border-radius: 8px;
  font-size: 13px;
}

.ocr-debug-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 600;
}

.ocr-debug-summary {
  margin: 0 0 16px;
  color: #aeaeb2;
}

.ocr-debug-label {
  margin: 0 0 8px;
  color: #aeaeb2;
  font-size: 12px;
}

.ocr-debug-warped {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
  border: 1px solid #48484a;
}

.ocr-debug-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-top: 20px;
}

.ocr-debug-cell {
  padding: 12px;
  background: #2c2c2e;
  border-radius: 10px;
  border: 1px solid #48484a;
}

.ocr-debug-cell--bad {
  border-color: #ff453a;
  box-shadow: 0 0 0 1px rgba(255, 69, 58, 0.35);
}

.ocr-debug-cell-head {
  font-weight: 600;
  margin-bottom: 10px;
  color: #f5f5f7;
}

.ocr-debug-cell-images {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.ocr-debug-cell-images figure {
  margin: 0;
  flex: 1;
  min-width: 0;
}

.ocr-debug-cell-images figcaption {
  font-size: 11px;
  color: #8e8e93;
  margin-bottom: 6px;
}

.ocr-debug-raw {
  width: 100%;
  max-height: 120px;
  object-fit: contain;
  background: #fff;
  border-radius: 4px;
}

.ocr-debug-pre {
  width: 100%;
  max-width: 224px;
  image-rendering: pixelated;
  border-radius: 4px;
  border: 1px solid #48484a;
  background: #000;
}

.ocr-debug-cell-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  font-size: 12px;
  color: #d1d1d6;
}

.ocr-debug-match.ok {
  color: #34c759;
}

.ocr-debug-match.no {
  color: #ff453a;
  font-weight: 600;
}

.marker-debug-panel {
  margin-top: 12px;
}

.marker-debug-kv {
  margin-bottom: 12px;
  color: #d1d1d6;
  display: grid;
  gap: 4px;
}

.marker-debug-candidates {
  margin-top: 14px;
}

.model-sanity-controls {
  margin-top: 10px;
}

.marker-debug-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 10px;
}

.marker-debug-item {
  background: #2c2c2e;
  border: 1px solid #48484a;
  border-radius: 8px;
  padding: 8px;
  color: #d1d1d6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 11px;
  line-height: 1.35;
}
</style>
