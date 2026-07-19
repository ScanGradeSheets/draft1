<template>
  <div class="scan-grade" :class="{ 'scan-grade--student': isStudentMode, 'scan-grade--capture': showStudentCaptureUi }">
    <header class="header">
      <img :src="publicUrl('scangrade-logo-transparent.png')" alt="ScanGrade logo" class="brand-logo" />
      <h1><span class="brand-name">ScanGrade</span><span class="brand-domain">.io</span></h1>
      <p class="build-label">Build {{ APP_BUILD_LABEL }}</p>
    </header>

    <main class="main" :class="{ 'main--student': isStudentMode }">
      <section v-if="isStudentMode && studentView === 'landing'" class="student-home">
        <div class="student-home-actions">
          <button type="button" class="btn btn-primary student-home-btn" @click="beginGuestScan">
            Start Scan
          </button>
          <button type="button" class="btn btn-secondary student-home-btn student-home-debug-btn" @click="beginDebugGuestScan">
            Debug Scan (exports)
          </button>
          <button type="button" class="btn btn-secondary student-home-btn" @click="beginStudentSignIn">
            Sign In
          </button>
          <a class="btn btn-worksheet student-home-btn" :href="publicUrl('worksheets/')">
            Get Worksheets
          </a>
        </div>
        <button type="button" class="teacher-link-btn" @click="enterTeacherMode">
          Teacher Review
        </button>
      </section>

      <section v-else-if="isStudentMode && studentView === 'identity'" class="student-roster">
        <h2 class="student-roster-title">Who are you?</h2>
        <p v-if="selectedStudentName" class="student-selected-label">
          Scanning as <strong>{{ selectedStudentName }}</strong>
        </p>
        <p v-else class="student-roster-help">Choose your name or continue as guest.</p>
        <p v-if="!classRoster.length" class="student-roster-empty">
          No class list yet. You can still continue as guest.
        </p>
        <div v-if="classRoster.length" class="student-roster-grid">
          <button
            v-for="name in classRoster"
            :key="name"
            type="button"
            class="student-name-chip"
            :class="{ 'student-name-chip--active': selectedStudentName === name }"
            @click="selectedStudentName = name"
          >
            {{ name }}
          </button>
        </div>
        <div class="student-identity-actions">
          <button
            v-if="classRoster.length"
            type="button"
            class="btn btn-primary student-home-btn"
            :disabled="!selectedStudentName"
            @click="startNamedScan"
          >
            Scan as {{ selectedStudentName || 'Student' }}
          </button>
          <button
            type="button"
            class="btn student-home-btn"
            :class="classRoster.length ? 'btn-secondary' : 'btn-primary'"
            @click="continueAsGuest"
          >
            Continue as Guest
          </button>
        </div>
        <button type="button" class="teacher-link-btn" @click="returnToLanding">
          Back
        </button>
      </section>

      <!-- Teacher / Review Mode only -->
      <div v-if="showTeacherUi" class="test-section">
        <button @click="runRuntimeTest" class="btn btn-test" :disabled="runtimeTestRunning">
          {{ runtimeTestRunning ? 'Testing...' : 'Runtime Self-Test' }}
        </button>
        <button @click="runPipelineTest" class="btn btn-test" :disabled="!pipelineReady || pipelineTestRunning">
          {{ pipelineTestRunning ? 'Testing...' : 'Pipeline Smoke Test' }}
        </button>
      </div>

      <div v-if="showTeacherUi && testResults.length > 0" class="console-output">
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

      <div
        v-if="showStudentCaptureUi || showTeacherUi"
        class="camera-wrapper"
        :class="{ 'camera-wrapper--student': isStudentMode }"
        ref="cameraWrapper"
      >
        <CameraCapture
          :key="cameraKey"
          :student-mode="isStudentMode"
          :capture-enabled="!isStudentMode || studentView === 'capture'"
          :capture-blocked-reason="studentCaptureBlockedReason"
          :auto-start="isStudentMode && studentView === 'capture'"
          :show-recognition-overlay="showRecognitionOverlay"
          @image-captured="handleImageCaptured"
          @ocr-complete="handleOCRComplete"
          @processing-change="handleCameraProcessingChange"
          @student-stage-change="handleStudentStageChange"
          @student-done="handleStudentDone"
          ref="cameraRef"
        />
        <div
          v-if="showStudentCaptureUi"
          class="student-scan-bar"
          :class="{
            'student-scan-bar--grading': studentScanStage,
            'student-scan-bar--has-result': ocrResult
          }"
        >
          <div v-if="studentScanStage" class="student-scan-grading" aria-live="polite">
            <span class="student-scan-grading-word">{{ studentScanStage === 'grading' ? 'Grading' : 'Scanning' }}</span>
          </div>
          <template v-else>
            <button type="button" class="student-scan-link student-scan-home" @click="returnToLanding">
              Home
            </button>
            <button type="button" class="student-scan-identity" @click="beginStudentSignIn">
              <strong>{{ activeStudentSession?.mode === 'named' ? activeStudentSession.studentName : 'Login' }}</strong>
            </button>
            <button
              v-if="ocrResult && !ocrResult.error"
              type="button"
              class="student-recognition-toggle"
              :class="{ 'student-recognition-toggle--active': showRecognitionOverlay }"
              :aria-expanded="showRecognitionOverlay"
              :aria-label="showRecognitionOverlay ? 'Hide what ScanGrade saw' : 'Show what ScanGrade saw'"
              @click="showRecognitionOverlay = !showRecognitionOverlay"
            >
              <span aria-hidden="true">{{ showRecognitionOverlay ? '⌄' : '⌃' }}</span>
            </button>
            <div class="student-scan-actions">
              <button
                v-if="ocrResult"
                type="button"
                class="student-scan-link student-scan-reset"
                @click="resetStudentScan"
              >
                New Scan
              </button>
            </div>
          </template>
        </div>
        <canvas v-if="showAnnotationLayer && showTeacherUi" ref="annotationCanvas" class="annotation-layer"></canvas>
      </div>

      <section v-if="showTeacherUi" class="teacher-panel">
        <div class="teacher-panel-card">
          <div class="teacher-panel-head">
            <div>
              <h2>Class Roster</h2>
              <p>One student name per line. Student Mode uses this list for quick tap selection.</p>
            </div>
            <button type="button" class="btn btn-export" @click="exitTeacherMode">
              Student Home
            </button>
          </div>
          <textarea
            v-model="rosterDraft"
            class="teacher-roster-input"
            rows="8"
            placeholder="Ava&#10;Mason&#10;Noah"
          />
          <div class="teacher-panel-actions">
            <button type="button" class="btn btn-export" @click="saveRoster">Save Roster</button>
          </div>
        </div>

        <div class="teacher-panel-card">
          <div class="teacher-panel-head">
            <div>
              <h2>Saved Scans</h2>
              <p>
                {{ reviewSummary.total }} saved.
                {{ reviewSummary.open }} open.
                {{ reviewSummary.reviewed }} reviewed.
              </p>
            </div>
            <button
              v-if="savedSubmissions.length"
              type="button"
              class="btn btn-export"
              @click="clearReviewQueue"
            >
              Clear Queue
            </button>
          </div>
          <div v-if="savedSubmissions.length" class="review-stats" aria-label="Review summary">
            <button type="button" class="review-stat" :class="{ active: reviewFilter === 'open' }" @click="reviewFilter = 'open'">
              <strong>{{ reviewSummary.open }}</strong>
              <span>Open</span>
            </button>
            <button type="button" class="review-stat" :class="{ active: reviewFilter === 'review' }" @click="reviewFilter = 'review'">
              <strong>{{ reviewSummary.needsReview }}</strong>
              <span>Needs review</span>
            </button>
            <button type="button" class="review-stat" :class="{ active: reviewFilter === 'ready' }" @click="reviewFilter = 'ready'">
              <strong>{{ reviewSummary.ready }}</strong>
              <span>Ready</span>
            </button>
            <button type="button" class="review-stat" :class="{ active: reviewFilter === 'done' }" @click="reviewFilter = 'done'">
              <strong>{{ reviewSummary.reviewed }}</strong>
              <span>Reviewed</span>
            </button>
            <button type="button" class="review-stat" :class="{ active: reviewFilter === 'all' }" @click="reviewFilter = 'all'">
              <strong>{{ reviewSummary.total }}</strong>
              <span>All</span>
            </button>
            <div class="review-stat review-stat--passive">
              <strong>{{ reviewSummary.assisted }}</strong>
              <span>Likely reads</span>
            </div>
          </div>
          <p v-if="!savedSubmissions.length" class="teacher-empty-state">
            No saved scans yet. Student Mode will add them here automatically after a successful read.
          </p>
          <p v-else-if="!filteredSubmissions.length" class="teacher-empty-state">
            No scans in this view.
          </p>
          <div v-else class="review-queue">
            <section
              v-for="group in submissionsByStudent"
              :key="group.studentName"
              class="review-group"
            >
              <div class="review-group-head">
                <div>
                  <h3>{{ group.studentName }}</h3>
                  <p>
                    {{ group.total }} saved ·
                    {{ group.open }} open ·
                    latest {{ formatSavedAt(group.latestSavedAt) }}
                  </p>
                </div>
              </div>
              <article
                v-for="submission in group.submissions"
                :key="submission.id"
                class="review-card"
                :class="{
                  'review-card--review': submission.status === 'review',
                  'review-card--ready': submission.status === 'ready',
                  'review-card--done': submission.status === 'done'
                }"
              >
                <div class="review-card-row">
                  <strong>{{ formatSavedAt(submission.savedAt) }}</strong>
                  <span class="review-status" :class="`review-status--${submission.status}`">
                    {{ statusLabel(submission.status) }}
                  </span>
                </div>
                <div v-if="submissionScoreText(submission)" class="review-score">
                  {{ submissionScoreText(submission) }}
                </div>
                <div class="review-card-meta">
                  <span v-if="submission.totalTime">OCR {{ submission.totalTime }}ms</span>
                  <span v-if="submission.avgConfidence != null">
                    Avg {{ Math.round(submission.avgConfidence * 100) }}%
                  </span>
                </div>
                <p class="review-card-digits">
                  <span>Digits</span>
                  <template v-if="submission.digits?.length">
                    <span
                      v-for="(digit, i) in submission.digits"
                      :key="`${submission.id}-${i}`"
                      class="review-digit"
                      :class="{
                        'review-digit--correct': submission.correct?.[i] === true,
                        'review-digit--incorrect': submission.correct?.[i] === false
                      }"
                    >
                      {{ digit }}
                    </span>
                  </template>
                  <span v-else>None saved</span>
                </p>
                <p
                  v-if="submissionReviewSuggestions(submission).length"
                  class="review-card-suggestions"
                >
                  <span>Likely reads</span>
                  <span
                    v-for="suggestion in submissionReviewSuggestions(submission)"
                    :key="`${submission.id}-${suggestion.label}-${suggestion.text}`"
                    class="review-suggestion-chip"
                  >
                    {{ suggestion.label }} {{ suggestion.text }}<span v-if="suggestionMetaText(suggestion)"> · {{ suggestionMetaText(suggestion) }}</span>
                  </span>
                </p>
                <p v-if="submission.template_id || submission.sheet_instance_id" class="review-card-meta">
                  <span v-if="submission.template_id">Template {{ submission.template_id }}</span>
                  <span v-if="submission.sheet_instance_id">Sheet {{ submission.sheet_instance_id }}</span>
                </p>
                <div class="review-card-actions">
                  <button
                    v-if="submission.status !== 'done'"
                    type="button"
                    class="btn btn-export review-action-btn"
                    @click="markSubmissionDone(submission.id)"
                  >
                    Mark reviewed
                  </button>
                  <button
                    v-else
                    type="button"
                    class="btn btn-export review-action-btn"
                    @click="markSubmissionForReview(submission.id)"
                  >
                    Reopen
                  </button>
                  <button
                    type="button"
                    class="btn btn-export review-action-btn review-action-btn--danger"
                    @click="removeSubmission(submission.id)"
                  >
                    Delete
                  </button>
                </div>
              </article>
            </section>
          </div>
        </div>
      </section>

      <div v-if="showTeacherUi && ocrResult" class="results">
        <h2>Results</h2>
        <p v-if="ocrResult.error" class="results-error">{{ ocrResult.error }}</p>
        <p v-if="ocrResult.needsReview" class="results-error">
          Alignment fallback was used for this page. Results may be unreliable and should be reviewed manually.
        </p>
        <p>Detected: {{ (ocrResult.digits && ocrResult.digits.length) ? ocrResult.digits.join(', ') : '—' }}</p>
        <p>Avg Confidence: {{ (ocrResult.confidences && ocrResult.confidences.length) ? (ocrResult.confidences.reduce((a,b)=>a+b,0)/ocrResult.confidences.length*100).toFixed(0) + '%' : '—' }}</p>
        <p v-if="ocrResult.totalTime">Time: {{ ocrResult.totalTime }}ms</p>
        <button type="button" class="btn btn-export" @click="exportResultJson">Export JSON</button>
        <button type="button" class="btn btn-export" @click="exportResultCsv">Export CSV</button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import CameraCapture from './components/CameraCapture.vue'
import { publicUrl } from './public-paths.js'
import {
  clearSavedSubmissions,
  deleteSubmission,
  loadClassRoster,
  loadSavedSubmissions,
  saveClassRoster,
  saveSubmission,
  updateSubmissionStatus
} from './services/studentReviewStore.js'

const APP_BUILD_LABEL = '2026.07.18-empty-save-beta-15-3'
const DEBUG_QUERY_FLAGS = ['ocrdebug', 'liveOcrDebug', 'sgdebug', 'debug']

// Optional local gateway sync for desk testing. GitHub Pages and classroom devices
// should not depend on a local server.
const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname)
const gatewaySyncEnabled =
  isLocalHost && new URLSearchParams(window.location.search).get('gateway') === '1'
const GATEWAY_URL = gatewaySyncEnabled ? `http://${window.location.hostname}:18789` : ''
const updateBoardState = async (ocrResult) => {
  if (!gatewaySyncEnabled) return
  try {
    const response = await fetch(`${GATEWAY_URL}/api/board`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        timestamp: new Date().toISOString(),
        result: ocrResult
      })
    })
    if (response.ok) {
      console.log('[ScanGrade] Board state synced')
    }
  } catch (err) {
    console.warn('Gateway sync failed:', err.message)
  }
}

const isStudentMode = ref(
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') !== 'teacher'
)
const showTeacherUi = ref(!isStudentMode.value)
const studentView = ref(isStudentMode.value ? 'landing' : 'capture')
const showStudentCaptureUi = computed(() => isStudentMode.value && studentView.value === 'capture')
const ocrResult = ref(null)
const studentCameraProcessing = ref(false)
const studentScanStage = ref('')
const showRecognitionOverlay = ref(false)
const studentScanKey = ref(0)
const cameraKey = computed(() => isStudentMode.value ? `student-camera-${studentScanKey.value}` : 'teacher-camera')
const classRoster = ref([])
const rosterDraft = ref('')
const selectedStudentName = ref('')
const activeStudentSession = ref(null)
const savedSubmissions = ref([])
const reviewFilter = ref('open')
const cameraRef = ref(null)
const cameraWrapper = ref(null)
const annotationCanvas = ref(null)
const showAnnotationLayer = ref(false)
const testResults = ref([])
const runtimeTestRunning = ref(false)
const pipelineTestRunning = ref(false)
const pipelineReady = ref(false)
const studentCaptureBlockedReason = computed(() =>
  studentView.value !== 'capture' ? 'Start from the home screen first.' : ''
)

const setModeInUrl = (mode) => {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (mode === 'teacher') {
    url.searchParams.set('mode', 'teacher')
  } else {
    url.searchParams.delete('mode')
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

const setLiveDebugInUrl = (enabled) => {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  for (const flag of DEBUG_QUERY_FLAGS) {
    url.searchParams.delete(flag)
  }
  if (enabled) {
    url.searchParams.set('liveOcrDebug', '1')
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

const isOpenSubmission = (submission) => submission.status !== 'done'

const reviewSummary = computed(() => {
  const total = savedSubmissions.value.length
  const needsReview = savedSubmissions.value.filter((submission) => submission.status === 'review').length
  const ready = savedSubmissions.value.filter((submission) => submission.status === 'ready').length
  const reviewed = savedSubmissions.value.filter((submission) => submission.status === 'done').length
  const assisted = savedSubmissions.value.reduce((sum, submission) => (
    sum + submissionReviewSuggestions(submission).length
  ), 0)
  return { total, open: needsReview + ready, needsReview, ready, reviewed, assisted }
})

const filteredSubmissions = computed(() => {
  if (reviewFilter.value === 'all') return savedSubmissions.value
  if (reviewFilter.value === 'open') return savedSubmissions.value.filter(isOpenSubmission)
  return savedSubmissions.value.filter((submission) => submission.status === reviewFilter.value)
})

const statusPriority = (status) => {
  if (status === 'review') return 0
  if (status === 'ready') return 1
  if (status === 'done') return 2
  return 3
}

const submissionsByStudent = computed(() => {
  const groups = new Map()
  for (const submission of filteredSubmissions.value) {
    if (!groups.has(submission.studentName)) {
      groups.set(submission.studentName, [])
    }
    groups.get(submission.studentName).push(submission)
  }
  return Array.from(groups.entries())
    .map(([studentName, submissions]) => {
      const sorted = [...submissions].sort((a, b) => {
        const byStatus = statusPriority(a.status) - statusPriority(b.status)
        if (byStatus !== 0) return byStatus
        return String(b.savedAt || '').localeCompare(String(a.savedAt || ''))
      })
      return {
        studentName,
        submissions: sorted,
        total: sorted.length,
        open: sorted.filter(isOpenSubmission).length,
        latestSavedAt: sorted.reduce((latest, submission) => {
          if (!latest) return submission.savedAt || null
          return String(submission.savedAt || '').localeCompare(String(latest)) > 0
            ? submission.savedAt
            : latest
        }, null)
      }
    })
    .sort((a, b) => {
      const byOpen = b.open - a.open
      if (byOpen !== 0) return byOpen
      return String(b.latestSavedAt || '').localeCompare(String(a.latestSavedAt || ''))
    })
})

const syncRosterDraft = () => {
  rosterDraft.value = classRoster.value.join('\n')
}

const clearActiveScanResult = () => {
  ocrResult.value = null
  showRecognitionOverlay.value = false
  showAnnotationLayer.value = false
  studentCameraProcessing.value = false
  studentScanStage.value = ''
}

const resetStudentScan = () => {
  clearActiveScanResult()
  studentView.value = 'capture'
  studentScanKey.value += 1
}

const beginStudentSignIn = () => {
  setLiveDebugInUrl(false)
  clearActiveScanResult()
  selectedStudentName.value = ''
  activeStudentSession.value = null
  studentView.value = 'identity'
}

const beginGuestScan = () => {
  setLiveDebugInUrl(false)
  continueAsGuest()
}

const beginDebugGuestScan = () => {
  setLiveDebugInUrl(true)
  continueAsGuest()
}

const continueAsGuest = () => {
  clearActiveScanResult()
  selectedStudentName.value = ''
  activeStudentSession.value = { mode: 'guest', studentName: 'Guest' }
  studentView.value = 'capture'
}

const startNamedScan = () => {
  if (!selectedStudentName.value) return
  clearActiveScanResult()
  activeStudentSession.value = { mode: 'named', studentName: selectedStudentName.value }
  studentView.value = 'capture'
}

const returnToLanding = () => {
  setLiveDebugInUrl(false)
  clearActiveScanResult()
  selectedStudentName.value = ''
  activeStudentSession.value = null
  studentView.value = 'landing'
}

const enterTeacherMode = () => {
  clearActiveScanResult()
  isStudentMode.value = false
  studentView.value = 'capture'
  showTeacherUi.value = true
  setModeInUrl('teacher')
}

const exitTeacherMode = () => {
  showTeacherUi.value = false
  isStudentMode.value = true
  setModeInUrl('student')
  returnToLanding()
}

const handleStudentDone = () => {
  returnToLanding()
}

const loadTeacherData = async () => {
  classRoster.value = await loadClassRoster()
  await refreshSavedSubmissions()
  syncRosterDraft()
  if (
    selectedStudentName.value &&
    !classRoster.value.includes(selectedStudentName.value)
  ) {
    selectedStudentName.value = ''
  }
}

const saveRoster = async () => {
  const names = rosterDraft.value.split('\n')
  classRoster.value = await saveClassRoster(names)
  syncRosterDraft()
  if (
    selectedStudentName.value &&
    !classRoster.value.includes(selectedStudentName.value)
  ) {
    selectedStudentName.value = ''
  }
}

const clearReviewQueue = async () => {
  savedSubmissions.value = await clearSavedSubmissions()
}

const refreshSavedSubmissions = async () => {
  savedSubmissions.value = await loadSavedSubmissions()
}

const markSubmissionDone = async (id) => {
  savedSubmissions.value = await updateSubmissionStatus(id, 'done')
}

const markSubmissionForReview = async (id) => {
  savedSubmissions.value = await updateSubmissionStatus(id, 'review')
}

const removeSubmission = async (id) => {
  savedSubmissions.value = await deleteSubmission(id)
}

const formatSavedAt = (iso) => {
  if (!iso) return 'Unknown time'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

const statusLabel = (status) => {
  if (status === 'review') return 'Needs review'
  if (status === 'done') return 'Reviewed'
  return 'Ready'
}

const submissionScoreText = (submission) => {
  if (Array.isArray(submission.questionCorrect) && submission.questionCorrect.length > 0) {
    const score = submission.questionCorrect.filter(Boolean).length
    return `${score}/${submission.questionCorrect.length} correct`
  }
  if (!Array.isArray(submission.correct) || submission.correct.length === 0) return ''
  const score = submission.correct.filter(Boolean).length
  return `${score}/${submission.correct.length} correct`
}

const submissionReviewSuggestions = (submission) => {
  const groups = Array.isArray(submission?.answerGroups) ? submission.answerGroups : []
  return groups
    .filter((group) => group?.reviewSuggestion?.text)
    .map((group) => ({
      label: String(group.label || group.questionNum || '').replace(/[).:]/g, '').trim() || '?',
      text: group.reviewSuggestion.text,
      confidence: group.reviewSuggestion.confidence ?? null,
      source: group.reviewSuggestion.source ?? null
    }))
}

const suggestionMetaText = (suggestion) => {
  const parts = []
  if (suggestion?.confidence != null) {
    parts.push(`${Math.round(Number(suggestion.confidence) * 100)}%`)
  }
  if (suggestion?.source === 'answer-key-context-review') {
    parts.push('context')
  } else if (suggestion?.source === 'ocr-alternative-review') {
    parts.push('OCR')
  }
  return parts.join(' · ')
}

const handleOCRComplete = async (res) => {
  console.log('OCR Results:', res)
  studentCameraProcessing.value = false
  ocrResult.value = res

  if (isStudentMode.value) {
    const currentStudent = activeStudentSession.value?.studentName
    if (!res?.error && currentStudent) {
      await saveSubmission({
        studentName: currentStudent,
        result: res
      })
      await refreshSavedSubmissions()
    }
    return
  }

  // Teacher/Review Mode only: sync to gateway and init annotation layer
  updateBoardState(res)
  nextTick(() => {
    if (annotationCanvas.value && cameraWrapper.value) {
      initAnnotationLayer()
      showAnnotationLayer.value = true
    } else {
      console.warn('Canvas refs not ready, retrying...')
      setTimeout(() => {
        if (annotationCanvas.value && cameraWrapper.value) {
          initAnnotationLayer()
          showAnnotationLayer.value = true
        }
      }, 100)
    }
  })
}

const handleCameraProcessingChange = (isProcessing) => {
  studentCameraProcessing.value = !!isProcessing
}

const handleStudentStageChange = (stage) => {
  studentScanStage.value = stage === 'scanning' || stage === 'grading' ? stage : ''
}

// Runtime test status tracking
let runtimeStatus = {
  openCV: false,
  openCVMat: false,
  openCVWarmup: false,
  ort: false,
  ortInferenceSession: false,
  ortSanity: false
}

// Image is processed in CameraCapture; result comes via @ocr-complete -> handleOCRComplete
const handleImageCaptured = () => {
  // No-op: single pipeline runs in CameraCapture.runRealOCR only
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

const initAnnotationLayer = () => {
  const canvas = annotationCanvas.value
  const ctx = canvas.getContext('2d')
  const wrapper = cameraWrapper.value

  // Resize canvas to match wrapper
  canvas.width = wrapper.offsetWidth
  canvas.height = wrapper.offsetHeight

  // Red pen styling
  ctx.strokeStyle = '#ff453a'
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Store drawing state
  let isDrawing = false
  let lastX = 0
  let lastY = 0

  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    }
  }

  const startDrawing = (e) => {
    e.preventDefault()
    isDrawing = true
    const pos = getPos(e)
    lastX = pos.x
    lastY = pos.y
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    const pos = getPos(e)

    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()

    lastX = pos.x
    lastY = pos.y
  }

  const stopDrawing = () => {
    isDrawing = false
  }

  // Event listeners
  canvas.addEventListener('mousedown', startDrawing)
  canvas.addEventListener('mousemove', draw)
  canvas.addEventListener('mouseup', stopDrawing)
  canvas.addEventListener('mouseleave', stopDrawing)

  canvas.addEventListener('touchstart', startDrawing, { passive: false })
  canvas.addEventListener('touchmove', draw, { passive: false })
  canvas.addEventListener('touchend', stopDrawing)

  console.log('[ScanGrade] Red pen layer initialized')
}

const clearResults = () => {
  testResults.value = []
}

const escapeCsv = (val) => {
  if (val == null) return ''
  const s = String(val)
  if (/[,"\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

const exportResultJson = () => {
  if (!ocrResult.value) return
  const json = JSON.stringify(ocrResult.value, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `scangrade-result-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

const exportResultCsv = () => {
  if (!ocrResult.value) return
  const r = ocrResult.value
  const predictions = r.predictions || []
  const templateId = r.template_id != null ? r.template_id : ''
  const sheetId = r.sheet_instance_id != null ? r.sheet_instance_id : ''
  const header = ['box_index', 'question_num', 'predicted_digit', 'confidence', 'correct', 'template_id', 'sheet_instance_id']
  const rows = predictions.map((p, i) => [
    p.id ?? i,
    p.questionNum ?? '',
    p.digit ?? '',
    p.confidence != null ? p.confidence : '',
    p.correct !== undefined ? (p.correct ? 'true' : 'false') : '',
    templateId,
    sheetId
  ].map(escapeCsv))
  const csv = [header.map(escapeCsv).join(','), ...rows.map(row => row.join(','))].join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `scangrade-result-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
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

    // Load normalized layout (QR-SPEC) for this test path only
    log('Loading normalized layout (QR-SPEC): layouts/sg-10-box-v1.json', 'info')
    const layoutRes = await fetch(publicUrl('layouts/sg-10-box-v1.json'))
    if (!layoutRes.ok) {
      throw new Error('Failed to load normalized layout: ' + layoutRes.status)
    }
    const normalizedLayout = await layoutRes.json()
    log(`✅ Layout loaded: ${normalizedLayout.layout_id}, units=${normalizedLayout.page?.units}`, 'pass')

    // Step 1: Run homography (detect → warp → crop → tensors) with normalized layout
    log('Running homography pipeline with normalized layout...', 'info')
    const homographyStart = performance.now()

    const result = processWorksheet(src, normalizedLayout)

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

      // Check value range (preprocessing: [0, 1] normalized pixels)
      const min = Math.min(...tensor)
      const max = Math.max(...tensor)
      const inRange = min >= -0.01 && max <= 1.01

      if (!inRange) {
        log(`⚠️ Tensor ${i}: Value range [${min.toFixed(2)}, ${max.toFixed(2)}] outside expected [0, 1]`, 'warn')
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
    log(`   └─ Layout: normalized (QR-SPEC) end-to-end`, 'info')
    log(`   └─ Total time: ${homographyTime}ms`, 'info')

  } catch (err) {
    log(`❌ Pipeline test FAILED: ${err.message}`, 'fail')
    console.error(err)
  }

  log('=== Pipeline Smoke Test Complete ===', 'header')
  pipelineTestRunning.value = false
}

const setCaptureViewportLock = (active) => {
  document.documentElement.classList.toggle('scan-grade-capture-lock', active)
  document.body.classList.toggle('scan-grade-capture-lock', active)
}

watch(showStudentCaptureUi, setCaptureViewportLock, { immediate: true })

onMounted(() => {
  loadTeacherData()
})

onUnmounted(() => {
  setCaptureViewportLock(false)
})
</script>

<style scoped>
.scan-grade {
  --teacher-highlighter-rgb: 253, 255, 50;
  max-width: 800px;
  margin: 0 auto;
  color: #202124;
}

.scan-grade--student {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  padding: max(6px, env(safe-area-inset-top, 0px)) 10px max(6px, env(safe-area-inset-bottom, 0px));
}

.scan-grade--capture {
  height: 100vh;
  height: 100dvh;
  min-height: 0;
  overflow: hidden;
}

:global(html.scan-grade-capture-lock),
:global(body.scan-grade-capture-lock),
:global(body.scan-grade-capture-lock #app) {
  width: 100%;
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}

:global(body.scan-grade-capture-lock) {
  position: fixed;
  inset: 0;
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.brand-logo {
  width: 82px;
  height: 82px;
  object-fit: contain;
  margin: 0 auto 8px;
  display: block;
}

.scan-grade--student .header {
  flex: 0 0 auto;
  margin-bottom: 5px;
}

.scan-grade--student .brand-logo {
  width: 44px;
  height: 44px;
  margin-bottom: 1px;
}

.scan-grade--student .header h1 {
  font-size: 20px;
  line-height: 1;
  margin-bottom: 0;
}

.scan-grade--student .build-label {
  margin-top: 2px;
  font-size: 8px;
}

.header h1 {
  font-size: 32px;
  font-weight: 750;
  margin-bottom: 0;
}

.brand-name {
  color: #202124;
  font-weight: 780;
}

.brand-domain {
  color: #6e6e73;
  font-size: 0.92em;
  font-weight: 450;
}

.build-label {
  margin: 4px 0 0;
  color: #8a8a8e;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0;
}

.main {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.student-home,
.student-roster {
  background: white;
  border-radius: 8px;
  padding: 18px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.student-home {
  text-align: center;
  background: transparent;
  box-shadow: none;
  padding: 6px 0 0;
  max-width: 360px;
  width: 100%;
  margin: 0 auto;
}

.student-home-actions,
.student-identity-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.student-home-btn {
  width: 100%;
}

.teacher-link-btn {
  margin-top: 14px;
  background: transparent;
  border: none;
  color: #6e6e73;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.student-roster-title {
  font-size: 20px;
  margin-bottom: 6px;
  text-align: center;
}

.student-selected-label,
.student-roster-help,
.student-roster-empty {
  text-align: center;
  color: #6e6e73;
  font-size: 14px;
  margin-bottom: 12px;
}

.student-roster-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.student-name-chip {
  border: 2px solid #d2d2d7;
  background: #f5f5f7;
  color: #1d1d1f;
  border-radius: 8px;
  padding: 14px 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.student-name-chip--active {
  background: #007aff;
  border-color: #007aff;
  color: white;
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
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;
  text-align: center;
  text-decoration: none;
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007aff;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0068d6;
}

.btn-secondary {
  background: #e8e8ed;
  color: #1d1d1f;
}

.btn-secondary:hover:not(:disabled) {
  background: #d2d2d7;
}

.btn-worksheet {
  background: #ffffff;
  border: 1px solid #d7d2c7;
  color: #202124;
  box-shadow: 0 1px 2px rgba(32, 33, 36, 0.06);
}

.btn-worksheet:hover:not(:disabled) {
  background: #fbfaf7;
  border-color: #c7c0b2;
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

.results .results-error {
  color: #dc3545;
  font-weight: 500;
  margin-bottom: 8px;
}

.results p {
  color: #6e6e73;
  font-size: 14px;
  margin-bottom: 8px;
}

.results .btn-export {
  margin-top: 12px;
  padding: 8px 14px;
  font-size: 14px;
  background: #e8e8ed;
  color: #1d1d1f;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.results .btn-export:hover {
  background: #d2d2d7;
}

.teacher-panel {
  display: grid;
  gap: 20px;
}

.teacher-panel-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.teacher-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.teacher-panel-head .btn {
  flex: 0 0 auto;
  min-width: 150px;
}

.teacher-panel-head h2 {
  font-size: 18px;
  margin-bottom: 4px;
}

.teacher-panel-head p,
.teacher-empty-state,
.review-card-meta,
.review-card-digits {
  color: #6e6e73;
  font-size: 14px;
}

.teacher-roster-input {
  width: 100%;
  resize: vertical;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  padding: 12px;
  font: inherit;
  margin-bottom: 12px;
  min-height: 180px;
}

.teacher-panel-actions {
  display: flex;
  justify-content: flex-end;
}

.teacher-panel-actions .btn {
  flex: 0 0 auto;
  min-width: 150px;
}

.review-stats {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 8px;
  margin: 14px 0;
}

.review-stat {
  appearance: none;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  background: #f8f8fa;
  color: #1d1d1f;
  padding: 10px 8px;
  text-align: left;
  cursor: pointer;
}

.review-stat strong {
  display: block;
  font-size: 22px;
  line-height: 1;
  margin-bottom: 4px;
}

.review-stat span {
  display: block;
  color: #6e6e73;
  font-size: 12px;
  font-weight: 700;
}

.review-stat.active {
  border-color: #007aff;
  background: #eef6ff;
}

.review-stat--passive {
  cursor: default;
  background: #fff9e6;
  border-color: #f4c542;
}

.review-queue {
  display: grid;
  gap: 12px;
}

.review-group {
  display: grid;
  gap: 10px;
}

.review-group-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.review-group-head h3 {
  font-size: 16px;
  margin-bottom: 2px;
}

.review-group-head p {
  color: #6e6e73;
  font-size: 13px;
}

.review-card {
  border: 1px solid #e5e5ea;
  border-left-width: 6px;
  border-radius: 8px;
  padding: 14px;
  background: #fafafa;
}

.review-card--ready {
  border-left-color: #34c759;
}

.review-card--review {
  border-left-color: #ff9f0a;
}

.review-card--done {
  border-left-color: #8e8e93;
  background: #f4f4f5;
}

.review-card-row,
.review-card-meta {
  display: flex;
  gap: 12px;
  justify-content: space-between;
  flex-wrap: wrap;
}

.review-card-row {
  margin-bottom: 6px;
}

.review-status {
  align-self: flex-start;
  padding: 4px 8px;
  border-radius: 999px;
  background: #eef2f7;
  color: #3a3a3c;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0;
}

.review-status--review {
  background: #fff3cd;
  color: #9a6700;
}

.review-status--ready {
  background: #e8f5e9;
  color: #137333;
}

.review-status--done {
  background: #f1f1f4;
  color: #636366;
}

.review-card-digits {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.review-card-digits > span:first-child {
  font-weight: 700;
  color: #3a3a3c;
}

.review-digit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 28px;
  padding: 0 7px;
  border-radius: 999px;
  border: 1px solid #d2d2d7;
  background: white;
  color: #1d1d1f;
  font-weight: 700;
}

.review-digit--correct {
  border-color: #34c759;
  background: #e8f5e9;
}

.review-digit--incorrect {
  border-color: #ff453a;
  background: #ffebee;
}

.review-card-suggestions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 8px;
}

.review-card-suggestions > span:first-child {
  font-weight: 700;
  color: #3a3a3c;
}

.review-suggestion-chip {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid #f4c542;
  background: #fff9e6;
  color: #5f4300;
  font-size: 13px;
  font-weight: 700;
}

.review-score {
  display: inline-flex;
  width: fit-content;
  margin-bottom: 8px;
  padding: 4px 8px;
  border-radius: 8px;
  background: white;
  color: #1d1d1f;
  border: 1px solid #d2d2d7;
  font-size: 13px;
  font-weight: 700;
}

.review-card-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 12px;
}

.review-action-btn {
  margin-top: 0;
}

.review-action-btn--danger {
  background: #ffe5e5;
  color: #b42318;
}

/* Camera wrapper with annotation overlay */
.camera-wrapper {
  position: relative;
  display: inline-block;
}

.student-scan-bar {
  display: grid;
  grid-template-columns: minmax(64px, 1fr) auto minmax(76px, 1fr);
  align-items: center;
  gap: 10px;
  width: min(100%, calc(72vh * 8.5 / 11));
  max-width: min(100%, calc(72vh * 8.5 / 11));
  flex: 0 0 auto;
  margin: 7px auto 0;
  padding: 8px;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
}

.student-scan-bar--has-result:not(.student-scan-bar--grading) {
  grid-template-columns: minmax(50px, 0.8fr) minmax(58px, 1fr) 40px minmax(82px, 1.2fr);
  gap: 5px;
}

.student-scan-bar--grading {
  grid-template-columns: 1fr;
}

.student-scan-grading {
  grid-column: 1 / -1;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #202124;
}

.student-scan-grading-word {
  position: relative;
  isolation: isolate;
  padding: 6px 13px 7px;
  color: #202124;
  font-size: 18px;
  line-height: 1;
  font-weight: 560;
}

.student-scan-grading-word::before {
  content: "";
  position: absolute;
  z-index: -1;
  left: -7px;
  right: -7px;
  top: 50%;
  height: 1.18em;
  border-radius: 999px 80% 999px 72%;
  background: rgba(var(--teacher-highlighter-rgb), 0.9);
  mix-blend-mode: multiply;
  transform: translateY(-46%) rotate(-2deg) scaleX(0.18);
  transform-origin: left center;
  animation: scan-grading-word-highlight 1.16s ease-in-out infinite;
}

@keyframes scan-grading-word-highlight {
  0% {
    opacity: 0;
    transform: translate(-8px, -46%) rotate(-2deg) scaleX(0.08) skewX(-10deg);
  }
  42% {
    opacity: 0.96;
    transform: translate(0, -46%) rotate(-2deg) scaleX(1) skewX(-10deg);
  }
  100% {
    opacity: 0;
    transform: translate(10px, -46%) rotate(-2deg) scaleX(0.86) skewX(-10deg);
  }
}

.student-scan-identity {
  justify-self: center;
  min-width: 64px;
  min-height: 36px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  text-align: center;
  cursor: pointer;
}

.student-scan-identity strong {
  display: block;
  color: #1d1d1f;
  font-size: 15px;
  line-height: 1.1;
}

.student-scan-identity:hover,
.student-scan-identity:focus-visible {
  background: #f5f7f6;
  outline: none;
}

.student-scan-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-end;
  min-width: 76px;
}

.student-recognition-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: #245aa4;
  font: inherit;
  font-size: 25px;
  line-height: 1;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.student-recognition-toggle:hover,
.student-recognition-toggle:focus-visible,
.student-recognition-toggle--active {
  border-color: rgba(36, 90, 164, 0.22);
  background: rgba(36, 90, 164, 0.08);
  outline: none;
}

.student-scan-link {
  min-height: 36px;
  border: 1px solid transparent;
  background: transparent;
  color: #555b5f;
  font: inherit;
  font-size: 13px;
  font-weight: 620;
  padding: 0 8px;
  border-radius: 8px;
  cursor: pointer;
}

.student-scan-link:hover,
.student-scan-link:focus-visible {
  background: #f5f7f6;
  color: #202124;
  outline: none;
}

.student-scan-home {
  justify-self: start;
}

.student-scan-reset {
  min-height: 40px;
  padding: 0 18px;
  border-radius: 8px;
  background: #126c39;
  color: #fff;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(18, 108, 57, 0.24);
}

.student-scan-reset:hover,
.student-scan-reset:focus-visible {
  background: #0f5d31;
  color: #fff;
}

/* Student Mode: dedicated layout — stage takes most of the screen */
.main--student {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-bottom: 20px;
}

.scan-grade--capture .main--student {
  overflow: hidden;
  padding-bottom: 0;
}

.main--student .camera-wrapper--student {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  padding: 0;
  overflow: hidden;
}

@media (max-width: 640px) {
  .scan-grade--student {
    padding: max(6px, env(safe-area-inset-top, 0px)) 10px max(6px, env(safe-area-inset-bottom, 0px));
  }

  .scan-grade--student .header {
    margin-bottom: 5px;
  }

  .scan-grade--student .brand-logo {
    width: 44px;
    height: 44px;
    margin-bottom: 1px;
  }

  .scan-grade--student .header h1 {
    font-size: 20px;
  }

  .build-label {
    margin-top: 2px;
    font-size: 9px;
  }

  .main {
    gap: 12px;
  }

  .student-home {
    padding-top: 0;
  }

  .student-home-actions,
  .student-identity-actions {
    gap: 8px;
  }

  .student-home-btn {
    padding-top: 12px;
    padding-bottom: 12px;
  }

  .teacher-link-btn {
    margin-top: 10px;
  }

  .student-scan-bar {
    margin-top: 6px;
    padding: 7px 8px;
  }

  .review-stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .teacher-panel-head {
    flex-direction: column;
  }
}

.annotation-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  cursor: crosshair;
  z-index: 10;
}
</style>
