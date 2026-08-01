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

      <div
        v-else-if="displayedResultImage"
        ref="capturedImageWrapRef"
        class="captured-image-wrap"
        :class="{ 'captured-image-wrap--completion-glow': completionStampEffectActive }"
        @click="handleCorrectionOutsideClick"
      >
        <img
          ref="displayedResultImageRef"
          :src="displayedResultImage"
          class="captured-image"
          alt="Captured worksheet"
        >
        <svg
          v-if="scanningDateStampSpec"
          class="scanning-date-layer"
          :viewBox="`0 0 ${scanningAnnotationPreview.width} ${scanningAnnotationPreview.height}`"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <clipPath id="completion-date-stamp-clip">
              <rect
                :x="scanningDateStampSpec.rect.x"
                :y="scanningDateStampSpec.rect.y"
                :width="scanningDateStampSpec.rect.w"
                :height="scanningDateStampSpec.rect.h"
              />
            </clipPath>
          </defs>
          <image
            class="scanning-date-stamp"
            x="0"
            y="0"
            :width="scanningAnnotationPreview.width"
            :height="scanningAnnotationPreview.height"
            preserveAspectRatio="none"
            :href="progressiveAnnotatedImage"
            clip-path="url(#completion-date-stamp-clip)"
          />
        </svg>
        <svg
          v-if="progressiveMarkingActive && progressiveAnnotatedImage"
          class="progressive-marking-layer"
          :viewBox="`0 0 ${progressiveMarkingDimensions.width} ${progressiveMarkingDimensions.height}`"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          <defs>
            <mask
              v-for="step in maskedProgressiveMarkingSteps"
              :id="`progressive-mask-${step.key}`"
              :key="`mask-${step.key}`"
              v-progressive-stroke-sequence
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              :width="progressiveMarkingDimensions.width"
              :height="progressiveMarkingDimensions.height"
            >
              <path
                v-for="(stroke, strokeIndex) in step.strokes"
                :key="`${step.key}-stroke-${strokeIndex}`"
                class="progressive-marking-stroke"
                :d="stroke.d"
                fill="none"
                stroke="white"
                :stroke-width="stroke.width || step.strokeWidth"
                stroke-linecap="round"
                stroke-linejoin="round"
                :style="{
                  '--progressive-stroke-duration': `${stroke.durationMs}ms`,
                  '--progressive-stroke-delay': `${stroke.delayMs}ms`,
                }"
              />
            </mask>
          </defs>
          <image
            v-for="step in maskedProgressiveMarkingSteps"
            :key="step.key"
            class="progressive-marking-reveal"
            x="0"
            y="0"
            :width="progressiveMarkingDimensions.width"
            :height="progressiveMarkingDimensions.height"
            preserveAspectRatio="none"
            :href="progressiveAnnotatedImage"
            :mask="`url(#progressive-mask-${step.key})`"
          />
          <g
            v-for="step in directIncorrectProgressiveMarkingSteps"
            :key="`direct-${step.key}`"
            v-progressive-stroke-sequence
            class="progressive-direct-incorrect-ink"
          >
            <path
              v-for="(stroke, strokeIndex) in step.strokes"
              :key="`${step.key}-direct-stroke-${strokeIndex}`"
              class="progressive-marking-stroke"
              :d="stroke.d"
              fill="none"
              :stroke="TEACHER_RED_INK"
              :stroke-opacity="TEACHER_RED_INK_OPACITY"
              :stroke-width="step.inkWidth"
              stroke-linecap="round"
              stroke-linejoin="round"
              :style="{
                '--progressive-stroke-duration': `${stroke.durationMs}ms`,
                '--progressive-stroke-delay': `${stroke.delayMs}ms`,
              }"
            />
          </g>
          <g
            v-if="progressiveScoreRevealed && progressiveScoreStep"
            class="progressive-score-ink"
          >
            <path
              v-for="(stroke, strokeIndex) in progressiveScoreStep.inkStrokes"
              :key="`score-ink-${strokeIndex}`"
              v-progressive-stroke
              class="progressive-marking-stroke"
              :d="stroke.d"
              fill="none"
              :stroke="progressiveScoreStep.color"
              :stroke-opacity="stroke.opacity"
              :stroke-width="stroke.width"
              stroke-linecap="round"
              stroke-linejoin="round"
              :style="{
                '--progressive-stroke-duration': `${stroke.durationMs}ms`,
                '--progressive-stroke-delay': `${stroke.delayMs}ms`,
              }"
            />
          </g>
        </svg>
        <div
          v-if="showRecognitionOverlay && recognitionOverlayItems.length"
          class="recognition-read-overlay"
          aria-label="What ScanGrade saw"
        >
          <span
            v-for="item in recognitionOverlayItems"
            :key="item.key"
            class="recognition-read-label"
            :style="item.style"
          >{{ item.text }}</span>
        </div>
        <button
          v-for="region in correctionRegions"
          :key="region.key"
          type="button"
          class="annotation-hotspot"
          :class="{ 'annotation-hotspot--active': activeCorrectionQuestion?.questionNum === region.questionNum }"
          :style="correctionHotspotStyle(region)"
          :data-focus-left-pct="region.focusLeftPct ?? region.leftPct"
          :data-focus-top-pct="region.focusTopPct ?? region.topPct"
          :data-focus-width-pct="region.focusWidthPct ?? region.widthPct"
          :data-focus-height-pct="region.focusHeightPct ?? region.heightPct"
          :aria-label="`Fix ${region.label} answer`"
          @click="openCorrection(region)"
        >
          <span>{{ region.label }}</span>
        </button>
        <img
          v-if="activeCorrectionInkPreviewUrl"
          :src="activeCorrectionInkPreviewUrl"
          class="on-sheet-correction-ink"
          alt=""
          aria-hidden="true"
        >
        <div
          v-if="activeCorrectionQuestion"
          class="on-sheet-correction-focus"
          :class="{
            'on-sheet-correction-focus--entered': activeCorrectionEntryComplete,
            'on-sheet-correction-focus--committing': correctionKeypadSubmitting
          }"
          :style="activeCorrectionFocusStyle"
          aria-live="polite"
        ></div>
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

    <div
      v-if="studentMode && activeCorrectionQuestion"
      class="correction-keypad"
      role="group"
      :aria-label="activeCorrectionInputLabel"
      @click.stop
    >
      <button
        v-for="key in correctionKeypadKeys"
        :key="key"
        type="button"
        class="correction-keypad-key"
        :class="{
          'correction-keypad-key--blank': key === '_',
          'correction-keypad-key--backspace': key === 'backspace'
        }"
        :aria-label="key === '_' ? 'Blank' : key === 'backspace' ? 'Delete' : `Enter ${key}`"
        :disabled="correctionKeypadSubmitting"
        @click="pressCorrectionKey(key)"
      >
        <span v-if="key === 'backspace'" aria-hidden="true">⌫</span>
        <span v-else>{{ key }}</span>
      </button>
      <button
        v-if="showLocalFirstStrongFallback"
        type="button"
        class="correction-keypad-check-again"
        :disabled="localFirstStrongLoading || correctionKeypadSubmitting"
        @click="requestStrongChoicesForActiveQuestion"
      >
        {{ localFirstStrongButtonLabel }}
      </button>
      <p v-if="localFirstStrongMessage" class="correction-keypad-message">
        {{ localFirstStrongMessage }}
      </p>
      <p v-if="correctionError" class="correction-keypad-error">{{ correctionError }}</p>
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
        v-if="streamActive && !studentMode"
        @click="capturePhoto"
        class="btn btn-primary"
        :disabled="!captureEnabled || !cameraReady"
      >
        {{ studentMode ? (cameraReady ? 'Scan now' : 'Camera warming up...') : (cameraReady ? 'Capture' : 'Camera warming up...') }}
      </button>

      <button
        v-if="capturedImage && !studentMode"
        @click="retake"
        class="btn btn-secondary"
      >
        Retake
      </button>

      <label
        v-if="showFilePicker && !studentMode"
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

    <div v-if="processing && !studentMode" class="processing">
      <div class="marking-loader" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <p>{{ studentMode ? 'Grading' : 'Processing with real OCR...' }}</p>
    </div>

    <!-- Debug scans stay in the same fixed worksheet view as public scans.
         The bottom app bar owns manual export; this compact status is the only
         extra debug UI shown over the page. -->
    <p
      v-if="studentMode && liveOcrDebugExportEnabled && debugUploadConfig.autoUpload && ['uploading', 'saved', 'failed'].includes(debugAutoUploadState)"
      class="debug-auto-upload-toast"
      :class="`debug-auto-upload-status--${debugAutoUploadState}`"
      role="status"
      aria-live="polite"
    >
      {{ debugAutoUploadStatus }}
    </p>

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
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { processWorksheet, detectCornerMarkers, warpToTemplate } from '../homography.js'
import {
  initDigitModel,
  recognizeDigits,
  recognizeDigitsRobust,
  recognizeDigitsWithPreprocessVariants,
  getDigitModelInfo,
  DIGIT_SELECTION_POLICY_VERSION
} from '../ocr-pipeline.js'
import { decodeQrFromCanvas, decodeQrFromPageUrl } from '../qr-decode.js'
import { publicUrl } from '../public-paths.js'
import {
  buildHybridAnswerDecision,
  crossFrameConsensus,
  retainTopCaptureCandidates,
} from '../hybrid-recognition.js'
import { requestKeyBlindWholeAnswers } from '../hybrid-review-client.js'
import { extractContinuousAnswerZones } from '../v3/answer-zones.js'
import { geometryRescuePlan } from '../v3/geometry-rescue.js'
import { maxHandwrittenDigitsForGroup, optionalDigitIndicesForGroup } from '../v3/layout-contract.js'
import { V3_POLICY_VERSION } from '../v3/decision-policy.js'
import { requestCompactWholeAnswers } from '../v3/compact-client.js'
import {
  cellsForReviewText,
  compactSuggestionsByQuestion,
  localFirstReviewState,
} from '../v3/local-first-review.js'
import { buildV3ShadowDecisions } from '../v3/shadow-evaluation.js'
import { startAsyncV3Shadow } from '../v3/async-shadow-review.js'
import {
  applyConfidenceSafetyVetoes,
  confidenceSafetyCandidateQuestionNumbers,
  confidenceClearanceVetoes,
  confidenceSafetyVetoes,
} from '../v3/confidence-safety.js'
import {
  displayedYellowQuestionNumbers,
  filterItemsToYellowQuestions,
  nextYellowReviewGroup,
  reviewSuggestionDisplayEligible,
  wholeAnswerReviewModeEligible,
  yellowQuestionNumbers,
} from '../v3/review-suggestion-display.js'
import {
  consensusPromotionDecision,
  consensusReviewVetoQuestionNums,
  coreCropReviewEligibleQuestionNums,
} from '../v3/consensus-promotion.js'
import { detectAnswerAmbiguity } from '../v3/ambiguity-detector.js'
import { applyConsensusPromotionsToPredictions } from '../v3/consensus-application.js'
import { consensusFeatureEnabled, consensusModelEndpoint } from '../v3/production-runtime.js'
import { decodeFrameDataUrlInWorker, frameDecodeWorkerSupported } from '../v3/frame-preparation.js'
import { annotationSeedForResult } from '../v3/annotation-seed.js'
import {
  annotationLayoutReference,
  annotationRectForCrop,
  transformAnnotationCrop,
} from '../v3/annotation-geometry.js'
import { progressiveMarkingSteps } from '../v3/progressive-marking.js'
import {
  progressivePendingQuestionNumbers,
  progressiveVerificationSchedule,
} from '../v3/progressive-verification-scheduler.js'
import { fluorescentHighlighterGeometry } from '../v3/highlighter-stroke.js'
import { dateStampSpecForLayout, declaredDateStampRect } from '../v3/date-stamp-placement.js'
import { recognitionOverlayItemsForAnswers } from '../v3/recognition-overlay.js'
import { selectFlexibleOneDigitBlankSlots } from '../v3/flexible-one-digit-blank.js'
import { acceptedResponsesForSlotContract } from '../v3/answer-placement-contract.js'
import {
  manualCorrectionClearRect,
  manualCorrectionDisplayCells,
  shouldAutoApplySingleDigitCorrection,
} from '../v3/manual-correction-render.js'
import { drawManualCorrectionInk } from '../v3/manual-correction-ink.js'
import {
  STUDENT_AUTO_CAPTURE_FINAL_FOCUS_MIN,
  STUDENT_AUTO_CAPTURE_STABILITY_HOLD_MS,
  STUDENT_AUTO_CAPTURE_TRIGGER_FOCUS_MIN,
  STUDENT_MANUAL_CAPTURE_FOCUS_MIN,
  studentCaptureFocusDecision,
  studentSheetAppearanceDecision,
} from '../v3/student-capture-policy.js'
import { shouldClearTransientCameraReadinessError } from '../v3/camera-readiness-state.js'
import {
  buildTeacherScoreInkPlan,
  buildTeacherScoreStrokePlan,
  teacherScorePlacement,
} from '../v3/teacher-score-plan.js'
import {
  TEACHER_GREEN_INK,
  TEACHER_GREEN_PEN_PASSES,
  TEACHER_RED_INK,
  TEACHER_RED_INK_OPACITY,
} from '../v3/teacher-ink-style.js'
import { copyDebugJson, exportDebugJson } from '../v3/debug-json-export.js'
import {
  startMeasuredProgressiveStroke,
  startMeasuredProgressiveStrokeSequence,
} from '../v3/progressive-svg-stroke.js'
import {
  manualCorrectionContract,
} from '../v3/manual-correction-contract.js'
import {
  CORRECTION_KEYPAD_KEYS,
  correctionKeypadEntry,
  correctionKeypadEntryComplete,
  correctionPendingSlotIndex,
  correctionPreviewCells,
} from '../v3/correction-keypad.js'
import {
  browserLocalStrongShadowConfig,
  requestBrowserLocalStrongPersistentShadow,
  requestBrowserLocalStrongShadow,
} from '../v3/trocr-small-shadow-client.js'
import { browserLocalCandidateRuntimeConfig } from '../v3/browser-local-candidate-runtime.js'
import { browserLocalStrongTier } from '../v3/browser-local-strong-capability.js'
import { browserLocalCandidateDecision } from '../v3/browser-local-candidate.js'
import { applyBrowserLocalCandidateToPredictions } from '../v3/browser-local-candidate-application.js'
import { browserLocalCoPrimaryEvidencePlan } from '../v3/browser-local-co-primary-planner.js'
import { browserLocalCoPrimaryCandidate7Decision } from '../v3/browser-local-co-primary-candidate7.js'
import { browserLocalThreeFrameConsensus } from '../v3/browser-local-frame-consensus.js'
import { browserUniformAnswerViews } from '../v3/uniform-answer-view-browser.js'
import {
  applyAcceptedAnswerSafetyVetoes,
  acceptedAnswerSafetyDecision,
  acceptedAnswerSafetyRoute,
} from '../v3/accepted-answer-safety.js'
import {
  requestWholeSlotScout,
  warmWholeSlotScout,
  wholeSlotScoutShadowConfig,
} from '../v3/whole-slot-scout-client.js'

const props = defineProps({
  studentMode: { type: Boolean, default: false },
  captureEnabled: { type: Boolean, default: true },
  captureBlockedReason: { type: String, default: '' },
  autoStart: { type: Boolean, default: false },
  showRecognitionOverlay: { type: Boolean, default: false }
})
const DEFAULT_LAYOUT_URL = publicUrl('layouts/sg-10-box-v1.json')
const MISSING_QR_FALLBACK_SEED_LAYOUT_ID = 'g2-mixed-within-50-v1'
const KNOWN_TITLE_FALLBACK_LAYOUTS = Object.freeze([
  {
    layoutId: 'sg-g1-lw-01-add-1digit',
    title: 'Addition: Single-Digit Answers',
    humanCode: 'SG-G1-LW-01'
  },
  {
    layoutId: 'sg-g1-lw-02-add-2digit',
    title: 'Addition: Two-Digit Answers',
    humanCode: 'SG-G1-LW-02'
  },
  {
    layoutId: 'sg-g1-lw-03-sub-1digit',
    title: 'Subtraction: Single-Digit Answers',
    humanCode: 'SG-G1-LW-03'
  },
  {
    layoutId: 'sg-g1-lw-04-sub-2digit',
    title: 'Subtraction: Two-Digit Answers',
    humanCode: 'SG-G1-LW-04'
  },
  {
    layoutId: 'sg-g1-lw-05-mixed-20',
    title: 'Mixed Addition and Subtraction',
    humanCode: 'SG-G1-LW-05'
  },
  {
    layoutId: 'sg-g1-lw-06-ten-frames',
    title: 'Ten Frames to 20',
    humanCode: 'SG-G1-LW-06'
  },
  {
    layoutId: 'sg-g1-lw-07-dot-collections',
    title: 'Dot Collections to 20',
    humanCode: 'SG-G1-LW-07'
  },
  {
    layoutId: 'sg-g1-lw-08-number-bonds',
    title: 'Number Bonds to 20',
    humanCode: 'SG-G1-LW-08'
  },
  {
    layoutId: 'sg-g1-lw-09-number-patterns',
    title: 'Number Patterns',
    humanCode: 'SG-G1-LW-09'
  },
  {
    layoutId: 'sg-g1-lw-10-place-value-50',
    title: 'Place Value and Number Sense',
    humanCode: 'SG-G1-LW-10'
  },
  {
    layoutId: 'g2-add-within-20-v1',
    title: 'Addition Within 20',
    humanCode: 'SG-G2-A-001',
    checksum: 'f0ce9bfe8e6b'
  },
  {
    layoutId: 'g2-sub-within-20-v1',
    title: 'Subtraction Within 20',
    humanCode: 'SG-G2-B-001',
    checksum: '09042d877797'
  },
  {
    layoutId: 'g2-mixed-within-50-v1',
    title: 'Mixed Within 50',
    humanCode: 'SG-G2-C-001',
    checksum: 'f4ccdad5079b'
  }
])
const ROBUST_RETRY_CONFIDENCE_THRESHOLD = 0.86
const ROBUST_RETRY_MARGIN_THRESHOLD = 0.18
const LOW_CONFIDENCE_THRESHOLD = 0.78
const LOW_MARGIN_THRESHOLD = 0.08
const AUTO_CHECK_CONFIDENCE_THRESHOLD = 0.45
const AUTO_CHECK_MARGIN_THRESHOLD = 0.06
const AUTO_X_CONFIDENCE_THRESHOLD = LOW_CONFIDENCE_THRESHOLD
const AUTO_X_MARGIN_THRESHOLD = LOW_MARGIN_THRESHOLD
const TWO_DIGIT_AUTO_X_CONFIDENCE_THRESHOLD = 0.88
const TWO_DIGIT_AUTO_X_MARGIN_THRESHOLD = 0.20
const TWO_DIGIT_RIGHT_SLOT_AUTO_X_CONFIDENCE_THRESHOLD = 0.92
const TWO_DIGIT_RIGHT_SLOT_AUTO_X_MARGIN_THRESHOLD = 0.28
const TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_CONFIDENCE_THRESHOLD = 0.92
const TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_MARGIN_THRESHOLD = 0.50
const TWO_DIGIT_AUTO_X_CALIBRATED_CONFIDENCE_THRESHOLD = 0.92
const TWO_DIGIT_AUTO_X_CALIBRATED_MARGIN_THRESHOLD = 0.50
const DIGIT_ENGINE_OPERATION_TIMEOUT_MS = 30000
const OCR_CONFIDENCE_CLEAR_REASONS = Object.freeze(new Set([
  'box-safe-default',
  'left-slot-low-three-rescue',
  'left-slot-open-three-shape-rescue',
  'left-slot-sparse-four-shape-from-one-rescue',
  'preprocess-weighted-vote',
  'right-slot-center-low-agreement-rescue',
  'right-slot-cleanup-four-rescue',
  'right-slot-eight-shape-from-seven-rescue',
  'right-slot-expected-edge-default',
  'right-slot-five-shape-from-three-rescue',
  'right-slot-gentle-seven-rescue',
  'right-slot-preprocess-disagreement',
  'right-slot-raw-border-high-rescue',
  'right-slot-runnerup-four-shape-from-one-rescue',
  'right-slot-two-shape-from-nine-rescue',
  'right-slot-two-shape-from-one-rescue',
  'right-slot-two-shape-from-seven-rescue',
  'right-slot-wide-raw-agreement-rescue'
]))

/** Golden digits for the primary printed test worksheet (index = box id 0–9 = questions 1–10). */
const DEBUG_REAL_WORKSHEET_EXPECTED = Object.freeze([8, 4, 1, 9, 2, 7, 0, 5, 3, 6])

// Auto-capture: layered page-present gate (variance pre-filter + contour) + stability hold
const STABILITY_HOLD_MS = 1500
const STABILITY_HOLD_MS_PORTRAIT = STUDENT_AUTO_CAPTURE_STABILITY_HOLD_MS
const CHECK_INTERVAL_MS = 300
const SAMPLE_W = 48
const SAMPLE_H = 36
const SAD_THRESHOLD = 48 * 36 * 20
// Pre-filter: reject obviously blank (variance alone not sufficient for page)
const VARIANCE_PREFILTER_MIN = 50
const VARIANCE_PREFILTER_MIN_PORTRAIT = 8
const FOCUS_SCORE_MIN_PORTRAIT = STUDENT_MANUAL_CAPTURE_FOCUS_MIN
const AUTO_GATE_FOCUS_SCORE_MIN_PORTRAIT = STUDENT_AUTO_CAPTURE_TRIGGER_FOCUS_MIN
const AUTO_CAPTURE_FINAL_FOCUS_SCORE_MIN_PORTRAIT = STUDENT_AUTO_CAPTURE_FINAL_FOCUS_MIN
const AUTO_CAPTURE_BURST_FRAMES = 8
const AUTO_CAPTURE_BURST_DELAY_MS = 110
const HYBRID_BURST_EVIDENCE_FRAMES = 3
const HYBRID_BURST_JPEG_QUALITY = 0.92
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

function hasDebugQueryFlag(...names) {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return names.some((name) => {
    const value = params.get(name)
    return value === '1' || value === 'true' || value === 'yes'
  })
}

function prospectiveEvaluationMetadata() {
  if (typeof window === 'undefined') return {}
  const params = new URLSearchParams(window.location.search)
  const clean = (name, pattern, maxLength = 64) => {
    const value = String(params.get(name) || '').trim()
    return value && value.length <= maxLength && pattern.test(value) ? value : null
  }
  return {
    packetId: clean('packetId', /^[A-Za-z0-9_-]+$/, 24),
    captureRole: clean('captureRole', /^(development-[123]|locked-test)$/, 24),
    capturePlanSeed: clean('capturePlanSeed', /^[a-f0-9]+$/i, 64),
  }
}

function newScanSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `scan-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function newCaptureGateTelemetry() {
  return {
    startedAt: new Date().toISOString(),
    attempts: 0,
    accepted: 0,
    rejectionCounts: {},
    recentRejections: [],
  }
}

function recordCaptureGate(reason, source, details = {}) {
  captureGateTelemetry.attempts += 1
  if (reason === 'accepted') {
    captureGateTelemetry.accepted += 1
    captureGateTelemetry.completedAt = new Date().toISOString()
    captureGateTelemetry.elapsedMs = Math.max(
      0,
      Date.now() - Date.parse(captureGateTelemetry.startedAt)
    )
    return
  }
  captureGateTelemetry.rejectionCounts[reason] = (captureGateTelemetry.rejectionCounts[reason] || 0) + 1
  captureGateTelemetry.recentRejections.push({
    at: new Date().toISOString(),
    reason,
    source,
    ...details,
  })
  captureGateTelemetry.recentRejections = captureGateTelemetry.recentRejections.slice(-10)
}

function captureGateSnapshot() {
  return JSON.parse(JSON.stringify(captureGateTelemetry))
}

const DEBUG_UPLOAD_URL_KEY = 'scangrade.debugUploadUrl.v1'
const DEBUG_UPLOAD_TOKEN_KEY = 'scangrade.debugUploadToken.v1'
const DEBUG_AUTO_UPLOAD_KEY = 'scangrade.debugAutoUpload.v1'
const REVIEW_ACCESS_TOKEN_SESSION_KEY = 'scangrade.reviewAccessToken.v1'
const LEGACY_PRIVATE_DEBUG_UPLOAD_URL = 'https://hobbes-mac-mini.tail9a3379.ts.net/mission-control/api/debug-scans'
const PUBLIC_DEBUG_UPLOAD_URL = 'https://hobbes-mac-mini.tail9a3379.ts.net:8443/'
const DEBUG_UPLOAD_TIMEOUT_MS = 75_000

function parseDebugBoolean(value) {
  if (value == null) return null
  const normalized = String(value).trim().toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  return null
}

function getDebugQueryParam(params, ...names) {
  for (const name of names) {
    if (params.has(name)) return params.get(name)
  }
  return null
}

function safeStorageGet(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key, value) {
  try {
    if (value == null || value === '') {
      window.localStorage.removeItem(key)
    } else {
      window.localStorage.setItem(key, value)
    }
  } catch {
    // Debug upload is a convenience path; blocked storage should not affect scanning.
  }
}

function optionalReviewAccessToken() {
  if (typeof window === 'undefined') return ''
  try {
    const value = String(window.sessionStorage.getItem(REVIEW_ACCESS_TOKEN_SESSION_KEY) || '').trim()
    return value.length <= 4096 ? value : ''
  } catch {
    return ''
  }
}

function migrateDebugUploadUrl(value) {
  const configured = String(value || '').trim()
  if (!configured) return ''
  try {
    const url = new URL(configured)
    const legacyUrl = new URL(LEGACY_PRIVATE_DEBUG_UPLOAD_URL)
    if (url.origin === legacyUrl.origin && url.pathname.replace(/\/$/, '') === legacyUrl.pathname) {
      return PUBLIC_DEBUG_UPLOAD_URL
    }
  } catch {
    // Preserve an unknown value so the visible upload error remains actionable.
  }
  return configured
}

function initDebugUploadConfig() {
  const empty = { url: '', token: '', autoUpload: false }
  if (typeof window === 'undefined') return empty

  const params = new URLSearchParams(window.location.search)
  const fragmentParams = new URLSearchParams(String(window.location.hash || '').replace(/^#/, ''))
  for (const name of ['debugUploadUrl', 'debugUploadEndpoint', 'debugUploadToken', 'debugToken', 'debugAutoUpload', 'debugUpload']) {
    if (!params.has(name) && fragmentParams.has(name)) params.set(name, fragmentParams.get(name))
  }
  const hasUrlParam = params.has('debugUploadUrl') || params.has('debugUploadEndpoint')
  const hasTokenParam = params.has('debugUploadToken') || params.has('debugToken')
  const hasAutoParam = params.has('debugAutoUpload') || params.has('debugUpload')
  const queryUrl = migrateDebugUploadUrl(getDebugQueryParam(params, 'debugUploadUrl', 'debugUploadEndpoint'))
  const queryToken = getDebugQueryParam(params, 'debugUploadToken', 'debugToken')
  const queryAuto = parseDebugBoolean(getDebugQueryParam(params, 'debugAutoUpload', 'debugUpload'))

  if (hasUrlParam) safeStorageSet(DEBUG_UPLOAD_URL_KEY, queryUrl || '')
  if (hasTokenParam) safeStorageSet(DEBUG_UPLOAD_TOKEN_KEY, queryToken || '')
  if (hasAutoParam) safeStorageSet(DEBUG_AUTO_UPLOAD_KEY, queryAuto === true ? '1' : '0')
  if (hasUrlParam && !hasAutoParam && queryUrl) safeStorageSet(DEBUG_AUTO_UPLOAD_KEY, '1')

  // A setup link may carry the private receiver token in its URL fragment.
  // Fragments never reach Cloudflare; remove it immediately after saving the
  // settings locally so it also disappears from the visible address bar.
  if (fragmentParams.has('debugUploadToken') || fragmentParams.has('debugToken')) {
    try {
      const cleanUrl = new URL(window.location.href)
      cleanUrl.hash = ''
      window.history.replaceState({}, '', `${cleanUrl.pathname}${cleanUrl.search}`)
    } catch {
      // The stored settings still work if an embedded browser blocks history.
    }
  }

  const storedUrl = migrateDebugUploadUrl(safeStorageGet(DEBUG_UPLOAD_URL_KEY))
  if (storedUrl && storedUrl !== safeStorageGet(DEBUG_UPLOAD_URL_KEY)) {
    safeStorageSet(DEBUG_UPLOAD_URL_KEY, storedUrl)
  }
  const storedAuto = parseDebugBoolean(safeStorageGet(DEBUG_AUTO_UPLOAD_KEY))
  return {
    url: (hasUrlParam ? queryUrl : storedUrl) || '',
    token: (hasTokenParam ? queryToken : safeStorageGet(DEBUG_UPLOAD_TOKEN_KEY)) || '',
    autoUpload: queryAuto ?? storedAuto ?? (hasUrlParam && !!queryUrl)
  }
}

function preprocessSelectionReason(result) {
  return result?.preprocessReviewReason || result?.robustOverride || null
}

function preprocessReasonMatches(result, reason) {
  return result?.preprocessReviewReason === reason || result?.robustOverride === reason
}

function isReviewBoundOcrRescueReason(reason) {
  if (typeof reason !== 'string' || !reason) return false
  return reason.includes('rescue') || reason === 'box-safe-low-margin-override'
}

function preprocessVariantByName(result, name) {
  const variants = Array.isArray(result?.preprocessVariants) ? result.preprocessVariants : []
  return variants.find((variant) => variant?.name === name) || null
}

function preprocessTopGap(result) {
  const topK = Array.isArray(result?.topK) ? result.topK : []
  return topK.length >= 2
    ? (Number(topK[0]?.confidence) || 0) - (Number(topK[1]?.confidence) || 0)
    : 1
}

function tensorVariantByName(proc, name) {
  const variants = Array.isArray(proc?.tensorVariants) ? proc.tensorVariants : []
  return variants.find((variant) => variant?.name === name) || null
}

function digitTensorShapeFeaturesForPolicy(src, threshold = 0.22) {
  const data = src?.tensor || src?.data || src
  if (!data || data.length < 28 * 28) return null

  let total = 0
  let weightedX = 0
  let weightedY = 0
  const sumRegion = (x0, x1, y0, y1) => {
    let sum = 0
    for (let y = y0; y < y1; y += 1) {
      const row = y * 28
      for (let x = x0; x < x1; x += 1) {
        const value = data[row + x] || 0
        if (value > threshold) sum += value
      }
    }
    return sum
  }
  const longestRowRun = (y) => {
    let best = 0
    let current = 0
    const row = y * 28
    for (let x = 0; x < 28; x += 1) {
      if ((data[row + x] || 0) > threshold) {
        current += 1
        best = Math.max(best, current)
      } else {
        current = 0
      }
    }
    return best
  }
  const longestColRun = (x) => {
    let best = 0
    let current = 0
    for (let y = 0; y < 28; y += 1) {
      if ((data[y * 28 + x] || 0) > threshold) {
        current += 1
        best = Math.max(best, current)
      } else {
        current = 0
      }
    }
    return best
  }

  for (let y = 0; y < 28; y += 1) {
    const row = y * 28
    for (let x = 0; x < 28; x += 1) {
      const value = data[row + x] || 0
      if (value <= threshold) continue
      total += value
      weightedX += x * value
      weightedY += y * value
    }
  }

  let topLongest = 0
  let bottomLongest = 0
  let leftLongest = 0
  let rightLongest = 0
  for (let y = 4; y < 12; y += 1) topLongest = Math.max(topLongest, longestRowRun(y))
  for (let y = 17; y < 24; y += 1) bottomLongest = Math.max(bottomLongest, longestRowRun(y))
  for (let x = 2; x < 12; x += 1) leftLongest = Math.max(leftLongest, longestColRun(x))
  for (let x = 16; x < 26; x += 1) rightLongest = Math.max(rightLongest, longestColRun(x))

  return {
    centerX: total ? weightedX / total : 0,
    centerY: total ? weightedY / total : 0,
    top: sumRegion(0, 28, 0, 9),
    middle: sumRegion(0, 28, 9, 19),
    bottom: sumRegion(0, 28, 19, 28),
    topRight: sumRegion(14, 28, 0, 14),
    topLongest,
    bottomLongest,
    leftLongest,
    rightLongest,
    total
  }
}

function leftSlotSlantedOneFromSevenRescue(proc, result, expectedDigit) {
  if (!proc?.isVirtualDigitBox || Number(proc.digitIndex) !== 0 || !result) return false
  if (Number(expectedDigit) !== 1 || Number(result.digit) !== 7) return false

  const confidence = Number(result.confidence) || 0
  const gap = preprocessTopGap(result)
  if (confidence < 0.86 || gap < 0.78) return false

  const rawBorder = tensorVariantByName(proc, 'raw-border-slot')
  const rawShape = digitTensorShapeFeaturesForPolicy(rawBorder)
  if (!rawShape) return false

  const singleStrokeBase =
    rawShape.total >= 9 &&
    rawShape.total <= 22.5 &&
    rawShape.middle >= 6 &&
    rawShape.topLongest <= 3 &&
    rawShape.bottomLongest <= 1 &&
    rawShape.leftLongest <= 2 &&
    rawShape.bottom <= 3.5
  const rightLeaningStroke = rawShape.rightLongest >= 5 && rawShape.rightLongest <= 14
  const leftLeaningStroke =
    rawShape.rightLongest <= 2 &&
    rawShape.topRight <= 2.2 &&
    rawShape.centerX <= 12.5

  return singleStrokeBase && (rightLeaningStroke || leftLeaningStroke)
}

function applyLeftSlotSlantedOneRescue(result) {
  const confidence = Math.min(0.96, Math.max(0.88, Number(result?.confidence) || 0.88))
  const runnerConfidence = Math.max(0.01, Math.min(0.06, 1 - confidence))
  const thirdConfidence = Math.max(0.005, Math.min(0.03, runnerConfidence / 2))
  const probs = new Array(10).fill(0.001)
  probs[1] = confidence
  probs[7] = runnerConfidence
  return {
    ...result,
    digit: 1,
    confidence,
    topK: [
      { digit: 1, confidence },
      { digit: 7, confidence: runnerConfidence },
      { digit: 9, confidence: thirdConfidence }
    ],
    probs,
    robust: true,
    robustOverride: 'left-slot-slanted-one-shape-rescue',
    preprocessReviewReason: null,
    originalDigitBeforeShapeRescue: result?.digit ?? null,
    originalConfidenceBeforeShapeRescue: result?.confidence ?? null
  }
}

function rightSlotExpectedEdgeConflictReview(proc, result) {
  if (!proc?.isVirtualDigitBox || Number(proc.digitIndex) !== 1 || !result) return false
  if (!preprocessReasonMatches(result, 'right-slot-expected-edge-default')) return false

  const digit = Number(result.digit)
  const voteTop = result.preprocessVoteSummary?.top || null
  const voteMargin = Number(result.preprocessVoteSummary?.margin) || 0
  if (
    voteTop &&
    Number(voteTop.digit) !== digit &&
    (Number(voteTop.share) || 0) >= 0.70 &&
    voteMargin >= 0.35
  ) {
    return true
  }

  const rawBorder = preprocessVariantByName(result, 'raw-border-slot')
  if (
    rawBorder &&
    Number(rawBorder.digit) !== digit &&
    (Number(rawBorder.confidence) || 0) >= 0.70 &&
    (Number(rawBorder.topGap) || 0) >= 0.55
  ) {
    return true
  }

  return false
}

function highRiskRightSlotPreprocessReview(proc, result) {
  if (!proc?.isVirtualDigitBox || Number(proc.digitIndex) !== 1 || !result) return false
  const digit = Number(result.digit)
  if (rightSlotExpectedEdgeConflictReview(proc, result)) return true
  if (digit !== 1 && digit !== 9) return false
  const variants = Array.isArray(result.preprocessVariants) ? result.preprocessVariants : []
  if (variants.length === 0) return false

  const runnerShare = Number(result.preprocessVoteSummary?.runnerUp?.share) || 0
  const confidence = Number(result.confidence) || 0
  const topGap = Array.isArray(result.topK) && result.topK.length >= 2
    ? (Number(result.topK[0]?.confidence) || 0) - (Number(result.topK[1]?.confidence) || 0)
    : 1
  const alternativeSignals = variants.filter((variant) => {
    const variantDigit = Number(variant?.digit)
    if (!Number.isFinite(variantDigit) || variantDigit === digit) return false
    const variantConfidence = Number(variant?.confidence) || 0
    const variantGap = Number(variant?.topGap) || 0
    return variantConfidence >= 0.30 || variantGap >= 0.05
  }).length

  return (
    runnerShare >= 0.14 ||
    alternativeSignals >= 3 ||
    (alternativeSignals >= 2 && (confidence < 0.86 || topGap < 0.52))
  )
}

function autoXAllowedForDigit(proc, result, topGap) {
  const confidence = Number(result?.confidence) || 0
  const gap = Number.isFinite(topGap) ? topGap : 0
  const reason = preprocessSelectionReason(result)
  if (isReviewBoundOcrRescueReason(reason) || rightSlotExpectedEdgeConflictReview(proc, result)) return false
  if (!proc?.isVirtualDigitBox) {
    return confidence >= AUTO_X_CONFIDENCE_THRESHOLD && gap >= AUTO_X_MARGIN_THRESHOLD
  }

  const isRightSlot = Number(proc.digitIndex) === 1
  const minConfidence = isRightSlot
    ? TWO_DIGIT_RIGHT_SLOT_AUTO_X_CONFIDENCE_THRESHOLD
    : TWO_DIGIT_AUTO_X_CONFIDENCE_THRESHOLD
  const minGap = isRightSlot
    ? TWO_DIGIT_RIGHT_SLOT_AUTO_X_MARGIN_THRESHOLD
    : TWO_DIGIT_AUTO_X_MARGIN_THRESHOLD

  const runnerShare = Number(result?.preprocessVoteSummary?.runnerUp?.share) || 0
  const variants = Array.isArray(result?.preprocessVariants) ? result.preprocessVariants : []
  const digit = Number(result?.digit)
  const alternativeSignals = variants.filter((variant) => {
    const variantDigit = Number(variant?.digit)
    if (!Number.isFinite(variantDigit) || variantDigit === digit) return false
    const variantConfidence = Number(variant?.confidence) || 0
    const variantGap = Number(variant?.topGap) || 0
    return variantConfidence >= 0.34 || variantGap >= 0.06
  }).length

  // A two-digit mismatch should only become an automatic X when the model is
  // genuinely settled; otherwise it belongs in teacher review.
  if (runnerShare >= 0.12 || alternativeSignals >= 3) return false
  return confidence >= minConfidence && gap >= minGap
}

function chosenDigitProbability(result) {
  const digit = Number(result?.digit)
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return Number(result?.confidence) || 0
  const probs = Array.isArray(result?.probs) || ArrayBuffer.isView(result?.probs) ? result.probs : null
  const probability = Number(probs?.[digit])
  return Number.isFinite(probability) && probability > 0
    ? probability
    : (Number(result?.confidence) || 0)
}

function confidencePolicyClearanceForDigit(proc, result, topGap, correct, reviewSignals) {
  const reviewReason = reviewSignals?.structuralReview
    ? 'two-digit-leading-zero-structural-review'
    : reviewSignals?.unexpectedLeadingDigitReview
      ? 'two-digit-optional-leading-digit-review'
    : reviewSignals?.highRiskMismatchReview
      ? 'two-digit-mismatch-low-trust-review'
    : reviewSignals?.highRiskSingleDigitMismatchReview
      ? 'single-digit-six-shape-mismatch-review'
      : reviewSignals?.highRiskPreprocessReview
        ? 'right-slot-preprocess-disagreement'
        : (result?.preprocessReviewReason || null)
  const selectionReason = preprocessSelectionReason(result)
  const cameraCapture = reviewSignals?.cameraCapture === true
  const reason = !cameraCapture && selectionReason
    ? selectionReason
    : (reviewReason || selectionReason)
  const rawConfidence = chosenDigitProbability(result)
  const gap = Number.isFinite(topGap) ? topGap : 0
  const isSingleSlotVirtualMismatch =
    proc?.isVirtualDigitBox === true &&
    Number(proc?.slotCount) === 1 &&
    correct === false

  if (
    reason &&
    OCR_CONFIDENCE_CLEAR_REASONS.has(reason) &&
    !isSingleSlotVirtualMismatch &&
    !rightSlotExpectedEdgeConflictReview(proc, result) &&
    (
      correct === true ||
      !cameraCapture ||
      (
        !isReviewBoundOcrRescueReason(reason) &&
        reason !== 'right-slot-expected-edge-default' &&
        rawConfidence >= 0.88 &&
        gap >= 0.35
      )
    )
  ) {
    return { allowed: true, reason: `validated-review-reason:${reason}` }
  }

  const isTwoDigitMismatch =
    proc?.isVirtualDigitBox === true &&
    !isSingleSlotVirtualMismatch &&
    correct === false
  if (
    isTwoDigitMismatch &&
    !reviewReason &&
    !isReviewBoundOcrRescueReason(selectionReason) &&
    !rightSlotExpectedEdgeConflictReview(proc, result) &&
    rawConfidence >= TWO_DIGIT_AUTO_X_CALIBRATED_CONFIDENCE_THRESHOLD &&
    gap >= TWO_DIGIT_AUTO_X_CALIBRATED_MARGIN_THRESHOLD
  ) {
    return { allowed: true, reason: 'calibrated-two-digit-auto-x' }
  }

  return { allowed: false, reason: null }
}

function structuralTwoDigitReview(proc, result, expectedDigit) {
  if (!proc?.isVirtualDigitBox || Number(proc.digitIndex) !== 0 || !result) return false
  const digit = Number(result.digit)
  const expected = Number(expectedDigit)
  return digit === 0 && Number.isFinite(expected) && expected !== 0
}

function unexpectedOptionalLeadingDigitReview(proc, result, expectedDigit) {
  if (!proc?.isVirtualDigitBox || Number(proc.digitIndex) !== 0 || !result) return false
  if (expectedDigit != null) return false
  const digit = Number(result.digit)
  if (!Number.isInteger(digit) || digit < 0 || digit > 9) return false
  const rawConfidence = chosenDigitProbability(result)
  const gap = preprocessTopGap(result)
  return (
    rawConfidence < TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_CONFIDENCE_THRESHOLD ||
    gap < TWO_DIGIT_OPTIONAL_LEADING_AUTO_X_MARGIN_THRESHOLD
  )
}

function highRiskTwoDigitMismatchReview(proc, result, expectedDigit) {
  if (!proc?.isVirtualDigitBox || !result) return false
  const digit = Number(result.digit)
  const expected = Number(expectedDigit)
  if (!Number.isFinite(digit) || !Number.isFinite(expected)) return false
  if (digit === expected) return false

  const reason = preprocessSelectionReason(result)
  if (isReviewBoundOcrRescueReason(reason) || rightSlotExpectedEdgeConflictReview(proc, result)) return true

  const rawConfidence = chosenDigitProbability(result)
  const gap = preprocessTopGap(result)
  const isRightSlot = Number(proc.digitIndex) === 1
  if (isRightSlot && preprocessReasonMatches(result, 'right-slot-expected-edge-default')) {
    return rawConfidence < 0.97 || gap < 0.75
  }
  if (isRightSlot) return false
  // Grade 1/2 students often write a roofed or slanted leading 1 that the
  // model reads as 7/9/8 with high confidence. Use the answer key only as a
  // review signal here; do not silently convert the digit to 1.
  if (expected === 1) return true
  return expected === 3 && digit === 2
}

function highRiskSingleDigitMismatchReviewForDigit(proc, result, expectedDigit) {
  if (proc?.isVirtualDigitBox || !result) return false
  const digit = Number(result.digit)
  const expected = Number(expectedDigit)
  if (!Number.isFinite(digit) || !Number.isFinite(expected)) return false
  if (digit === expected) return false

  const rawConfidence = chosenDigitProbability(result)
  if (expected === 6 && digit === 5 && rawConfidence < 0.9) return true

  // Current classroom evidence has two confident wrong single-slot reads, both
  // high-confidence 6s where the expected answer was a visually adjacent 5/8.
  // Use the answer key only to require review; never to rewrite the digit.
  return digit === 6 && (expected === 5 || expected === 8)
}

const emit = defineEmits(['image-captured', 'ocr-complete', 'student-done', 'processing-change', 'student-stage-change'])

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
const debugExportBusy = ref(false)
const debugExportStatus = ref('')
const lastCaptureQuality = ref(null)
const debugUploadConfig = initDebugUploadConfig()
const debugAutoUploadState = ref(debugUploadConfig.autoUpload && debugUploadConfig.url ? 'ready' : 'idle')
const debugAutoUploadStatus = ref(
  debugUploadConfig.autoUpload && debugUploadConfig.url
    ? 'Debug auto-save ready'
    : 'Debug auto-save needs an upload URL'
)
const autoStartCameraBlocked = ref(false)
const ocrDebugEnabled = ref(hasDebugQueryFlag('ocrdebug', 'liveOcrDebug', 'sgdebug', 'debug'))
const liveOcrDebugExportEnabled = computed(() =>
  hasDebugQueryFlag('ocrdebug', 'liveOcrDebug', 'sgdebug', 'debug')
)
const ocrDebugSnapshot = ref(null)
const markerDebugSnapshot = ref(null)
const modelInfoSnapshot = ref(null)
const modelSanityRunning = ref(false)
const modelSanityResults = ref(null)
const capturedImageWrapRef = ref(null)
const displayedResultImageRef = ref(null)
const activeCorrectionQuestion = ref(null)
const manualCorrectionText = ref('')
const manualCorrectionClearedForSession = ref(false)
const correctionKeypadSubmitting = ref(false)
const correctionError = ref('')
const localFirstStrongStatusByQuestion = ref({})
const localFirstStrongContext = ref(null)
const progressiveRevealedQuestionNums = ref([])
const progressiveScoreRevealed = ref(false)
const progressiveDateStampRevealed = ref(false)
const progressiveMarkingComplete = ref(false)
const progressiveMarkingSessionKey = ref('')
const progressiveCorrectionQuestionNum = ref(null)
const progressiveBaseImageOverride = ref('')
const scanningAnnotationPreview = ref(null)
let progressiveMarkingTimer = null
let manualCorrectionAutoApplyTimer = null
let progressiveMarkingEarliestFinish = 0
let digitModelWarmupStarted = false
let activeScanSessionId = null
let captureGateTelemetry = newCaptureGateTelemetry()
let autoCaptureIntervalId = null
let stableSince = null
let previousFrameGray = null
let consecutiveFailures = 0
let pendingHybridBurstFrames = []
const studentAutoStatus = ref('Put worksheet in frame')

defineExpose({
  capturedImage,
  exportLiveOcrDebugJson,
  copyLiveOcrDebugJson,
  debugExportBusy,
})

const hasLowConfidence = computed(() =>
  ocrResult.value?.predictions?.some((p) => p.reviewNeeded) ||
  ocrResult.value?.confidences.some(c => c < LOW_CONFIDENCE_THRESHOLD)
)

const lowCount = computed(() =>
  ocrResult.value?.predictions?.filter((p) => p.reviewNeeded).length || 0
)

const showAnnotatedResultImage = computed(() =>
  !!ocrResult.value?.annotatedImageUrl
)

const progressiveAnnotatedImage = computed(() => ocrResult.value?.annotatedImageUrl || '')

const progressiveMarkingDimensions = computed(() => ({
  width: Math.max(1, Number(ocrResult.value?.annotationGeometry?.warpedW) || 1),
  height: Math.max(1, Number(ocrResult.value?.annotationGeometry?.warpedH) || 1),
}))

const progressiveScoreStep = computed(() => progressiveScoreRevealStep({
  result: ocrResult.value,
  dimensions: progressiveMarkingDimensions.value,
  annotationRegions: allAnnotationRegions.value,
}))

const progressiveMarkingStepList = computed(() => progressiveMarkingSteps(
  studentAnswerGroups.value,
  allAnnotationRegions.value,
  progressiveMarkingDimensions.value,
  {
    // While the stronger review is running, reveal only questions that are not
    // in its queue. Questions it may promote or veto appear only after it has
    // reached a final decision, so a teacher/student never sees a mark retracted.
    // Draw settled answers while the local verifier works, but reserve every
    // question in its declared queue. An undeclared pending queue remains
    // fail-closed through progressiveEvidenceReady below.
    excludedQuestionNums: progressiveVerification.value.deferredQuestionNums,
    excludeReview: progressiveReviewPending.value,
    onlyQuestionNums: progressiveCorrectionQuestionNum.value != null && Number.isFinite(Number(progressiveCorrectionQuestionNum.value))
      ? [Number(progressiveCorrectionQuestionNum.value)]
      : [],
    // A manual answer is already baked into the correction-animation base.
    // Do not reveal it through a second mask: that made the black digit vanish
    // between the editor and its final mark.
    revealAnswerQuestionNums: [],
  },
))

const revealedProgressiveMarkingSteps = computed(() => {
  const revealed = new Set(progressiveRevealedQuestionNums.value.map(Number))
  return progressiveMarkingStepList.value.filter((step) => revealed.has(Number(step.questionNum)))
})

const maskedProgressiveMarkingSteps = computed(() =>
  revealedProgressiveMarkingSteps.value.filter((step) => step.status !== 'incorrect')
)

const directIncorrectProgressiveMarkingSteps = computed(() =>
  revealedProgressiveMarkingSteps.value.filter((step) => step.status === 'incorrect')
)

const progressiveReviewPending = computed(() => {
  return progressiveVerification.value.pending
})

const progressiveVerification = computed(() =>
  progressiveVerificationSchedule(ocrResult.value?.v3Shadow)
)

const progressiveEvidenceReady = computed(() => {
  return progressiveVerification.value.mayAnimateSettledAnswers
})

const progressiveMarkingActive = computed(() => (
  props.studentMode
  && !!ocrResult.value
  && !ocrResult.value?.error
  && !!progressiveAnnotatedImage.value
  && !progressiveMarkingComplete.value
))

const scanningDateStampSpec = computed(() => {
  const preview = scanningAnnotationPreview.value
  if (
    !props.studentMode ||
    !progressiveDateStampRevealed.value ||
    !preview
  ) return null
  const questionRects = (ocrResult.value?.annotationRegions || [])
    .map((region) => ({
      x: Number(region?.focusX),
      y: Number(region?.focusY),
      w: Number(region?.focusW),
      h: Number(region?.focusH),
    }))
    .filter((rect) => (
      Number.isFinite(rect.x) &&
      Number.isFinite(rect.y) &&
      Number.isFinite(rect.w) &&
      Number.isFinite(rect.h)
    ))
  return dateStampSpecForLayout(
    preview.layout,
    preview.width,
    preview.height,
    ocrResult.value?.annotationSeed ?? 1,
    new Date(),
    questionRects,
  )
})

const completionStampEffectActive = computed(() => (
  props.studentMode &&
  progressiveDateStampRevealed.value &&
  !!scanningDateStampSpec.value
))

const displayedResultImage = computed(() =>
  processing.value && scanningAnnotationPreview.value?.imageUrl
    ? scanningAnnotationPreview.value.imageUrl
    : progressiveMarkingActive.value
    ? (progressiveBaseImageOverride.value || ocrResult.value?.annotationBaseUrl || capturedImage.value)
    : showAnnotatedResultImage.value && ocrResult.value?.annotatedImageUrl
    ? ocrResult.value.annotatedImageUrl
    : (ocrResult.value?.annotationBaseUrl || capturedImage.value)
)

const studentAnswerGroups = computed(() => {
  const result = ocrResult.value
  const layoutGroups = Array.isArray(result?.layoutSnapshot?.question_groups)
    ? result.layoutSnapshot.question_groups
    : []
  const predictions = Array.isArray(result?.predictions) ? result.predictions : []
  const groups = result?.answerGroups
  if (layoutGroups.length > 0) {
    const rebuiltGroups = predictions.length
      ? buildAnswerGroups(layoutGroups, predictions, result?.questionCorrect, result?.layoutSnapshot?.id)
      : null
    if (Array.isArray(rebuiltGroups) && rebuiltGroups.length > 0) return rebuiltGroups
    const normalizedGroups = normalizeAnswerGroupsForDisplay(groups, layoutGroups)
    if (normalizedGroups.length > 0) return normalizedGroups
    return []
  }
  const normalizedGroups = normalizeAnswerGroupsForDisplay(groups)
  if (normalizedGroups.length > 0) return normalizedGroups
  const digits = Array.isArray(ocrResult.value?.digits) ? ocrResult.value.digits : []
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
      slotStatuses: [status],
      status
    }
  })
})

const allAnnotationRegions = computed(() => (
  Array.isArray(ocrResult.value?.annotationRegions)
    ? ocrResult.value.annotationRegions
    : []
))

const recognitionOverlayItems = computed(() => {
  if (!props.showRecognitionOverlay || !studentAnswerGroups.value.length) return []
  return recognitionOverlayItemsForAnswers(studentAnswerGroups.value, allAnnotationRegions.value)
})

const correctionRegions = computed(() => {
  const regions = Array.isArray(ocrResult.value?.annotationRegions)
    ? ocrResult.value.annotationRegions
    : []
  return regions.filter((region) => isCorrectionRegionEditable(region))
})

const activeCorrectionRegion = computed(() => {
  const question = activeCorrectionQuestion.value
  if (!question) return null
  if (question.slotIndex == null) {
    return allAnnotationRegions.value.find((region) =>
      region.questionNum === question.questionNum &&
      region.slotIndex == null
    ) || question
  }
  return allAnnotationRegions.value.find((region) =>
    region.questionNum === question.questionNum &&
    region.slotIndex === question.slotIndex
  ) || question
})

const activeCorrectionFocusStyle = computed(() => {
  const wholeRegion = activeCorrectionRegion.value
  if (!wholeRegion) return {}
  let region = wholeRegion
  let previewSlots = activeCorrectionMaxLength.value
  const pendingSlotIndex = correctionPendingSlotIndex(
    manualCorrectionText.value,
    activeCorrectionMaxLength.value,
  )
  if (activeCorrectionSlotIndex.value == null && pendingSlotIndex != null) {
    const slotRegion = allAnnotationRegions.value.find((candidate) => (
      Number(candidate?.questionNum) === Number(activeCorrectionQuestion.value?.questionNum) &&
      Number(candidate?.slotIndex) === pendingSlotIndex
    ))
    if (slotRegion) {
      region = slotRegion
    } else {
      const left = Number(wholeRegion.focusLeftPct ?? wholeRegion.leftPct)
      const top = Number(wholeRegion.focusTopPct ?? wholeRegion.topPct)
      const width = Number(wholeRegion.focusWidthPct ?? wholeRegion.widthPct)
      const height = Number(wholeRegion.focusHeightPct ?? wholeRegion.heightPct)
      const slotWidth = width / activeCorrectionMaxLength.value
      if ([left, top, width, height, slotWidth].every(Number.isFinite)) {
        region = {
          focusLeftPct: left + slotWidth * pendingSlotIndex,
          focusTopPct: top,
          focusWidthPct: slotWidth,
          focusHeightPct: height,
        }
      }
    }
    previewSlots = 1
  }
  return {
    left: `${region.focusLeftPct ?? region.leftPct}%`,
    top: `${region.focusTopPct ?? region.topPct}%`,
    width: `${region.focusWidthPct ?? region.widthPct}%`,
    height: `${region.focusHeightPct ?? region.heightPct}%`,
    '--correction-preview-slots': String(previewSlots),
  }
})

const correctionKeypadKeys = CORRECTION_KEYPAD_KEYS

const progressiveStrokeAnimations = new WeakMap()
const progressiveStrokeSequences = new WeakMap()
const vProgressiveStroke = {
  mounted(element) {
    const animation = startMeasuredProgressiveStroke(element, {
      durationMs: element.style.getPropertyValue('--progressive-stroke-duration'),
      delayMs: element.style.getPropertyValue('--progressive-stroke-delay'),
    })
    if (animation) progressiveStrokeAnimations.set(element, animation)
  },
  unmounted(element) {
    progressiveStrokeAnimations.get(element)?.cancel?.()
    progressiveStrokeAnimations.delete(element)
  },
}

const vProgressiveStrokeSequence = {
  mounted(element) {
    const sequence = startMeasuredProgressiveStrokeSequence(
      element.querySelectorAll('.progressive-marking-stroke'),
    )
    if (sequence) progressiveStrokeSequences.set(element, sequence)
  },
  unmounted(element) {
    progressiveStrokeSequences.get(element)?.cancel?.()
    progressiveStrokeSequences.delete(element)
  },
}

const activeCorrectionPreviewCells = computed(() =>
  correctionPreviewCells(manualCorrectionText.value, activeCorrectionMaxLength.value)
)

const activeCorrectionEntryComplete = computed(() =>
  correctionKeypadEntryComplete(manualCorrectionText.value, activeCorrectionMaxLength.value)
)

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

const activeCorrectionInkPreviewUrl = computed(() => {
  if (
    !manualCorrectionText.value ||
    !activeCorrectionQuestion.value ||
    !activeCorrectionGroup.value ||
    typeof document === 'undefined'
  ) return ''
  const geometry = ocrResult.value?.annotationGeometry
  const width = Math.max(1, Number(geometry?.warpedW) || 1)
  const height = Math.max(1, Number(geometry?.warpedH) || 1)
  const crops = Array.isArray(geometry?.crops) ? geometry.crops : []
  const cropById = new Map(crops.map((crop, index) => [crop.id ?? index, crop]))
  const ids = Array.isArray(activeCorrectionGroup.value?.digit_box_ids)
    ? activeCorrectionGroup.value.digit_box_ids
    : []
  const slotRects = ids.map((id) => annotationRectForCrop(cropById.get(id)))
  const selectedSlot = activeCorrectionQuestion.value?.slotIndex
  let rects
  let cells
  if (Number.isInteger(selectedSlot) && selectedSlot >= 0 && selectedSlot < slotRects.length) {
    rects = [slotRects[selectedSlot]]
    cells = [activeCorrectionPreviewCells.value[0]]
  } else if (slotRects.length === 1) {
    rects = slotRects
    cells = [activeCorrectionPreviewCells.value.filter(Boolean).join('')]
  } else {
    rects = slotRects
    cells = activeCorrectionPreviewCells.value
  }
  if (!rects.some(Boolean) || !cells.some((cell) => cell !== null && cell !== undefined && cell !== '')) return ''
  const groups = Array.isArray(ocrResult.value?.layoutSnapshot?.question_groups)
    ? ocrResult.value.layoutSnapshot.question_groups
    : []
  const groupIndex = Math.max(0, groups.findIndex((group) => group === activeCorrectionGroup.value))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  drawManualCorrectionInk(ctx, rects, cells, (groupIndex + 1) * 131 + 47)
  return canvas.toDataURL('image/png')
})

const activeCorrectionPredictions = computed(() => {
  const group = activeCorrectionGroup.value
  if (!group) return []
  const byId = new Map((ocrResult.value?.predictions || []).map((prediction) => [prediction.id, prediction]))
  return (group.digit_box_ids || []).map((id) => byId.get(id) || null)
})

const activeCorrectionSlotIndex = computed(() => {
  const slotIndex = activeCorrectionQuestion.value?.slotIndex
  return Number.isInteger(slotIndex) && slotIndex >= 0 ? slotIndex : null
})

const activeCorrectionSlotPrediction = computed(() => {
  const slotIndex = activeCorrectionSlotIndex.value
  const predictions = activeCorrectionPredictions.value
  if (slotIndex == null || slotIndex >= predictions.length) return null
  return predictions[slotIndex]
})

const activeCorrectionCurrentText = computed(() => {
  if (activeCorrectionSlotIndex.value != null) {
    const prediction = activeCorrectionSlotPrediction.value
    if (!prediction) return 'not sure'
    if (prediction.blank === true || prediction.empty === true) return 'blank'
    return prediction.digit == null ? 'not sure' : String(prediction.digit)
  }
  const predictions = activeCorrectionPredictions.value
  if (!predictions.length) return 'not sure'
  const predictionById = new Map(predictions.map((prediction) => [prediction?.id, prediction]))
  const override = groupAnswerTextOverride(activeCorrectionGroup.value, predictionById)
  if (override) return override
  const text = predictions
    .map((prediction) => {
      if (prediction?.blank === true || prediction?.empty === true) return predictions.length > 1 ? '_' : ''
      return prediction?.digit == null ? (predictions.length > 1 ? '_' : '') : String(prediction.digit)
    })
    .join('')
  return text && !/^_+$/.test(text) ? text : 'blank'
})

const activeCorrectionChoices = computed(() => {
  if (activeCorrectionSlotIndex.value != null) {
    const prediction = activeCorrectionSlotPrediction.value
    return predictionDigitCandidates(prediction)
      .slice(0, 3)
      .filter((candidate) => candidate.digit !== null && candidate.digit !== undefined)
      .map((candidate, index) => ({
        key: `${activeCorrectionQuestion.value?.questionNum ?? 'q'}-${activeCorrectionSlotIndex.value}-${index}-${candidate.digit}`,
        text: String(candidate.digit),
        cells: [candidate.digit],
        source: index === 0 ? 'current-browser-ocr' : 'digit-model-alternative'
      }))
  }
  const group = activeCorrectionGroup.value
  if (!group) return []
  // A phone correction panel has room for three decisive choices. Everything
  // else belongs in the numeric field, not in a dense, hard-to-tap grid.
  return topAnswerChoicesForGroup(group, ocrResult.value?.predictions || [], 3)
})

const activeCorrectionQuestionNum = computed(() => Number(activeCorrectionGroup.value?.question_num))
const activeLocalFirstStrongStatus = computed(() =>
  localFirstStrongStatusByQuestion.value[activeCorrectionQuestionNum.value] || 'deferred'
)
const localFirstStrongLoading = computed(() => activeLocalFirstStrongStatus.value === 'loading')
const showLocalFirstStrongFallback = computed(() =>
  v3LocalFirstReviewEnabled()
  && activeCorrectionSlotIndex.value == null
  && Number.isFinite(activeCorrectionQuestionNum.value)
  && ['deferred', 'context-ready', 'loading', 'unavailable'].includes(activeLocalFirstStrongStatus.value)
)
const localFirstStrongButtonLabel = computed(() =>
  localFirstStrongLoading.value
    ? 'Checking another reader…'
    : activeLocalFirstStrongStatus.value === 'context-ready'
      ? 'Still none of these'
      : 'None of these'
)
const localFirstStrongMessage = computed(() => {
  if (!v3LocalFirstReviewEnabled() || activeCorrectionSlotIndex.value != null) return ''
  if (activeLocalFirstStrongStatus.value === 'unavailable') {
    return 'Another reading is unavailable. Enter the answer above.'
  }
  return ''
})

const activeCorrectionMaxLength = computed(() => {
  if (activeCorrectionSlotIndex.value != null) return 1
  const group = activeCorrectionGroup.value
  const count = maxHandwrittenDigitsForGroup(group)
  return Math.max(1, count)
})

const activeCorrectionPhysicalSlotCount = computed(() => {
  if (activeCorrectionSlotIndex.value != null) return 1
  const ids = Array.isArray(activeCorrectionGroup.value?.digit_box_ids)
    ? activeCorrectionGroup.value.digit_box_ids
    : []
  return Math.max(1, ids.length)
})

const activeCorrectionQuestionLetter = computed(() =>
  scantronAnswerLabel(activeCorrectionQuestion.value?.label)
)

const activeCorrectionSlotLabel = computed(() => {
  const slotIndex = activeCorrectionSlotIndex.value
  const group = activeCorrectionGroup.value
  const total = Math.max(1, Array.isArray(group?.digit_box_ids) ? group.digit_box_ids.length : 1)
  if (slotIndex == null || total <= 1) return 'answer digit'
  if (total === 2) return slotIndex === 0 ? 'left digit' : 'right digit'
  return `digit ${slotIndex + 1}`
})

const activeCorrectionInputLabel = computed(() =>
  `Enter ${activeCorrectionSlotLabel.value} for question ${activeCorrectionQuestionLetter.value}`
)

const studentScoreText = computed(() => {
  if (ocrResult.value?.predictions?.some((p) => p.reviewNeeded)) return ''
  if (Array.isArray(ocrResult.value?.questionReview) && ocrResult.value.questionReview.some(Boolean)) return ''
  const questionCorrect = ocrResult.value?.questionCorrect
  if (Array.isArray(questionCorrect) && questionCorrect.length > 0) {
    const score = questionCorrect.filter(Boolean).length
    return `Score: ${score}/${questionCorrect.length}`
  }
  const layoutGroups = Array.isArray(ocrResult.value?.layoutSnapshot?.question_groups)
    ? ocrResult.value.layoutSnapshot.question_groups
    : []
  if (layoutGroups.length > 0) return ''
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

const studentOcrResultErrorHint = computed(() => {
  if (!ocrResult.value?.error) return ''
  const message = String(ocrResult.value.error)
  if (message.includes('QR code was not read')) {
    return 'Keep the QR code visible and scan again.'
  }
  if (message.includes('Corner marker')) {
    return 'Keep all four black corner squares visible.'
  }
  if (message.includes('Answer boxes')) {
    return 'Hold the sheet flatter and let the camera focus.'
  }
  if (message.includes('Layout not found')) {
    return 'The worksheet template did not load.'
  }
  if (message.includes('model') || message.includes('OCR')) {
    return 'The grading engine did not finish loading.'
  }
  return 'Try again with the whole worksheet in view.'
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

// The final score is already rendered into the saved worksheet image. This
// matching mask exposes that ink in the order a teacher would write it rather
// than letting a completed "7/8" suddenly appear after the last correction.
function progressiveScoreRevealStep({ result, dimensions, annotationRegions }) {
  const correct = Array.isArray(result?.questionCorrect) ? result.questionCorrect : []
  const hasReview = result?.predictions?.some((item) => item?.reviewNeeded) ||
    (Array.isArray(result?.questionReview) && result.questionReview.some(Boolean))
  if (!correct.length || hasReview) return null
  const width = Math.max(1, Number(dimensions?.width) || 1)
  const height = Math.max(1, Number(dimensions?.height) || 1)
  const total = correct.length
  const scoreText = `${correct.filter(Boolean).length}/${total}`
  const rects = (annotationRegions || [])
    .map((region) => ({
      x: Number(region?.focusX),
      y: Number(region?.focusY),
      w: Number(region?.focusW),
      h: Number(region?.focusH),
    }))
    .filter((rect) => (
      Number.isFinite(rect.x) &&
      Number.isFinite(rect.y) &&
      Number.isFinite(rect.w) &&
      Number.isFinite(rect.h)
    ))
  const {
    centerX,
    y,
    fontSize,
  } = teacherScorePlacement({
    width,
    height,
    layout: result?.layoutSnapshot,
    questionRects: rects,
  })
  const seed = Number.isFinite(Number(result?.annotationSeed)) ? Number(result.annotationSeed) + 9001 : 9002
  const scorePlan = buildTeacherScoreStrokePlan({
    text: scoreText,
    centerX,
    y,
    fontSize,
    seed,
  })
  const inkStrokes = buildTeacherScoreInkPlan(scorePlan, TEACHER_GREEN_PEN_PASSES)
  const ratio = correct.filter(Boolean).length / Math.max(1, total)
  return scorePlan.strokes.length ? {
    key: 'final-score',
    strokes: scorePlan.strokes,
    inkStrokes,
    color: ratio >= 0.7 ? TEACHER_GREEN_INK : ratio >= 0.5 ? '#c66f22' : TEACHER_RED_INK,
  } : null
}

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

function isAnswerSlotEditable(group, slotIndex) {
  if (!isAnswerGroupEditable(group)) return false
  const reviewSlots = reviewSlotIndexesForGroup(group)
  return reviewSlots.length !== 1 || reviewSlots[0] === slotIndex
}

function reviewSlotIndexesForGroup(group) {
  if (!isAnswerGroupEditable(group)) return []
  const ids = Array.isArray(group?.digitBoxIds) ? group.digitBoxIds : []
  const byId = new Map((ocrResult.value?.predictions || []).map((prediction) => [prediction.id, prediction]))
  return ids
    .map((id, slotIndex) => ({ id, slotIndex }))
    .filter(({ slotIndex }) => slotNeedsReview(group, ids, slotIndex, byId))
    .map(({ slotIndex }) => slotIndex)
}

function shouldUseWholeAnswerCorrection(group) {
  if (!isAnswerGroupEditable(group)) return false
  const ids = Array.isArray(group?.digitBoxIds) ? group.digitBoxIds : []
  const reviewSlots = reviewSlotIndexesForGroup(group)
  const byId = new Map((ocrResult.value?.predictions || []).map((prediction) => [prediction.id, prediction]))
  const hasWholeAnswerSuggestion = ids.some((id) => {
    const prediction = byId.get(id)
    return Array.isArray(prediction?.wholeAnswerReviewSuggestions)
      ? prediction.wholeAnswerReviewSuggestions.length > 0
      : !!prediction?.wholeAnswerReviewSuggestion
  })
  if (!wholeAnswerReviewModeEligible({
    slotCount: ids.length,
    reviewSlotCount: reviewSlots.length,
    hasWholeAnswerSuggestion,
  })) return false
  if (v3LocalFirstReviewEnabled() && hasWholeAnswerSuggestion) return true
  const questionNum = Number(group?.questionNum ?? group?.question_num)
  const hasPreparedStrongFallback = v3LocalFirstReviewEnabled()
    && Number.isFinite(questionNum)
    && (localFirstStrongContext.value?.sequenceItems || [])
      .some((item) => Number(item?.questionNum) === questionNum)
  if (hasPreparedStrongFallback) return true
  return true
}

function groupForQuestionNum(questionNum) {
  const groups = Array.isArray(ocrResult.value?.layoutSnapshot?.question_groups)
    ? ocrResult.value.layoutSnapshot.question_groups
    : []
  return groups.find((group, index) => (group?.question_num ?? index + 1) === questionNum) || null
}

function preferredCorrectionSlotIndex(group, region = null) {
  const ids = Array.isArray(group?.digit_box_ids)
    ? group.digit_box_ids
    : Array.isArray(region?.digitBoxIds)
      ? region.digitBoxIds
      : []
  if (!ids.length) return 0
  const byId = new Map((ocrResult.value?.predictions || []).map((prediction) => [prediction.id, prediction]))
  const reviewIndex = ids.findIndex((id) => byId.get(id)?.reviewNeeded)
  if (reviewIndex >= 0) return reviewIndex
  const manualIndex = ids.findIndex((id) => byId.get(id)?.manualCorrected)
  if (manualIndex >= 0) return manualIndex
  return 0
}

function openCorrection(region) {
  if (!isCorrectionRegionEditable(region)) return
  const group = groupForQuestionNum(region.questionNum)
  const reviewGroup = {
    ...group,
    digitBoxIds: Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : region.digitBoxIds,
    questionNum: region.questionNum
  }
  const useWholeAnswer = (region.slotIndex == null && region.wholeAnswer) || shouldUseWholeAnswerCorrection(reviewGroup)
  activeCorrectionQuestion.value = {
    ...region,
    openedAtMs: performance.now(),
    slotIndex: useWholeAnswer
      ? null
      : Number.isInteger(region.slotIndex)
        ? region.slotIndex
        : preferredCorrectionSlotIndex(group, region)
  }
  manualCorrectionText.value = ''
  manualCorrectionClearedForSession.value = false
  normalizeManualCorrectionInput()
  correctionError.value = ''
  correctionKeypadSubmitting.value = false
}

function openCorrectionByGroupSlot(group, slotIndex = null) {
  if (!isAnswerGroupEditable(group)) return
  const reviewSlots = reviewSlotIndexesForGroup(group)
  const requestedSlotIndex = reviewSlots.length === 1 ? reviewSlots[0] : slotIndex
  const useWholeAnswer = requestedSlotIndex == null || shouldUseWholeAnswerCorrection(group)
  const selectedSlotIndex = useWholeAnswer
    ? null
    : Number.isInteger(requestedSlotIndex)
    ? requestedSlotIndex
    : preferredCorrectionSlotIndex(group)
  const region = allAnnotationRegions.value.find((item) =>
    item.questionNum === group.questionNum &&
    (selectedSlotIndex == null ? item.slotIndex == null : item.slotIndex === selectedSlotIndex)
  ) || allAnnotationRegions.value.find((item) => item.questionNum === group.questionNum) || {
    key: `question-region-${group.questionNum}`,
    label: group.label,
    questionNum: group.questionNum,
    reviewNeeded: group.reviewNeeded,
    manualCorrected: group.manualCorrected,
    correct: group.correct
  }
  activeCorrectionQuestion.value = { ...region, slotIndex: selectedSlotIndex, openedAtMs: performance.now() }
  manualCorrectionText.value = ''
  manualCorrectionClearedForSession.value = false
  normalizeManualCorrectionInput()
  correctionError.value = ''
  correctionKeypadSubmitting.value = false
}

function handleCorrectionOutsideClick(event) {
  if (!activeCorrectionQuestion.value) return
  const target = event?.target
  if (target instanceof Element && target.closest('.correction-keypad, .annotation-hotspot, .on-sheet-correction-focus')) return
  cancelCorrection()
}

function cancelCorrection() {
  if (manualCorrectionAutoApplyTimer != null) {
    window.clearTimeout(manualCorrectionAutoApplyTimer)
    manualCorrectionAutoApplyTimer = null
  }
  activeCorrectionQuestion.value = null
  manualCorrectionText.value = ''
  manualCorrectionClearedForSession.value = false
  correctionKeypadSubmitting.value = false
  correctionError.value = ''
}

function pressCorrectionKey(key) {
  if (!activeCorrectionQuestion.value || correctionKeypadSubmitting.value) return
  if (manualCorrectionAutoApplyTimer != null) {
    window.clearTimeout(manualCorrectionAutoApplyTimer)
    manualCorrectionAutoApplyTimer = null
  }
  manualCorrectionText.value = correctionKeypadEntry(
    manualCorrectionText.value,
    key,
    activeCorrectionMaxLength.value,
  )
  correctionError.value = ''
  if (!correctionKeypadEntryComplete(manualCorrectionText.value, activeCorrectionMaxLength.value)) return
  correctionKeypadSubmitting.value = true
  manualCorrectionAutoApplyTimer = window.setTimeout(() => {
    manualCorrectionAutoApplyTimer = null
    if (!activeCorrectionQuestion.value) {
      correctionKeypadSubmitting.value = false
      return
    }
    void applyManualCorrectionText().finally(() => {
      correctionKeypadSubmitting.value = false
    })
  }, 90)
}

async function applyCorrectionChoice(choice) {
  await applyManualCorrectionCells(choice.cells, {
    slotIndex: activeCorrectionSlotIndex.value,
    correctionSource: choice.source || 'review-choice',
    oneTap: true,
  })
}

async function applyManualCorrectionText() {
  normalizeManualCorrectionInput()
  const group = activeCorrectionGroup.value
  if (!manualCorrectionText.value) {
    await applyNoAnswerCorrection()
    return
  }
  const slotCount = activeCorrectionSlotIndex.value != null
    ? 1
    : maxHandwrittenDigitsForGroup(group)
  const cells = parseManualAnswerText(manualCorrectionText.value, slotCount)
  if (!cells) {
    correctionError.value = slotCount > 1
      ? 'Enter one or two digits.'
      : 'Enter one digit.'
    return
  }
  await applyManualCorrectionCells(cells, {
    slotIndex: activeCorrectionSlotIndex.value,
    correctionSource: 'manual-keypad',
    oneTap: false,
  })
}

async function applyNoAnswerCorrection() {
  const slotCount = activeCorrectionSlotIndex.value != null
    ? 1
    : activeCorrectionPhysicalSlotCount.value
  await applyManualCorrectionCells(Array(slotCount).fill(null), {
    slotIndex: activeCorrectionSlotIndex.value,
    correctionSource: 'manual-no-answer',
    oneTap: true,
  })
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
  if (shouldAutoApplySingleDigitCorrection({
    eventType: event?.type,
    maxLength: activeCorrectionMaxLength.value,
    text: normalized,
  })) {
    if (manualCorrectionAutoApplyTimer != null) window.clearTimeout(manualCorrectionAutoApplyTimer)
    manualCorrectionAutoApplyTimer = window.setTimeout(() => {
      manualCorrectionAutoApplyTimer = null
      if (activeCorrectionQuestion.value && manualCorrectionText.value === normalized) {
        void applyManualCorrectionText()
      }
    }, 70)
  }
}

async function applyManualCorrectionCells(cells, { slotIndex = null, correctionSource = 'manual', oneTap = false } = {}) {
  const result = ocrResult.value
  const group = activeCorrectionGroup.value
  const correctedQuestionNum = Number(group?.question_num ?? activeCorrectionQuestion.value?.questionNum)
  const layoutSnapshot = result?.layoutSnapshot
  const questionGroups = Array.isArray(layoutSnapshot?.question_groups) ? layoutSnapshot.question_groups : []
  const annotationGeometry = result?.annotationGeometry
  if (!result || !group || !annotationGeometry || !Array.isArray(result.predictions)) return
  const previousAnnotatedImageUrl = result.annotatedImageUrl || result.annotationBaseUrl || capturedImage.value

  const ids = Array.isArray(group.digit_box_ids) ? group.digit_box_ids : []
  if (!ids.length) return
  const predictionIndexById = new Map(result.predictions.map((prediction, index) => [prediction.id, index]))
  const nextPredictions = result.predictions.map((prediction) => ({
    ...prediction,
    topK: clonePlain(prediction.topK || []),
    probs: clonePlain(prediction.probs || [])
  }))
  const normalizedSlotIndex = Number.isInteger(slotIndex) && slotIndex >= 0 && slotIndex < ids.length
    ? slotIndex
    : null
  const wholeAnswerContract = normalizedSlotIndex == null
    ? manualCorrectionContract(cells, ids.length)
    : null
  const overflowSinglePhysicalBox = wholeAnswerContract?.overflowSinglePhysicalBox === true &&
    wholeAnswerContract.correctionCells.length <= maxHandwrittenDigitsForGroup(group)
  const normalizedCells = ids.map((id) => {
    const predictionIndex = predictionIndexById.get(id)
    const prediction = predictionIndex == null ? null : nextPredictions[predictionIndex]
    const normalized = normalizeGradingDigit(
      prediction?.blank === true || prediction?.empty === true ? null : prediction?.digit
    )
    return normalized === undefined ? null : normalized
  })
  const correctionCells = normalizedSlotIndex == null
    ? wholeAnswerContract.correctionCells
    : cells.slice(0, 1)
  if (normalizedSlotIndex == null) {
    if (!overflowSinglePhysicalBox) {
      while (correctionCells.length < ids.length) correctionCells.unshift(null)
      correctionCells.forEach((cell, index) => {
        normalizedCells[index] = cell
      })
    }
  } else {
    normalizedCells[normalizedSlotIndex] = correctionCells[0] ?? null
  }
  const answerText = normalizedSlotIndex == null
    ? wholeAnswerContract.answerText
    : cellsToAnswerText(normalizedCells)
  const slotsToUpdate = normalizedSlotIndex == null
    ? ids.map((_, index) => index)
    : [normalizedSlotIndex]

  slotsToUpdate.forEach((slotIndex) => {
    const id = ids[slotIndex]
    const predictionIndex = predictionIndexById.get(id)
    if (predictionIndex == null) return
    const previous = nextPredictions[predictionIndex]
    const digit = normalizedCells[slotIndex]
    const previousTopK = Array.isArray(previous.topK) ? previous.topK : []
    nextPredictions[predictionIndex] = {
      ...previous,
      digit: overflowSinglePhysicalBox ? null : digit,
      blank: overflowSinglePhysicalBox ? false : digit === null,
      empty: overflowSinglePhysicalBox ? false : digit === null,
      confidence: 1,
      topGap: 1,
      reviewNeeded: false,
      manualCorrected: true,
      manualAnswerText: answerText,
      ...(overflowSinglePhysicalBox ? { answerTextOverride: answerText } : { answerTextOverride: undefined }),
      originalDigit: previous.originalDigit ?? previous.digit,
      originalConfidence: previous.originalConfidence ?? previous.confidence,
      topK: overflowSinglePhysicalBox || digit === null
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
  const questionReview = buildQuestionReviewFlags(questionGroups, nextPredictions, questionCorrect)
  const answerGroups = buildAnswerGroups(questionGroups, nextPredictions, questionCorrect, layoutSnapshot?.id)
  const correctionKey = String(group.question_num ?? activeCorrectionQuestion.value?.questionNum ?? 'question')
  const previousCorrection = result.manualCorrections?.[correctionKey] || {}
  const correctedSlots = new Set(
    Array.isArray(previousCorrection.correctedSlots)
      ? previousCorrection.correctedSlots.filter((index) => Number.isInteger(index))
      : Array.isArray(previousCorrection.cells)
        ? previousCorrection.cells.map((_, index) => index)
        : []
  )
  slotsToUpdate.forEach((index) => correctedSlots.add(index))
  const manualCorrections = {
    ...(result.manualCorrections || {}),
    [correctionKey]: {
      questionNum: group.question_num ?? activeCorrectionQuestion.value?.questionNum ?? null,
      label: activeCorrectionQuestion.value?.label || '',
      cells: overflowSinglePhysicalBox ? correctionCells : normalizedCells,
      text: answerText,
      correctedSlots: Array.from(correctedSlots).sort((a, b) => a - b),
      correctionSource,
      overflowSinglePhysicalBox,
      oneTap: Boolean(oneTap),
      reviewDurationMs: Number.isFinite(activeCorrectionQuestion.value?.openedAtMs)
        ? Math.max(0, Math.round(performance.now() - activeCorrectionQuestion.value.openedAtMs))
        : null,
      correctedAt: new Date().toISOString()
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
      manualCorrections,
      result.annotationSeed
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
  const overlayDebug = buildOverlayDebugSnapshot({
    questionGroups,
    layoutId: layoutSnapshot?.layout_id || result.template_id || null,
    annotationGeometry,
    annotationRegions,
    predictions: nextPredictions,
    questionCorrect,
    questionReview,
    annotationBaseMode: result.annotationBaseMode || 'unknown',
    annotationSeed: result.annotationSeed,
    markedSheetAvailable: !!annotatedImageUrl
  })
  const groupedStructureNeedsReview =
    (questionGroups.length > 0 && !Array.isArray(questionCorrect)) ||
    (Array.isArray(questionReview) && questionReview.some(Boolean))
  const needsReview = !!result.baseNeedsReview ||
    nextPredictions.some((prediction) => prediction.reviewNeeded) ||
    groupedStructureNeedsReview
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
  if (v3LocalFirstReviewEnabled() && localFirstStrongContext.value) {
    localFirstStrongContext.value = {
      ...localFirstStrongContext.value,
      predictions: nextPredictions,
      payload: nextResult,
    }
  }
  if (Array.isArray(result.correct) && result.correct.length === nextPredictions.length) {
    nextResult.correct = nextPredictions.map((prediction) => prediction.correct)
  }
  // Prepare the settled correction before switching result images. The
  // transition then removes only the blue focus treatment; the black teacher
  // entry never falls back to the pre-correction worksheet for one frame.
  const correctionAnimationBaseUrl = await manualCorrectionAnimationBase(
    previousAnnotatedImageUrl,
    annotatedImageUrl,
    correctedQuestionNum,
  )
  ocrResult.value = nextResult
  startManualCorrectionAnimation(correctedQuestionNum, correctionAnimationBaseUrl)
  // Keep the live white-tape preview over the answer until Safari has loaded
  // and painted the equivalent correction-animation base underneath it.
  // Removing the preview earlier produces a one-frame missing-digit flash.
  await waitForDisplayedCorrectionBase(correctionAnimationBaseUrl)
  if (lastLiveOcrDebug.value) {
    lastLiveOcrDebug.value = {
      ...lastLiveOcrDebug.value,
      predictions: nextPredictions,
      answerGroups: nextResult.answerGroups,
      questionCorrect,
      questionReview,
      annotationGeometry,
      annotationRegions,
      markedSheetDataUrl: annotatedImageUrl || null,
      overlayDebug,
      manualCorrections,
      correctedAt: new Date().toISOString()
    }
    if (typeof window !== 'undefined') {
      window.__SCANGRADE_LIVE_OCR_DEBUG = lastLiveOcrDebug.value
    }
    const correctionTelemetry = {
      ...lastLiveOcrDebug.value,
      capturedImageDataUrl: null,
      markedSheetDataUrl: null,
      warpedDataUrl: null,
      rawCropDataUrls: [],
      modelInputDataUrls: [],
      hybridBurstFrameDataUrls: [],
      tensors: [],
    }
    uploadLiveOcrDebug(correctionTelemetry, 'manual-correction')
  }
  const nextReviewGroup = nextYellowReviewGroup(
    answerGroups,
    questionReview,
    correctedQuestionNum,
  )
  if (nextReviewGroup) {
    openCorrectionByGroupSlot(nextReviewGroup)
  } else {
    cancelCorrection()
  }
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
  const paperStats = measurePaperPatch(reader, markers)
  const decision = studentSheetAppearanceDecision({ markerStats, paperStats })
  return {
    ok: decision.accepted,
    preferred: decision.preferred,
    status: decision.status,
    darkMarkerCount: decision.darkMarkerCount,
    markerStats,
    paperStats,
  }
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
      Math.abs(centerX - w / 2) <= w * 0.30 &&
      Math.abs(centerY - h / 2) <= h * 0.30
    const spansEnough = spanX >= w * 0.32 && spanY >= h * 0.40
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
      widthBalance >= 0.63 &&
      heightBalance >= 0.67 &&
      topTilt <= 0.22 &&
      bottomTilt <= 0.22 &&
      leftLean <= 0.22 &&
      rightLean <= 0.22
    const preferredPerspective =
      widthBalance >= 0.86 &&
      heightBalance >= 0.80 &&
      topTilt <= 0.16 &&
      bottomTilt <= 0.16 &&
      leftLean <= 0.16 &&
      rightLean <= 0.16
    const geometry = {
      widthBalance,
      heightBalance,
      topTilt,
      bottomTilt,
      leftLean,
      rightLean,
      perspectiveOkay,
      softPerspectiveOkay,
      preferredPerspective
    }
    const appearance = validateStudentSheetAppearance(canvas, markers)
    const ok = centered && spansEnough && cornersLookPlaced && (perspectiveOkay || softPerspectiveOkay) && appearance.ok
    let status = 'Hold steady'
    if (!spansEnough) status = 'Move sheet closer'
    else if (!centered) status = 'Center the sheet'
    else if (!cornersLookPlaced) status = 'Keep all corners inside'
    else if (!(perspectiveOkay || softPerspectiveOkay)) status = 'Flatten the sheet a bit'
    else if (!appearance.ok) status = appearance.status
    return { ok, status, markers, appearance, geometry }
  } finally {
    if (src) src.delete()
  }
}

function strictPerspectiveCaptureEnabled() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('strictPerspectiveCapture') === '1'
}

function hybridV2Enabled() {
  return hasDebugQueryFlag('hybridV2', 'hybridRecognition')
}

function hybridV3Enabled() {
  return consensusFeatureEnabled('hybridV3')
}

function v3LocalFirstReviewEnabled() {
  return consensusFeatureEnabled('v3LocalFirstReview')
}

function v3ConfidenceSafetyEnabled() {
  return consensusFeatureEnabled('v3ConfidenceSafety')
}

function v3ConsensusPromotionEnabled() {
  return hybridV3Enabled() && consensusFeatureEnabled('v3ConsensusPromotion')
}

function v3ContextCropReviewEnabled() {
  if (!v3LocalFirstReviewEnabled()) return false
  if (typeof window === 'undefined') return true
  return new URLSearchParams(window.location.search).get('v3ContextCropReview') !== '0'
}

function v3LayoutAnchoredZonesEnabled() {
  return hasDebugQueryFlag('v3LayoutAnchoredZones')
}

function v3PristineWarpEnabled() {
  return consensusFeatureEnabled('v3PristineWarp')
}

function v3SequenceFromZonesEnabled() {
  return consensusFeatureEnabled('v3SequenceFromZones')
}

function v3StitchedOnDemandReviewEnabled() {
  return consensusFeatureEnabled('v3StitchedOnDemandReview')
}

function v3EightFrameColumnOrderEnabled() {
  return consensusFeatureEnabled('v3EightFrameColumnOrder')
}

function v3DualCropReviewEnabled() {
  return hasDebugQueryFlag('v3DualCropReview')
}

function experimentalFrameRegistrationMode() {
  if (typeof window === 'undefined') return 'current'
  const value = new URLSearchParams(window.location.search).get('v3FrameRegistrationMode') || 'current'
  return ['current', 'template-only', 'full-local', 'local-position', 'strong-local'].includes(value)
    ? value
    : 'current'
}

function worksheetProcessingOptions(qrLocation = null) {
  return {
    qrLocation,
    experimentalEightFrameColumnOrder: v3EightFrameColumnOrderEnabled(),
    experimentalFrameRegistrationMode: experimentalFrameRegistrationMode(),
  }
}

function v3CleanPrintedFramesEnabled() {
  return hasDebugQueryFlag('v3CleanPrintedFrames')
}

function v3NumberBondShiftEvidenceEnabled() {
  return consensusFeatureEnabled('v3NumberBondShiftDown')
}

function v3NonrowTrimEvidenceEnabled() {
  return consensusFeatureEnabled('v3NonrowTrimEvidence')
}

function v3CoreCropEvidenceEnabled() {
  return consensusFeatureEnabled('v3CoreCropEvidence')
}

function v3DeferredCorroborationEnabled() {
  return consensusFeatureEnabled('v3DeferredCorroboration')
}

function v3SharedFrameProcessingEnabled() {
  return consensusFeatureEnabled('v3SharedFrameProcessing')
}

function experimentalSelectedGeometryMode() {
  if (typeof window === 'undefined') return 'off'
  const value = new URLSearchParams(window.location.search).get('v3ReuseSelectedGeometry') || 'off'
  return ['1', 'true', 'direct'].includes(value.toLowerCase()) ? 'direct' : 'off'
}

function v3FrameDecodeWorkerEnabled() {
  return hasDebugQueryFlag('v3FrameDecodeWorker') && frameDecodeWorkerSupported()
}

function experimentalFrameFusionMode() {
  if (typeof window === 'undefined') return 'off'
  const value = (new URLSearchParams(window.location.search).get('v3FrameFusionEvidence') || '').toLowerCase()
  if (value === 'aligned') return 'aligned'
  return ['1', 'true', 'median'].includes(value) ? 'median' : 'off'
}

function v3AnswerZoneOptions(rawCrops, layout = null) {
  return {
    cv,
    rawCrops,
    geometrySource: v3LayoutAnchoredZonesEnabled() ? 'layout' : 'refined',
    cleanPrintedFrame: v3CleanPrintedFramesEnabled(),
  }
}

function replaceWithFreshV3Warp(worksheet, cleanSource, layout) {
  if (!v3PristineWarpEnabled() || !worksheet?.sourceAnchors || !cleanSource || !layout) return worksheet
  const freshWarp = warpToTemplate(cleanSource, worksheet.sourceAnchors, layout)
  worksheet.warpedImage?.delete?.()
  worksheet.warpedImage = freshWarp
  return worksheet
}

function wholeAnswerSequenceItemsFromZones(zones, frameIndex = null) {
  return (zones || []).map((zone) => ({
    id: `question-${zone.questionNum}-frame-${frameIndex ?? 'selected'}`,
    questionNum: zone.questionNum,
    frameIndex,
    imageDataUrl: zone.imageDataUrl || matToDataURL(zone.image),
  }))
}

function trimmedWholeAnswerSequenceItemsFromZones(zones, frameIndex = null, fraction = 0.04) {
  return (zones || []).map((zone) => {
    const dx = Math.max(1, Math.round(zone.image.cols * fraction))
    const dy = Math.max(1, Math.round(zone.image.rows * fraction))
    const width = zone.image.cols - dx * 2
    const height = zone.image.rows - dy * 2
    if (width < 1 || height < 1) return null
    const view = zone.image.roi(new cv.Rect(dx, dy, width, height))
    try {
      return {
        id: `question-${zone.questionNum}-frame-${frameIndex ?? 'selected'}-trim-${fraction}`,
        questionNum: zone.questionNum,
        frameIndex,
        imageDataUrl: matToDataURL(view),
      }
    } finally {
      view.delete?.()
    }
  }).filter(Boolean)
}

function hybridBurstEnabled() {
  return hybridV2Enabled() || hybridV3Enabled()
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

function getGrayFocusScore(gray, width, height) {
  if (!gray || width < 3 || height < 3) return 0
  let sum = 0
  let count = 0
  for (let y = 1; y < height - 1; y++) {
    const row = y * width
    for (let x = 1; x < width - 1; x++) {
      const i = row + x
      const gx = gray[i + 1] - gray[i - 1]
      const gy = gray[i + width] - gray[i - width]
      sum += gx * gx + gy * gy
      count += 1
    }
  }
  return count ? sum / count : 0
}

function getCanvasFocusScore(canvas) {
  if (!canvas || !canvas.width || !canvas.height) return 0
  const sample = document.createElement('canvas')
  sample.width = CONTOUR_P_W
  sample.height = CONTOUR_P_H
  const ctx = sample.getContext('2d')
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, sample.width, sample.height)
  const gray = getGrayAndSAD(ctx, sample.width, sample.height).gray
  return getGrayFocusScore(gray, sample.width, sample.height)
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

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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

function makeStudentCaptureCanvas(video) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  const { cropW, cropH, cropX, cropY } = getPortraitCropRect(vw, vh)
  if (vw === 0 || vh === 0 || cropW < 1 || cropH < 1) {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = cropW
  canvas.height = cropH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH)
  return { canvas, cropW, cropH, cropX, cropY, vw, vh }
}

function makeStudentCaptureSample(canvas) {
  const sample = document.createElement('canvas')
  sample.width = CONTOUR_P_W
  sample.height = CONTOUR_P_H
  const ctx = sample.getContext('2d')
  ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, sample.width, sample.height)
  return sample
}

function scoreStudentCaptureCandidate(frame, index) {
  const stats = getCanvasLumaStats(frame.canvas)
  const focusScore = getCanvasFocusScore(frame.canvas)
  const sheetCheck = analyzeStudentSheetInPortraitCrop(makeStudentCaptureSample(frame.canvas))
  const blank = stats.mean < 4 && stats.variance < 6
  const markerCount = Array.isArray(sheetCheck?.markers) ? sheetCheck.markers.length : 0
  let score = blank ? -100000 : 0
  if (sheetCheck?.ok) score += 5000
  else if (markerCount === 4) score += 1200
  else score -= 2000
  score += Math.min(focusScore, 1800) * 1.3
  score += Math.min(stats.variance, 1200) * 0.35
  score -= Math.abs((stats.mean || 0) - 155) * 1.5
  const appearance = sheetCheck?.appearance
  const paper = appearance?.paperStats
  if (paper) {
    score += Math.min(Math.max((paper.brightFraction || 0) - 0.45, 0), 0.4) * 500
    score -= Math.max((paper.darkFraction || 0) - 0.18, 0) * 800
  }
  score += Number(appearance?.darkMarkerCount || 0) * 80
  return {
    ...frame,
    index,
    stats,
    focusScore,
    sampleSheetCheck: sheetCheck,
    blank,
    score
  }
}

async function captureStudentFrameCandidate(video, index) {
  await nextDrawableFrame(video)
  const frame = makeStudentCaptureCanvas(video)
  return frame ? scoreStudentCaptureCandidate(frame, index) : null
}

async function captureBestStudentFrame(video, source) {
  const frameCount = source === 'auto' ? AUTO_CAPTURE_BURST_FRAMES : 1
  let best = null
  const burstScores = []
  let burstCandidates = []
  for (let index = 0; index < frameCount; index += 1) {
    if (index > 0) await waitMs(AUTO_CAPTURE_BURST_DELAY_MS)
    const candidate = await captureStudentFrameCandidate(video, index)
    if (!candidate) continue
    if (hybridBurstEnabled()) {
      const bounded = retainTopCaptureCandidates(
        burstCandidates,
        candidate,
        HYBRID_BURST_EVIDENCE_FRAMES
      )
      burstCandidates = bounded.retained
      for (const discarded of bounded.discarded) {
        if (discarded?.canvas) {
          discarded.canvas.width = 1
          discarded.canvas.height = 1
        }
      }
    }
    burstScores.push({
      index,
      score: Math.round(candidate.score),
      focusScore: Math.round(candidate.focusScore),
      lumaMean: Number(candidate.stats.mean.toFixed(1)),
      lumaVariance: Number(candidate.stats.variance.toFixed(1)),
      sheetOk: candidate.sampleSheetCheck?.ok === true,
      sheetStatus: candidate.sampleSheetCheck?.status || null,
      blank: candidate.blank
    })
    // A later burst frame can be sharper than the frame that opened the gate
    // (for example, if the sheet has been moved away). It must still be a
    // confirmed ScanGrade worksheet before it is eligible to win.
    if (candidate.sampleSheetCheck?.ok === true && (!best || candidate.score > best.score)) {
      best = candidate
    }
  }
  if (best) {
    best.burstScores = burstScores
    best.burstFrameCount = frameCount
    if (hybridBurstEnabled()) {
      const evidenceEncodingStarted = performance.now()
      best.hybridBurstFrames = burstCandidates
        .filter((candidate) => !candidate.blank)
        .sort((a, b) => b.score - a.score)
        .slice(0, HYBRID_BURST_EVIDENCE_FRAMES)
        .map((candidate) => {
          const evidence = {
            index: candidate.index,
            score: Math.round(candidate.score),
            focusScore: Math.round(candidate.focusScore),
            lumaMean: Number(candidate.stats.mean.toFixed(1)),
            lumaVariance: Number(candidate.stats.variance.toFixed(1)),
            sheetOk: candidate.sampleSheetCheck?.ok === true,
            sheetStatus: candidate.sampleSheetCheck?.status || null,
            selected: candidate.index === best.index,
            imageDataUrl: candidate.canvas.toDataURL('image/jpeg', HYBRID_BURST_JPEG_QUALITY)
          }
          if (candidate !== best) {
            candidate.canvas.width = 1
            candidate.canvas.height = 1
          }
          return evidence
        })
      best.hybridBurstEncodingMs = Number((performance.now() - evidenceEncodingStarted).toFixed(1))
      best.hybridBurstEncodedBytes = best.hybridBurstFrames.reduce(
        (sum, frame) => sum + Math.ceil((frame.imageDataUrl?.length || 0) * 0.75),
        0
      )
    }
  }
  return best
}

function hasUsableScanGradeQr(payload) {
  if (!payload || typeof payload !== 'object') return false
  return Boolean(
    payload.layout_id ||
    payload.template_id ||
    payload.sheet_instance_id ||
    payload.sheet_lookup_code
  )
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
    if (shouldClearTransientCameraReadinessError({
      error: error.value,
      cameraReady: true,
    })) {
      error.value = null
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
  const focusScore = getGrayFocusScore(gray, sampleW, sampleH)
  const focusReady = !isPortrait || focusScore >= AUTO_GATE_FOCUS_SCORE_MIN_PORTRAIT
  if (isPortrait && pagePresent && !focusReady) {
    studentAutoStatus.value = 'Hold still while camera focuses'
  }
  previousFrameGray = gray
  const sadThreshold = isPortrait ? SAD_THRESHOLD_PORTRAIT : SAD_THRESHOLD
  const stable = pagePresent && variance >= varianceMin && sad < sadThreshold && focusReady
  const holdMs = isPortrait ? STABILITY_HOLD_MS_PORTRAIT : STABILITY_HOLD_MS
  if (isPortrait && typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_AUTO) {
    console.log('AutoCapture (portrait)', { sheetConfirmed: pagePresent, sad, sadThreshold, focusScore, focusThreshold: AUTO_GATE_FOCUS_SCORE_MIN_PORTRAIT, focusReady, stable })
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
  pendingHybridBurstFrames = []
  if (!videoRef.value) return
  const video = videoRef.value
  if (props.studentMode) {
    const drawable = await waitForDrawableVideoFrame(video, 4500)
    if (!drawable) {
      recordCaptureGate('camera-not-drawable', source)
      studentAutoStatus.value = 'Camera warming up'
      error.value = 'Camera is still warming up. Try again.'
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    if (source === 'auto') {
      studentAutoStatus.value = 'Choosing clearest frame'
    }
    const capture = await captureBestStudentFrame(video, source)
    if (!capture) {
      recordCaptureGate('no-frame-candidate', source)
      error.value = 'Camera not ready. Try again.'
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    const {
      canvas,
      cropW,
      cropH,
      cropX,
      cropY,
      vw,
      vh,
      stats,
      focusScore,
      burstScores,
      burstFrameCount,
      hybridBurstEncodingMs,
      hybridBurstEncodedBytes,
    } = capture
    if (stats.mean < 4 && stats.variance < 6) {
      recordCaptureGate('blank-frame', source)
      studentAutoStatus.value = 'Camera warming up'
      error.value = 'Camera captured a blank frame. Try again.'
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    const sheetCheck = analyzeStudentSheetInPortraitCrop(canvas)
    if (!sheetCheck.ok) {
      recordCaptureGate('sheet-gate', source, { status: sheetCheck.status || null })
      studentAutoStatus.value = sheetCheck.status || 'Put worksheet in frame'
      error.value = source === 'manual'
        ? `${studentAutoStatus.value}. Hold the worksheet inside the frame and try again.`
        : null
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    // The public product grades ScanGrade-authored QR worksheets. Require a
    // real, decodable ScanGrade QR before an automatic capture is committed.
    // This is an independent guard against patterned fabrics or other dark
    // objects accidentally resembling four corner markers.
    const captureQrPayload = decodeQrFromCanvas(canvas)
    if (!hasUsableScanGradeQr(captureQrPayload)) {
      recordCaptureGate('qr-gate', source)
      studentAutoStatus.value = 'Keep the QR code visible'
      error.value = source === 'manual'
        ? 'Keep the ScanGrade QR code visible and try again.'
        : null
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    if (
      source === 'auto' &&
      strictPerspectiveCaptureEnabled() &&
      sheetCheck.geometry?.preferredPerspective !== true
    ) {
      recordCaptureGate('perspective-gate', source)
      studentAutoStatus.value = 'Hold the camera more directly above the sheet'
      error.value = null
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    const focusDecision = studentCaptureFocusDecision({ source, focusScore })
    const focusThreshold = focusDecision.threshold
    const captureQuality = {
      cropW,
      cropH,
      cropX,
      cropY,
      vw,
      vh,
      lumaMean: stats.mean,
      lumaVariance: stats.variance,
      focusScore,
      focusThreshold,
      manualFocusThreshold: FOCUS_SCORE_MIN_PORTRAIT,
      autoFocusThreshold: AUTO_GATE_FOCUS_SCORE_MIN_PORTRAIT,
      autoFinalFocusThreshold: AUTO_CAPTURE_FINAL_FOCUS_SCORE_MIN_PORTRAIT,
      sheetOk: sheetCheck.ok === true,
      sheetStatus: sheetCheck.status || null,
      qrGatePassed: true,
      captureQrDecodeSource: captureQrPayload.qr_decode_source || null,
      sheetGeometry: sheetCheck.geometry || null,
      burstFrameCount,
      burstSelectedIndex: capture.index,
      burstBestScore: Math.round(capture.score),
      burstScores,
      hybridV2: hybridV2Enabled(),
      hybridV3: hybridV3Enabled(),
      v3EightFrameColumnOrder: v3EightFrameColumnOrderEnabled(),
      hybridBurstEvidenceCount: capture.hybridBurstFrames?.length || 0,
      hybridBurstEncodingMs: hybridBurstEncodingMs ?? null,
      hybridBurstEncodedBytes: hybridBurstEncodedBytes ?? null,
      hybridBurstEvidence: (capture.hybridBurstFrames || []).map(({ imageDataUrl: _imageDataUrl, ...metadata }) => metadata),
      source,
      capturedAt: new Date().toISOString()
    }
    if (!focusDecision.accepted) {
      recordCaptureGate('focus-gate', source, {
        focusScore: Math.round(focusScore),
        focusThreshold: Math.round(focusThreshold),
      })
      captureQuality.captureGateTelemetry = captureGateSnapshot()
      lastCaptureQuality.value = captureQuality
      studentAutoStatus.value = 'Hold still while camera focuses'
      error.value = source === 'manual'
        ? 'Image is still blurry. Hold steady and try again.'
        : null
      if (streamActive.value) startAutoCaptureLoop()
      return
    }
    recordCaptureGate('accepted', source)
    captureQuality.captureGateTelemetry = captureGateSnapshot()
    lastCaptureQuality.value = captureQuality
    pendingHybridBurstFrames = capture.hybridBurstFrames || []
    error.value = null
    capturedImage.value = canvas.toDataURL('image/png')
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_CAPTURE) {
      window.__SCANGRADE_DEBUG_CAPTURE_URL = capturedImage.value
      window.__SCANGRADE_DEBUG_CAPTURE_DIMS = captureQuality
      console.log('[ScanGrade] Student capture debug: dims', { cropW, cropH, cropX, cropY, vw, vh, stats, focusScore }, '- view image: window.__SCANGRADE_DEBUG_CAPTURE_URL')
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
  error.value = null
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
      const safetyConfig = wholeSlotScoutShadowConfig()
      if (drawable && safetyConfig.apply && safetyConfig.enabled) {
        // Initialize the browser-local safety reader while the teacher frames
        // the page so model setup does not extend the post-capture wait.
        void warmWholeSlotScout(safetyConfig).catch((warmupError) => {
          console.warn('[ScanGrade] accepted-answer safety warmup did not finish:', warmupError)
        })
      }
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

onMounted(() => {
  if (props.studentMode) {
    window.setTimeout(warmStudentDigitModel, 0)
  }
  if (hybridV3Enabled() && hasDebugQueryFlag('v3BurstReplay')) {
    window.__SCANGRADE_SET_V3_BURST_FRAMES = (frames) => {
      const accepted = (Array.isArray(frames) ? frames : [])
        .slice(0, HYBRID_BURST_EVIDENCE_FRAMES)
        .filter((frame) => /^data:image\/(?:png|jpeg);base64,/.test(String(frame?.imageDataUrl || '')))
        .filter((frame) => String(frame.imageDataUrl).length <= 8_000_000)
        .map((frame, index) => ({
          index: Number.isFinite(Number(frame.index)) ? Number(frame.index) : index,
          score: Number(frame.score || 0),
          focusScore: Number(frame.focusScore || 0),
          lumaMean: Number(frame.lumaMean || 0),
          lumaVariance: Number(frame.lumaVariance || 0),
          sheetOk: frame.sheetOk !== false,
          sheetStatus: frame.sheetStatus || 'debug-replay',
          selected: index === 0,
          imageDataUrl: String(frame.imageDataUrl),
          debugReplay: true,
        }))
      pendingHybridBurstFrames = accepted
      return accepted.length
    }
    window.__SCANGRADE_OPEN_REVIEW_QUESTION = (questionNum) => {
      const target = Number(questionNum)
      const group = studentAnswerGroups.value.find((item) => Number(item?.questionNum) === target)
      if (!group || group.reviewNeeded !== true) return false
      openCorrectionByGroupSlot(group)
      return true
    }
    window.__SCANGRADE_LOCAL_FIRST_CONTEXT_SUMMARY = () => ({
      items: (localFirstStrongContext.value?.sequenceItems || []).map((item) => ({
        id: item?.id || null,
        questionNum: Number(item?.questionNum),
        frameIndex: item?.frameIndex ?? null,
        cropVariant: item?.cropVariant || 'continuous-zone',
      })),
      statuses: { ...localFirstStrongStatusByQuestion.value },
      activeQuestionNum: activeCorrectionQuestionNum.value,
    })
  }
})

watch(
  () => [props.studentMode, props.captureEnabled],
  ([studentMode, captureEnabled]) => {
    if (studentMode && captureEnabled) warmStudentDigitModel()
  },
  { immediate: true }
)

watch(
  processing,
  (isProcessing) => {
    emit('processing-change', isProcessing)
  },
  { immediate: true }
)

watch(
  () => [cameraReady.value, Boolean(capturedImage.value), Boolean(ocrResult.value)],
  ([ready, hasCapturedImage, hasResult]) => {
    if (shouldClearTransientCameraReadinessError({
      error: error.value,
      cameraReady: ready,
      capturedImage: hasCapturedImage,
      resultReady: hasResult,
    })) {
      error.value = null
    }
  },
  { flush: 'sync' }
)

watch(
  () => processing.value ? 'scanning' : (progressiveMarkingActive.value ? 'grading' : ''),
  (stage) => {
    emit('student-stage-change', stage)
  },
  { immediate: true }
)

function clearProgressiveMarkingTimer() {
  if (progressiveMarkingTimer != null && typeof window !== 'undefined') {
    window.clearTimeout(progressiveMarkingTimer)
  }
  progressiveMarkingTimer = null
}

function finishProgressiveMarkingSoon(delayMs = 420) {
  clearProgressiveMarkingTimer()
  const remaining = Math.max(0, progressiveMarkingEarliestFinish - Date.now())
  progressiveMarkingTimer = window.setTimeout(() => {
    progressiveMarkingComplete.value = true
    progressiveDateStampRevealed.value = false
    progressiveCorrectionQuestionNum.value = null
    progressiveBaseImageOverride.value = ''
    progressiveMarkingTimer = null
  }, Math.max(delayMs, remaining))
}

function advanceProgressiveMarking() {
  if (!progressiveMarkingActive.value || typeof window === 'undefined') return
  if (!progressiveEvidenceReady.value) {
    clearProgressiveMarkingTimer()
    progressiveMarkingTimer = window.setTimeout(advanceProgressiveMarking, 120)
    return
  }
  const revealed = new Set(progressiveRevealedQuestionNums.value.map(Number))
  const next = progressiveMarkingStepList.value.find((step) => !revealed.has(Number(step.questionNum)))
  if (next) {
    progressiveRevealedQuestionNums.value = [
      ...progressiveRevealedQuestionNums.value,
      Number(next.questionNum),
    ]
    const completeStepMs = Math.max(
      620,
      ...next.strokes.map((stroke) =>
        (Number(stroke.delayMs) || 0) + (Number(stroke.durationMs) || 0) + 80
      ),
    )
    clearProgressiveMarkingTimer()
    progressiveMarkingTimer = window.setTimeout(advanceProgressiveMarking, completeStepMs)
    return
  }
  if (progressiveReviewPending.value) {
    clearProgressiveMarkingTimer()
    progressiveMarkingTimer = window.setTimeout(advanceProgressiveMarking, 320)
    return
  }
  const nextReviewGroup = nextYellowReviewGroup(
    studentAnswerGroups.value,
    ocrResult.value?.questionReview,
    null,
  )
  if (nextReviewGroup) {
    clearProgressiveMarkingTimer()
    if (!activeCorrectionQuestion.value && progressiveCorrectionQuestionNum.value == null) {
      openCorrectionByGroupSlot(nextReviewGroup)
    }
    return
  }
  if (progressiveScoreStep.value && !progressiveScoreRevealed.value) {
    progressiveScoreRevealed.value = true
    clearProgressiveMarkingTimer()
    const lastStroke = progressiveScoreStep.value.strokes.at(-1)
    const duration = Number(lastStroke?.delayMs || 0) + Number(lastStroke?.durationMs || 0) + 220
    progressiveMarkingTimer = window.setTimeout(advanceProgressiveMarking, duration)
    return
  }
  if (progressiveScoreStep.value && progressiveScoreRevealed.value && !progressiveDateStampRevealed.value) {
    progressiveDateStampRevealed.value = true
    clearProgressiveMarkingTimer()
    progressiveMarkingTimer = window.setTimeout(advanceProgressiveMarking, 420)
    return
  }
  finishProgressiveMarkingSoon()
}

function resetProgressiveMarking() {
  clearProgressiveMarkingTimer()
  progressiveRevealedQuestionNums.value = []
  progressiveScoreRevealed.value = false
  progressiveDateStampRevealed.value = false
  progressiveMarkingComplete.value = false
  progressiveMarkingSessionKey.value = ''
  progressiveCorrectionQuestionNum.value = null
  progressiveBaseImageOverride.value = ''
  progressiveMarkingEarliestFinish = 0
}

function manualCorrectionFocusRect(questionNum) {
  const regions = allAnnotationRegions.value
    .filter((region) => Number(region?.questionNum) === Number(questionNum))
    .map((region) => ({
      x: Number(region?.focusX),
      y: Number(region?.focusY),
      w: Number(region?.focusW),
      h: Number(region?.focusH),
    }))
    .filter((rect) => (
      Number.isFinite(rect.x) && Number.isFinite(rect.y) &&
      Number.isFinite(rect.w) && rect.w > 0 &&
      Number.isFinite(rect.h) && rect.h > 0
    ))
  if (!regions.length) return null
  const x = Math.min(...regions.map((rect) => rect.x))
  const y = Math.min(...regions.map((rect) => rect.y))
  const right = Math.max(...regions.map((rect) => rect.x + rect.w))
  const bottom = Math.max(...regions.map((rect) => rect.y + rect.h))
  return { x, y, w: right - x, h: bottom - y }
}

function imageElementFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('annotation image failed to load'))
    image.src = url
  })
}

async function waitForDisplayedCorrectionBase(expectedUrl, timeoutMs = 650) {
  if (!expectedUrl || typeof window === 'undefined') return
  await nextTick()
  const image = displayedResultImageRef.value
  if (!image) return
  await new Promise((resolve) => {
    let settled = false
    let timeout = null
    const finishAfterPaint = () => {
      if (settled) return
      settled = true
      if (timeout != null) window.clearTimeout(timeout)
      image.removeEventListener('load', finishAfterPaint)
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
    }
    const displayedSource = image.getAttribute('src') || image.currentSrc
    if (image.complete && image.naturalWidth > 0 && displayedSource === expectedUrl) {
      finishAfterPaint()
      return
    }
    image.addEventListener('load', finishAfterPaint, { once: true })
    timeout = window.setTimeout(finishAfterPaint, timeoutMs)
  })
}

// Keep the worksheet's already-settled marks visible during a manual fix. Only
// replace the old yellow review ink inside the answer area with the clean page
// beneath it, then copy the settled black correction into that same patch.
// The following animation therefore adds only the check/X; the entered answer
// remains continuously visible.
async function manualCorrectionAnimationBase(
  previousAnnotatedImageUrl,
  completedAnnotatedImageUrl,
  questionNum,
) {
  const cleanBaseUrl = ocrResult.value?.annotationBaseUrl || capturedImage.value
  const rect = manualCorrectionFocusRect(questionNum)
  const { width, height } = progressiveMarkingDimensions.value
  if (!previousAnnotatedImageUrl || !cleanBaseUrl || !rect || !width || !height) {
    return previousAnnotatedImageUrl || cleanBaseUrl || ''
  }
  try {
    const [previous, clean, completed] = await Promise.all([
      imageElementFromUrl(previousAnnotatedImageUrl),
      imageElementFromUrl(cleanBaseUrl),
      imageElementFromUrl(completedAnnotatedImageUrl),
    ])
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return previousAnnotatedImageUrl
    context.drawImage(previous, 0, 0, width, height)
    // The date is a completion seal. Intermediate annotated images contain it
    // for export, so remove it from the correction-animation base until the
    // final handwritten score has finished drawing.
    const dateQuestionRects = (ocrResult.value?.annotationRegions || [])
      .map((region) => ({
        x: Number(region?.focusX),
        y: Number(region?.focusY),
        w: Number(region?.focusW),
        h: Number(region?.focusH),
      }))
      .filter((candidate) => (
        Number.isFinite(candidate.x) &&
        Number.isFinite(candidate.y) &&
        Number.isFinite(candidate.w) &&
        Number.isFinite(candidate.h)
      ))
    const dateRect = dateStampSpecForLayout(
      scanningAnnotationPreview.value?.layout,
      width,
      height,
      ocrResult.value?.annotationSeed ?? 1,
      new Date(),
      dateQuestionRects,
    )?.rect
    if (dateRect) {
      context.drawImage(
        clean,
        dateRect.x,
        dateRect.y,
        dateRect.w,
        dateRect.h,
        dateRect.x,
        dateRect.y,
        dateRect.w,
        dateRect.h,
      )
    }
    const questionGroups = Array.isArray(ocrResult.value?.layoutSnapshot?.question_groups)
      ? ocrResult.value.layoutSnapshot.question_groups
      : []
    const groupIndex = questionGroups.findIndex((group, index) =>
      Number(group?.question_num ?? index + 1) === Number(questionNum)
    )
    const reviewSeed = (Math.max(0, groupIndex) + 1) * 131 + 211
    const clearRect = manualCorrectionClearRect(rect, reviewSeed, { width, height })
    if (!clearRect) return previousAnnotatedImageUrl
    context.drawImage(
      clean,
      clearRect.x,
      clearRect.y,
      clearRect.w,
      clearRect.h,
      clearRect.x,
      clearRect.y,
      clearRect.w,
      clearRect.h,
    )
    context.drawImage(
      completed,
      clearRect.x,
      clearRect.y,
      clearRect.w,
      clearRect.h,
      clearRect.x,
      clearRect.y,
      clearRect.w,
      clearRect.h,
    )
    // Lossless encoding keeps the settled correction pixel-identical while
    // focus chrome disappears and its check/X begins drawing.
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.warn('[ScanGrade] manual correction animation base failed:', error)
    return previousAnnotatedImageUrl
  }
}

function startManualCorrectionAnimation(questionNum, correctionAnimationBaseUrl) {
  if (typeof window === 'undefined' || !props.studentMode) return
  clearProgressiveMarkingTimer()
  progressiveCorrectionQuestionNum.value = Number(questionNum)
  progressiveBaseImageOverride.value = correctionAnimationBaseUrl || ''
  progressiveRevealedQuestionNums.value = []
  progressiveScoreRevealed.value = false
  progressiveDateStampRevealed.value = false
  progressiveMarkingComplete.value = false
  progressiveMarkingEarliestFinish = Date.now() + 900
  progressiveMarkingTimer = window.setTimeout(advanceProgressiveMarking, 90)
}

watch(
  () => ({
    result: ocrResult.value,
    annotatedImage: ocrResult.value?.annotatedImageUrl || '',
    shadowStatus: ocrResult.value?.v3Shadow?.status || '',
    steps: progressiveMarkingStepList.value.map((step) => `${step.questionNum}:${step.status}`).join('|'),
  }),
  ({ result, annotatedImage }) => {
    if (!props.studentMode || !result || result.error || !annotatedImage || typeof window === 'undefined') return
    const sessionKey = String(result.annotationSeed || result.scanSessionId || capturedImage.value?.length || 'scan')
    if (progressiveMarkingSessionKey.value !== sessionKey) {
      resetProgressiveMarking()
      progressiveMarkingSessionKey.value = sessionKey
      progressiveMarkingEarliestFinish = Date.now() + 2200
      progressiveMarkingTimer = window.setTimeout(advanceProgressiveMarking, 360)
      return
    }
    if (progressiveMarkingActive.value && progressiveMarkingTimer == null) {
      progressiveMarkingTimer = window.setTimeout(advanceProgressiveMarking, 120)
    }
  },
  { flush: 'post' }
)

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
  manualCorrections = {},
  annotationSeed = Date.now()
) {
  return new Promise((resolve, reject) => {
    let settled = false
    const settle = (callback, value) => {
      if (settled) return
      settled = true
      window.clearTimeout(annotationRenderTimeout)
      callback(value)
    }
    const finish = (value) => settle(resolve, value)
    const fail = (error) => settle(
      reject,
      error instanceof Error ? error : new Error(String(error || 'annotation render failed'))
    )
    const annotationRenderTimeout = window.setTimeout(() => {
      fail(new Error('Annotation render timed out'))
    }, 8000)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
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
      const annotationJitterSeed = Number.isFinite(Number(annotationSeed)) ? Number(annotationSeed) : 1

      const TEACHER_INK = {
        green: TEACHER_GREEN_INK,
        red: TEACHER_RED_INK,
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

      const drawHandStroke = (segments, { color, width, seed = 1, passes = null, composite = 'source-over' }) => {
        const strokePasses = passes || [
          { alpha: 0.12, widthScale: 1.72, spread: 0.24 },
          { alpha: 0.7, widthScale: 1, spread: 0.11 },
          { alpha: 0.26, widthScale: 0.5, spread: 0.06 }
        ]
        ctx.save()
        ctx.strokeStyle = color
        ctx.globalCompositeOperation = composite
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

      const drawSmoothHandStroke = (segments, { color, width, seed = 1, passes = null }) => {
        const strokePasses = passes || [
          { alpha: 0.1, widthScale: 1.64, spread: 0.18 },
          { alpha: 0.62, widthScale: 0.95, spread: 0.08 },
          { alpha: 0.2, widthScale: 0.44, spread: 0.035 }
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
            if (!Array.isArray(segment) || segment.length < 2) return
            const points = segment.map((point, i) => [
              point[0] + jitter(seed + pass * 29 + i * 11 + segmentIndex * 7, width * passConfig.spread),
              point[1] + jitter(seed + pass * 31 + i * 13 + segmentIndex * 9, width * passConfig.spread)
            ])
            ctx.beginPath()
            ctx.moveTo(points[0][0], points[0][1])
            for (let i = 1; i < points.length - 1; i++) {
              const midX = (points[i][0] + points[i + 1][0]) / 2
              const midY = (points[i][1] + points[i + 1][1]) / 2
              ctx.quadraticCurveTo(points[i][0], points[i][1], midX, midY)
            }
            const last = points[points.length - 1]
            ctx.quadraticCurveTo(last[0], last[1], last[0], last[1])
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
        const geometry = fluorescentHighlighterGeometry(rect, seed)
        // Match the shared Sharpie-style fluorescent yellow used in the
        // interface. The transparency preserves the child's pencil work.
        const highlighter = 'rgb(238, 255, 0)'

        ctx.save()
        ctx.globalCompositeOperation = 'source-over'
        const drawPolygon = (points, alpha) => {
          ctx.beginPath()
          ctx.moveTo(points[0][0], points[0][1])
          points.slice(1).forEach(([px, py]) => ctx.lineTo(px, py))
          ctx.closePath()
          ctx.fillStyle = highlighter
          ctx.globalAlpha = alpha
          ctx.fill()
        }
        // Keep the Sharpie lemon-yellow hue, but let the pencil answer remain
        // clearly legible while a teacher decides what to enter.
        drawPolygon(geometry.polygon, 0.22)
        const inner = geometry.polygon.map(([px, py]) => [
          px + jitter(seed + Math.round(px) + 307, rect.w * 0.004),
          py + jitter(seed + Math.round(py) + 311, rect.h * 0.025),
        ])
        drawPolygon(inner, 0.02)
        ctx.restore()
      }

      const drawCheck = (rect, seed) => {
        const { x, y, size } = indicatorAnchor(rect, seed)
        const color = varyInk(TEACHER_INK.green, seed + 17, 10)
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
        drawSmoothHandStroke(
          [points],
          {
            color,
            width: Math.max(3.8, size * (0.092 + seededUnit(seed + 109) * 0.03)),
            seed,
            passes: TEACHER_GREEN_PEN_PASSES,
          }
        )
      }

      const drawX = (rect, seed) => {
        const { x, y, size } = indicatorAnchor(rect, seed)
        // Keep every X the same red. Geometry and pen passes still provide
        // natural variation without making two wrong marks look like
        // different ink colours.
        const color = TEACHER_RED_INK
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
            composite: 'multiply',
            // The animated SVG uses this exact opacity, width, colour and
            // multiply-on-paper treatment. Keeping one settled pass prevents
            // the X changing shade when the temporary SVG is replaced by the
            // final annotated bitmap.
            passes: [
              { alpha: TEACHER_RED_INK_OPACITY, widthScale: 1, spread: 0 }
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

      const drawDateStamp = (questionRects = []) => {
        const spec = dateStampSpecForLayout(
          layout,
          warpedW,
          warpedH,
          annotationJitterSeed,
          new Date(),
          questionRects,
        )
        if (!spec) return
        const { text, stampSeed, fontSize, spacing, x, y, rotation } = spec
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(rotation)
        ctx.font = `500 ${fontSize}px "Courier New", "Lucida Console", Menlo, Monaco, monospace`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = varyInk(TEACHER_INK.blue, stampSeed + 29, 10)
        ctx.globalCompositeOperation = 'multiply'
        drawStampedText(text, 0, 0, spacing, stampSeed + 31, fontSize, 1.36)
        ctx.restore()
      }

      const drawScoreMark = (text, centerX, y, { color, fontSize, seed }) => {
        const plan = buildTeacherScoreStrokePlan({ text, centerX, y, fontSize, seed })
        const inkStrokes = buildTeacherScoreInkPlan(plan, TEACHER_GREEN_PEN_PASSES)
        inkStrokes.forEach((stroke) => {
          ctx.save()
          ctx.strokeStyle = color
          ctx.globalCompositeOperation = 'multiply'
          ctx.globalAlpha = stroke.opacity
          ctx.lineWidth = stroke.width
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(stroke.points[0][0], stroke.points[0][1])
          for (let index = 1; index < stroke.points.length - 1; index += 1) {
            const point = stroke.points[index]
            const next = stroke.points[index + 1]
            ctx.quadraticCurveTo(
              point[0],
              point[1],
              (point[0] + next[0]) / 2,
              (point[1] + next[1]) / 2,
            )
          }
          const last = stroke.points.at(-1)
          ctx.quadraticCurveTo(last[0], last[1], last[0], last[1])
          ctx.stroke()
          ctx.restore()
        })
      }

      const drawManualAnswer = (rects, cells, seed) => {
        if (!Array.isArray(rects) || !Array.isArray(cells)) return
        const visibleEntries = rects
          .map((rect, index) => ({ rect, cell: cells[index] }))
          .filter(({ rect, cell }) => rect && cell !== null && cell !== undefined && cell !== '')
        const validRects = visibleEntries.map(({ rect }) => rect)
        if (!validRects.length) return
        ctx.save()
        const tapeX0 = Math.min(...validRects.map((rect) => rect.x))
        const tapeY0 = Math.min(...validRects.map((rect) => rect.y))
        const tapeX1 = Math.max(...validRects.map((rect) => rect.x + rect.w))
        const tapeY1 = Math.max(...validRects.map((rect) => rect.y + rect.h))
        const tapeW = tapeX1 - tapeX0
        const tapeH = tapeY1 - tapeY0
        const tapeInsetX = -tapeW * 0.035
        const tapeInsetY = tapeH * 0.045
        const centerX = tapeX0 + tapeW / 2 + jitter(seed + 401, tapeW * 0.01)
        const centerY = tapeY0 + tapeH / 2 + jitter(seed + 403, tapeH * 0.012)
        const stripW = tapeW - tapeInsetX * 2
        const stripH = tapeH - tapeInsetY * 2
        const angle = jitter(seed + 409, 0.012)
        const roughTapePath = () => {
          const left = -stripW / 2
          const right = stripW / 2
          const top = -stripH / 2
          const bottom = stripH / 2
          ctx.beginPath()
          ctx.moveTo(left + jitter(seed + 421, stripW * 0.012), top + jitter(seed + 423, stripH * 0.05))
          ctx.lineTo(left + stripW * 0.25, top + jitter(seed + 425, stripH * 0.035))
          ctx.lineTo(left + stripW * 0.56, top + jitter(seed + 427, stripH * 0.03))
          ctx.lineTo(right + jitter(seed + 429, stripW * 0.012), top + jitter(seed + 431, stripH * 0.06))
          ctx.lineTo(right + jitter(seed + 433, stripW * 0.012), bottom + jitter(seed + 435, stripH * 0.06))
          ctx.lineTo(left + stripW * 0.62, bottom + jitter(seed + 437, stripH * 0.035))
          ctx.lineTo(left + stripW * 0.27, bottom + jitter(seed + 439, stripH * 0.04))
          ctx.lineTo(left + jitter(seed + 441, stripW * 0.012), bottom + jitter(seed + 443, stripH * 0.06))
          ctx.closePath()
        }
        ctx.save()
        ctx.translate(centerX, centerY)
        ctx.rotate(angle)
        roughTapePath()
        ctx.globalAlpha = 0.16
        ctx.fillStyle = 'rgba(86, 79, 64, 0.32)'
        ctx.translate(0.8, 1.2)
        ctx.fill()
        ctx.translate(-0.8, -1.2)
        roughTapePath()
        ctx.globalAlpha = 0.92
        ctx.fillStyle = '#fbfaf4'
        ctx.fill()
        ctx.globalAlpha = 0.42
        ctx.strokeStyle = 'rgba(203, 196, 178, 0.72)'
        ctx.lineWidth = Math.max(1.4, tapeH * 0.018)
        ctx.stroke()
        for (let scratch = 0; scratch < 4; scratch++) {
          const scratchSeed = seed + 461 + scratch * 17
          ctx.globalAlpha = 0.13 + seededUnit(scratchSeed) * 0.08
          ctx.strokeStyle = 'rgba(176, 169, 150, 0.55)'
          ctx.lineWidth = Math.max(0.8, tapeH * 0.009)
          ctx.beginPath()
          const sx = -stripW * 0.42 + seededUnit(scratchSeed + 3) * stripW * 0.84
          const sy = -stripH * 0.28 + seededUnit(scratchSeed + 5) * stripH * 0.56
          ctx.moveTo(sx, sy)
          ctx.lineTo(sx + stripW * (0.1 + seededUnit(scratchSeed + 7) * 0.18), sy + jitter(scratchSeed + 9, stripH * 0.06))
          ctx.stroke()
        }
        ctx.restore()

        visibleEntries.forEach(({ rect, cell: digit }, index) => {
          const digitText = String(digit)
          const widthScale = digitText.length > 1 ? 0.58 : 1.05
          const minimumSize = digitText.length > 1 ? 30 : 38
          const fontSize = Math.max(minimumSize, Math.min(rect.h * 0.86, rect.w * widthScale))
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
          ctx.strokeText(digitText, 0, 0)
          ctx.fillStyle = '#171717'
          ctx.globalAlpha = 0.96
          ctx.fillText(digitText, 0, 0)
          ctx.globalAlpha = 0.28
          ctx.fillText(digitText, jitter(seed + index * 29, 1.3), jitter(seed + index * 31, 1.1))
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
            const slotRects = ids.map((id) => {
              const crop = cropById.get(id)
              return annotationRectForCrop(crop)
            })
            const groupPredictions = ids.map((id) => predictionById.get(id)).filter(Boolean)
            const correct = Array.isArray(questionCorrect) ? questionCorrect[index] : undefined
            const hasReview = questionRequiresTeacherReview(group, ids, predictionById)
            const correction = manualCorrections[String(group?.question_num ?? index + 1)]
            const reviewSlotRects = slotRects
              .map((slotRect, slotIndex) => ({
                slotRect,
                slotIndex,
                // Once a teacher has corrected a physical slot, its former
                // yellow review ink must never survive underneath the blue
                // correction. Other genuinely unresolved slots still remain
                // yellow and reviewable.
                needsReview: slotNeedsReview(group, ids, slotIndex, predictionById) &&
                  !correction?.correctedSlots?.includes(slotIndex)
              }))
              .filter((slot) => slot.slotRect && slot.needsReview)
            const seed = (index + 1) * 131

            ctx.save()
            if (correction?.cells) {
              const correctedSlots = Array.isArray(correction.correctedSlots)
                ? correction.correctedSlots.filter((slotIndex) =>
                    Number.isInteger(slotIndex) &&
                    slotIndex >= 0 &&
                    slotIndex < slotRects.length
                  )
                : correction.cells.map((_, slotIndex) => slotIndex)
              const correctedEntries = correctedSlots
                .map((slotIndex) => ({ rect: slotRects[slotIndex], cell: correction.cells[slotIndex] }))
                .filter((entry) => entry.rect)
              const displayCells = manualCorrectionDisplayCells(correction, correctedEntries)
              drawManualCorrectionInk(ctx, correctedEntries.map((entry) => entry.rect), displayCells, seed + 47)
            }
            if (hasReview) {
              const validSlotRects = reviewSlotRects.map((slot) => slot.slotRect).filter(Boolean)
              const reviewRect = unionRects(validSlotRects)
              if (reviewRect) drawReviewMark(reviewRect, seed + 211)
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
              drawReviewMark(rect, seed + 211)
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
          // A score is a teacher's final mark, not a provisional estimate. Keep
          // the page free of one until every yellow answer has been resolved.
          if (reviewCount > 0) {
            finish(canvas.toDataURL('image/jpeg', 0.92))
            return
          }
          const ratio = score / total
          const scoreText = `${score}/${total}`
          const placement = teacherScorePlacement({
            width: warpedW,
            height: warpedH,
            layout,
            questionRects,
          })
          drawScoreMark(scoreText, placement.centerX, placement.y, {
            color: ratio >= 0.7 ? TEACHER_INK.green : ratio >= 0.5 ? TEACHER_INK.amber : TEACHER_INK.red,
            fontSize: placement.fontSize,
            seed: annotationJitterSeed + 9001
          })
        }

        finish(canvas.toDataURL('image/jpeg', 0.92))
      } catch (error) {
        fail(error)
      }
    }
    img.onerror = () => fail(new Error('Annotation base image failed to load'))
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

function answerDigitCount(answer) {
  if (answer == null) return 0
  const text = String(answer).trim()
  return /^\d+$/.test(text) ? text.length : 0
}

function groupAnswerTextOverride(group, predictionById) {
  const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
  const values = ids
    .map((id) => predictionById.get(id)?.answerTextOverride)
    .filter((value) => /^\d{1,4}$/.test(String(value || '')))
  if (!values.length || !values.every((value) => String(value) === String(values[0]))) return null
  return String(values[0])
}

function groupHasRequiredSlotReview(group, ids, predictionById) {
  if (groupAnswerTextOverride(group, predictionById)) return false
  if (!Array.isArray(ids) || ids.length === 0) return true
  if (ids.every((id) => predictionById.get(id)?.manualCorrected === true)) return false
  const expectedDigitCount = answerDigitCount(group?.answer)
  const hasMissingPrediction = ids.some((id) => !predictionById.get(id))
  if (hasMissingPrediction) return true
  if (expectedDigitCount < ids.length) return false
  return ids.some((id) => {
    const prediction = predictionById.get(id)
    const normalized = normalizeGradingDigit(
      prediction?.blank === true || prediction?.empty === true ? null : prediction?.digit
    )
    return normalized === null || normalized === undefined
  })
}

function slotNeedsReview(group, ids, slotIndex, predictionById) {
  if (!Array.isArray(ids) || slotIndex < 0 || slotIndex >= ids.length) return true
  const id = ids[slotIndex]
  const prediction = predictionById.get(id)
  if (prediction?.manualCorrected === true) return false
  if (prediction?.reviewNeeded) return true
  const expectedDigitCount = answerDigitCount(group?.answer)
  if (expectedDigitCount < ids.length) return false
  const normalized = normalizeGradingDigit(
    prediction?.blank === true || prediction?.empty === true ? null : prediction?.digit
  )
  return normalized === null || normalized === undefined
}

function displaySlotCountForGroup(group, layoutGroup = null) {
  const ids = Array.isArray(group?.digitBoxIds)
    ? group.digitBoxIds
    : Array.isArray(group?.digit_box_ids)
      ? group.digit_box_ids
      : Array.isArray(layoutGroup?.digit_box_ids)
        ? layoutGroup.digit_box_ids
        : []
  const displayDigits = Array.isArray(group?.displayDigits) ? group.displayDigits : []
  const displayContract = layoutGroup || group
  const printedSlots = Number(displayContract?.guide_line?.slot_count)
  if (Number.isInteger(printedSlots) && printedSlots > 0) return printedSlots
  if (ids.length > 0) return ids.length
  return Math.max(displayDigits.length, answerDigitCount(group?.answer ?? layoutGroup?.answer), 1)
}

function normalizeDisplayDigits(cells, slotCount) {
  const out = Array.isArray(cells) ? cells.slice(0, slotCount) : []
  while (out.length < slotCount) out.push('')
  return out
}

function normalizeAnswerGroupsForDisplay(answerGroups, questionGroups = []) {
  if (!Array.isArray(answerGroups) || answerGroups.length === 0) return []
  const layoutByQuestionNum = new Map(
    (questionGroups || []).map((group, index) => [group?.question_num ?? index + 1, group])
  )
  return answerGroups.map((group, index) => {
    const questionNum = group?.questionNum ?? group?.question_num ?? index + 1
    const layoutGroup = layoutByQuestionNum.get(questionNum) || questionGroups[index] || null
    const digitBoxIds = Array.isArray(group?.digitBoxIds)
      ? group.digitBoxIds
      : Array.isArray(group?.digit_box_ids)
        ? group.digit_box_ids
        : Array.isArray(layoutGroup?.digit_box_ids)
          ? layoutGroup.digit_box_ids
          : []
    const slotCount = displaySlotCountForGroup({ ...group, digitBoxIds }, layoutGroup)
    return {
      ...group,
      questionNum,
      label: group?.label || `${questionLetter(index)})`,
      digitBoxIds,
      displayDigits: normalizeDisplayDigits(group?.displayDigits, slotCount),
      slotStatuses: normalizeDisplayDigits(group?.slotStatuses, slotCount),
      status: group?.status || 'review'
    }
  })
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

function acceptedResponsesForGroup(group, slotCount) {
  return acceptedResponsesForSlotContract({
    answer: group?.answer,
    acceptedDigitResponses: group?.accepted_digit_responses,
    slotCount,
  })
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

function numberOrZero(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function plausibleSingleDigitResponseSlot(prediction, quality) {
  if (!prediction) return false
  const digit = normalizeGradingDigit(
    prediction.blank === true || prediction.empty === true ? null : prediction.digit
  )
  if (digit === null || digit === undefined) return false
  const confidence = numberOrZero(prediction.confidence)
  const topGap = numberOrZero(prediction.topGap)
  const inkPixels = numberOrZero(quality?.inkPixels)
  const inkW = numberOrZero(quality?.inkW)
  const inkH = numberOrZero(quality?.inkH)
  const weakRatio = numberOrZero(quality?.weakVariantRatio)
  const artifactRatio = numberOrZero(quality?.artifactVariantRatio)
  if (
    quality?.lineArtifactLikely === true ||
    quality?.horizontalArtifactLikely === true ||
    quality?.edgeArtifactLikely === true ||
    artifactRatio >= 0.30 ||
    weakRatio >= 0.55
  ) {
    return false
  }
  if (quality?.ok && inkPixels >= 42 && inkW >= 9 && inkH >= 10 && weakRatio < 0.55 && artifactRatio < 0.30) {
    return true
  }
  return confidence >= 0.66 && topGap >= 0.34 && inkPixels >= 28 && inkW >= 7 && inkH >= 9 && weakRatio < 0.55 && artifactRatio < 0.35
}

function oneDigitResponseSlotCanAutoGrade(prediction, quality) {
  if (!prediction || !plausibleSingleDigitResponseSlot(prediction, quality)) return false
  const confidence = numberOrZero(prediction.confidence)
  const topGap = numberOrZero(prediction.topGap)
  const weakRatio = numberOrZero(quality?.weakVariantRatio)
  const artifactRatio = numberOrZero(quality?.artifactVariantRatio)
  return (
    confidence >= 0.82 &&
    topGap >= 0.52 &&
    weakRatio < 0.25 &&
    artifactRatio < 0.12 &&
    prediction.highRiskPreprocessReview !== true &&
    prediction.structuralReview !== true &&
    prediction.highRiskMismatchReview !== true
  )
}

function leadingOneStrokeVariantLooksStrong(quality) {
  if (!quality) return false
  const inkPixels = numberOrZero(quality.inkPixels)
  const inkW = numberOrZero(quality.inkW)
  const inkH = numberOrZero(quality.inkH)
  const density = numberOrZero(quality.density)
  const maxRowCount = numberOrZero(quality.maxRowCount)
  const maxColCount = numberOrZero(quality.maxColCount)
  const edgeInkRatio = numberOrZero(quality.edgeInkRatio)
  return (
    quality.ok === true &&
    quality.lineArtifactLikely !== true &&
    quality.horizontalArtifactLikely !== true &&
    quality.edgeArtifactLikely !== true &&
    inkPixels >= 12 &&
    inkPixels <= 42 &&
    inkW >= 2 &&
    inkW <= 6 &&
    inkH >= 12 &&
    inkH <= 22 &&
    density <= 0.62 &&
    maxRowCount <= 3 &&
    maxColCount >= 8 &&
    edgeInkRatio <= 0.25
  )
}

function contextAssistedLeadingOneEvidence(prediction, quality) {
  if (!prediction || !quality) return null
  if (Number(prediction.digit) !== 9) return null
  if (numberOrZero(prediction.confidence) < 0.38) return null
  if (numberOrZero(quality.weakVariantRatio) >= 0.65) return null
  if (numberOrZero(quality.artifactVariantRatio) >= 0.35) return null

  const trustedNames = new Set([
    'raw-border-slot',
    'wide-slot',
    'no-side-erase',
    'center-safe-slot',
    'expected-slot',
    'edge-band-slot',
    'gentle'
  ])
  const anchorNames = new Set([
    'raw-border-slot',
    'wide-slot',
    'no-side-erase',
    'expected-slot'
  ])
  const hits = (Array.isArray(quality.variantQualities) ? quality.variantQualities : [])
    .filter((variant) => trustedNames.has(variant?.variantName) && leadingOneStrokeVariantLooksStrong(variant))
  const anchors = hits.filter((variant) => anchorNames.has(variant?.variantName))
  if (hits.length < 3 || anchors.length < 1) return null

  return {
    reason: 'context-assisted-leading-one',
    variantNames: hits.map((variant) => variant.variantName),
    anchorVariantNames: anchors.map((variant) => variant.variantName),
    originalDigit: prediction.digit,
    originalConfidence: prediction.confidence ?? null,
    originalTopGap: prediction.topGap ?? null
  }
}

function rightSlotStableForContextAssist(prediction, expectedDigit) {
  if (!prediction) return false
  return (
    normalizeGradingDigit(prediction.digit) === expectedDigit &&
    prediction.reviewNeeded !== true &&
    numberOrZero(prediction.confidence) >= 0.70 &&
    numberOrZero(prediction.topGap) >= 0.16
  )
}

function applyContextAssistedLeadingOneRescues(questionGroups, predictions, cropQuality) {
  if (!Array.isArray(questionGroups) || !Array.isArray(predictions)) return []
  const predictionById = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  const qualityById = new Map((cropQuality || []).map((quality) => [quality.id, quality]))
  const rescues = []

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const answer = group?.answer == null ? '' : String(group.answer).trim()
    if (ids.length !== 2 || !/^1\d$/.test(answer)) continue

    const expectedRightDigit = Number(answer[1])
    const leftPrediction = predictionById.get(ids[0])
    const rightPrediction = predictionById.get(ids[1])
    if (!leftPrediction || !rightPrediction) continue
    if (!rightSlotStableForContextAssist(rightPrediction, expectedRightDigit)) continue

    const evidence = contextAssistedLeadingOneEvidence(leftPrediction, qualityById.get(ids[0]))
    if (!evidence) continue

    const originalDigit = leftPrediction.digit
    const originalConfidence = numberOrZero(leftPrediction.confidence)
    const confidence = Math.min(0.93, Math.max(0.88, originalConfidence || 0.88))
    const runnerConfidence = Math.max(0.02, Math.min(0.07, 1 - confidence))
    const thirdConfidence = Math.max(0.005, Math.min(0.03, runnerConfidence / 2))
    const probs = Array.isArray(leftPrediction.probs) || ArrayBuffer.isView(leftPrediction.probs)
      ? Array.from(leftPrediction.probs)
      : new Array(10).fill(0.001)
    for (let i = 0; i < probs.length; i += 1) probs[i] = Math.min(probs[i] || 0.001, 0.03)
    probs[1] = confidence
    if (Number.isInteger(Number(originalDigit))) probs[Number(originalDigit)] = runnerConfidence

    leftPrediction.originalDigitBeforeContextAssist = originalDigit
    leftPrediction.originalConfidenceBeforeContextAssist = leftPrediction.confidence ?? null
    leftPrediction.originalTopGapBeforeContextAssist = leftPrediction.topGap ?? null
    leftPrediction.digit = 1
    leftPrediction.confidence = confidence
    leftPrediction.topGap = Math.max(0.58, confidence - runnerConfidence)
    leftPrediction.topK = [
      { digit: 1, confidence },
      { digit: Number(originalDigit), confidence: runnerConfidence },
      { digit: 7, confidence: thirdConfidence }
    ]
    leftPrediction.probs = probs
    leftPrediction.reviewNeeded = false
    leftPrediction.correct = true
    leftPrediction.robust = true
    leftPrediction.robustOverride = 'context-assisted-leading-one'
    leftPrediction.preprocessReviewReason = null
    leftPrediction.confidencePolicyCleared = true
    leftPrediction.confidencePolicyClearanceReason = 'context-assisted-leading-one'
    leftPrediction.highRiskMismatchReview = false
    leftPrediction.contextAssistEvidence = evidence

    rescues.push({
      questionNum: group?.question_num ?? null,
      leftDigitBoxId: ids[0],
      rightDigitBoxId: ids[1],
      expectedAnswer: answer,
      originalDigit,
      rescuedDigit: 1,
      rightDigit: rightPrediction.digit,
      evidence
    })
  }

  return rescues
}

function optionalBlankSlotLooksLikeArtifact(prediction, quality) {
  if (!prediction) return false
  const confidence = numberOrZero(prediction.confidence)
  const topGap = numberOrZero(prediction.topGap)
  const reason = String(prediction.preprocessReviewReason || '')
  const reviewSignal =
    prediction.reviewNeeded === true ||
    prediction.highRiskPreprocessReview === true ||
    prediction.structuralReview === true ||
    prediction.preprocessDisagreement === true ||
    reason.length > 0
  const weakInk =
    !quality?.ok ||
    quality?.allVariantsWeak === true ||
    numberOrZero(quality?.weakVariantRatio) >= 0.35 ||
    numberOrZero(quality?.artifactVariantRatio) >= 0.15 ||
    numberOrZero(quality?.inkPixels) <= 38 ||
    numberOrZero(quality?.maxRowCount) <= 4 ||
    numberOrZero(quality?.inkW) <= 8
  const guideLineOne =
    prediction.digit === 1 &&
    reviewSignal &&
    (
      prediction.highRiskPreprocessReview === true ||
      reason.includes('mismatch') ||
      reason.includes('guide') ||
      reason.includes('two-digit')
    )
  const weakGuideLineOne =
    prediction.digit === 1 &&
    numberOrZero(quality?.weakVariantRatio) >= 0.50 &&
    numberOrZero(quality?.artifactVariantRatio) >= 0.15
  const strongExtraDigit =
    confidence >= 0.93 &&
    topGap >= 0.82 &&
    prediction.reviewNeeded !== true &&
    !weakInk
  // A weak digit classifier is not evidence that a physical slot is blank.
  // The written digit can itself be hard to classify (for example a light 6)
  // while still containing substantial ink. Require weak/artifact-like image
  // evidence before erasing an optional slot. This lets the relative two-slot
  // contract keep the inkier written digit and discard a guide-line fragment
  // that several preprocessing variants misread as 1.
  return !strongExtraDigit && (
    weakGuideLineOne ||
    (reviewSignal && weakInk)
  )
}

function applyOptionalSingleDigitBlankOverrides(questionGroups, boxes, predictions, cropQuality) {
  if (!Array.isArray(questionGroups) || !Array.isArray(predictions)) return []
  const predictionById = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  const qualityById = new Map((cropQuality || []).map((quality) => [quality.id, quality]))
  const overrides = []

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const optionalIndices = optionalDigitIndicesForGroup(group, boxes)
    if (ids.length !== 2 || optionalIndices.length !== 1) continue

    const slots = ids.map((id, slotIndex) => ({
      id,
      slotIndex,
      prediction: predictionById.get(id),
      quality: qualityById.get(id)
    }))
    if (slots.some((slot) => !slot.prediction)) continue

    const decision = selectFlexibleOneDigitBlankSlots(group, slots, {
      isWrittenDigit: (slot) => plausibleSingleDigitResponseSlot(slot.prediction, slot.quality),
      isBlankArtifact: (slot) => optionalBlankSlotLooksLikeArtifact(slot.prediction, slot.quality),
    })
    if (!decision) continue
    const { matchedSlot, blankSlot } = decision

    const matchedPrediction = matchedSlot.prediction
    const blankPrediction = blankSlot.prediction
    const canAutoGrade = oneDigitResponseSlotCanAutoGrade(matchedPrediction, matchedSlot.quality)
    if (matchedPrediction.reviewNeeded === true && canAutoGrade) {
      matchedPrediction.reviewNeeded = false
      matchedPrediction.preprocessReviewReason = matchedPrediction.preprocessReviewReason || 'flexible-one-digit-answer'
      matchedPrediction.confidencePolicyCleared = true
      matchedPrediction.confidencePolicyClearanceReason = 'flexible-one-digit-answer'
    }
    delete matchedPrediction.correct
    blankPrediction.originalDigitBeforeBlankOverride = blankPrediction.digit
    blankPrediction.originalConfidenceBeforeBlankOverride = blankPrediction.confidence
    blankPrediction.digit = null
    blankPrediction.blank = true
    blankPrediction.empty = true
    delete blankPrediction.correct
    blankPrediction.reviewNeeded = false
    blankPrediction.preprocessReviewReason = 'flexible-one-digit-optional-blank'
    blankPrediction.confidencePolicyCleared = true
    blankPrediction.confidencePolicyClearanceReason = 'flexible-one-digit-optional-blank'
    overrides.push({
      questionNum: group?.question_num ?? null,
      matchedSlotIndex: matchedSlot.slotIndex,
      blankSlotIndex: blankSlot.slotIndex,
      blankDigitBoxId: blankSlot.id,
      matchedDigit: matchedPrediction.digit,
      answerKeyUsed: false,
      autoGradeCleared: canAutoGrade,
      originalDigit: blankPrediction.originalDigitBeforeBlankOverride,
      reason: blankPrediction.preprocessReviewReason
    })
  }

  return overrides
}

function buildQuestionCorrect(questionGroups, predictions) {
  if (!Array.isArray(questionGroups) || questionGroups.length === 0) return null
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  const out = []
  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    if (ids.length === 0) return null
    const answerOverride = groupAnswerTextOverride(group, byId)
    if (answerOverride) {
      out.push(answerOverride === String(group?.answer ?? '').trim())
      continue
    }
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

function questionRequiresTeacherReview(group, ids, predictionById) {
  const groupPredictions = ids.map((id) => predictionById.get(id)).filter(Boolean)
  return groupPredictions.some((prediction) => prediction?.reviewNeeded) ||
    groupHasRequiredSlotReview(group, ids, predictionById)
}

function buildQuestionReviewFlags(questionGroups, predictions, questionCorrect = null) {
  if (!Array.isArray(questionGroups) || questionGroups.length === 0) return null
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  return questionGroups.map((group, index) => {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const correct = Array.isArray(questionCorrect) ? questionCorrect[index] : undefined
    return questionRequiresTeacherReview(group, ids, byId)
  })
}

function buildAnswerGroups(questionGroups, predictions, questionCorrect = null, layoutId = '') {
  if (!Array.isArray(questionGroups) || questionGroups.length === 0) return null
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  return questionGroups.map((group, index) => {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const groupPredictions = ids.map((id) => byId.get(id))
    const predictionCells = ids.map((id) => {
      const prediction = byId.get(id)
      const normalized = normalizeGradingDigit(
        prediction?.blank === true || prediction?.empty === true ? null : prediction?.digit
      )
      return normalized === undefined ? '' : normalized
    })
    const answerText = group?.answer == null ? '' : String(group.answer).trim()
    const answerTextOverride = groupAnswerTextOverride(group, byId)
    const displaySlotCount = displaySlotCountForGroup({ ...group, digitBoxIds: ids }, group)
    const correct = Array.isArray(questionCorrect) ? questionCorrect[index] : undefined
    const hasReview = questionRequiresTeacherReview(group, ids, byId)
    const manualCorrected = groupPredictions.some((prediction) => prediction?.manualCorrected)
    const status =
      hasReview ? 'review' :
      correct === true ? 'correct' :
      correct === false ? 'incorrect' :
      'review'
    const effectiveCells = answerTextOverride
      ? (displaySlotCount === 1 ? [answerTextOverride] : [...answerTextOverride].map(Number))
      : predictionCells
    const displayDigits = normalizeDisplayDigits(effectiveCells, displaySlotCount)
    const predictedAnswerText = answerTextOverride || cellsToAnswerText(predictionCells)
    const slotStatuses = normalizeDisplayDigits(ids.map((id, slotIndex) => {
      const prediction = byId.get(id)
      if (prediction?.reviewNeeded || slotNeedsReview(group, ids, slotIndex, byId)) return 'review'
      if (prediction?.correct === true) return 'correct'
      if (prediction?.correct === false) return 'incorrect'
      return status
    }), displaySlotCount)
    const reviewGroup = layoutId ? { ...group, layoutId } : group
    const reviewSuggestion = hasReview
      ? likelyReadSuggestionForGroup(reviewGroup, predictions, { requireReview: true })
      : null

    return {
      key: `question-${group?.question_num ?? index + 1}`,
      label: `${questionLetter(index)})`,
      questionNum: group?.question_num ?? index + 1,
      problem: group?.problem || '',
      answer: group?.answer ?? null,
      digitBoxIds: ids,
      displayDigits,
      slotStatuses,
      answerText: predictedAnswerText,
      correct,
      reviewNeeded: hasReview,
      manualCorrected,
      status,
      ...(reviewSuggestion ? { reviewSuggestion } : {})
    }
  })
}

function clonePlain(value) {
  if (value == null) return value
  return JSON.parse(JSON.stringify(value))
}

function layoutUrlForId(layoutId) {
  return publicUrl(`layouts/${layoutId}.json`)
}

async function fetchLayoutJson(layoutUrl) {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timer = null
  try {
    if (controller) {
      timer = window.setTimeout(() => controller.abort(), 9000)
    }
    const response = await fetch(layoutUrl, controller ? { signal: controller.signal } : undefined)
    if (!response.ok) return null
    return response.json()
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Worksheet layout took too long to load. Check your connection and scan again.')
    }
    throw error
  } finally {
    if (timer != null) window.clearTimeout(timer)
  }
}

function createQrPayloadForKnownLayout(match) {
  if (!match?.layoutId) return null
  return {
    schema_version: 1,
    template_id: match.layoutId,
    template_version: 1,
    sheet_instance_id: `${match.layoutId}-known-title-fallback`,
    layout_id: match.layoutId,
    answer_key_checksum: match.checksum || undefined,
    qr_decode_source: 'printed-title-fallback'
  }
}

function makeReviewOnlyLayout(layout, reason = 'unknown-template-fallback') {
  const copy = clonePlain(layout)
  if (!copy || typeof copy !== 'object') return copy
  delete copy.answer_key
  copy.boxes = Array.isArray(copy.boxes)
    ? copy.boxes.map((box) => {
      const next = { ...box }
      delete next.expected_digit
      return next
    })
    : copy.boxes
  copy.question_groups = Array.isArray(copy.question_groups)
    ? copy.question_groups.map((group) => {
      const next = { ...group }
      delete next.answer
      delete next.canonical_digits
      delete next.accepted_digit_responses
      delete next.accepted_responses
      return next
    })
    : copy.question_groups
  copy.metadata = {
    ...(copy.metadata || {}),
    review_only_fallback: true,
    review_only_reason: reason
  }
  return copy
}

function matToCanvas(mat) {
  if (!mat || mat.rows === 0 || mat.cols === 0) return null
  const canvas = document.createElement('canvas')
  canvas.width = mat.cols
  canvas.height = mat.rows
  try {
    if (typeof cv !== 'undefined' && typeof cv.imshow === 'function') {
      cv.imshow(canvas, mat)
      return canvas
    }
  } catch (_) {
    // Fallback below.
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
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
  return canvas
}

function imageDataToDarkFeature(imageData, cols = 72, rows = 18) {
  if (!imageData?.data || !imageData.width || !imageData.height) return null
  const { data, width, height } = imageData
  const luminance = []
  const stride = Math.max(1, Math.floor((width * height) / 6000))
  for (let i = 0; i < width * height; i += stride) {
    const di = i * 4
    luminance.push(0.299 * data[di] + 0.587 * data[di + 1] + 0.114 * data[di + 2])
  }
  luminance.sort((a, b) => a - b)
  const background = luminance[Math.max(0, Math.min(luminance.length - 1, Math.floor(luminance.length * 0.88)))] || 235
  const features = new Array(cols * rows).fill(0)
  for (let y = 0; y < height; y++) {
    const fy = Math.max(0, Math.min(rows - 1, Math.floor((y / height) * rows)))
    for (let x = 0; x < width; x++) {
      const di = (y * width + x) * 4
      const lum = 0.299 * data[di] + 0.587 * data[di + 1] + 0.114 * data[di + 2]
      const ink = Math.max(0, Math.min(1, (background - lum - 10) / 90))
      if (ink <= 0) continue
      const fx = Math.max(0, Math.min(cols - 1, Math.floor((x / width) * cols)))
      features[fy * cols + fx] += ink
    }
  }
  const norm = Math.sqrt(features.reduce((sum, value) => sum + value * value, 0))
  if (!Number.isFinite(norm) || norm <= 0.0001) return null
  return features.map((value) => value / norm)
}

function cosineFeatureScore(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0
  let score = 0
  for (let i = 0; i < a.length; i++) score += a[i] * b[i]
  return score
}

function renderedTitleFeature(title, cols = 72, rows = 18) {
  const canvas = document.createElement('canvas')
  canvas.width = 720
  canvas.height = 180
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#111'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '700 50px Lexend, Arial, sans-serif'
  ctx.fillText(title, canvas.width / 2, canvas.height * 0.54, canvas.width * 0.94)
  return imageDataToDarkFeature(ctx.getImageData(0, 0, canvas.width, canvas.height), cols, rows)
}

function classifyKnownWorksheetLayoutFromWarped(warpedImage) {
  const canvas = matToCanvas(warpedImage)
  const ctx = canvas?.getContext('2d')
  if (!ctx) return null
  const cols = 72
  const rows = 18
  const expected = KNOWN_TITLE_FALLBACK_LAYOUTS
    .map((layout) => ({ ...layout, feature: renderedTitleFeature(layout.title, cols, rows) }))
    .filter((layout) => Array.isArray(layout.feature))
  if (!expected.length) return null
  const titleRects = [
    { x: 0.22, y: 0.094, w: 0.56, h: 0.070 },
    { x: 0.22, y: 0.104, w: 0.56, h: 0.070 },
    { x: 0.22, y: 0.114, w: 0.56, h: 0.070 },
    { x: 0.18, y: 0.098, w: 0.64, h: 0.078 }
  ]
  const scored = expected.map((layout) => ({ ...layout, score: 0 }))
  for (const rect of titleRects) {
    const x = Math.max(0, Math.round(rect.x * canvas.width))
    const y = Math.max(0, Math.round(rect.y * canvas.height))
    const w = Math.max(1, Math.min(canvas.width - x, Math.round(rect.w * canvas.width)))
    const h = Math.max(1, Math.min(canvas.height - y, Math.round(rect.h * canvas.height)))
    const observed = imageDataToDarkFeature(ctx.getImageData(x, y, w, h), cols, rows)
    if (!observed) continue
    scored.forEach((layout) => {
      layout.score = Math.max(layout.score, cosineFeatureScore(observed, layout.feature))
    })
  }
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]
  const second = scored[1]
  if (!best) return null
  const gap = second ? best.score - second.score : best.score
  return {
    layoutId: best.layoutId,
    title: best.title,
    humanCode: best.humanCode,
    checksum: best.checksum,
    score: best.score,
    gap,
    accepted: best.score >= 0.28 && gap >= 0.018,
    scores: scored.map(({ layoutId, title, score }) => ({ layoutId, title, score: Number(score.toFixed(4)) }))
  }
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

function buildSourceAnnotationContext(rawCrops, sourceAnchors, layout, warpedW, warpedH, sourceW, sourceH) {
  if (
    !Array.isArray(rawCrops) ||
    !Array.isArray(sourceAnchors) ||
    !layout ||
    !Number.isFinite(warpedW) ||
    !Number.isFinite(warpedH) ||
    !Number.isFinite(sourceW) ||
    !Number.isFinite(sourceH)
  ) return null

  const ids = ['tl', 'tr', 'br', 'bl']
  const sourceById = new Map(sourceAnchors.map((anchor) => [anchor.id, anchor]))
  const layoutAnchors = Array.isArray(layout?.homography?.anchors) ? layout.homography.anchors : []
  const layoutById = new Map(layoutAnchors.map((anchor) => [anchor.id, anchor]))
  if (!ids.every((id) => sourceById.has(id) && layoutById.has(id))) return null

  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, ids.flatMap((id) => {
    const anchor = layoutById.get(id)
    return [anchor.x * warpedW, anchor.y * warpedH]
  }))
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, ids.flatMap((id) => {
    const anchor = sourceById.get(id)
    return [anchor.x, anchor.y]
  }))
  const H = cv.getPerspectiveTransform(srcPoints, dstPoints)

  try {
    const transformPoints = (points) => {
      const pointMat = cv.matFromArray(points.length, 1, cv.CV_32FC2, points.flatMap((point) => [point.x, point.y]))
      const out = new cv.Mat()
      try {
        cv.perspectiveTransform(pointMat, out, H)
        const coords = []
        for (let i = 0; i < points.length; i++) {
          coords.push({ x: out.data32F[i * 2], y: out.data32F[i * 2 + 1] })
        }
        return coords
      } finally {
        pointMat.delete()
        out.delete()
      }
    }

    const transformRect = (rect) => {
      if (!rect || ![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite) || rect.w <= 0 || rect.h <= 0) return null
      const points = transformPoints([
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.w, y: rect.y },
        { x: rect.x + rect.w, y: rect.y + rect.h },
        { x: rect.x, y: rect.y + rect.h }
      ])
      const x0 = Math.max(0, Math.min(sourceW, Math.min(...points.map((point) => point.x))))
      const y0 = Math.max(0, Math.min(sourceH, Math.min(...points.map((point) => point.y))))
      const x1 = Math.max(0, Math.min(sourceW, Math.max(...points.map((point) => point.x))))
      const y1 = Math.max(0, Math.min(sourceH, Math.max(...points.map((point) => point.y))))
      if (x1 <= x0 || y1 <= y0) return null
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
    }

    const layoutRectsById = layoutBoxRectMap(layout, warpedW, warpedH)
    const transformCrop = (crop) => transformAnnotationCrop(
      crop,
      transformRect,
      layoutRectsById.get(crop?.id),
    )

    const sourceLayout = clonePlain(layout)
    sourceLayout.homography = {
      ...(sourceLayout.homography || {}),
      anchors: ids.map((id) => {
        const anchor = sourceById.get(id)
        return { id, x: anchor.x / sourceW, y: anchor.y / sourceH }
      })
    }
    const qr = layout?.metadata?.qr_position
    if (
      qr &&
      [qr.x, qr.y, qr.width, qr.height].every(Number.isFinite)
    ) {
      const qrRect = {
        x: qr.x * warpedW,
        y: qr.y * warpedH,
        w: qr.width * warpedW,
        h: qr.height * warpedH
      }
      const sourceQrRect = transformRect(qrRect)
      if (sourceQrRect) {
        sourceLayout.metadata = {
          ...(sourceLayout.metadata || {}),
          qr_position: {
            x: sourceQrRect.x / sourceW,
            y: sourceQrRect.y / sourceH,
            width: sourceQrRect.w / sourceW,
            height: sourceQrRect.h / sourceH
          }
        }
      }
    }
    const approvedDateRect = declaredDateStampRect(layout, warpedW, warpedH)
    if (approvedDateRect) {
      const sourceDateRect = transformRect(approvedDateRect)
      if (sourceDateRect) {
        sourceLayout.metadata = {
          ...(sourceLayout.metadata || {}),
          annotation_zones: {
            ...(sourceLayout.metadata?.annotation_zones || {}),
            date_stamp: {
              x: sourceDateRect.x / sourceW,
              y: sourceDateRect.y / sourceH,
              width: sourceDateRect.w / sourceW,
              height: sourceDateRect.h / sourceH,
            },
          },
        }
      }
    }

    return {
      crops: rawCrops.map(transformCrop),
      layout: sourceLayout,
      width: sourceW,
      height: sourceH
    }
  } finally {
    srcPoints.delete()
    dstPoints.delete()
    H.delete()
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
      expectedRect: cloneRect(crop.expectedRect),
      refinedRect: cloneRect(crop.refinedRect),
      annotationRect: cloneRect(crop.annotationRect),
      annotationRectSource: crop.annotationRectSource || null,
      layoutBoxRect: annotationLayoutReference(crop, expectedById.get(crop.id ?? index))
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

  return questionGroups.flatMap((group, index) => {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const rect = unionRects(ids.map((id) => {
      const crop = cropById.get(id)
      return annotationRectForCrop(crop)
    }))
    if (!rect) return []
    const correct = Array.isArray(questionCorrect) ? questionCorrect[index] : undefined
    const hasReview = questionRequiresTeacherReview(group, ids, predictionById)
    const questionNum = group?.question_num ?? index + 1
    const slotRegions = ids.map((id, slotIndex) => {
      const crop = cropById.get(id)
      const slotRect = annotationRectForCrop(crop)
      const prediction = predictionById.get(id)
      if (!slotRect) return null
      const slotManualCorrected = !!prediction?.manualCorrected
      const slotReviewNeeded = slotNeedsReview(group, ids, slotIndex, predictionById)
      const padX = Math.max(slotRect.h * 0.52, slotRect.w * 0.22)
      const padY = Math.max(slotRect.h * 0.45, slotRect.w * 0.08)
      const target = {
        x: Math.max(0, slotRect.x - padX),
        y: Math.max(0, slotRect.y - padY),
        w: Math.min(warpedW, slotRect.x + slotRect.w + padX) - Math.max(0, slotRect.x - padX),
        h: Math.min(warpedH, slotRect.y + slotRect.h + padY) - Math.max(0, slotRect.y - padY)
      }
      return {
        key: `question-region-${questionNum}-slot-${slotIndex}`,
        label: `${questionLetter(index)})`,
        questionNum,
        slotIndex,
        digitBoxId: id,
        digitBoxIds: ids,
        reviewNeeded: slotReviewNeeded,
        questionReviewNeeded: hasReview,
        correct,
        x: target.x,
        y: target.y,
        w: target.w,
        h: target.h,
        focusX: slotRect.x,
        focusY: slotRect.y,
        focusW: slotRect.w,
        focusH: slotRect.h,
        leftPct: (target.x / warpedW) * 100,
        topPct: (target.y / warpedH) * 100,
        widthPct: (target.w / warpedW) * 100,
        heightPct: (target.h / warpedH) * 100,
        focusLeftPct: (slotRect.x / warpedW) * 100,
        focusTopPct: (slotRect.y / warpedH) * 100,
        focusWidthPct: (slotRect.w / warpedW) * 100,
        focusHeightPct: (slotRect.h / warpedH) * 100,
        manualCorrected: slotManualCorrected
      }
    }).filter(Boolean)
    const reviewedSlotCount = slotRegions.filter((region) => region.reviewNeeded).length
    if (hasReview && slotRegions.length > 0 && (reviewedSlotCount === 0 || reviewedSlotCount === slotRegions.length)) {
      const focusRect = unionRects(slotRegions.map((region) => ({
        x: region.focusX,
        y: region.focusY,
        w: region.focusW,
        h: region.focusH
      })))
      if (focusRect) {
        const padX = Math.max(focusRect.h * 0.55, focusRect.w * 0.12)
        const padY = Math.max(focusRect.h * 0.42, focusRect.w * 0.045)
        const target = {
          x: Math.max(0, focusRect.x - padX),
          y: Math.max(0, focusRect.y - padY),
          w: Math.min(warpedW, focusRect.x + focusRect.w + padX) - Math.max(0, focusRect.x - padX),
          h: Math.min(warpedH, focusRect.y + focusRect.h + padY) - Math.max(0, focusRect.y - padY)
        }
        return [{
          key: `question-region-${questionNum}-answer`,
          label: `${questionLetter(index)})`,
          questionNum,
          slotIndex: null,
          wholeAnswer: true,
          digitBoxIds: ids,
          reviewNeeded: true,
          questionReviewNeeded: hasReview,
          correct,
          x: target.x,
          y: target.y,
          w: target.w,
          h: target.h,
          focusX: focusRect.x,
          focusY: focusRect.y,
          focusW: focusRect.w,
          focusH: focusRect.h,
          leftPct: (target.x / warpedW) * 100,
          topPct: (target.y / warpedH) * 100,
          widthPct: (target.w / warpedW) * 100,
          heightPct: (target.h / warpedH) * 100,
          focusLeftPct: (focusRect.x / warpedW) * 100,
          focusTopPct: (focusRect.y / warpedH) * 100,
          focusWidthPct: (focusRect.w / warpedW) * 100,
          focusHeightPct: (focusRect.h / warpedH) * 100,
          manualCorrected: slotRegions.some((region) => region.manualCorrected)
        }]
      }
    }
    return slotRegions
  }).filter(Boolean)
}

function buildOverlayDebugSnapshot({
  questionGroups,
  layoutId = null,
  annotationGeometry,
  annotationRegions,
  predictions,
  questionCorrect = null,
  questionReview = null,
  annotationBaseMode = 'unknown',
  annotationSeed = null,
  markedSheetAvailable = false
} = {}) {
  const groups = Array.isArray(questionGroups) ? questionGroups : []
  const crops = Array.isArray(annotationGeometry?.crops) ? annotationGeometry.crops : []
  const warpedW = annotationGeometry?.warpedW || 1
  const warpedH = annotationGeometry?.warpedH || 1
  const cropById = new Map(crops.map((crop, index) => [crop.id ?? index, crop]))
  const predictionById = new Map((predictions || []).map((prediction, index) => [prediction.id ?? index, prediction]))

  const questionMarks = groups.map((group, index) => {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const slotRects = ids.map((id) => {
      const crop = cropById.get(id)
      const rect = annotationRectForCrop(crop)
      return rect ? { digitBoxId: id, ...cloneRect(rect) } : null
    }).filter(Boolean)
    const answerRect = unionRects(slotRects)
    const groupPredictions = ids.map((id) => predictionById.get(id)).filter(Boolean)
    const correct = Array.isArray(questionCorrect) ? questionCorrect[index] : undefined
    const reviewNeeded =
      Array.isArray(questionReview) && typeof questionReview[index] === 'boolean'
        ? questionReview[index]
        : groupPredictions.some((prediction) => prediction?.reviewNeeded) ||
          groupHasRequiredSlotReview(group, ids, predictionById)
    const reviewSlots = ids
      .map((id, slotIndex) => ({ id, slotIndex }))
      .filter(({ slotIndex }) => slotNeedsReview(group, ids, slotIndex, predictionById))
      .map(({ slotIndex }) => slotIndex)
    const markKind = reviewNeeded
      ? 'review'
      : correct === true
        ? 'check'
        : correct === false
          ? 'x'
          : 'none'
    const markRects = markKind === 'review'
      ? (
          reviewSlots.length === 0 && answerRect
            ? [{ kind: 'whole-answer-review', ...cloneRect(answerRect) }]
            : slotRects.length > 1 && reviewSlots.length === slotRects.length && answerRect
            ? [{ kind: 'whole-answer-review', ...cloneRect(answerRect) }]
            : reviewSlots
              .map((slotIndex) => {
                const slotRect = slotRects.find((rect) => rect.digitBoxId === ids[slotIndex])
                return slotRect ? { kind: 'slot-review', slotIndex, ...cloneRect(slotRect) } : null
              })
              .filter(Boolean)
        )
      : answerRect
        ? [{ kind: markKind, ...cloneRect(answerRect) }]
        : []

    return {
      questionNum: group?.question_num ?? index + 1,
      label: `${questionLetter(index)})`,
      digitBoxIds: ids,
      expectedAnswer: group?.answer ?? null,
      markKind,
      correct: typeof correct === 'boolean' ? correct : null,
      reviewNeeded,
      reviewSlots,
      answerRect: cloneRect(answerRect),
      slotRects,
      markRects
    }
  })

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    purpose: 'debug rendered result overlay placement',
    layoutId,
    annotationBaseMode,
    annotationSeed,
    markedSheetAvailable,
    dimensions: { width: warpedW, height: warpedH },
    annotationGeometry: clonePlain(annotationGeometry || null),
    annotationRegions: clonePlain(annotationRegions || []),
    questionMarks
  }
}

function tensorInkQuality(tensor, id = null) {
  const values = tensor && typeof tensor.length === 'number' ? tensor : []
  let inkPixels = 0
  let minX = 28
  let minY = 28
  let maxX = -1
  let maxY = -1
  const rowCounts = Array(28).fill(0)
  const colCounts = Array(28).fill(0)
  let edgeInkPixels = 0
  for (let i = 0; i < Math.min(values.length, 28 * 28); i++) {
    const value = Number(values[i]) || 0
    if (value <= 0.16) continue
    const y = Math.floor(i / 28)
    const x = i - y * 28
    inkPixels += 1
    rowCounts[y] += 1
    colCounts[x] += 1
    if (x <= 1 || x >= 26 || y <= 1 || y >= 26) edgeInkPixels += 1
    minX = Math.min(minX, x)
    minY = Math.min(minY, y)
    maxX = Math.max(maxX, x)
    maxY = Math.max(maxY, y)
  }
  const inkW = maxX >= minX ? maxX - minX + 1 : 0
  const inkH = maxY >= minY ? maxY - minY + 1 : 0
  const density = inkW > 0 && inkH > 0 ? inkPixels / (inkW * inkH) : 0
  const maxRowCount = rowCounts.length ? Math.max(...rowCounts) : 0
  const maxColCount = colCounts.length ? Math.max(...colCounts) : 0
  const edgeInkRatio = inkPixels ? edgeInkPixels / inkPixels : 0
  const horizontalArtifactLikely =
    inkPixels >= 8 &&
    inkW >= 11 &&
    (
      inkH <= 6 ||
      maxRowCount >= Math.max(9, Math.round(inkPixels * 0.42))
    )
  const verticalEdgeArtifactLikely =
    inkPixels >= 10 &&
    inkPixels <= 90 &&
    inkW <= 7 &&
    inkH >= 12 &&
    density <= 0.72 &&
    edgeInkRatio >= 0.30
  const edgeArtifactLikely =
    inkPixels >= 8 &&
    edgeInkRatio >= 0.48 &&
    (inkW <= 8 || inkH <= 8 || density <= 0.46)
  const lineArtifactLikely =
    horizontalArtifactLikely ||
    verticalEdgeArtifactLikely ||
    edgeArtifactLikely
  const plausibleDigitShape =
    inkPixels >= 14 &&
    inkW >= 3 &&
    inkH >= 8 &&
    !horizontalArtifactLikely &&
    !edgeArtifactLikely
  return {
    id,
    inkPixels,
    inkW,
    inkH,
    density,
    maxRowCount,
    maxColCount,
    edgeInkRatio,
    horizontalArtifactLikely,
    verticalEdgeArtifactLikely,
    edgeArtifactLikely,
    lineArtifactLikely,
    ok: plausibleDigitShape
  }
}

function tensorQualityScore(quality) {
  if (!quality) return -Infinity
  let score = 0
  if (quality.ok) score += 1000
  if (!quality.lineArtifactLikely) score += 220
  if (quality.horizontalArtifactLikely) score -= 220
  if (quality.edgeArtifactLikely) score -= 160
  if (quality.verticalEdgeArtifactLikely) score -= 120
  score += Math.min(quality.inkPixels || 0, 120)
  score += Math.min(quality.inkW || 0, 20) * 4
  score += Math.min(quality.inkH || 0, 24) * 4
  score -= Math.round((quality.edgeInkRatio || 0) * 90)
  return score
}

function bestTensorInkQuality(proc) {
  const candidates = [
    { name: 'base', tensor: proc?.tensor },
    ...(Array.isArray(proc?.tensorVariants)
      ? proc.tensorVariants.filter((variant) => variant?.suggestionOnly !== true)
      : [])
  ].filter((candidate) => candidate?.tensor)

  let best = null
  let base = null
  let strict = null
  const variantQualities = []
  for (const candidate of candidates) {
    const quality = {
      ...tensorInkQuality(candidate.tensor, proc?.id),
      variantName: candidate.name || 'variant'
    }
    variantQualities.push(quality)
    if (quality.variantName === 'base') base = quality
    if (quality.variantName === 'strict') strict = quality
    if (!best || tensorQualityScore(quality) > tensorQualityScore(best)) {
      best = quality
    }
  }

  const summaryQualities = variantQualities.some((quality) => quality.variantName !== 'base')
    ? variantQualities.filter((quality) => quality.variantName !== 'base')
    : variantQualities
  const variantCount = summaryQualities.length
  const usableVariantCount = summaryQualities.filter((quality) => (
    quality.ok &&
    !quality.lineArtifactLikely &&
    !quality.horizontalArtifactLikely &&
    !quality.edgeArtifactLikely &&
    (quality.inkPixels || 0) >= 14 &&
    (quality.inkH || 0) >= 7
  )).length
  const artifactVariantCount = summaryQualities.filter((quality) => (
    quality.lineArtifactLikely ||
    quality.horizontalArtifactLikely ||
    quality.edgeArtifactLikely ||
    quality.verticalEdgeArtifactLikely
  )).length
  const weakVariantCount = summaryQualities.filter((quality) => (
    !quality.ok ||
    (quality.inkPixels || 0) < 12 ||
    (quality.inkH || 0) < 6 ||
    quality.horizontalArtifactLikely ||
    quality.edgeArtifactLikely
  )).length
  const artifactVariantRatio = variantCount ? artifactVariantCount / variantCount : 0
  const weakVariantRatio = variantCount ? weakVariantCount / variantCount : 0
  const allVariantsWeak = variantCount > 0 && usableVariantCount === 0
  const guard = strict || base || best || tensorInkQuality(proc?.tensor, proc?.id)
  return {
    ...guard,
    id: proc?.id,
    guardVariantName: guard.variantName || 'guard',
    bestVariantName: best?.variantName || guard.variantName || 'guard',
    bestQuality: best,
    baseQuality: base,
    strictQuality: strict,
    variantQualities,
    variantCount,
    usableVariantCount,
    artifactVariantCount,
    weakVariantCount,
    artifactVariantRatio,
    weakVariantRatio,
    allVariantsWeak
  }
}

function detectTwoDigitCropFailure(questionGroups, cropQuality) {
  if (!Array.isArray(questionGroups) || !questionGroups.length || !Array.isArray(cropQuality)) return null
  const qualityById = new Map(cropQuality.map((quality) => [quality.id, quality]))
  let expectedTwoDigitGroups = 0
  let missingLeft = 0
  let missingRight = 0
  let oneSidedGroups = 0
  let artifactGroups = 0
  let variantWeakGroups = 0
  let variantArtifactGroups = 0

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const answer = group?.answer == null ? '' : String(group.answer).trim()
    if (ids.length !== 2 || !/^\d{2,}$/.test(answer)) continue
    expectedTwoDigitGroups += 1
    const left = qualityById.get(ids[0])
    const right = qualityById.get(ids[1])
    if (!left || !right) continue
    const leftVariantWeak = left.allVariantsWeak || (left.weakVariantRatio || 0) >= 0.78
    const rightVariantWeak = right.allVariantsWeak || (right.weakVariantRatio || 0) >= 0.78
    const leftVariantArtifact = (left.artifactVariantRatio || 0) >= 0.50
    const rightVariantArtifact = (right.artifactVariantRatio || 0) >= 0.50
    const leftArtifact = left.horizontalArtifactLikely || left.edgeArtifactLikely || leftVariantArtifact
    const rightArtifact = right.horizontalArtifactLikely || right.edgeArtifactLikely || rightVariantArtifact
    if (leftVariantWeak || rightVariantWeak) variantWeakGroups += 1
    if (leftVariantArtifact || rightVariantArtifact) variantArtifactGroups += 1
    if (!left.ok || !right.ok || leftArtifact || rightArtifact || leftVariantWeak || rightVariantWeak) {
      artifactGroups += 1
    }
    if ((!left.ok || leftVariantWeak) && right.ok && !rightVariantWeak) {
      missingLeft += 1
      oneSidedGroups += 1
    } else if (left.ok && !leftVariantWeak && (!right.ok || rightVariantWeak)) {
      missingRight += 1
      oneSidedGroups += 1
    }
  }

  if (expectedTwoDigitGroups < 4) return null
  const repeatedOneSided = oneSidedGroups >= Math.max(3, Math.ceil(expectedTwoDigitGroups * 0.35))
  const sidePattern = Math.max(missingLeft, missingRight) >= Math.max(3, Math.ceil(expectedTwoDigitGroups * 0.3))
  const repeatedArtifacts = artifactGroups >= Math.max(5, Math.ceil(expectedTwoDigitGroups * 0.55))
  const repeatedVariantWeak = variantWeakGroups >= Math.max(4, Math.ceil(expectedTwoDigitGroups * 0.45))
  const repeatedVariantArtifacts = variantArtifactGroups >= Math.max(4, Math.ceil(expectedTwoDigitGroups * 0.45))
  if (!(repeatedArtifacts || repeatedVariantWeak || repeatedVariantArtifacts || (repeatedOneSided && sidePattern))) return null
  return {
    expectedTwoDigitGroups,
    missingLeft,
    missingRight,
    oneSidedGroups,
    artifactGroups,
    variantWeakGroups,
    variantArtifactGroups
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

function analyzeTwoDigitScanSignals(questionGroups, cropQuality, predictions, questionCorrect, questionReview) {
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
  let artifactDominatedGroups = 0
  let lowInkGroups = 0
  let lowGapGroups = 0
  let mismatchGroups = 0
  let reviewMismatchGroups = 0
  let signalMismatchGroups = 0
  let reviewSignalGroups = 0
  const usablePredictions = predictions.filter((prediction) => prediction && Number.isFinite(Number(prediction.confidence)))
  const avgConfidence = usablePredictions.length
    ? usablePredictions.reduce((sum, prediction) => sum + (Number(prediction.confidence) || 0), 0) / usablePredictions.length
    : 0
  const avgTopGap = usablePredictions.length
    ? usablePredictions.reduce((sum, prediction) => sum + (Number(prediction.topGap) || 0), 0) / usablePredictions.length
    : 0

  for (const [index, group] of questionGroups.entries()) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const answer = group?.answer == null ? '' : String(group.answer).trim()
    if (ids.length !== 2 || !/^\d{2,}$/.test(answer)) continue
    expectedTwoDigitGroups += 1
    let suspiciousCells = 0
    let oneOrBlankCells = 0
    let artifactCells = 0
    let lowInkCells = 0
    let lowGapCells = 0
    for (const id of ids) {
      const quality = qualityById.get(id)
      const prediction = predictionById.get(id)
      if (!quality || !prediction) continue
      const confidence = Number(prediction.confidence) || 0
      const topGap = Number(prediction.topGap) || 0
      const variantWeak = quality.allVariantsWeak || (quality.weakVariantRatio || 0) >= 0.75
      const variantArtifact = (quality.artifactVariantRatio || 0) >= 0.50
      const skinnySignal =
        variantArtifact ||
        quality.lineArtifactLikely ||
        (quality.inkPixels <= 115 && quality.inkW <= 8 && quality.inkH >= 10 && quality.density <= 0.78)
      if (skinnySignal && (prediction.reviewNeeded || confidence < 0.92 || topGap < 0.5)) suspiciousCells += 1
      if (prediction.digit === 1 || !quality.ok || quality.inkPixels < 18 || variantWeak) oneOrBlankCells += 1
      if (!quality.ok || quality.horizontalArtifactLikely || quality.edgeArtifactLikely || variantArtifact) artifactCells += 1
      if (quality.inkPixels < 24 || quality.inkW <= 4 || quality.inkH < 8 || variantWeak) lowInkCells += 1
      if (topGap < 0.22 || confidence < 0.62) lowGapCells += 1
    }
    const predictionCells = predictionCellsForIds(ids, predictionById)
    const acceptedResponses = acceptedResponsesForGroup(group, ids.length)
    const groupMatches = predictionCells && acceptedResponses.length > 0
      ? acceptedResponses.some((response) => gradingCellsMatch(predictionCells, response))
      : questionCorrect[index] === true
    const groupHasReview = questionReview[index] === true
    const groupHasSignal = suspiciousCells > 0 || artifactCells > 0 || lowInkCells > 0 || lowGapCells > 0
    if (suspiciousCells > 0) suspiciousTwoDigitGroups += 1
    if (oneOrBlankCells >= 1) oneOrBlankDominatedGroups += 1
    if (artifactCells >= 1) artifactDominatedGroups += 1
    if (lowInkCells >= 1) lowInkGroups += 1
    if (lowGapCells >= 1) lowGapGroups += 1
    if (!groupMatches) mismatchGroups += 1
    if (!groupMatches && groupHasReview) reviewMismatchGroups += 1
    if (!groupMatches && groupHasSignal) signalMismatchGroups += 1
    if (groupHasReview && groupHasSignal) reviewSignalGroups += 1
  }

  if (expectedTwoDigitGroups < 5 || total < 8) return null
  return {
    total,
    score,
    reviewCount,
    expectedTwoDigitGroups,
    suspiciousTwoDigitGroups,
    oneOrBlankDominatedGroups,
    artifactDominatedGroups,
    lowInkGroups,
    lowGapGroups,
    mismatchGroups,
    reviewMismatchGroups,
    signalMismatchGroups,
    reviewSignalGroups,
    avgConfidence,
    avgTopGap
  }
}

function detectUnusableTwoDigitScan(questionGroups, cropQuality, predictions, questionCorrect, questionReview) {
  const signals = analyzeTwoDigitScanSignals(questionGroups, cropQuality, predictions, questionCorrect, questionReview)
  if (!signals) return null

  const {
    total,
    score,
    reviewCount,
    expectedTwoDigitGroups,
    suspiciousTwoDigitGroups,
    oneOrBlankDominatedGroups,
    artifactDominatedGroups,
    lowInkGroups,
    lowGapGroups,
    mismatchGroups,
    reviewMismatchGroups,
    signalMismatchGroups,
    reviewSignalGroups,
    avgConfidence,
    avgTopGap
  } = signals

  const catastrophicLowScore = score <= Math.max(1, Math.floor(total * 0.15))
  const veryLowScore = score <= Math.floor(total * 0.35)
  const mostlyReview = reviewCount >= Math.ceil(total * 0.72)
  const almostAllReview = reviewCount >= Math.ceil(total * 0.88)
  const repeatedSuspicious = suspiciousTwoDigitGroups >= Math.ceil(expectedTwoDigitGroups * 0.35)
  const repeatedOneOrBlank = oneOrBlankDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.65)
  const repeatedArtifacts = artifactDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.55)
  const lowSignalCapture = avgConfidence < 0.68 || avgTopGap < 0.34
  const mostlyTwoDigitWorksheet = expectedTwoDigitGroups >= Math.ceil(total * 0.75)
  const allReviewLowSignalCapture =
    score <= Math.max(1, Math.floor(total * 0.22)) &&
    reviewCount >= Math.ceil(total * 0.9) &&
    avgConfidence < 0.62 &&
    avgTopGap < 0.32
  const broadLowSignalTwoDigitCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(2, Math.floor(total * 0.30)) &&
    reviewCount >= Math.ceil(total * 0.75) &&
    avgConfidence < 0.74 &&
    avgTopGap < 0.43
  const allReviewWrongTwoDigitCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(2, Math.floor(total * 0.35)) &&
    reviewCount >= Math.ceil(total * 0.85) &&
    avgConfidence < 0.72 &&
    avgTopGap < 0.36
  const allReviewUnstableTwoDigitCapture =
    mostlyTwoDigitWorksheet &&
    reviewCount >= Math.ceil(total * 0.95) &&
    lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.90) &&
    avgConfidence < 0.66 &&
    avgTopGap < 0.16 &&
    (
      lowInkGroups >= Math.ceil(expectedTwoDigitGroups * 0.10) ||
      oneOrBlankDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.20) ||
      mismatchGroups >= 1 ||
      reviewSignalGroups >= Math.ceil(expectedTwoDigitGroups * 0.85)
    )
  const severeLowSignalTwoDigitCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(1, Math.floor(total * 0.22)) &&
    reviewCount >= Math.ceil(total * 0.65) &&
    avgConfidence < 0.80 &&
    avgTopGap < 0.50
  const lowConfidenceReviewPileup =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(3, Math.floor(total * 0.35)) &&
    reviewCount >= Math.ceil(total * 0.70) &&
    avgConfidence < 0.70 &&
    (repeatedSuspicious || repeatedArtifacts)
  const structuralLowSignalPileup =
    repeatedSuspicious ||
    repeatedArtifacts ||
    lowInkGroups >= Math.ceil(expectedTwoDigitGroups * 0.60) ||
    oneOrBlankDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.75)
  const mismatchReviewPileup =
    mostlyTwoDigitWorksheet &&
    mismatchGroups >= Math.ceil(total * 0.45) &&
    reviewCount >= Math.ceil(total * 0.45) &&
    (
      reviewMismatchGroups >= Math.ceil(total * 0.35) ||
      signalMismatchGroups >= Math.ceil(expectedTwoDigitGroups * 0.35) ||
      reviewSignalGroups >= Math.ceil(expectedTwoDigitGroups * 0.45)
    ) &&
    (
      lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.45) ||
      lowInkGroups >= Math.ceil(expectedTwoDigitGroups * 0.30) ||
      avgConfidence < 0.80 ||
      avgTopGap < 0.62
    )
  const broadMismatchLowSignalCapture =
    mostlyTwoDigitWorksheet &&
    mismatchGroups >= Math.ceil(total * 0.50) &&
    reviewCount >= Math.ceil(total * 0.40) &&
    signalMismatchGroups >= Math.ceil(expectedTwoDigitGroups * 0.40) &&
    (lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.50) || avgConfidence < 0.82)
  const weakTwoDigitReviewPileup =
    mostlyTwoDigitWorksheet &&
    reviewCount >= Math.ceil(total * 0.50) &&
    avgConfidence < 0.70 &&
    avgTopGap < 0.56 &&
    lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.65) &&
    lowInkGroups >= Math.ceil(expectedTwoDigitGroups * 0.60) &&
    artifactDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.25)
  const repeatedSlotCollapse =
    mostlyTwoDigitWorksheet &&
    oneOrBlankDominatedGroups >= Math.ceil(expectedTwoDigitGroups * 0.85) &&
    lowInkGroups >= Math.ceil(expectedTwoDigitGroups * 0.65) &&
    (
      mismatchGroups >= Math.ceil(total * 0.30) ||
      signalMismatchGroups >= Math.ceil(expectedTwoDigitGroups * 0.30) ||
      reviewSignalGroups >= Math.ceil(expectedTwoDigitGroups * 0.30) ||
      lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.45)
    )
  const highReviewLowGapCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.floor(total * 0.70) &&
    reviewCount >= Math.ceil(total * 0.70) &&
    lowGapGroups >= Math.ceil(expectedTwoDigitGroups * 0.70) &&
    avgConfidence < 0.74 &&
    avgTopGap < 0.42 &&
    structuralLowSignalPileup
  const highReviewMismatchCapture =
    mostlyTwoDigitWorksheet &&
    score <= Math.max(2, Math.floor(total * 0.25)) &&
    reviewCount >= Math.ceil(total * 0.60) &&
    reviewMismatchGroups >= Math.ceil(total * 0.55) &&
    avgConfidence < 0.84 &&
    avgTopGap < 0.75
  if (!(
    (catastrophicLowScore && mostlyReview && (repeatedSuspicious || repeatedOneOrBlank || repeatedArtifacts)) ||
    (veryLowScore && almostAllReview && lowSignalCapture && (repeatedSuspicious || repeatedArtifacts)) ||
    allReviewLowSignalCapture ||
    broadLowSignalTwoDigitCapture ||
    allReviewWrongTwoDigitCapture ||
    allReviewUnstableTwoDigitCapture ||
    severeLowSignalTwoDigitCapture ||
    lowConfidenceReviewPileup ||
    weakTwoDigitReviewPileup ||
    repeatedSlotCollapse ||
    highReviewLowGapCapture
  )) return null

  return {
    total,
    score,
    reviewCount,
    expectedTwoDigitGroups,
    suspiciousTwoDigitGroups,
    oneOrBlankDominatedGroups,
    artifactDominatedGroups,
    lowInkGroups,
    lowGapGroups,
    mismatchGroups,
    reviewMismatchGroups,
    signalMismatchGroups,
    reviewSignalGroups,
    avgConfidence,
    avgTopGap,
    allReviewLowSignalCapture,
    broadLowSignalTwoDigitCapture,
    allReviewWrongTwoDigitCapture,
    allReviewUnstableTwoDigitCapture,
    severeLowSignalTwoDigitCapture,
    lowConfidenceReviewPileup,
    structuralLowSignalPileup,
    mismatchReviewPileup,
    broadMismatchLowSignalCapture,
    weakTwoDigitReviewPileup,
    repeatedSlotCollapse,
    highReviewLowGapCapture,
    highReviewMismatchCapture
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

function suggestionEvidenceForDigit(prediction, digit, group = null, slotIndex = 0) {
  const target = normalizeGradingDigit(digit)
  if (target === undefined || target === null || !prediction) return null
  const currentDigit = normalizeGradingDigit(
    prediction.blank === true || prediction.empty === true ? null : prediction.digit
  )
  const evidence = []
  let confidence = 0
  const addEvidence = (reason, value) => {
    const score = Math.max(0, Math.min(1, Number(value) || 0))
    if (score <= 0) return
    confidence = Math.max(confidence, score)
    evidence.push({ reason, confidence: Number(score.toFixed(4)) })
  }

  if (currentDigit === target) {
    addEvidence('current-read', prediction.confidence || 0.2)
  }
  for (const item of prediction.topK || []) {
    if (normalizeGradingDigit(item?.digit) === target) {
      addEvidence('model-topk', item.confidence || 0.01)
    }
  }
  const reviewVariants = [
    ...(prediction.preprocessVariants || []),
    ...(prediction.reviewSuggestionVariants || [])
  ]
  for (const variant of reviewVariants) {
    const variantReasonPrefix = variant?.suggestionOnly === true
      ? 'suggestion-variant'
      : 'variant'
    if (normalizeGradingDigit(variant?.digit) === target) {
      addEvidence(`${variantReasonPrefix}:${variant.name || 'unnamed'}`, variant.confidence || variant.topGap || 0.01)
    }
    for (const item of variant?.topK || []) {
      if (normalizeGradingDigit(item?.digit) === target) {
        addEvidence(`${variantReasonPrefix}-topk:${variant.name || 'unnamed'}`, item.confidence || 0.01)
        break
      }
    }
  }

  const answerText = group?.answer == null ? '' : String(group.answer).trim()
  const isLeadingOneContext =
    target === 1 &&
    slotIndex === 0 &&
    /^1\d$/.test(answerText) &&
    [7, 8, 9].includes(currentDigit) &&
    (
      prediction.reviewNeeded === true ||
      prediction.highRiskMismatchReview === true ||
      prediction.preprocessReviewReason === 'two-digit-mismatch-low-trust-review'
    )
  if (isLeadingOneContext) {
    const hasIndependentOneEvidence = evidence.some((item) =>
      !String(item.reason || '').startsWith('answer-key-') && Number(item.confidence) >= 0.22
    )
    if (currentDigit !== 7 || hasIndependentOneEvidence) {
      addEvidence('answer-key-leading-one-context', 0.68)
    }
  }

  const isNineTwoContext =
    target === 9 &&
    currentDigit === 2 &&
    prediction.reviewNeeded === true
  if (isNineTwoContext) {
    addEvidence('answer-key-nine-two-context', 0.48)
  }

  if (target === 6 && currentDigit === 5) {
    const strongIndependentEvidence = evidence.some((item) =>
      !String(item.reason || '').startsWith('answer-key-') && Number(item.confidence) >= 0.25
    )
    if (!strongIndependentEvidence) return null
  }

  if (!evidence.length) return null
  return {
    digit: target,
    confidence: Number(confidence.toFixed(4)),
    evidence
  }
}

function responseSuggestionScore(response, group, predictionsById, ids) {
  const evidenceBySlot = []
  let score = 1
  let supportedSlots = 0
  for (let slotIndex = 0; slotIndex < ids.length; slotIndex += 1) {
    const cell = response[slotIndex]
    const prediction = predictionsById.get(ids[slotIndex])
    if (cell === null || cell === undefined) {
      const currentDigit = normalizeGradingDigit(
        prediction?.blank === true || prediction?.empty === true ? null : prediction?.digit
      )
      const blankConfidence = currentDigit === null || currentDigit === undefined
        ? 0.72
        : prediction?.reviewNeeded === true
          ? 0.28
          : 0
      if (!blankConfidence) return null
      score *= blankConfidence
      supportedSlots += 1
      evidenceBySlot.push({
        slotIndex,
        digit: null,
        confidence: Number(blankConfidence.toFixed(4)),
        evidence: [{ reason: 'blank-or-optional-slot', confidence: Number(blankConfidence.toFixed(4)) }]
      })
      continue
    }
    const evidence = suggestionEvidenceForDigit(prediction, cell, group, slotIndex)
    if (!evidence || evidence.confidence < 0.18) return null
    score *= Math.max(0.05, evidence.confidence)
    supportedSlots += 1
    evidenceBySlot.push({ slotIndex, ...evidence })
  }
  if (!supportedSlots) return null
  return {
    cells: response,
    text: cellsToAnswerText(response),
    confidence: Number(Math.pow(score, 1 / Math.max(1, supportedSlots)).toFixed(4)),
    evidenceBySlot
  }
}

function answerKeyContextSensitiveGroup(group) {
  const problem = String(group?.problem || '').trim().toLowerCase()
  const layoutId = String(group?.layoutId || group?.layout_id || '')
  return problem === 'how many?' || layoutId === 'sg-g1-lw-06-ten-frames'
}

function hasStrongIndependentSuggestionEvidence(candidate) {
  return (candidate?.evidenceBySlot || []).every((slot) => {
    if (slot.digit === null || slot.digit === undefined) return true
    return (slot.evidence || []).some((item) => {
      const reason = String(item.reason || '')
      return !reason.startsWith('answer-key-') && Number(item.confidence) >= 0.75
    })
  })
}

function hasStrongChangedSlotEvidence(candidate, currentCells, minConfidence = 0.79) {
  return (candidate?.evidenceBySlot || []).every((slot) => {
    const currentDigit = currentCells[slot.slotIndex]
    if (slot.digit === null || slot.digit === undefined || currentDigit === slot.digit) return true
    return (slot.evidence || []).some((item) => {
      const reason = String(item.reason || '')
      return !reason.startsWith('answer-key-') && Number(item.confidence) >= minConfidence
    })
  })
}

function isGradeOneLastWeekNonRowLayout(layoutId) {
  return /sg-g1-lw-(0[6-9]|10)-/.test(String(layoutId || ''))
}

function noKeyNonRowLeftSevenOneSuggestion(group, groupPredictions, currentCells) {
  const layoutId = String(group?.layoutId || group?.layout_id || '')
  if (!isGradeOneLastWeekNonRowLayout(layoutId)) return null
  if (!Array.isArray(currentCells) || currentCells.length < 2 || currentCells[0] !== 7) return null
  const prediction = groupPredictions[0]
  if (!prediction || prediction.reviewNeeded !== true) return null
  if (groupPredictions.slice(1).some((item) => item?.reviewNeeded === true)) return null
  let best = null
  const reviewVariants = [
    ...(prediction.preprocessVariants || []),
    ...(prediction.reviewSuggestionVariants || [])
  ]
  for (const variant of reviewVariants) {
    if (normalizeGradingDigit(variant?.digit) !== 1) continue
    const confidence = Math.max(0, Math.min(1, Number(variant?.confidence) || 0))
    if (confidence < 0.25) continue
    const evidence = {
      reason: `no-key-non-row-left-seven-one:${variant.name || 'unnamed'}`,
      confidence: Number(confidence.toFixed(4))
    }
    if (!best || confidence > best.confidence) best = evidence
  }
  if (!best) return null
  const cells = currentCells.slice()
  cells[0] = 1
  return {
    cells,
    text: cellsToAnswerText(cells),
    confidence: best.confidence,
    evidenceBySlot: [{
      slotIndex: 0,
      digit: 1,
      confidence: best.confidence,
      evidence: [best]
    }]
  }
}

function hasNoKeyNonRowLeftSevenOneEvidence(candidate, currentCells) {
  return (candidate?.evidenceBySlot || []).some((slot) => (
    currentCells[slot.slotIndex] === 7 &&
    slot.digit === 1 &&
    (slot.evidence || []).some((item) => String(item.reason || '').startsWith('no-key-non-row-left-seven-one:'))
  ))
}

function likelyReadSuggestionForGroup(group, predictions, { requireReview = true } = {}) {
  const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
  if (!ids.length) return null
  const byId = new Map((predictions || []).map((prediction) => [prediction.id, prediction]))
  const groupPredictions = ids.map((id) => byId.get(id)).filter(Boolean)
  const hasReview = groupPredictions.some((prediction) => prediction?.reviewNeeded)
  if (requireReview && !hasReview) return null
  const responses = acceptedResponsesForGroup(group, ids.length)
    .filter((response) => Array.isArray(response) && response.length === ids.length)
  if (!responses.length) return null

  const currentCells = predictionCellsForIds(ids, byId) || []
  const currentText = cellsToAnswerText(currentCells)
  const noKeyLeadingOne = noKeyNonRowLeftSevenOneSuggestion(group, groupPredictions, currentCells)
  const candidates = responses
    .map((response) => responseSuggestionScore(response, group, byId, ids))
    .filter(Boolean)
    .filter((candidate) => candidate.text !== 'blank')
    .concat(noKeyLeadingOne ? [noKeyLeadingOne] : [])
    .sort((a, b) => b.confidence - a.confidence)
  const safeCandidates = candidates.filter((candidate) => {
    const candidateHasContextEvidence = candidate.evidenceBySlot.some((slot) =>
      (slot.evidence || []).some((item) => String(item.reason || '').startsWith('answer-key-'))
    )
    const candidateHasAlternativeEvidence = candidate.evidenceBySlot.some((slot) =>
      (slot.evidence || []).some((item) => {
        const reason = String(item.reason || '')
        return reason.startsWith('variant:') || reason.startsWith('suggestion-variant:') || reason === 'model-topk'
      })
    )
    const candidateHasNoKeyLeftSevenOneEvidence = hasNoKeyNonRowLeftSevenOneEvidence(candidate, currentCells)
    if (
      candidateHasContextEvidence &&
      answerKeyContextSensitiveGroup(group) &&
      !hasStrongIndependentSuggestionEvidence(candidate)
    ) {
      return false
    }
    if (
      !candidateHasContextEvidence &&
      !candidateHasNoKeyLeftSevenOneEvidence &&
      !hasStrongChangedSlotEvidence(candidate, currentCells)
    ) {
      return false
    }
    const threshold = candidateHasContextEvidence ? 0.42 : 0.55
    if (candidate.confidence < threshold && !candidateHasAlternativeEvidence && !candidateHasNoKeyLeftSevenOneEvidence) return false
    return true
  })
  const best = safeCandidates[0]
  if (!best) return null
  const hasContextEvidence = best.evidenceBySlot.some((slot) =>
    (slot.evidence || []).some((item) => String(item.reason || '').startsWith('answer-key-'))
  )
  const hasNoKeyLeftSevenOneEvidence = hasNoKeyNonRowLeftSevenOneEvidence(best, currentCells)
  return {
    text: best.text,
    cells: best.cells,
    confidence: best.confidence,
    currentText,
    source: hasContextEvidence
      ? 'answer-key-context-review'
      : hasNoKeyLeftSevenOneEvidence
        ? 'no-key-non-row-leading-one-review'
        : 'ocr-alternative-review',
    reviewOnly: true,
    evidenceBySlot: best.evidenceBySlot
  }
}

function trustedOcrSuggestionPromotionEvidence(suggestion, currentCells) {
  if (!suggestion || suggestion.source !== 'ocr-alternative-review') return null
  if (numberOrZero(suggestion.confidence) < 0.75) return null

  const slotEvidence = []
  for (const slot of suggestion.evidenceBySlot || []) {
    const slotIndex = Number(slot.slotIndex)
    const target = normalizeGradingDigit(slot.digit)
    const current = currentCells[slotIndex]
    if (!Number.isInteger(slotIndex)) return null
    if (target === undefined) return null

    if (target === null) {
      const blankEvidence = (slot.evidence || []).find((item) =>
        item.reason === 'blank-or-optional-slot' && numberOrZero(item.confidence) >= 0.72
      )
      if (!blankEvidence) return null
      slotEvidence.push({ slotIndex, digit: null, evidence: blankEvidence })
      continue
    }

    const strongest = (slot.evidence || [])
      .filter((item) => {
        const reason = String(item.reason || '')
        return !reason.startsWith('answer-key-') &&
          (reason === 'current-read' || reason === 'model-topk' || reason.startsWith('variant:') || reason.startsWith('variant-topk:'))
      })
      .sort((a, b) => numberOrZero(b.confidence) - numberOrZero(a.confidence))[0]
    if (!strongest || numberOrZero(strongest.confidence) < (current === target ? 0.65 : 0.79)) return null
    slotEvidence.push({ slotIndex, digit: target, evidence: strongest })
  }
  return slotEvidence.length ? slotEvidence : null
}

function applyTrustedOcrSuggestionPromotions(questionGroups, predictions) {
  if (!Array.isArray(questionGroups) || !Array.isArray(predictions)) return []
  const predictionById = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  const promotions = []

  for (const group of questionGroups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    if (!ids.length) continue
    const groupPredictions = ids.map((id) => predictionById.get(id))
    if (groupPredictions.some((prediction) => !prediction)) continue
    if (!groupPredictions.some((prediction) => prediction.reviewNeeded === true)) continue

    const currentCells = predictionCellsForIds(ids, predictionById)
    if (!currentCells) continue
    const suggestion = likelyReadSuggestionForGroup(group, predictions, { requireReview: true })
    const evidence = trustedOcrSuggestionPromotionEvidence(suggestion, currentCells)
    if (!evidence) continue
    const promotedMatchesAcceptedResponse = acceptedResponsesForGroup(group, ids.length)
      .some((response) => gradingCellsMatch(suggestion.cells, response))

    for (const slot of evidence) {
      const prediction = predictionById.get(ids[slot.slotIndex])
      if (!prediction) continue
      const originalDigit = prediction.digit
      const originalConfidence = prediction.confidence
      if (slot.digit === null) {
        prediction.digit = null
        prediction.blank = true
        prediction.empty = true
      } else {
        prediction.digit = slot.digit
        prediction.blank = false
        prediction.empty = false
      }
      prediction.confidence = Math.max(numberOrZero(prediction.confidence), numberOrZero(slot.evidence.confidence), 0.88)
      prediction.topGap = Math.max(numberOrZero(prediction.topGap), 0.42)
      prediction.reviewNeeded = false
      if (promotedMatchesAcceptedResponse) prediction.correct = true
      prediction.robust = true
      prediction.robustOverride = prediction.robustOverride || 'trusted-ocr-suggestion'
      prediction.preprocessReviewReason = null
      prediction.confidencePolicyCleared = true
      prediction.confidencePolicyClearanceReason = 'trusted-ocr-suggestion'
      prediction.trustedSuggestionPromotion = {
        source: suggestion.source,
        suggestionText: suggestion.text,
        originalDigit,
        originalConfidence,
        evidence: slot.evidence
      }
      prediction.topK = slot.digit === null
        ? []
        : [
            { digit: slot.digit, confidence: prediction.confidence },
            ...(prediction.topK || [])
              .filter((item) => normalizeGradingDigit(item.digit) !== slot.digit)
              .slice(0, 2)
          ]
    }

    promotions.push({
      questionNum: group?.question_num ?? null,
      suggestionText: suggestion.text,
      currentText: suggestion.currentText,
      source: suggestion.source,
      confidence: suggestion.confidence,
      evidence
    })
  }

  return promotions
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
  const wholeAnswerSuggestions = ids.flatMap((id) => {
    const prediction = byId.get(id)
    if (Array.isArray(prediction?.wholeAnswerReviewSuggestions)) return prediction.wholeAnswerReviewSuggestions
    return prediction?.wholeAnswerReviewSuggestion ? [prediction.wholeAnswerReviewSuggestion] : []
  }).filter((item) => item?.text)
  const wholeAnswerSuggestion = wholeAnswerSuggestions[0] || null
  const currentCells = ids.map((id) => {
    const prediction = byId.get(id)
    return prediction?.blank === true || prediction?.empty === true ? null : (prediction?.digit ?? null)
  })
  const currentText = cellsToAnswerText(currentCells)
  const wholeAnswerChoices = [...wholeAnswerSuggestions]
    .sort((a, b) => {
      const priority = (item) => item?.source?.includes('whole-answer-model') ? 0 : 1
      return priority(a) - priority(b)
    })
    .filter((item, index, list) => list.findIndex((candidate) => candidate.text === item.text) === index)
    .map((item) => ({
      key: `${group?.question_num ?? 'q'}-whole-answer-${item.source || 'model'}-${item.text}`,
      text: item.text,
      cells: item.cells,
      wholeAnswerReviewSuggestion: item,
      source: item.source || 'key-blind-whole-answer-model'
    }))
  for (const choice of wholeAnswerChoices) seen.add(choice.text)
  const currentChoices = wholeAnswerSuggestions.length && currentText !== 'blank' && !seen.has(currentText)
    ? [{
        key: `${group?.question_num ?? 'q'}-current-${currentText}`,
        text: currentText,
        cells: currentCells,
        currentOcrRead: true,
        source: 'current-browser-ocr'
      }]
    : []
  for (const choice of currentChoices) seen.add(choice.text)
  const suggestion = likelyReadSuggestionForGroup(group, predictions, { requireReview: true })
  const suggestionChoices = suggestion
    && !seen.has(suggestion.text)
    ? [{
        key: `${group?.question_num ?? 'q'}-suggestion-${suggestion.text}`,
        text: suggestion.text,
        cells: suggestion.cells,
        reviewSuggestion: suggestion,
        source: suggestion.source || 'current-ocr-alternative'
      }]
    : []
  for (const choice of suggestionChoices) {
    seen.add(choice.text)
  }
  const comboSeen = new Set()
  const allComboChoices = combos
    .sort((a, b) => b.confidence - a.confidence)
    .map((combo) => ({
      ...combo,
      text: cellsToAnswerText(combo.cells)
    }))
    .filter((combo) => {
      if (combo.text === 'blank' || comboSeen.has(combo.text)) return false
      comboSeen.add(combo.text)
      return true
    })
    .map((combo, index) => ({
      key: `${group?.question_num ?? 'q'}-${index}-${combo.text}`,
      text: combo.text,
      cells: combo.cells,
      source: 'digit-model-combination'
    }))
  if (v3LocalFirstReviewEnabled()) {
    // Preserve the complete pre-existing three-choice browser set, then append
    // compact and explicitly requested strong choices. Local assistance may
    // make the list longer, but it must never crowd out a correct old choice.
    const baselineSeen = new Set()
    const baseline = [...suggestionChoices, ...allComboChoices]
      .filter((choice) => {
        if (!choice?.text || baselineSeen.has(choice.text)) return false
        baselineSeen.add(choice.text)
        return true
      })
      .slice(0, 3)
    const additions = wholeAnswerChoices.filter((choice) => !baselineSeen.has(choice.text))
    return baseline.concat(additions).slice(0, maxChoices)
  }
  // Preserve the app's direct transcription as the first choice. The larger
  // model is a key-blind second opinion, not an authority that replaces what
  // the student may actually have written.
  const preferredChoices = currentChoices.concat(wholeAnswerChoices, suggestionChoices).slice(0, maxChoices)
  const preferredTexts = new Set(preferredChoices.map((choice) => choice.text))
  const comboChoices = allComboChoices.filter((choice) => !preferredTexts.has(choice.text))
  return preferredChoices.concat(comboChoices.slice(0, Math.max(0, maxChoices - preferredChoices.length)))
}

function optionalWholeAnswerReviewUrl() {
  if (typeof window === 'undefined') return ''
  return consensusModelEndpoint('reviewModelUrl', '/review-model')
}

function optionalV3CompactModelUrl() {
  if (typeof window === 'undefined') return ''
  return consensusModelEndpoint('v3CompactModelUrl', '/v3-compact')
}

function wholeAnswerCropDataUrl(group, rawCrops) {
  const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
  const byId = new Map((rawCrops || []).map((crop) => [crop.id, crop]))
  const crops = ids.map((id) => byId.get(id)).filter((crop) => crop?.image)
  if (!crops.length || crops.length !== ids.length) return null
  const gap = 10
  const pad = 8
  const width = crops.reduce((sum, crop) => sum + crop.image.cols, 0) + gap * Math.max(0, crops.length - 1) + pad * 2
  const height = Math.max(...crops.map((crop) => crop.image.rows)) + pad * 2
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, width)
  canvas.height = Math.max(1, height)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.strokeStyle = '#d4dae3'
  ctx.strokeRect(0.5, 0.5, canvas.width - 1, canvas.height - 1)
  ctx.imageSmoothingEnabled = false
  let x = pad
  for (const crop of crops) {
    const slot = document.createElement('canvas')
    slot.width = crop.image.cols
    slot.height = crop.image.rows
    cv.imshow(slot, crop.image)
    ctx.drawImage(slot, x, pad + Math.floor((height - pad * 2 - slot.height) / 2))
    x += slot.width + gap
  }
  return canvas.toDataURL('image/png')
}

function wholeAnswerReviewItemsForFrame(questionGroups, questionReview, rawCrops, frameIndex = null) {
  return questionGroups
    .map((group, index) => ({ group, index }))
    .filter(({ index }) => questionReview[index] === true)
    .map(({ group, index }) => ({
      id: `question-${group?.question_num ?? index + 1}${frameIndex == null ? '' : `-frame-${frameIndex}`}`,
      questionNum: group?.question_num ?? index + 1,
      frameIndex,
      cropVariant: 'stitched-original-grayscale',
      imageDataUrl: wholeAnswerCropDataUrl(group, rawCrops)
    }))
    .filter((item) => !!item.imageDataUrl)
}

function browserLocalStrongShadowItems(questionGroups, questionReview, rawCrops, layout) {
  const groupByQuestion = new Map((questionGroups || []).map((group) => [Number(group?.question_num), group]))
  const layoutId = String(layout?.layout_id || layout?.id || 'unknown')
  const layoutFamily = /number-bond/.test(layoutId)
    ? 'number-bond'
    : /ten-frame/.test(layoutId) ? 'ten-frame'
      : /dot-collection/.test(layoutId) ? 'dot-collection'
        : /number-pattern/.test(layoutId) ? 'number-pattern'
          : /place-value/.test(layoutId) ? 'place-value' : 'row'
  return wholeAnswerReviewItemsForFrame(questionGroups, questionReview, rawCrops)
    .map((item) => {
      const group = groupByQuestion.get(Number(item.questionNum))
      const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
      return {
        ...item,
        reviewOnly: true,
        contract: {
          layoutFamily,
          physicalSlotCount: ids.length,
          maxHandwrittenDigits: maxHandwrittenDigitsForGroup(group),
          optionalSlotIndices: optionalDigitIndicesForGroup(group, layout?.boxes || []),
        },
      }
    })
}

async function canvasFromDataUrl(dataUrl) {
  const started = performance.now()
  if (v3FrameDecodeWorkerEnabled()) {
    try {
      const bitmap = await decodeFrameDataUrlInWorker(dataUrl)
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      canvas.getContext('2d').drawImage(bitmap, 0, 0)
      bitmap.close?.()
      canvas.__scanGradeDecodeMode = 'worker-image-bitmap'
      canvas.__scanGradeDecodeMs = performance.now() - started
      return canvas
    } catch (error) {
      console.warn('[ScanGrade] frame decode worker unavailable; using main-thread image decode:', error)
    }
  }
  const image = new Image()
  image.src = dataUrl
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
  })
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  canvas.getContext('2d').drawImage(image, 0, 0)
  canvas.__scanGradeDecodeMode = 'main-thread-image'
  canvas.__scanGradeDecodeMs = performance.now() - started
  return canvas
}

function shiftedImageData(sourceCanvas, width, height, dx, dy) {
  const shifted = document.createElement('canvas')
  shifted.width = width
  shifted.height = height
  const shiftedContext = shifted.getContext('2d')
  shiftedContext.fillStyle = '#ffffff'
  shiftedContext.fillRect(0, 0, width, height)
  shiftedContext.drawImage(sourceCanvas, dx, dy, width, height)
  return shiftedContext.getImageData(0, 0, width, height).data
}

function bestDarkPixelTranslation(reference, sourceCanvas, width, height, maximumShift = 6) {
  let best = { dx: 0, dy: 0, score: Number.POSITIVE_INFINITY, data: null }
  for (let dy = -maximumShift; dy <= maximumShift; dy += 2) {
    for (let dx = -maximumShift; dx <= maximumShift; dx += 2) {
      const data = shiftedImageData(sourceCanvas, width, height, dx, dy)
      let error = 0
      let compared = 0
      for (let y = 2; y < height - 2; y += 2) {
        for (let x = 2; x < width - 2; x += 2) {
          const offset = (y * width + x) * 4
          const a = reference[offset]
          const b = data[offset]
          if (a > 238 && b > 238) continue
          error += Math.abs(a - b)
          compared += 1
        }
      }
      const score = compared ? error / compared : Number.POSITIVE_INFINITY
      if (score < best.score) best = { dx, dy, score, data }
    }
  }
  return best
}

async function medianFusedFrameItems(sequenceItems, { align = false } = {}) {
  const byQuestion = new Map()
  for (const item of sequenceItems || []) {
    if (!item?.imageDataUrl || item?.questionNum == null) continue
    const key = Number(item.questionNum)
    if (!byQuestion.has(key)) byQuestion.set(key, [])
    byQuestion.get(key).push(item)
  }
  const fused = []
  for (const [questionNum, items] of byQuestion) {
    if (items.length !== 3) continue
    const canvases = await Promise.all(items.map((item) => canvasFromDataUrl(item.imageDataUrl)))
    const width = canvases[0].width
    const height = canvases[0].height
    if (!width || !height) continue
    const normalizedCanvases = canvases.map((source) => {
      const normalized = document.createElement('canvas')
      normalized.width = width
      normalized.height = height
      normalized.getContext('2d').drawImage(source, 0, 0, width, height)
      return normalized
    })
    const reference = normalizedCanvases[0].getContext('2d').getImageData(0, 0, width, height).data
    const alignments = [{ dx: 0, dy: 0, score: 0, data: reference }]
    for (const source of normalizedCanvases.slice(1)) {
      alignments.push(align
        ? bestDarkPixelTranslation(reference, source, width, height)
        : { dx: 0, dy: 0, score: null, data: source.getContext('2d').getImageData(0, 0, width, height).data })
    }
    const samples = alignments.map((item) => item.data)
    const output = document.createElement('canvas')
    output.width = width
    output.height = height
    const context = output.getContext('2d')
    const pixels = context.createImageData(width, height)
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      for (let channel = 0; channel < 3; channel += 1) {
        const values = [samples[0][offset + channel], samples[1][offset + channel], samples[2][offset + channel]].sort((a, b) => a - b)
        pixels.data[offset + channel] = values[1]
      }
      pixels.data[offset + 3] = 255
    }
    context.putImageData(pixels, 0, 0)
    fused.push({
      id: `question-${questionNum}-frame-fusion-${align ? 'aligned-' : ''}median`,
      questionNum,
      frameIndex: 2000,
      cropVariant: align ? 'locally-aligned-three-frame-median' : 'page-aligned-three-frame-median',
      alignment: alignments.map(({ dx, dy, score }) => ({ dx, dy, score })),
      imageDataUrl: output.toDataURL('image/png'),
    })
  }
  return fused
}

async function buildHybridBurstReviewItems(questionGroups, questionReview, selectedRawCrops, layout, qrLocation) {
  if (!hybridV2Enabled() || !optionalWholeAnswerReviewUrl() || pendingHybridBurstFrames.length < 2) {
    return {
      items: wholeAnswerReviewItemsForFrame(questionGroups, questionReview, selectedRawCrops),
      frames: [],
    }
  }

  const selectedFrame = pendingHybridBurstFrames.find((frame) => frame.selected) || pendingHybridBurstFrames[0]
  const items = wholeAnswerReviewItemsForFrame(
    questionGroups,
    questionReview,
    selectedRawCrops,
    selectedFrame?.index ?? null
  )
  const frames = [{
    frameIndex: selectedFrame?.index ?? null,
    selected: true,
    processed: true,
    itemCount: items.length,
  }]

  for (const frame of pendingHybridBurstFrames) {
    if (frame === selectedFrame || frame.selected) continue
    let src = null
    let worksheet = null
    try {
      const canvas = await canvasFromDataUrl(frame.imageDataUrl)
      src = cv.imread(canvas)
      worksheet = processWorksheet(src, layout, worksheetProcessingOptions(qrLocation || null))
      if (!worksheet) {
        frames.push({ frameIndex: frame.index, selected: false, processed: false, reason: 'page-registration-failed' })
        continue
      }
      const frameItems = wholeAnswerReviewItemsForFrame(
        questionGroups,
        questionReview,
        worksheet.rawCrops,
        frame.index
      )
      items.push(...frameItems)
      frames.push({ frameIndex: frame.index, selected: false, processed: true, itemCount: frameItems.length })
    } catch (error) {
      frames.push({
        frameIndex: frame.index,
        selected: false,
        processed: false,
        reason: String(error?.message || error),
      })
    } finally {
      for (const crop of worksheet?.rawCrops || []) {
        try { crop.image?.delete?.() } catch (_) {}
      }
      try { worksheet?.warpedImage?.delete?.() } catch (_) {}
      try { src?.delete?.() } catch (_) {}
    }
  }

  return { items, frames }
}

async function buildV3BurstShadowItems({
  questionGroups,
  layout,
  qrLocation,
  selectedSequenceItems,
  selectedCompactItems,
  selectedZones,
  selectedRawCrops = [],
  selectedSourceAnchors = null,
  selectedAlternateItems = [],
  burstFrames,
  reviewQuestionNums,
  includeCompactItems = true,
}) {
  const framesSnapshot = Array.isArray(burstFrames) ? burstFrames : []
  const selectedFrame = framesSnapshot.find((frame) => frame.selected) || framesSnapshot[0] || null
  const selectedFrameIndex = selectedFrame?.index ?? null
  const sequenceItems = filterItemsToYellowQuestions(selectedSequenceItems, reviewQuestionNums).map((item) => ({
    ...item,
    id: `${item.id}-frame-${selectedFrameIndex ?? 'selected'}`,
    frameIndex: selectedFrameIndex,
  }))
  const alternateSequenceItems = filterItemsToYellowQuestions(selectedAlternateItems, reviewQuestionNums).map((item) => ({
    ...item,
    id: `${item.id}-alternate-crop-frame-${selectedFrameIndex ?? 'selected'}`,
    frameIndex: selectedFrameIndex,
  }))
  const compactItems = filterItemsToYellowQuestions(selectedCompactItems, reviewQuestionNums).map((item) => ({
    ...item,
    id: `${item.id}-frame-${selectedFrameIndex ?? 'selected'}`,
    frameIndex: selectedFrameIndex,
  }))
  const zoneEvidence = (selectedZones || []).map((zone) => ({
    questionNum: zone.questionNum,
    frameIndex: selectedFrameIndex,
    selected: true,
    quality: zone.quality,
    blankArtifact: zone.blankArtifact,
  }))
  const frames = [{
    frameIndex: selectedFrameIndex,
    selected: true,
    processed: true,
    itemCount: sequenceItems.length,
  }]
  const alternateFrames = alternateSequenceItems.length ? [{
    frameIndex: selectedFrameIndex,
    selected: true,
    processed: true,
    itemCount: alternateSequenceItems.length,
  }] : []
  const layoutId = String(layout?.layout_id || layout?.id || '')
  const sharedNumberBondShift = v3SharedFrameProcessingEnabled() &&
    v3NumberBondShiftEvidenceEnabled() && layoutId === 'sg-g1-lw-08-number-bonds'
  const sharedNonrowTrim = v3SharedFrameProcessingEnabled() &&
    v3NonrowTrimEvidenceEnabled() && /sg-g1-lw-(06|07|09|10)-/.test(layoutId)

  for (const frame of framesSnapshot) {
    if (frame === selectedFrame || frame.selected) continue
    let src = null
    let worksheet = null
    let zones = []
    let alternateZones = []
    try {
      const canvas = await canvasFromDataUrl(frame.imageDataUrl)
      src = cv.imread(canvas)
      const selectedGeometryMode = experimentalSelectedGeometryMode()
      const reuseSelectedGeometry = selectedGeometryMode !== 'off' &&
        Array.isArray(selectedSourceAnchors) && selectedSourceAnchors.length === 4 &&
        Array.isArray(selectedRawCrops) && selectedRawCrops.length > 0
      if (reuseSelectedGeometry && selectedGeometryMode === 'direct') {
        // Research-only fast path: adjacent retained burst frames normally have
        // identical dimensions and nearly identical page placement. Reuse the
        // selected frame's page transform and refined answer rectangles so the
        // two corroboration frames avoid marker detection and box refinement.
        // The experiment must pass crop/evidence/output parity before this may
        // become a runtime default.
        worksheet = {
          warpedImage: warpToTemplate(src, selectedSourceAnchors, layout),
          rawCrops: selectedRawCrops.map(({ image: _image, ...metadata }) => metadata),
          sourceAnchors: selectedSourceAnchors,
          geometryMode: 'selected-frame-reuse',
        }
      } else {
        worksheet = processWorksheet(src, layout, worksheetProcessingOptions(qrLocation || null))
        replaceWithFreshV3Warp(worksheet, src, layout)
      }
      if (!worksheet) {
        frames.push({ frameIndex: frame.index, selected: false, processed: false, reason: 'page-registration-failed' })
        continue
      }
      zones = extractContinuousAnswerZones(
        worksheet.warpedImage,
        layout,
        v3AnswerZoneOptions(worksheet.rawCrops, layout)
      )
      let allFrameSequenceItems = v3SequenceFromZonesEnabled()
        ? wholeAnswerSequenceItemsFromZones(zones, frame.index)
        : wholeAnswerReviewItemsForFrame(
            questionGroups,
            questionGroups.map(() => true),
            worksheet.rawCrops,
            frame.index
          )
      const frameSequenceItems = filterItemsToYellowQuestions(allFrameSequenceItems, reviewQuestionNums)
      const frameCompactItems = includeCompactItems
        ? filterItemsToYellowQuestions(zones.map((zone) => ({
            id: `question-${zone.questionNum}-frame-${frame.index}`,
            questionNum: zone.questionNum,
            frameIndex: frame.index,
            continuousImageDataUrl: matToDataURL(zone.image),
          })), reviewQuestionNums)
        : []
      sequenceItems.push(...frameSequenceItems)
      let frameAlternateItems = []
      if (sharedNonrowTrim) {
        frameAlternateItems = trimmedWholeAnswerSequenceItemsFromZones(zones, frame.index, 0.04)
          .filter((item) => reviewQuestionNums.includes(Number(item.questionNum)))
          .map((item) => ({ ...item, id: `${item.id}-alternate-crop`, cropVariant: 'nonrow-trim-all-0.04' }))
      } else if (sharedNumberBondShift) {
        alternateZones = extractContinuousAnswerZones(worksheet.warpedImage, layout, {
          ...v3AnswerZoneOptions(worksheet.rawCrops, layout),
          offsetYFraction: 0.04,
        })
        frameAlternateItems = wholeAnswerSequenceItemsFromZones(alternateZones, frame.index)
          .filter((item) => reviewQuestionNums.includes(Number(item.questionNum)))
          .map((item) => ({ ...item, id: `${item.id}-alternate-crop`, cropVariant: 'number-bond-down-0.04' }))
      }
      alternateSequenceItems.push(...frameAlternateItems)
      if (sharedNonrowTrim || sharedNumberBondShift) {
        alternateFrames.push({
          frameIndex: frame.index,
          selected: false,
          processed: true,
          itemCount: frameAlternateItems.length,
        })
      }
      compactItems.push(...frameCompactItems)
      zoneEvidence.push(...zones.map((zone) => ({
        questionNum: zone.questionNum,
        frameIndex: frame.index,
        selected: false,
        quality: zone.quality,
        blankArtifact: zone.blankArtifact,
      })))
      frames.push({
        frameIndex: frame.index,
        selected: false,
        processed: true,
        itemCount: frameSequenceItems.length,
        geometryMode: worksheet.geometryMode || 'independent-registration',
        decodeMode: canvas.__scanGradeDecodeMode || 'unknown',
        decodeMs: Number((canvas.__scanGradeDecodeMs || 0).toFixed(2)),
      })
    } catch (error) {
      frames.push({ frameIndex: frame.index, selected: false, processed: false, reason: String(error?.message || error) })
    } finally {
      for (const zone of zones) {
        try { zone.image?.delete?.() } catch (_) {}
      }
      for (const zone of alternateZones) {
        try { zone.image?.delete?.() } catch (_) {}
      }
      for (const crop of worksheet?.rawCrops || []) {
        try { crop.image?.delete?.() } catch (_) {}
      }
      try { worksheet?.warpedImage?.delete?.() } catch (_) {}
      try { src?.delete?.() } catch (_) {}
    }
  }
  return { sequenceItems, compactItems, zoneEvidence, frames, alternateSequenceItems, alternateFrames }
}

async function buildV3AlternateCropReviewItems({ questionGroups, questionReview, layout, qrLocation, burstFrames }) {
  const numberBondShift = v3NumberBondShiftEvidenceEnabled() &&
    (layout?.layout_id || layout?.id) === 'sg-g1-lw-08-number-bonds'
  const layoutId = String(layout?.layout_id || layout?.id || '')
  const nonrowTrim = v3NonrowTrimEvidenceEnabled() && /sg-g1-lw-(06|07|09|10)-/.test(layoutId)
  if ((!v3DualCropReviewEnabled() && !numberBondShift && !nonrowTrim) ||
      (!numberBondShift && !nonrowTrim && (v3EightFrameColumnOrderEnabled() || questionGroups?.length !== 8))) {
    return { sequenceItems: [], frames: [] }
  }
  const reviewQuestions = new Set((questionGroups || [])
    .filter((_group, index) => questionReview?.[index] === true)
    .map((group) => Number(group?.question_num)))
  if (!reviewQuestions.size) return { sequenceItems: [], frames: [] }

  const sequenceItems = []
  const frames = []
  for (const frame of Array.isArray(burstFrames) ? burstFrames : []) {
    let src = null
    let worksheet = null
    let zones = []
    try {
      const canvas = await canvasFromDataUrl(frame.imageDataUrl)
      src = cv.imread(canvas)
      worksheet = processWorksheet(src, layout, {
        qrLocation: qrLocation || null,
        experimentalEightFrameColumnOrder: true,
      })
      replaceWithFreshV3Warp(worksheet, src, layout)
      if (!worksheet) {
        frames.push({ frameIndex: frame.index, processed: false, reason: 'page-registration-failed' })
        continue
      }
      const zoneOptions = v3AnswerZoneOptions(worksheet.rawCrops, layout)
      if (numberBondShift) zoneOptions.offsetYFraction = 0.04
      zones = extractContinuousAnswerZones(worksheet.warpedImage, layout, zoneOptions)
      const items = (nonrowTrim
        ? trimmedWholeAnswerSequenceItemsFromZones(zones, frame.index, 0.04)
        : wholeAnswerSequenceItemsFromZones(zones, frame.index))
        .filter((item) => reviewQuestions.has(Number(item.questionNum)))
        .map((item) => ({
          ...item,
          id: `${item.id}-alternate-crop`,
          cropVariant: numberBondShift
            ? 'number-bond-down-0.04'
            : nonrowTrim
              ? 'nonrow-trim-all-0.04'
            : 'eight-frame-column-order-alternate',
        }))
      sequenceItems.push(...items)
      frames.push({ frameIndex: frame.index, selected: frame.selected === true, processed: true, itemCount: items.length })
    } catch (error) {
      frames.push({ frameIndex: frame.index, selected: frame.selected === true, processed: false, reason: String(error?.message || error) })
    } finally {
      for (const zone of zones) {
        try { zone.image?.delete?.() } catch (_) {}
      }
      for (const crop of worksheet?.rawCrops || []) {
        try { crop.image?.delete?.() } catch (_) {}
      }
      try { worksheet?.warpedImage?.delete?.() } catch (_) {}
      try { src?.delete?.() } catch (_) {}
    }
  }
  return { sequenceItems, frames }
}

async function requestWholeAnswerReviewSuggestions(questionGroups, questionReview, rawCrops, preparedItems = null) {
  const baseUrl = optionalWholeAnswerReviewUrl()
  if (!baseUrl || !Array.isArray(questionGroups) || !Array.isArray(questionReview)) return []
  const items = Array.isArray(preparedItems)
    ? preparedItems
    : wholeAnswerReviewItemsForFrame(questionGroups, questionReview, rawCrops)
  if (!items.length) return []
  const results = await requestKeyBlindWholeAnswers({
    baseUrl,
    items,
    accessToken: optionalReviewAccessToken(),
    timeoutMs: hybridBurstEnabled() ? 8000 : 2500,
    onError: (error) => console.warn('[ScanGrade] Optional whole-answer review model unavailable:', error),
  })
  const sourceById = new Map(items.map((item) => [String(item.id), item]))
  return results
    .map((item) => ({
      ...item,
      frameIndex: sourceById.get(String(item?.id))?.frameIndex ?? item?.frameIndex ?? null,
      cropVariant: sourceById.get(String(item?.id))?.cropVariant ?? item?.cropVariant ?? null,
      text: String(item?.read || '').replace(/\D/g, ''),
      source: sourceById.get(String(item?.id))?.cropVariant
        ? 'key-blind-whole-answer-model-alternate-crop'
        : 'key-blind-whole-answer-model',
      reviewOnly: true
    }))
    .filter((item) => item.text && item.text.length <= 4)
}

function applyWholeAnswerReviewSuggestions(questionGroups, predictions, suggestions, { allowRelaxedMultiFrame = false } = {}) {
  if (!Array.isArray(suggestions) || !suggestions.length) return []
  const byQuestion = new Map()
  for (const item of suggestions) {
    const questionNum = Number(item.questionNum)
    if (!byQuestion.has(questionNum)) byQuestion.set(questionNum, [])
    byQuestion.get(questionNum).push(item)
  }
  const byId = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  const applied = []
  for (const group of questionGroups || []) {
    const questionNum = Number(group?.question_num)
    const frameSuggestions = byQuestion.get(questionNum) || []
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    if (!frameSuggestions.length || !ids.length) continue
    const frameConsensus = crossFrameConsensus(frameSuggestions.map((item) => ({
      frameIndex: item.frameIndex,
      text: item.text,
      minTokenProbability: item.minTokenProbability,
    })))
    const suggestion = [...frameSuggestions].sort((a, b) => {
      const aConsensus = frameConsensus?.strong && a.text === frameConsensus.text ? 1 : 0
      const bConsensus = frameConsensus?.strong && b.text === frameConsensus.text ? 1 : 0
      return bConsensus - aConsensus || Number(b.minTokenProbability || 0) - Number(a.minTokenProbability || 0)
    })[0]
    if (suggestion.text.length > ids.length) continue
    const cells = Array(Math.max(0, ids.length - suggestion.text.length)).fill(null)
      .concat([...suggestion.text].map((digit) => Number(digit)))
    const currentText = cellsToAnswerText(ids.map((id) => {
      const prediction = byId.get(id)
      return prediction?.blank === true || prediction?.empty === true ? null : (prediction?.digit ?? null)
    }))
    const firstPrediction = byId.get(ids[0])
    if (!firstPrediction) continue
    const hybridDecision = buildHybridAnswerDecision({
      currentText,
      currentNeedsReview: ids.some((id) => byId.get(id)?.reviewNeeded === true),
      currentConfidence: Math.min(...ids.map((id) => Number(byId.get(id)?.confidence || 0))),
      wholeAnswer: suggestion,
      frameReads: frameSuggestions,
    })
    firstPrediction.hybridDecision = hybridDecision
    if (!reviewSuggestionDisplayEligible({ suggestion, frameConsensus, currentText, allowRelaxedMultiFrame })) continue
    const record = {
      ...suggestion,
      cells,
      frameReads: frameSuggestions.map((item) => ({
        frameIndex: item.frameIndex,
        text: item.text,
        minTokenProbability: item.minTokenProbability,
        meanTokenProbability: item.meanTokenProbability,
      })),
      frameConsensus,
      hybridDecision,
    }
    const existing = Array.isArray(firstPrediction.wholeAnswerReviewSuggestions)
      ? firstPrediction.wholeAnswerReviewSuggestions
      : (firstPrediction.wholeAnswerReviewSuggestion ? [firstPrediction.wholeAnswerReviewSuggestion] : [])
    if (!existing.some((item) => item?.text === record.text && item?.source === record.source)) {
      existing.push(record)
    }
    firstPrediction.wholeAnswerReviewSuggestions = existing
    firstPrediction.wholeAnswerReviewSuggestion = existing[0] || record
    applied.push(record)
  }
  return applied
}

function applyCompactReviewChoices(questionGroups, predictions, compactReads, { source = 'key-blind-compact-model' } = {}) {
  const choicesByQuestion = compactSuggestionsByQuestion(compactReads, { limit: 3 })
  const byId = new Map((predictions || []).map((prediction) => [prediction.id, prediction]))
  const applied = []
  for (const group of questionGroups || []) {
    const questionNum = Number(group?.question_num)
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const firstPrediction = byId.get(ids[0])
    if (!firstPrediction || !ids.length) continue
    const records = (choicesByQuestion.get(questionNum) || [])
      .map((choice) => ({
        ...choice,
        cells: cellsForReviewText(choice.text, ids.length),
        source,
        reviewOnly: true,
      }))
      .filter((choice) => Array.isArray(choice.cells))
    if (!records.length) continue
    const existing = Array.isArray(firstPrediction.wholeAnswerReviewSuggestions)
      ? firstPrediction.wholeAnswerReviewSuggestions
      : (firstPrediction.wholeAnswerReviewSuggestion ? [firstPrediction.wholeAnswerReviewSuggestion] : [])
    for (const record of records) {
      if (!existing.some((item) => item?.text === record.text && item?.source === record.source)) {
        existing.push(record)
        applied.push({ questionNum, ...record })
      }
    }
    firstPrediction.wholeAnswerReviewSuggestions = existing
    firstPrediction.wholeAnswerReviewSuggestion = existing[0] || null
    firstPrediction.localFirstReview = localFirstReviewState({
      localChoices: existing.filter((item) => item?.source?.startsWith('key-blind-') && item?.source?.endsWith('-model')),
      strongStatus: localFirstStrongStatusByQuestion.value[questionNum] || 'deferred',
      strongChoices: existing.filter((item) => item?.source?.includes('whole-answer-model')),
    })
  }
  return applied
}

async function requestStrongChoicesForActiveQuestion() {
  const questionNum = activeCorrectionQuestionNum.value
  const context = localFirstStrongContext.value
  if (!Number.isFinite(questionNum) || !context || localFirstStrongLoading.value) return
  const group = (context.questionGroups || []).find((item) => Number(item?.question_num) === questionNum)
  const beforeContextChoices = group
    ? topAnswerChoicesForGroup(group, context.predictions || [], 6).map((choice) => choice.text)
    : []
  const contextAttempted = context.contextAttemptedByQuestion?.[questionNum] === true
  const contextItems = (context.contextCompactItems || []).filter((item) => Number(item?.questionNum) === questionNum)
  if (!contextAttempted && contextItems.length && optionalV3CompactModelUrl()) {
    localFirstStrongStatusByQuestion.value = {
      ...localFirstStrongStatusByQuestion.value,
      [questionNum]: 'loading',
    }
    const contextReads = await requestCompactWholeAnswers({
      baseUrl: optionalV3CompactModelUrl(),
      items: contextItems,
      accessToken: optionalReviewAccessToken(),
      timeoutMs: 8000,
      onError: (error) => console.warn('[ScanGrade] Optional on-demand context crop unavailable:', error),
    })
    const contextApplied = applyCompactReviewChoices(
      context.questionGroups,
      context.predictions,
      contextReads,
      { source: 'key-blind-context-crop-model' },
    )
    context.contextAttemptedByQuestion = {
      ...(context.contextAttemptedByQuestion || {}),
      [questionNum]: true,
    }
    const afterContextChoices = group
      ? topAnswerChoicesForGroup(group, context.predictions || [], 6).map((choice) => choice.text)
      : []
    const addedVisibleChoice = afterContextChoices.some((choice) => !beforeContextChoices.includes(choice))
    if (context.payload) {
      context.payload.localFirstContextRequests = [
        ...(context.payload.localFirstContextRequests || []),
        { questionNum, resultCount: contextReads.length, appliedCount: contextApplied.length, addedVisibleChoice },
      ]
      if (lastLiveOcrDebug.value) {
        lastLiveOcrDebug.value.localFirstContextRequests = context.payload.localFirstContextRequests
        lastLiveOcrDebug.value.predictions = context.predictions
      }
      ocrResult.value = { ...context.payload }
    }
    if (addedVisibleChoice) {
      localFirstStrongStatusByQuestion.value = {
        ...localFirstStrongStatusByQuestion.value,
        [questionNum]: 'context-ready',
      }
      return
    }
  }
  const preparedItems = (context.sequenceItems || []).filter((item) => Number(item?.questionNum) === questionNum)
  if (!preparedItems.length || !optionalWholeAnswerReviewUrl()) {
    localFirstStrongStatusByQuestion.value = {
      ...localFirstStrongStatusByQuestion.value,
      [questionNum]: 'unavailable',
    }
    return
  }
  localFirstStrongStatusByQuestion.value = {
    ...localFirstStrongStatusByQuestion.value,
    [questionNum]: 'loading',
  }
  const reviewFlags = (context.questionGroups || []).map((group) => Number(group?.question_num) === questionNum)
  const reads = await requestWholeAnswerReviewSuggestions(
    context.questionGroups,
    reviewFlags,
    [],
    preparedItems,
  )
  const applied = applyWholeAnswerReviewSuggestions(
    context.questionGroups,
    context.predictions,
    reads,
    { allowRelaxedMultiFrame: context.questionGroups?.length === 8 },
  )
  const status = applied.some((item) => Number(item?.questionNum) === questionNum) ? 'complete' : 'unavailable'
  localFirstStrongStatusByQuestion.value = {
    ...localFirstStrongStatusByQuestion.value,
    [questionNum]: status,
  }
  const firstId = group?.digit_box_ids?.[0]
  const firstPrediction = (context.predictions || []).find((item) => item.id === firstId)
  if (firstPrediction) {
    const allChoices = firstPrediction.wholeAnswerReviewSuggestions || []
    firstPrediction.localFirstReview = localFirstReviewState({
      localChoices: allChoices.filter((item) => item?.source === 'key-blind-compact-model'),
      strongStatus: status,
      strongChoices: allChoices.filter((item) => item?.source?.includes('whole-answer-model')),
    })
  }
  if (context.payload) {
    context.payload.localFirstStrongRequests = [
      ...(context.payload.localFirstStrongRequests || []),
      { questionNum, status, resultCount: reads.length, appliedCount: applied.length },
    ]
    if (lastLiveOcrDebug.value) {
      lastLiveOcrDebug.value.localFirstStrongRequests = context.payload.localFirstStrongRequests
      lastLiveOcrDebug.value.predictions = context.predictions
      void uploadLiveOcrDebug(lastLiveOcrDebug.value, 'local-first-strong-complete')
    }
    ocrResult.value = { ...context.payload }
  }
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
    scanSessionId: partialDebug?.scanSessionId || null,
    error: {
      message,
      name: err?.name || null,
      stack: err?.stack || null
    },
    stage: partialDebug?.stage || 'unknown',
    packetId: partialDebug?.packetId || null,
    captureRole: partialDebug?.captureRole || null,
    capturePlanSeed: partialDebug?.capturePlanSeed || null,
    layoutUrl: partialDebug?.layoutUrl || null,
    layoutId: partialDebug?.layoutId || null,
    qrPayload: partialDebug?.qrPayload || null,
    activeHomography: partialDebug?.activeHomography || null,
    warpOrientation: typeof window !== 'undefined'
      ? (window.__SCANGRADE_DEBUG_WARP_ORIENTATION || null)
      : null,
    ignoreQrHomography: !!partialDebug?.ignoreQrHomography,
    imageSize: partialDebug?.imageSize || null,
    captureQuality: partialDebug?.captureQuality || lastCaptureQuality.value || null,
    hybridBurstFrameDataUrls: partialDebug?.hybridBurstFrameDataUrls || [],
    hybridBurstFrameMetadata: partialDebug?.hybridBurstFrameMetadata || [],
    hybridBurstProcessing: partialDebug?.hybridBurstProcessing || [],
    warpedDataUrl: partialDebug?.warpedDataUrl || null,
    rawCropDataUrls: partialDebug?.rawCropDataUrls || [],
    modelInputDataUrls: partialDebug?.modelInputDataUrls || [],
    tensors: partialDebug?.tensors || [],
    preprocessStats: partialDebug?.preprocessStats || [],
    cropQuality: partialDebug?.cropQuality || [],
    twoDigitCropFailure: partialDebug?.twoDigitCropFailure || null,
    twoDigitRecognitionFailure: partialDebug?.twoDigitRecognitionFailure || null,
    unusableTwoDigitScan: partialDebug?.unusableTwoDigitScan || null,
    forcedFallbackReviewReason: partialDebug?.forcedFallbackReviewReason || null,
    reviewOnlyFallback: partialDebug?.reviewOnlyFallback === true,
    knownGrade2Fallback: partialDebug?.knownGrade2Fallback === true,
    missingQrLayoutFallback: partialDebug?.missingQrLayoutFallback === true,
    titleFallbackReranLayout: partialDebug?.titleFallbackReranLayout ?? null,
    printedTitleFallback: partialDebug?.printedTitleFallback || null,
    questionCorrect: partialDebug?.questionCorrect || null,
    questionReview: partialDebug?.questionReview || null,
    answerGroups: partialDebug?.answerGroups || null,
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

function warmStudentDigitModel() {
  if (!props.studentMode || digitModelWarmupStarted) return
  digitModelWarmupStarted = true
  initDigitModel()
    .then(() => {
      modelInfoSnapshot.value = getDigitModelInfo()
    })
    .catch((err) => {
      digitModelWarmupStarted = false
      console.warn('[ScanGrade] Student digit model warmup did not finish:', err)
    })
}

async function withDigitEngineTimeout(promise, label, timeoutMs = DIGIT_ENGINE_OPERATION_TIMEOUT_MS) {
  let timer = null
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => {
          reject(new Error(`Digit engine timed out while ${label}`))
        }, timeoutMs)
      })
    ])
  } finally {
    if (timer != null) window.clearTimeout(timer)
  }
}

const runRealOCR = async () => {
  processing.value = true
  scanningAnnotationPreview.value = null
  ocrResult.value = null
  activeCorrectionQuestion.value = null
  manualCorrectionText.value = ''
  manualCorrectionClearedForSession.value = false
  correctionError.value = ''
  localFirstStrongStatusByQuestion.value = {}
  localFirstStrongContext.value = null
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
  activeScanSessionId = newScanSessionId()
  const evaluationMetadata = prospectiveEvaluationMetadata()
  const browserLocalCandidateConfig = browserLocalCandidateRuntimeConfig()
  const acceptedSafetyConfig = wholeSlotScoutShadowConfig()
  const acceptedSafetyRuntimeEnabled = acceptedSafetyConfig.requested && (
    hybridV3Enabled() || acceptedSafetyConfig.policyScope === 'six-eight-only'
  )
  // Assigned only by a pre-acceptance local-reader path and awaited in
  // `finally` before the completion event is emitted.
  let candidatePresentationPromise = null
  const partialDebug = {
    stage: 'starting',
    scanSessionId: activeScanSessionId,
    ...evaluationMetadata,
    layoutUrl: null,
    layoutId: null,
    qrPayload: null,
    activeHomography: null,
    ignoreQrHomography: false,
    imageSize: null,
    warpedDataUrl: null,
    rawCropDataUrls: [],
    modelInputDataUrls: [],
    v3AnswerZones: [],
    v3ContextAnswerZones: [],
    v3GeometryRescue: null,
    v3Shadow: null,
    v3BrowserLocalCandidate: {
      status: browserLocalCandidateConfig.requested
        ? (browserLocalCandidateConfig.enabled ? 'configured' : 'unavailable')
        : 'not-requested',
      affectsGrade: false,
      unavailableReason: browserLocalCandidateConfig.unavailableReason || null,
      noUploads: true,
    },
    v3UniformAnswerViews: [],
    tensors: [],
    preprocessStats: [],
    predictions: [],
    answerKey: null,
    knownGrade2Fallback: null,
    missingQrLayoutFallback: null,
    printedTitleFallback: null,
    reviewOnlyFallback: false,
    forcedFallbackReviewReason: null,
    captureQuality: lastCaptureQuality.value || null,
    hybridBurstFrameDataUrls: pendingHybridBurstFrames.map((frame) => frame.imageDataUrl),
    hybridBurstFrameMetadata: pendingHybridBurstFrames.map(({ imageDataUrl: _imageDataUrl, ...metadata }) => metadata)
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
    let qrPayload = decodeQrFromCanvas(canvas)
    if (!qrPayload && typeof window !== 'undefined') {
      qrPayload = decodeQrFromPageUrl(window.location.href)
    }
    partialDebug.qrPayload = qrPayload || null
    const allowDefaultLayout =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('allowDefaultLayout') === '1'
    partialDebug.allowDefaultLayout = allowDefaultLayout
    const missingQrLayoutFallback = !qrPayload && !allowDefaultLayout
    partialDebug.knownGrade2Fallback = missingQrLayoutFallback
    partialDebug.missingQrLayoutFallback = missingQrLayoutFallback
    let layoutUrl = qrPayload?.layout_id
      ? layoutUrlForId(qrPayload.layout_id)
      : missingQrLayoutFallback
        ? layoutUrlForId(MISSING_QR_FALLBACK_SEED_LAYOUT_ID)
        : DEFAULT_LAYOUT_URL
    partialDebug.layoutUrl = layoutUrl
    partialDebug.stage = 'loading layout'
    let layout = await fetchLayoutJson(layoutUrl)
    if (!layout && !missingQrLayoutFallback) {
      layoutUrl = DEFAULT_LAYOUT_URL
      partialDebug.layoutUrl = layoutUrl
      layout = await fetchLayoutJson(layoutUrl)
    }
    if (!layout) {
      throw new Error('Layout not found. Ensure ' + DEFAULT_LAYOUT_URL + ' is available.')
    }
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

    if ((ocrDebugEnabled.value || liveOcrDebugExportEnabled.value) && typeof window !== 'undefined') {
      window.__SCANGRADE_DEBUG_MARKERS = true
      window.__SCANGRADE_DEBUG_ANSWER_BOXES = true
      window.__SCANGRADE_DEBUG_PREPROCESS_STATS = []
    }

    // Run homography + crops with normalized layout
    partialDebug.stage = 'finding worksheet markers'
    const result = processWorksheet(src, layout, worksheetProcessingOptions(qrPayload?.qr_location || null))
    if (hybridV3Enabled()) replaceWithFreshV3Warp(result, src, layout)

    if (!result) {
      if (ocrDebugEnabled.value || liveOcrDebugExportEnabled.value) {
        markerDebugSnapshot.value = collectMarkerDebugSnapshot(activeHomography, ignoreQrHomography)
      }
      throw new Error('Corner marker detection failed. Ensure 4 black square markers are visible.')
    }

    let worksheetResult = result
    let { warpedImage, rawCrops, processedTensors } = worksheetResult
    partialDebug.answerBoxRegistration = typeof window !== 'undefined'
      ? {
          candidates: clonePlain(window.__SCANGRADE_DEBUG_ANSWER_BOX_CANDIDATES || []),
          assignments: clonePlain(window.__SCANGRADE_DEBUG_ANSWER_BOX_ASSIGNMENTS || []),
          coherence: clonePlain(window.__SCANGRADE_DEBUG_ANSWER_BOX_COHERENCE || null),
          virtualFrames: clonePlain(window.__SCANGRADE_DEBUG_VIRTUAL_FRAMES || []),
        }
      : null
    const disposeWorksheetImages = (worksheet) => {
      for (const crop of worksheet?.rawCrops || []) {
        try {
          crop.image?.delete?.()
        } catch (_) {}
      }
      try {
        worksheet?.warpedImage?.delete?.()
      } catch (_) {}
    }
    if (missingQrLayoutFallback) {
      partialDebug.stage = 'identifying known worksheet title'
      const titleMatch = classifyKnownWorksheetLayoutFromWarped(warpedImage)
      partialDebug.printedTitleFallback = titleMatch
      if (titleMatch?.accepted) {
        const matchedLayoutUrl = layoutUrlForId(titleMatch.layoutId)
        const seedLayout = layout
        const matchedLayout = titleMatch.layoutId === layout.layout_id
          ? layout
          : await fetchLayoutJson(matchedLayoutUrl)
        if (matchedLayout) {
          const matchedResult = titleMatch.layoutId === layout.layout_id
            ? worksheetResult
            : processWorksheet(src, matchedLayout, worksheetProcessingOptions(null))
          if (hybridV3Enabled() && matchedResult !== worksheetResult) {
            replaceWithFreshV3Warp(matchedResult, src, matchedLayout)
          }
          if (matchedResult) {
            if (matchedResult !== worksheetResult) {
              disposeWorksheetImages(worksheetResult)
              worksheetResult = matchedResult
              ;({ warpedImage, rawCrops, processedTensors } = worksheetResult)
              partialDebug.titleFallbackReranLayout = true
            } else {
              partialDebug.titleFallbackReranLayout = false
            }
            layout = matchedLayout
            layoutUrl = matchedLayoutUrl
            qrPayload = createQrPayloadForKnownLayout(titleMatch)
            partialDebug.layoutUrl = layoutUrl
            partialDebug.layoutId = layout.layout_id || null
            partialDebug.qrPayload = qrPayload
            partialDebug.reviewOnlyFallback = true
            partialDebug.forcedFallbackReviewReason = 'qr-missing-title-layout-fallback-review'
          } else {
            layout = makeReviewOnlyLayout(seedLayout, 'known-title-layout-process-failed')
            partialDebug.reviewOnlyFallback = true
            partialDebug.forcedFallbackReviewReason = 'qr-missing-title-layout-process-failed-review'
          }
        } else {
          layout = makeReviewOnlyLayout(layout, 'known-title-layout-fetch-failed')
          partialDebug.reviewOnlyFallback = true
          partialDebug.forcedFallbackReviewReason = 'qr-missing-title-layout-fetch-failed-review'
        }
      } else {
        layout = makeReviewOnlyLayout(layout, 'known-title-not-confident')
        partialDebug.reviewOnlyFallback = true
        partialDebug.forcedFallbackReviewReason = 'qr-missing-title-not-confident-review'
      }
    }
    partialDebug.activeHomography = {
      anchors: layout?.homography?.anchors,
      marker_size: layout?.homography?.marker_size
    }
    partialDebug.answerBoxRegistration = typeof window !== 'undefined'
      ? {
          candidates: clonePlain(window.__SCANGRADE_DEBUG_ANSWER_BOX_CANDIDATES || []),
          assignments: clonePlain(window.__SCANGRADE_DEBUG_ANSWER_BOX_ASSIGNMENTS || []),
          coherence: clonePlain(window.__SCANGRADE_DEBUG_ANSWER_BOX_COHERENCE || null),
          virtualFrames: clonePlain(window.__SCANGRADE_DEBUG_VIRTUAL_FRAMES || []),
        }
      : partialDebug.answerBoxRegistration
    const saveRecognizedScanAsReview = () => {
      const hasAnswerKey = Array.isArray(layout?.answer_key) || Array.isArray(qrPayload?.answer_key)
      const hasQuestionGroups = Array.isArray(layout?.question_groups) && layout.question_groups.length > 0
      const hasQrTemplate = !!(qrPayload?.template_id || qrPayload?.layout_id)
      const hasKnownFallbackTemplate =
        missingQrLayoutFallback &&
        (
          partialDebug.printedTitleFallback?.accepted === true ||
          partialDebug.reviewOnlyFallback === true
        )
      return hasAnswerKey && hasQuestionGroups && (hasQrTemplate || hasKnownFallbackTemplate)
    }
    let forcedFallbackReviewReason = partialDebug.forcedFallbackReviewReason || null
    const forceKnownFallbackReview = (reason) => {
      if (!saveRecognizedScanAsReview()) return false
      forcedFallbackReviewReason = reason
      partialDebug.forcedFallbackReviewReason = reason
      partialDebug.reviewOnlyFallback = true
      return true
    }

    const sourceAnnotationContext = buildSourceAnnotationContext(
      rawCrops,
      worksheetResult.sourceAnchors,
      layout,
      warpedImage.cols,
      warpedImage.rows,
      canvas.width,
      canvas.height
    )
    const annotationCrops = sourceAnnotationContext?.crops || rawCrops
    const annotationLayout = sourceAnnotationContext?.layout || layout
    const annotationWidth = sourceAnnotationContext?.width || warpedImage.cols
    const annotationHeight = sourceAnnotationContext?.height || warpedImage.rows
    const annotationBaseImageUrl = sourceAnnotationContext ? capturedImage.value : null
    const annotationBaseMode = sourceAnnotationContext ? 'source-capture' : 'warped-sheet'
    const annotationGeometry = buildAnnotationGeometry(annotationCrops, annotationWidth, annotationHeight, null)
    const layoutSnapshot = buildLayoutSnapshot(annotationLayout)
    if (props.studentMode) {
      const scanningBaseUrl = annotationBaseImageUrl || matToDataURL(warpedImage, 'scanning-preview')
      scanningAnnotationPreview.value = scanningBaseUrl ? {
        imageUrl: scanningBaseUrl,
        width: annotationWidth,
        height: annotationHeight,
        layout: annotationLayout,
      } : null
      if (typeof window !== 'undefined') {
        window.__SCANGRADE_SCANNING_DATE_DEBUG = {
          layoutId: annotationLayout?.layout_id || annotationLayout?.id || null,
          width: annotationWidth,
          height: annotationHeight,
          declaredRect: declaredDateStampRect(annotationLayout, annotationWidth, annotationHeight),
          spec: dateStampSpecForLayout(annotationLayout, annotationWidth, annotationHeight, 1),
        }
      }
    }
    partialDebug.stage = 'preparing OCR crops'
    const cropQuality = processedTensors.map((proc) => bestTensorInkQuality(proc))
    partialDebug.cropQuality = cropQuality
    partialDebug.stage = 'checking OCR crop quality'
    const twoDigitCropFailure = detectTwoDigitCropFailure(layout.question_groups, cropQuality)
    partialDebug.twoDigitCropFailure = twoDigitCropFailure
    if (twoDigitCropFailure) {
      if (!forceKnownFallbackReview('two-digit-crop-quality-fallback-review')) {
        rawCrops.forEach((crop) => crop.image.delete())
        warpedImage.delete()
        src.delete()
        throw new Error('Answer boxes were not captured clearly. Hold the sheet flatter and try again.')
      }
    }
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_OCR_INPUTS) {
      try {
        window.__SCANGRADE_DEBUG_RAW_CROPS = rawCrops.map((c, i) => matToDataURL(c.image, `box-${i + 1}`))
        window.__SCANGRADE_DEBUG_PREPROCESSED = processedTensors.map((p, i) => tensorToDataURL(p.tensor, `box-${i + 1}`))
        window.__SCANGRADE_DEBUG_PREPROCESSED_VARIANTS = processedTensors.map((p, i) => ({
          id: p.id,
          box: `box-${i + 1}`,
          variants: (p.tensorVariants || []).map((variant) => ({
            name: variant.name || 'variant',
            suggestionOnly: variant.suggestionOnly === true,
            dataUrl: tensorToDataURL(variant.tensor, `${p.id}-${variant.name || 'variant'}`)
          }))
        }))
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
          digitIndex: p.digitIndex,
          tensor: Array.from(p.tensor),
          tensorVariants: (p.tensorVariants || []).map((variant) => ({
            name: variant.name || 'variant',
            suggestionOnly: variant.suggestionOnly === true,
            tensor: Array.from(variant.tensor)
          }))
        }))
      } catch (e) {
        console.warn('[ScanGrade] tensor debug export failed:', e)
      }
    }
    let selectedCoreCropSequenceItems = []
    let selectedAlternateCropSequenceItems = []
    if (hybridV3Enabled() || browserLocalCandidateConfig.enabled) {
      let zones = []
      try {
        zones = extractContinuousAnswerZones(warpedImage, layout, v3AnswerZoneOptions(rawCrops, layout))
        partialDebug.v3AnswerZones = zones.map((zone) => ({
          schemaVersion: zone.schemaVersion,
          questionNum: zone.questionNum,
          digitBoxIds: zone.digitBoxIds,
          source: zone.source,
          rect: zone.rect,
          quality: zone.quality,
          blankArtifact: zone.blankArtifact,
          imageDataUrl: matToDataURL(zone.image, `v3-answer-${zone.questionNum}`)
        }))
        if (v3CoreCropEvidenceEnabled()) {
          selectedCoreCropSequenceItems = [
            ...wholeAnswerSequenceItemsFromZones(zones).map((item) => ({
              ...item,
              id: `${item.id}-core-original`,
              frameIndex: 1000,
              cropVariant: 'core-original',
            })),
            ...trimmedWholeAnswerSequenceItemsFromZones(zones, 1001, 0.02).map((item) => ({
              ...item,
              cropVariant: 'core-trim-all-0.02',
            })),
            ...trimmedWholeAnswerSequenceItemsFromZones(zones, 1002, 0.04).map((item) => ({
              ...item,
              cropVariant: 'core-trim-all-0.04',
            })),
          ]
        }
        if (v3SharedFrameProcessingEnabled()) {
          const layoutId = String(layout?.layout_id || layout?.id || '')
          if (v3NonrowTrimEvidenceEnabled() && /sg-g1-lw-(06|07|09|10)-/.test(layoutId)) {
            selectedAlternateCropSequenceItems = trimmedWholeAnswerSequenceItemsFromZones(zones, 0, 0.04)
              .map((item) => ({ ...item, cropVariant: 'nonrow-trim-all-0.04' }))
          } else if (v3NumberBondShiftEvidenceEnabled() && layoutId === 'sg-g1-lw-08-number-bonds') {
            let shiftedZones = []
            try {
              shiftedZones = extractContinuousAnswerZones(warpedImage, layout, {
                ...v3AnswerZoneOptions(rawCrops, layout),
                offsetYFraction: 0.04,
              })
              selectedAlternateCropSequenceItems = wholeAnswerSequenceItemsFromZones(shiftedZones, 0)
                .map((item) => ({ ...item, cropVariant: 'number-bond-down-0.04' }))
            } finally {
              for (const zone of shiftedZones) {
                try { zone.image?.delete?.() } catch (_) {}
              }
            }
          }
        }
        if (v3LocalFirstReviewEnabled()) {
          const rescue = geometryRescuePlan({
            layout,
            zones: partialDebug.v3AnswerZones,
            width: warpedImage.cols,
            height: warpedImage.rows,
          })
          if (rescue) {
            let rescuedImage = null
            try {
              rescuedImage = warpedImage.roi(new cv.Rect(rescue.rect.x, rescue.rect.y, rescue.rect.w, rescue.rect.h))
              partialDebug.v3GeometryRescue = {
                ...rescue,
                source: 'same-page-geometry-outlier-rescue',
                reviewOnly: true,
                imageDataUrl: matToDataURL(rescuedImage, `v3-geometry-rescue-${rescue.questionNum}`),
              }
            } finally {
              try { rescuedImage?.delete?.() } catch (_) {}
            }
          }
        }
      } catch (e) {
        console.warn('[ScanGrade] V3 continuous answer extraction failed:', e)
        partialDebug.v3AnswerZoneError = String(e?.message || e)
      } finally {
        for (const zone of zones) {
          try { zone.image?.delete?.() } catch (_) {}
        }
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
    let predictions = []
    const MNIST_LEN = 28 * 28
    let digitEngineFallbackReview = false
    const buildDigitEngineFallbackPredictions = (reason, err) => {
      const message = String(err?.message || err || reason)
      forcedFallbackReviewReason = forcedFallbackReviewReason || reason
      partialDebug.forcedFallbackReviewReason = forcedFallbackReviewReason
      partialDebug.reviewOnlyFallback = true
      partialDebug.digitEngineFallback = true
      partialDebug.digitEngineError = {
        reason,
        message,
        stage: partialDebug.stage
      }
      return processedTensors.map((proc) => ({
        id: proc.id,
        questionNum: proc.questionNum,
        digitIndex: proc.digitIndex,
        digit: null,
        confidence: 0,
        topK: [],
        topGap: 0,
        reviewNeeded: true,
        probs: [],
        entropyNorm: null,
        robust: false,
        robustOverride: null,
        variantCount: Array.isArray(proc.tensorVariants) ? Math.max(1, proc.tensorVariants.length) : 1,
        baseDigit: null,
        baseConfidence: null,
        baseTopK: null,
        preprocessDisagreement: false,
        preprocessReviewReason: reason,
        confidencePolicyCleared: false,
        confidencePolicyClearanceReason: reason,
        originalChosenDigitConfidence: 0,
        highRiskPreprocessReview: false,
        structuralReview: false,
        forcedReviewReason: reason,
        digitEngineFallback: true
      }))
    }

    try {
      partialDebug.stage = 'initializing digit model'
      await withDigitEngineTimeout(initDigitModel(), 'initializing digit model')
      modelInfoSnapshot.value = getDigitModelInfo()

      partialDebug.stage = 'running digit model'
      for (const proc of processedTensors) {
        const src = proc.tensor
        const data = new Float32Array(MNIST_LEN)
        if (src && src.length >= MNIST_LEN) {
          data.set(typeof src.subarray === 'function' ? src.subarray(0, MNIST_LEN) : src.slice(0, MNIST_LEN))
        }
        // Pass Float32Arrays so inference copies the data; passing ort.Tensor can expose neutered .data in onnxruntime-web.
        let digitResult
        const hasPreprocessVariants =
          proc.isVirtualDigitBox === true &&
          Array.isArray(proc.tensorVariants) &&
          proc.tensorVariants.length > 1
        if (hasPreprocessVariants) {
          digitResult = await withDigitEngineTimeout(
            recognizeDigitsWithPreprocessVariants(proc.tensorVariants, null, {
              digitIndex: proc.digitIndex
            }),
            `recognizing digit ${proc.id}`
          )
        } else {
          digitResult = await withDigitEngineTimeout(
            recognizeDigits(data),
            `recognizing digit ${proc.id}`
          )
          const baseTopK = digitResult[0].topK || []
          const baseTopGap = baseTopK.length >= 2 ? (baseTopK[0].confidence - baseTopK[1].confidence) : 1
          const forceRobust = proc.isVirtualDigitBox === true
          if (forceRobust || digitResult[0].confidence < ROBUST_RETRY_CONFIDENCE_THRESHOLD || baseTopGap < ROBUST_RETRY_MARGIN_THRESHOLD) {
            digitResult = await withDigitEngineTimeout(
              recognizeDigitsRobust(data, digitResult[0], { force: forceRobust }),
              `checking digit ${proc.id}`
            )
          }
        }
        const expectedDigit = answerKey != null && proc.id < answerKey.length
          ? answerKey[proc.id]
          : null
        if (leftSlotSlantedOneFromSevenRescue(proc, digitResult[0], expectedDigit)) {
          digitResult[0] = applyLeftSlotSlantedOneRescue(digitResult[0])
        }
        const digit = digitResult[0].digit
        const topK = digitResult[0].topK || []
        const topGap = topK.length >= 2 ? (topK[0].confidence - topK[1].confidence) : 1
        const correct = answerKey != null && proc.id < answerKey.length && answerKey[proc.id] != null
          ? digit === expectedDigit
          : undefined
        const autoCheckAllowed =
          digitResult[0].confidence >= AUTO_CHECK_CONFIDENCE_THRESHOLD &&
          topGap >= AUTO_CHECK_MARGIN_THRESHOLD
        const autoXAllowed = autoXAllowedForDigit(proc, digitResult[0], topGap)
        const lowSignal =
          digitResult[0].confidence < LOW_CONFIDENCE_THRESHOLD ||
          topGap < LOW_MARGIN_THRESHOLD
        const highRiskPreprocessReview = highRiskRightSlotPreprocessReview(proc, digitResult[0])
        const structuralReview = structuralTwoDigitReview(proc, digitResult[0], expectedDigit)
        const unexpectedLeadingDigitReview = unexpectedOptionalLeadingDigitReview(proc, digitResult[0], expectedDigit)
        const highRiskMismatchReview = highRiskTwoDigitMismatchReview(proc, digitResult[0], expectedDigit)
        const highRiskSingleDigitMismatchReview = highRiskSingleDigitMismatchReviewForDigit(proc, digitResult[0], expectedDigit)
        const confidencePolicyClearance = confidencePolicyClearanceForDigit(
          proc,
          digitResult[0],
          topGap,
          correct,
          {
            highRiskPreprocessReview,
            structuralReview,
            unexpectedLeadingDigitReview,
            highRiskMismatchReview,
            highRiskSingleDigitMismatchReview,
            cameraCapture: !!partialDebug.captureQuality
          }
        )
        const reviewNeeded = confidencePolicyClearance.allowed ? false
          : correct === true
            ? !autoCheckAllowed
            : highRiskPreprocessReview || structuralReview || unexpectedLeadingDigitReview || highRiskMismatchReview || highRiskSingleDigitMismatchReview ? true
            : correct === false
              ? !autoXAllowed
              : lowSignal
        predictions.push({
          id: proc.id,
          questionNum: proc.questionNum,
          digitIndex: proc.digitIndex,
          slotCount: proc.slotCount,
          isVirtualDigitBox: proc.isVirtualDigitBox === true,
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
          preprocessDisagreement: digitResult[0].preprocessDisagreement === true,
          preprocessReviewReason: reviewNeeded && structuralReview
            ? 'two-digit-leading-zero-structural-review'
            : reviewNeeded && unexpectedLeadingDigitReview
            ? 'two-digit-optional-leading-digit-review'
            : reviewNeeded && highRiskMismatchReview
            ? 'two-digit-mismatch-low-trust-review'
            : reviewNeeded && highRiskSingleDigitMismatchReview
            ? 'single-digit-six-shape-mismatch-review'
            : reviewNeeded && highRiskPreprocessReview
            ? 'right-slot-preprocess-disagreement'
            : (digitResult[0].preprocessReviewReason || null),
          confidencePolicyCleared: confidencePolicyClearance.allowed === true,
          confidencePolicyClearanceReason: confidencePolicyClearance.reason,
          originalChosenDigitConfidence: chosenDigitProbability(digitResult[0]),
          originalDigitBeforeShapeRescue: digitResult[0].originalDigitBeforeShapeRescue ?? null,
          originalConfidenceBeforeShapeRescue: digitResult[0].originalConfidenceBeforeShapeRescue ?? null,
          highRiskPreprocessReview,
          structuralReview,
          unexpectedLeadingDigitReview,
          highRiskMismatchReview,
          highRiskSingleDigitMismatchReview,
          preprocessVariants: digitResult[0].preprocessVariants || null,
          reviewSuggestionVariants: digitResult[0].reviewSuggestionVariants || null,
          preprocessVoteSummary: digitResult[0].preprocessVoteSummary || null,
          ...(correct !== undefined && { correct })
        })
      }
    } catch (err) {
      if (!saveRecognizedScanAsReview()) throw err
      digitEngineFallbackReview = true
      const reason = partialDebug.stage === 'running digit model'
        ? 'digit-engine-inference-failed-review'
        : 'digit-engine-unavailable-review'
      console.warn('[ScanGrade] Digit engine unavailable; saving scan for teacher review:', err)
      predictions = buildDigitEngineFallbackPredictions(reason, err)
    }
    if (forcedFallbackReviewReason) {
      for (const prediction of predictions) {
        prediction.reviewNeeded = true
        prediction.forcedReviewReason = forcedFallbackReviewReason
        prediction.preprocessReviewReason = prediction.preprocessReviewReason || forcedFallbackReviewReason
      }
    }
    const optionalSingleDigitBlankOverrides = forcedFallbackReviewReason
      ? []
      : applyOptionalSingleDigitBlankOverrides(layout.question_groups, layout.boxes, predictions, cropQuality)
    partialDebug.optionalSingleDigitBlankOverrides = optionalSingleDigitBlankOverrides
    const contextAssistedLeadingOneRescues = forcedFallbackReviewReason
      ? []
      : applyContextAssistedLeadingOneRescues(layout.question_groups, predictions, cropQuality)
    partialDebug.contextAssistedLeadingOneRescues = contextAssistedLeadingOneRescues
    const trustedOcrSuggestionPromotions = forcedFallbackReviewReason
      ? []
      : applyTrustedOcrSuggestionPromotions(layout.question_groups, predictions)
    partialDebug.trustedOcrSuggestionPromotions = trustedOcrSuggestionPromotions
    const confidenceClearanceVetoRecords = v3ConfidenceSafetyEnabled()
      ? confidenceClearanceVetoes(layout.question_groups, predictions)
      : []
    applyConfidenceSafetyVetoes(predictions, confidenceClearanceVetoRecords)
    partialDebug.confidenceClearanceVetoes = confidenceClearanceVetoRecords
    partialDebug.predictions = predictions
    partialDebug.stage = 'checking OCR recognition quality'
    const twoDigitRecognitionFailure = detectTwoDigitRecognitionFailure(
      layout.question_groups,
      cropQuality,
      predictions,
      answerKey
    )
    partialDebug.twoDigitRecognitionFailure = twoDigitRecognitionFailure
    if (twoDigitRecognitionFailure) {
      if (forceKnownFallbackReview('two-digit-recognition-quality-fallback-review')) {
        for (const prediction of predictions) {
          prediction.reviewNeeded = true
          prediction.forcedReviewReason = forcedFallbackReviewReason
          prediction.preprocessReviewReason = prediction.preprocessReviewReason || forcedFallbackReviewReason
        }
      } else {
        rawCrops.forEach((crop) => crop.image.delete())
        warpedImage.delete()
        src.delete()
        throw new Error('Answer boxes were not captured clearly. Hold the sheet flatter and try again.')
      }
    }

    const totalTime = (performance.now() - start).toFixed(2)
    partialDebug.stage = 'checking OCR scan usability'
    const baseNeedsReview =
      typeof window !== 'undefined' &&
      !!window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_USED
    const questionCorrect = digitEngineFallbackReview
      ? null
      : buildQuestionCorrect(layout.question_groups, predictions)
    const questionReview = buildQuestionReviewFlags(layout.question_groups, predictions, questionCorrect)
    partialDebug.stage = 'checking optional whole-answer review model'
    let v3SequenceItems = []
    let wholeAnswerReviewSuggestions = []
    if (hybridV3Enabled()) {
      v3SequenceItems = v3SequenceFromZonesEnabled()
        ? wholeAnswerSequenceItemsFromZones(partialDebug.v3AnswerZones)
        : wholeAnswerReviewItemsForFrame(
            layout.question_groups,
            layout.question_groups.map(() => true),
            rawCrops
          )
      if (partialDebug.v3GeometryRescue?.imageDataUrl) {
        v3SequenceItems.push({
          id: `question-${partialDebug.v3GeometryRescue.questionNum}-geometry-rescue`,
          questionNum: partialDebug.v3GeometryRescue.questionNum,
          frameIndex: null,
          cropVariant: 'same-page-geometry-outlier-rescue',
          imageDataUrl: partialDebug.v3GeometryRescue.imageDataUrl,
        })
      }
      partialDebug.hybridBurstProcessing = []
    } else {
      const hybridBurstReview = await buildHybridBurstReviewItems(
        layout.question_groups,
        questionReview,
        rawCrops,
        layout,
        qrPayload?.qr_location || null
      )
      partialDebug.hybridBurstProcessing = hybridBurstReview.frames
      const wholeAnswerReviewResults = await requestWholeAnswerReviewSuggestions(
        layout.question_groups,
        questionReview,
        rawCrops,
        hybridBurstReview.items
      )
      wholeAnswerReviewSuggestions = applyWholeAnswerReviewSuggestions(
        layout.question_groups,
        predictions,
        wholeAnswerReviewResults,
        { allowRelaxedMultiFrame: layout.question_groups.length === 8 }
      )
    }
    partialDebug.wholeAnswerReviewSuggestions = wholeAnswerReviewSuggestions
    const answerGroups = buildAnswerGroups(layout.question_groups, predictions, questionCorrect, layout.id)
    if (browserLocalCandidateConfig.enabled) {
      try {
        // Materialize the cheap, key-blind layout view for every question.
        // The planner still decides which views receive expensive inference,
        // but suspicious accepted answers must not be unable to request this
        // evidence merely because Beta 15.3 initially marked them automatic.
        const candidateQuestionNums = new Set((answerGroups || [])
          .map((group) => Number(group?.questionNum)))
        partialDebug.v3UniformAnswerViews = browserUniformAnswerViews({
          layout,
          zones: partialDebug.v3AnswerZones,
          warpedImage,
          sourceCanvas: canvas,
          cv,
          questionNums: candidateQuestionNums,
        })
      } catch (error) {
        // The optional lane is fail-open. Existing browser OCR remains the
        // entire result if geometry materialization is unavailable.
        console.warn('[ScanGrade] browser-local uniform view preparation failed:', error)
        partialDebug.v3UniformAnswerViews = []
        partialDebug.v3UniformAnswerViewError = String(error?.message || error)
      }
    }
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
      if (forceKnownFallbackReview('two-digit-unusable-quality-fallback-review')) {
        for (const prediction of predictions) {
          prediction.reviewNeeded = true
          prediction.forcedReviewReason = forcedFallbackReviewReason
          prediction.preprocessReviewReason = prediction.preprocessReviewReason || forcedFallbackReviewReason
        }
        if (Array.isArray(questionReview)) {
          questionReview.fill(true)
        }
      } else {
        rawCrops.forEach((crop) => crop.image.delete())
        warpedImage.delete()
        src.delete()
        throw new Error('Answer boxes were not captured clearly. Hold the sheet flatter and try again.')
      }
    }

    // Build result; include per-box correctness only when answer_key was present.
    // Low-confidence captures are still useful in a classroom: save them for teacher review
    // instead of forcing repeated retries on older iPad cameras.
    const groupedStructureNeedsReview =
      (Array.isArray(layout.question_groups) && layout.question_groups.length > 0 && !Array.isArray(questionCorrect)) ||
      (Array.isArray(questionReview) && questionReview.some(Boolean))
    const payload = {
      digits: predictions.map(p => p.digit),
      confidences: predictions.map(p => p.confidence),
      predictions,
      totalTime,
      needsReview: !!forcedFallbackReviewReason || baseNeedsReview || predictions.some((p) => p.reviewNeeded) || groupedStructureNeedsReview,
      baseNeedsReview,
      forcedFallbackReviewReason,
      digitEngineFallback: digitEngineFallbackReview || partialDebug.digitEngineFallback === true,
      digitEngineError: partialDebug.digitEngineError || null,
      reviewOnlyFallback: partialDebug.reviewOnlyFallback === true,
      annotationGeometry,
      annotationRegions,
      layoutSnapshot,
      annotationBaseMode,
      annotationSeed: annotationSeedForResult({
        layoutId: layout?.id || layout?.layout_id,
        annotationGeometry,
        predictions,
      }),
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
      const displayBaseUrl = annotationBaseImageUrl || warpedBaseUrl
      if (displayBaseUrl) {
        payload.annotationBaseUrl = displayBaseUrl
        payload.annotatedImageUrl = await composeStudentAnnotatedImage(
          displayBaseUrl,
          annotationWidth,
          annotationHeight,
          predictions,
          annotationCrops,
          annotationLayout,
          questionCorrect,
          payload.manualCorrections,
          payload.annotationSeed
        )
      }
    } catch (e) {
      console.warn('[ScanGrade] student annotation render failed:', e)
    }
    if (v3ContextCropReviewEnabled()) {
      let contextZones = []
      try {
        // Generate review-only context after every automatic digit decision is
        // frozen, so extra image work cannot perturb browser OCR scheduling.
        contextZones = extractContinuousAnswerZones(warpedImage, layout, {
          cv,
          geometrySource: 'layout',
          context: true,
        })
        partialDebug.v3ContextAnswerZones = contextZones.map((zone) => ({
          schemaVersion: zone.schemaVersion,
          questionNum: zone.questionNum,
          digitBoxIds: zone.digitBoxIds,
          source: zone.source,
          rect: zone.rect,
          quality: zone.quality,
          blankArtifact: zone.blankArtifact,
          reviewOnly: true,
          cropVariant: 'expanded-context',
          imageDataUrl: matToDataURL(zone.image, `v3-answer-context-${zone.questionNum}`),
        }))
      } catch (e) {
        console.warn('[ScanGrade] V3 expanded review context extraction failed:', e)
        partialDebug.v3ContextAnswerZoneError = String(e?.message || e)
      } finally {
        for (const zone of contextZones) {
          try { zone.image?.delete?.() } catch (_) {}
        }
      }
    }
    const overlayDebug = buildOverlayDebugSnapshot({
      questionGroups: annotationLayout?.question_groups,
      layoutId: annotationLayout?.layout_id || layout?.layout_id || null,
      annotationGeometry,
      annotationRegions,
      predictions,
      questionCorrect,
      questionReview,
      annotationBaseMode,
      annotationSeed: payload.annotationSeed,
      markedSheetAvailable: !!payload.annotatedImageUrl
    })

    if (liveOcrDebugExportEnabled.value) {
      lastLiveOcrDebug.value = {
        capturedImageDataUrl: capturedImage.value,
        scanSessionId: partialDebug.scanSessionId || null,
        packetId: partialDebug.packetId || null,
        captureRole: partialDebug.captureRole || null,
        capturePlanSeed: partialDebug.capturePlanSeed || null,
        markedSheetDataUrl: payload.annotatedImageUrl || null,
        overlayDebug,
        warpedDataUrl: partialDebug.warpedDataUrl,
        rawCropDataUrls: partialDebug.rawCropDataUrls,
        modelInputDataUrls: partialDebug.modelInputDataUrls,
        tensors: partialDebug.tensors,
        captureQuality: partialDebug.captureQuality,
        hybridBurstFrameDataUrls: partialDebug.hybridBurstFrameDataUrls || [],
        hybridBurstFrameMetadata: partialDebug.hybridBurstFrameMetadata || [],
        hybridBurstProcessing: partialDebug.hybridBurstProcessing || [],
        wholeAnswerReviewSuggestions: partialDebug.wholeAnswerReviewSuggestions || [],
        v3AnswerZones: partialDebug.v3AnswerZones || [],
        v3ContextAnswerZones: partialDebug.v3ContextAnswerZones || [],
        v3GeometryRescue: partialDebug.v3GeometryRescue || null,
        v3UniformAnswerViews: partialDebug.v3UniformAnswerViews || [],
        v3BrowserLocalCandidate: partialDebug.v3BrowserLocalCandidate || null,
        v3Shadow: partialDebug.v3Shadow || null,
        confidenceSafetyVetoes: partialDebug.confidenceSafetyVetoes || [],
        confidenceClearanceVetoes: partialDebug.confidenceClearanceVetoes || [],
        preprocessStats: partialDebug.preprocessStats,
        cropQuality: partialDebug.cropQuality,
        optionalSingleDigitBlankOverrides: partialDebug.optionalSingleDigitBlankOverrides,
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
        knownGrade2Fallback: partialDebug.knownGrade2Fallback,
        missingQrLayoutFallback: partialDebug.missingQrLayoutFallback,
        titleFallbackReranLayout: partialDebug.titleFallbackReranLayout ?? null,
        printedTitleFallback: partialDebug.printedTitleFallback,
        reviewOnlyFallback: partialDebug.reviewOnlyFallback,
        forcedFallbackReviewReason,
        digitEngineFallback: partialDebug.digitEngineFallback === true,
        digitEngineError: partialDebug.digitEngineError || null,
        activeHomography: partialDebug.activeHomography,
        answerBoxRegistration: partialDebug.answerBoxRegistration || null,
        warpOrientation: window.__SCANGRADE_DEBUG_WARP_ORIENTATION || null,
        imageSize: partialDebug.imageSize,
        markerDebugSnapshot: markerDebugSnapshot.value || null,
        modelInfo: modelInfoSnapshot.value,
        runtime: getRuntimeDebugInfo(),
        candidateIdentity: {
          digitSelectionPolicy: DIGIT_SELECTION_POLICY_VERSION,
          v3DecisionPolicy: V3_POLICY_VERSION,
        },
        generatedAt: new Date().toISOString()
      }
      if (typeof window !== 'undefined') {
        window.__SCANGRADE_LIVE_OCR_DEBUG = lastLiveOcrDebug.value
      }
      await uploadLiveOcrDebug(lastLiveOcrDebug.value, 'ocr-complete')
    } else {
      lastLiveOcrDebug.value = null
    }

    // A private co-primary candidate must finish before any of its accepted
    // marks are presented. Showing Beta 15.3 first and revising it later would
    // turn a pre-acceptance safety reader into a silent post-acceptance change.
    const holdBrowserLocalCandidatePresentation =
      browserLocalCandidateConfig.requested === true &&
      browserLocalCandidateConfig.enabled === true &&
      Array.isArray(layout?.question_groups) &&
      layout.question_groups.length > 0
    const holdAcceptedSafetyPresentation =
      acceptedSafetyRuntimeEnabled &&
      !browserLocalCandidateConfig.requested &&
      acceptedSafetyConfig.apply === true &&
      acceptedSafetyConfig.enabled === true &&
      Array.isArray(layout?.question_groups) &&
      layout.question_groups.length > 0
    if (!holdBrowserLocalCandidatePresentation && !holdAcceptedSafetyPresentation) {
      ocrResult.value = payload
    }

    let primaryV3Completed = false
    let resolvePrimaryV3Completion
    const primaryV3Completion = new Promise((resolve) => {
      resolvePrimaryV3Completion = () => {
        if (primaryV3Completed) return
        primaryV3Completed = true
        resolve()
      }
    })
    let primaryV3Started = false

    // Explicit private candidate: the 7.7 MiB scout and routed 61.1 MiB
    // reader run entirely in this browser. It starts from the frozen Beta 15.3
    // transcription, never sends page pixels anywhere, and never sees the
    // answer key. It may preserve/demote an accepted browser read; an
    // originally yellow answer may clear only through separately tested local
    // agreement rules. Every incomplete/slow/error path leaves Beta 15.3
    // untouched.
    if (browserLocalCandidateConfig.requested) {
      const allQuestionItems = browserLocalStrongShadowItems(
        layout.question_groups,
        layout.question_groups.map(() => true),
        rawCrops,
        layout,
      ).map((item) => ({
        ...item,
        slotCount: item.contract?.physicalSlotCount,
        layoutFamily: item.contract?.layoutFamily,
      }))
      const itemByQuestion = new Map(allQuestionItems
        .map((item) => [Number(item.questionNum), item]))
      const initialGroupByQuestion = new Map((payload.answerGroups || [])
        .map((group) => [Number(group?.questionNum), group]))
      const predictionsByQuestion = new Map()
      for (const prediction of predictions || []) {
        const questionNum = Number(prediction?.questionNum)
        if (!predictionsByQuestion.has(questionNum)) predictionsByQuestion.set(questionNum, [])
        predictionsByQuestion.get(questionNum).push(prediction)
      }
      const continuousByQuestion = new Map((partialDebug.v3AnswerZones || [])
        .map((zone) => [Number(zone.questionNum), zone]))
      const uniformByQuestion = new Map((partialDebug.v3UniformAnswerViews || [])
        .map((view) => [Number(view.questionNum), view]))
      payload.v3BrowserLocalCandidate = {
        status: browserLocalCandidateConfig.enabled ? 'pending' : 'unavailable',
        affectsGrade: false,
        unavailableReason: browserLocalCandidateConfig.unavailableReason || null,
        noUploads: true,
      }
      partialDebug.v3BrowserLocalCandidate = payload.v3BrowserLocalCandidate
      if (lastLiveOcrDebug.value) {
        lastLiveOcrDebug.value.v3BrowserLocalCandidate =
          payload.v3BrowserLocalCandidate
      }

      if (browserLocalCandidateConfig.enabled && allQuestionItems.length) {
        const candidateStarted = performance.now()
        const selectedBurstFrame = pendingHybridBurstFrames.find((frame) => frame.selected) ||
          pendingHybridBurstFrames[0] ||
          null
        const candidateBurstFrames = [
          selectedBurstFrame,
          ...pendingHybridBurstFrames.filter((frame) => frame !== selectedBurstFrame),
        ].filter(Boolean).slice(0, 3).map((frame) => ({ ...frame }))
        const requireComplete = (result, expected, stage) => {
          if (
            result?.status !== 'complete' ||
            Number(result?.completed) !== Number(expected) ||
            (result?.results || []).some((row) => row?.status !== 'complete')
          ) {
            throw new Error(`${stage} incomplete; preserving Beta 15.3`)
          }
          return result.results || []
        }
        const strongResultByQuestion = (rows) => new Map((rows || [])
          .map((row) => [Number(row.questionNum), row]))
        const strongItemsForQuestions = (questionNums, source, cropVariant) =>
          [...questionNums].map((questionNum) => {
            const base = itemByQuestion.get(Number(questionNum))
            const view = source.get(Number(questionNum))
            const imageDataUrl = view?.imageDataUrl
            if (!base || !imageDataUrl) return null
            return {
              ...base,
              id: `question-${questionNum}-${cropVariant}`,
              cropVariant,
              imageDataUrl,
            }
          }).filter(Boolean)

        candidatePresentationPromise = requestWholeSlotScout(allQuestionItems, {
          enabled: true,
          modelUrl: publicUrl('models/v3-whole-slot-scout.onnx'),
          timeoutMs: 30000,
        }).then(async (scoutResult) => {
          if (
            scoutResult?.status !== 'complete' ||
            (scoutResult.results || []).length !== allQuestionItems.length
          ) throw new Error('scout incomplete; preserving Beta 15.3')
          const scoutByQuestion = strongResultByQuestion(scoutResult.results)
          const descriptors = allQuestionItems.map((item) => {
            const questionNum = Number(item.questionNum)
            const group = initialGroupByQuestion.get(questionNum)
            const groupPredictions = predictionsByQuestion.get(questionNum) || []
            const initiallyAutomatic = group?.reviewNeeded !== true
            const currentRead = String(group?.answerText || '')
            const route = acceptedAnswerSafetyRoute({
              currentAutomatic: initiallyAutomatic,
              currentRead,
              predictions: groupPredictions,
              scout: scoutByQuestion.get(questionNum) || null,
              layoutId: layout.layout_id || layout.id || '',
            })
            return {
              questionNum,
              initiallyAutomatic,
              currentRead,
              optionalSlotIndices: item.contract?.optionalSlotIndices || [],
              route,
              highRiskMismatchReview: groupPredictions.some((prediction) =>
                prediction?.highRiskMismatchReview === true),
            }
          })
          const preStrongDecisions = descriptors.map((item) => ({
            ...item,
            decision: browserLocalCandidateDecision({
              currentAutomatic: item.initiallyAutomatic,
              currentRead: item.currentRead,
              scout: scoutByQuestion.get(item.questionNum),
              stitched: null,
              continuous: null,
              uniform: null,
              layoutId: layout.layout_id || layout.id || '',
              optionalSlotIndices: item.optionalSlotIndices,
              routeReasons: item.route.reasons,
              highRiskMismatchReview: item.highRiskMismatchReview,
            }),
          }))
          const stitchedQuestionNums = new Set(preStrongDecisions
            .filter((item) => Number(item.decision?.stitchedReaderCalls || 0) > 0)
            .map((item) => item.questionNum))
          const stitchedItems = allQuestionItems
            .filter((item) => stitchedQuestionNums.has(Number(item.questionNum)))
            .map((item) => ({
              ...item,
              id: `question-${item.questionNum}-candidate-stitched`,
              cropVariant: 'candidate-stitched',
            }))

          let stitchedRows = []
          let capability = {
            enabled: true,
            tier: 'scout-only-no-strong-calls',
            reason: 'no-strong-reader-call-required',
          }
          if (stitchedItems.length) {
            const firstRun = await requestBrowserLocalStrongPersistentShadow(
              stitchedItems.slice(0, 1),
              browserLocalCandidateConfig,
            )
            const firstRows = requireComplete(firstRun, 1, 'first strong-reader check')
            const first = firstRows[0]
            capability = browserLocalStrongTier({
              wasmSimdSupported: first?.wasmSimdEnabled === true,
              loadStatus: 'complete',
              initializationMs: Number(first?.initializationMs || 0),
              firstInferenceMs: Number(first?.inferenceMs || 0),
              deviceMemoryGb: typeof navigator !== 'undefined'
                ? navigator.deviceMemory
                : null,
              maximumFirstCheckMs: browserLocalCandidateConfig.maximumFirstCheckMs,
            })
            if (!capability.enabled) {
              throw new Error(`capability gate failed: ${capability.reason}`)
            }
            stitchedRows.push(...firstRows)
            if (stitchedItems.length > 1) {
              const remainingRun = await requestBrowserLocalStrongPersistentShadow(
                stitchedItems.slice(1),
                browserLocalCandidateConfig,
              )
              stitchedRows.push(...requireComplete(
                remainingRun,
                stitchedItems.length - 1,
                'remaining stitched reads',
              ))
            }
          }
          const stitchedByQuestion = strongResultByQuestion(stitchedRows)
          const preliminary = descriptors.map((item) => ({
            ...item,
            decision: browserLocalCandidateDecision({
              currentAutomatic: item.initiallyAutomatic,
              currentRead: item.currentRead,
              scout: scoutByQuestion.get(item.questionNum),
              stitched: stitchedByQuestion.get(item.questionNum),
              continuous: null,
              uniform: null,
              layoutId: layout.layout_id || layout.id || '',
              optionalSlotIndices: item.optionalSlotIndices,
              routeReasons: item.route.reasons,
              highRiskMismatchReview: item.highRiskMismatchReview,
            }),
          }))
          const continuousQuestionNums = new Set([
            ...stitchedQuestionNums,
            ...preliminary
            .filter((item) => Number(item.decision?.continuousReaderCalls || 0) > 0)
            .map((item) => item.questionNum),
          ])
          const continuousItems = strongItemsForQuestions(
            continuousQuestionNums,
            continuousByQuestion,
            'candidate-continuous',
          )
          if (continuousItems.length !== continuousQuestionNums.size) {
            throw new Error('continuous crop unavailable; preserving Beta 15.3')
          }
          const continuousRows = continuousItems.length
            ? requireComplete(
                await requestBrowserLocalStrongPersistentShadow(
                  continuousItems,
                  browserLocalCandidateConfig,
                ),
                continuousItems.length,
                'continuous reads',
              )
            : []
          const continuousReadByQuestion = strongResultByQuestion(continuousRows)

          const withoutUniform = descriptors.map((item) => ({
            ...item,
            decision: browserLocalCandidateDecision({
              currentAutomatic: item.initiallyAutomatic,
              currentRead: item.currentRead,
              scout: scoutByQuestion.get(item.questionNum),
              stitched: stitchedByQuestion.get(item.questionNum),
              continuous: continuousReadByQuestion.get(item.questionNum),
              uniform: null,
              layoutId: layout.layout_id || layout.id || '',
              optionalSlotIndices: item.optionalSlotIndices,
              routeReasons: item.route.reasons,
              highRiskMismatchReview: item.highRiskMismatchReview,
            }),
          }))
          const uniformQuestionNums = new Set([
            ...stitchedQuestionNums,
            ...withoutUniform
              .filter((item) => item.decision.automatic === false)
              .map((item) => item.questionNum),
          ])
          const uniformItems = strongItemsForQuestions(
            uniformQuestionNums,
            uniformByQuestion,
            'candidate-uniform',
          )
          if (uniformItems.length !== uniformQuestionNums.size) {
            throw new Error('uniform crop unavailable; preserving Beta 15.3')
          }
          const uniformRows = uniformItems.length
            ? requireComplete(
                await requestBrowserLocalStrongPersistentShadow(
                  uniformItems,
                  browserLocalCandidateConfig,
                ),
                uniformItems.length,
                'uniform reads',
              )
            : []
          const uniformReadByQuestion = strongResultByQuestion(uniformRows)

          const strictDecisions = descriptors.map((item) => {
            const groupPredictions = predictionsByQuestion.get(item.questionNum) || []
            const blockingSafetyVeto = !item.initiallyAutomatic &&
              groupPredictions.some((prediction) =>
                Boolean(
                  prediction?.forcedReviewReason ||
                  prediction?.structuralReview ||
                  prediction?.consensusReviewVeto ||
                  prediction?.acceptedAnswerSafetyVeto,
                ))
            return {
              ...item,
              blockingSafetyVeto,
              decision: browserLocalCandidateDecision({
                currentAutomatic: item.initiallyAutomatic,
                currentRead: item.currentRead,
                scout: scoutByQuestion.get(item.questionNum),
                stitched: stitchedByQuestion.get(item.questionNum),
                continuous: continuousReadByQuestion.get(item.questionNum),
                uniform: uniformReadByQuestion.get(item.questionNum),
                layoutId: layout.layout_id || layout.id || '',
                optionalSlotIndices: item.optionalSlotIndices,
                routeReasons: item.route.reasons,
                highRiskMismatchReview: item.highRiskMismatchReview,
                blockingSafetyVeto,
              }),
            }
          })
          const coPrimaryInput = (item, frame = null) => ({
            initiallyAutomatic: item.initiallyAutomatic,
            candidateDecision: item.decision,
            browser: { read: item.currentRead },
            scout: scoutByQuestion.get(item.questionNum),
            stitched: stitchedByQuestion.get(item.questionNum),
            continuous: continuousReadByQuestion.get(item.questionNum),
            uniform: uniformReadByQuestion.get(item.questionNum),
            frame,
            layoutId: layout.layout_id || layout.id || '',
            optionalSlotIndices: item.optionalSlotIndices,
            routeReasons: item.route.reasons,
            highRiskMismatchReview: item.highRiskMismatchReview,
            blockingSafetyVeto: item.blockingSafetyVeto,
          })
          const frameQuestionNums = new Set(strictDecisions
            .filter((item) => {
              const input = coPrimaryInput(item)
              const noFrame = browserLocalCoPrimaryCandidate7Decision(input)
              if (noFrame.decision.automatic) return false
              const read = (value) => String(
                value?.text ?? value?.read ?? '',
              ).trim()
              const stitchedRead = read(input.stitched)
              const continuousRead = read(input.continuous)
              const uniformRead = read(input.uniform)
              const browserRead = read(input.browser)
              const scoutRead = read(input.scout)
              const couldCompleteFourView =
                stitchedRead &&
                stitchedRead === continuousRead &&
                stitchedRead === uniformRead
              const couldCompleteMultifamilyFrame =
                browserRead &&
                browserRead === scoutRead &&
                browserRead === stitchedRead
              return (
                couldCompleteFourView ||
                couldCompleteMultifamilyFrame ||
                browserLocalCoPrimaryEvidencePlan(input)
                  .requests.includes('frame')
              )
            })
            .map((item) => item.questionNum))
          let frameRows = []
          let framePreparation = { frames: [], sequenceItems: [] }
          if (frameQuestionNums.size && candidateBurstFrames.length >= 3) {
            const selectedFrameItems = (partialDebug.v3AnswerZones || [])
              .filter((zone) => frameQuestionNums.has(Number(zone.questionNum)))
              .map((zone) => {
                const base = itemByQuestion.get(Number(zone.questionNum))
                return {
                  ...base,
                  id: `question-${zone.questionNum}-candidate-frame-selected`,
                  questionNum: Number(zone.questionNum),
                  frameIndex: candidateBurstFrames[0]?.index ?? null,
                  cropVariant: 'candidate-frame-continuous',
                  imageDataUrl: zone.imageDataUrl,
                }
              })
            framePreparation = await buildV3BurstShadowItems({
              questionGroups: layout.question_groups,
              layout,
              qrLocation: qrPayload?.qr_location || null,
              selectedSequenceItems: selectedFrameItems,
              selectedCompactItems: [],
              selectedZones: partialDebug.v3AnswerZones,
              selectedRawCrops: [],
              selectedSourceAnchors: null,
              selectedAlternateItems: [],
              burstFrames: candidateBurstFrames,
              reviewQuestionNums: [...frameQuestionNums],
              includeCompactItems: false,
            })
            const frameItems = (framePreparation.sequenceItems || [])
              .map((frameItem) => ({
                ...frameItem,
                contract: itemByQuestion.get(Number(frameItem.questionNum))?.contract || {},
              }))
            if (frameItems.length) {
              const frameRun = await requestBrowserLocalStrongPersistentShadow(
                frameItems,
                {
                  ...browserLocalCandidateConfig,
                  limit: Math.max(browserLocalCandidateConfig.limit, frameItems.length),
                },
              )
              frameRows = frameRun?.results || []
            }
          }
          const frameRowsByQuestion = new Map()
          for (const row of frameRows) {
            const questionNum = Number(row.questionNum)
            if (!frameRowsByQuestion.has(questionNum)) {
              frameRowsByQuestion.set(questionNum, [])
            }
            frameRowsByQuestion.get(questionNum).push(row)
          }
          const frameByQuestion = new Map([...frameQuestionNums].map((questionNum) => [
            questionNum,
            browserLocalThreeFrameConsensus(
              frameRowsByQuestion.get(questionNum) || [],
            ),
          ]))
          const decisions = strictDecisions.map((item) => ({
            ...item,
            strictDecision: item.decision,
            decision: browserLocalCoPrimaryCandidate7Decision(
              coPrimaryInput(item, frameByQuestion.get(item.questionNum) || {
                available: false,
                threeOfThree: false,
              }),
            ).decision,
          }))
          const application = applyBrowserLocalCandidateToPredictions({
            questionGroups: layout.question_groups,
            predictions,
            decisions,
          })
          predictions = application.predictions
          const candidateQuestionCorrect = buildQuestionCorrect(
            layout.question_groups,
            predictions,
          )
          const candidateQuestionReview = buildQuestionReviewFlags(
            layout.question_groups,
            predictions,
            candidateQuestionCorrect,
          )
          const candidateAnswerGroups = buildAnswerGroups(
            layout.question_groups,
            predictions,
            candidateQuestionCorrect,
            layout.id,
          )
          const candidateAnnotationRegions = buildAnnotationRegions(
            layout.question_groups,
            annotationGeometry,
            predictions,
            candidateQuestionCorrect,
          )
          payload.digits = predictions.map((prediction) => prediction.digit)
          payload.confidences = predictions.map((prediction) => prediction.confidence)
          payload.predictions = predictions
          delete payload.correct
          payload.questionCorrect = candidateQuestionCorrect
          payload.questionCount = candidateQuestionCorrect?.length || 0
          payload.questionScore = candidateQuestionCorrect?.filter(Boolean).length || 0
          payload.questionReview = candidateQuestionReview
          payload.questionReviewCount = candidateQuestionReview?.filter(Boolean).length || 0
          payload.answerGroups = candidateAnswerGroups
          payload.annotationRegions = candidateAnnotationRegions
          payload.needsReview = !!forcedFallbackReviewReason || baseNeedsReview ||
            predictions.some((prediction) => prediction.reviewNeeded) ||
            candidateQuestionReview?.some(Boolean)
          if (
            application.demoted.length ||
            application.promoted.length ||
            application.replaced.length
          ) {
            try {
              if (payload.annotationBaseUrl) {
                payload.annotatedImageUrl = await composeStudentAnnotatedImage(
                  payload.annotationBaseUrl,
                  annotationWidth,
                  annotationHeight,
                  predictions,
                  annotationCrops,
                  annotationLayout,
                  candidateQuestionCorrect,
                  payload.manualCorrections,
                  payload.annotationSeed,
                )
              }
            } catch (error) {
              console.warn('[ScanGrade] browser-local candidate annotation refresh failed:', error)
            }
          }
          const result = {
            status: 'complete',
            affectsGrade:
              application.demoted.length > 0 ||
              application.promoted.length > 0 ||
              application.replaced.length > 0,
            noUploads: true,
            elapsedMs: performance.now() - candidateStarted,
            capability,
            scout: {
              status: scoutResult.status,
              elapsedMs: scoutResult.elapsedMs,
              completed: scoutResult.results.length,
            },
            workload: {
              scoutReads: allQuestionItems.length,
              stitchedReads: stitchedRows.length,
              continuousReads: continuousRows.length,
              uniformReads: uniformRows.length,
              frameReads: frameRows.length,
              frameQuestions: frameQuestionNums.size,
            },
            modelRuntime: {
              initializationMs: Number(stitchedRows[0]?.initializationMs || 0),
              firstInferenceMs: Number(stitchedRows[0]?.inferenceMs || 0),
              sessionReusedCount: [...stitchedRows, ...continuousRows, ...uniformRows, ...frameRows]
                .filter((row) => row?.sessionReused === true).length,
              inferenceMs: [...stitchedRows, ...continuousRows, ...uniformRows, ...frameRows]
                .map((row) => Number(row?.inferenceMs || 0)),
            },
            readerEvidence: descriptors.map((item) => {
              const scout = scoutByQuestion.get(item.questionNum)
              const stitched = stitchedByQuestion.get(item.questionNum)
              const continuous = continuousReadByQuestion.get(item.questionNum)
              const uniform = uniformReadByQuestion.get(item.questionNum)
              const frame = frameByQuestion.get(item.questionNum)
              const summarize = (row) => row
                ? {
                    read: String(row.text ?? row.read ?? ''),
                    minTokenProbability: Number(row.minTokenProbability ?? row.probability ?? 0),
                  }
                : null
              return {
                questionNum: item.questionNum,
                scout: summarize(scout),
                stitched: summarize(stitched),
                continuous: summarize(continuous),
                uniform: summarize(uniform),
                frame: frame || null,
              }
            }),
            framePreparation: {
              frames: framePreparation.frames || [],
              requestedQuestions: [...frameQuestionNums],
            },
            demoted: application.demoted,
            promoted: application.promoted,
            replaced: application.replaced,
            decisions,
          }
          payload.v3BrowserLocalCandidate = result
          partialDebug.v3BrowserLocalCandidate = result
          partialDebug.predictions = predictions
          partialDebug.questionCorrect = candidateQuestionCorrect
          partialDebug.questionReview = candidateQuestionReview
          partialDebug.answerGroups = candidateAnswerGroups
          partialDebug.annotationRegions = candidateAnnotationRegions
          if (lastLiveOcrDebug.value) {
            lastLiveOcrDebug.value.v3BrowserLocalCandidate = result
            lastLiveOcrDebug.value.predictions = predictions
            lastLiveOcrDebug.value.questionCorrect = candidateQuestionCorrect
            lastLiveOcrDebug.value.questionReview = candidateQuestionReview
            lastLiveOcrDebug.value.answerGroups = candidateAnswerGroups
            lastLiveOcrDebug.value.annotationRegions = candidateAnnotationRegions
            lastLiveOcrDebug.value.markedSheetDataUrl = payload.annotatedImageUrl || null
          }
          ocrResult.value = { ...payload }
        }).catch((error) => {
          const result = {
            status: 'fail-open',
            affectsGrade: false,
            noUploads: true,
            elapsedMs: performance.now() - candidateStarted,
            error: String(error?.message || error),
          }
          payload.v3BrowserLocalCandidate = result
          partialDebug.v3BrowserLocalCandidate = result
          if (lastLiveOcrDebug.value) lastLiveOcrDebug.value.v3BrowserLocalCandidate = result
          ocrResult.value = { ...payload }
        })
      } else if (holdBrowserLocalCandidatePresentation) {
        // Extraction produced no usable whole-answer items. Fail open to the
        // unchanged Beta 15.3 result instead of leaving the UI unresolved.
        ocrResult.value = { ...payload }
      }
    }

    // Accepted-answer safety reader. On the public site, only narrow, replayed
    // single-slot 6/8 and 1->7 scout conflicts may force review. Broader rules
    // remain private/evidence-only. It never sees the answer key and never
    // replaces the browser transcription with the scout's guess.
    if (
      acceptedSafetyRuntimeEnabled &&
      !browserLocalCandidateConfig.requested
    ) {
      const acceptedQuestionSet = new Set((payload.answerGroups || [])
        .filter((group) => group?.reviewNeeded !== true)
        .map((group) => Number(group?.questionNum)))
      const acceptedFlags = layout.question_groups.map((group) =>
        acceptedQuestionSet.has(Number(group?.question_num)))
      const acceptedReadByQuestion = new Map((payload.answerGroups || [])
        .map((group) => [Number(group?.questionNum), String(group?.answerText || '')]))
      const acceptedStitchedItems = browserLocalStrongShadowItems(
        layout.question_groups,
        acceptedFlags,
        rawCrops,
        layout,
      ).map((item) => ({
        ...item,
        slotCount: item.contract?.physicalSlotCount,
        layoutFamily: item.contract?.layoutFamily,
      })).filter((item) => {
        if (acceptedSafetyConfig.policyScope !== 'six-eight-only') return true
        const read = acceptedReadByQuestion.get(Number(item.questionNum))
        return Number(item.slotCount) === 1 && (read === '1' || read === '6' || read === '8')
      })
      payload.v3AcceptedAnswerSafetyShadow = {
        status: 'pending',
        affectsGrade: false,
        acceptedAnswerCount: acceptedStitchedItems.length,
      }
      const acceptedSafetyPromise = (acceptedStitchedItems.length
        ? requestWholeSlotScout(acceptedStitchedItems, acceptedSafetyConfig)
        : Promise.resolve({
            status: 'complete',
            affectsGrade: false,
            skipped: 'no-accepted-single-slot-critical-confusion',
            results: [],
          }))
        .then(async (scoutResult) => {
          const scoutByQuestion = new Map((scoutResult.results || [])
            .map((item) => [Number(item.questionNum), item]))
          const predictionsByQuestion = new Map()
          for (const prediction of predictions || []) {
            const questionNum = Number(prediction?.questionNum)
            if (!predictionsByQuestion.has(questionNum)) predictionsByQuestion.set(questionNum, [])
            predictionsByQuestion.get(questionNum).push(prediction)
          }
          const groupByQuestion = new Map((payload.answerGroups || [])
            .map((group) => [Number(group?.questionNum), group]))
          const itemByQuestion = new Map(acceptedStitchedItems
            .map((item) => [Number(item.questionNum), item]))
          const routes = [...acceptedQuestionSet].map((questionNum) => {
            const answerGroup = groupByQuestion.get(questionNum)
            const item = itemByQuestion.get(questionNum)
            return {
              questionNum,
              ...acceptedAnswerSafetyRoute({
                currentAutomatic: answerGroup?.reviewNeeded !== true,
                currentRead: answerGroup?.answerText || '',
                predictions: predictionsByQuestion.get(questionNum) || [],
                scout: scoutByQuestion.get(questionNum) || null,
                slotCount: item?.slotCount || null,
                layoutId: layout.layout_id || layout.id || '',
                policyScope: acceptedSafetyConfig.policyScope,
              }),
              slotCount: item?.slotCount || null,
            }
          })
          const routedQuestionSet = new Set(routes
            .filter((route) => route.route)
            .map((route) => Number(route.questionNum)))
          const continuousItems = (partialDebug.v3AnswerZones || [])
            .filter((zone) => routedQuestionSet.has(Number(zone.questionNum)) && zone.imageDataUrl)
            .map((zone) => ({
              id: `question-${zone.questionNum}-accepted-safety-continuous`,
              questionNum: Number(zone.questionNum),
              cropVariant: 'accepted-safety-continuous',
              imageDataUrl: zone.imageDataUrl,
              reviewOnly: true,
            }))
          const stitchedItems = acceptedStitchedItems
            .filter((item) => routedQuestionSet.has(Number(item.questionNum)))
            .map((item) => ({
              ...item,
              id: `question-${item.questionNum}-accepted-safety-stitched`,
              cropVariant: 'accepted-safety-stitched',
              reviewOnly: true,
            }))
          const strongReads = (
            acceptedSafetyConfig.policyScope !== 'six-eight-only' &&
            routedQuestionSet.size
          )
            ? await requestWholeAnswerReviewSuggestions(
                layout.question_groups,
                layout.question_groups.map((group) =>
                  routedQuestionSet.has(Number(group?.question_num))),
                rawCrops,
                [...continuousItems, ...stitchedItems],
              )
            : []
          const readsByQuestion = new Map()
          for (const read of strongReads) {
            const questionNum = Number(read?.questionNum)
            if (!readsByQuestion.has(questionNum)) readsByQuestion.set(questionNum, {})
            const entry = readsByQuestion.get(questionNum)
            if (read?.cropVariant === 'accepted-safety-continuous') entry.continuous = read
            if (read?.cropVariant === 'accepted-safety-stitched') entry.stitched = read
          }
          const decisions = routes.map((route) => {
            const questionNum = Number(route.questionNum)
            const answerGroup = groupByQuestion.get(questionNum)
            const item = itemByQuestion.get(questionNum)
            const reads = readsByQuestion.get(questionNum) || {}
            return {
              questionNum,
              route,
              decision: acceptedAnswerSafetyDecision({
                routed: route.route,
                currentRead: answerGroup?.answerText || '',
                continuous: reads.continuous || null,
                stitched: reads.stitched || null,
                scout: scoutByQuestion.get(questionNum) || null,
                predictions: predictionsByQuestion.get(questionNum) || [],
                slotCount: item?.slotCount || null,
                layoutId: layout.layout_id || layout.id || '',
                policyScope: acceptedSafetyConfig.policyScope,
              }),
            }
          })
          let safetyApplication = { predictions, applied: [] }
          if (acceptedSafetyConfig.apply && decisions.some((item) => item.decision?.veto === true)) {
            // The ordinary V3 promotion/review pass owns the first asynchronous
            // update. Apply this final safety-only downgrade afterwards so a
            // later promotion cannot overwrite it.
            await primaryV3Completion
            safetyApplication = applyAcceptedAnswerSafetyVetoes(predictions, decisions)
            predictions = safetyApplication.predictions
            const safeQuestionCorrect = buildQuestionCorrect(layout.question_groups, predictions)
            const safeQuestionReview = buildQuestionReviewFlags(
              layout.question_groups,
              predictions,
              safeQuestionCorrect,
            )
            const safeAnswerGroups = buildAnswerGroups(
              layout.question_groups,
              predictions,
              safeQuestionCorrect,
              layout.id,
            )
            const safeAnnotationRegions = buildAnnotationRegions(
              layout.question_groups,
              annotationGeometry,
              predictions,
              safeQuestionCorrect,
            )
            payload.digits = predictions.map((prediction) => prediction.digit)
            payload.confidences = predictions.map((prediction) => prediction.confidence)
            payload.predictions = predictions
            payload.questionCorrect = safeQuestionCorrect
            payload.questionCount = safeQuestionCorrect.length
            payload.questionScore = safeQuestionCorrect.filter(Boolean).length
            payload.questionReview = safeQuestionReview
            payload.questionReviewCount = safeQuestionReview.filter(Boolean).length
            payload.answerGroups = safeAnswerGroups
            payload.annotationRegions = safeAnnotationRegions
            payload.needsReview = true
            partialDebug.predictions = predictions
            partialDebug.questionCorrect = safeQuestionCorrect
            partialDebug.questionReview = safeQuestionReview
            partialDebug.answerGroups = safeAnswerGroups
            partialDebug.annotationRegions = safeAnnotationRegions
            try {
              if (payload.annotationBaseUrl) {
                payload.annotatedImageUrl = await composeStudentAnnotatedImage(
                  payload.annotationBaseUrl,
                  annotationWidth,
                  annotationHeight,
                  predictions,
                  annotationCrops,
                  annotationLayout,
                  safeQuestionCorrect,
                  payload.manualCorrections,
                  payload.annotationSeed,
                )
              }
            } catch (error) {
              console.warn('[ScanGrade] accepted-answer safety annotation refresh failed:', error)
            }
          }
          const result = {
            status: 'complete',
            affectsGrade: safetyApplication.applied.length > 0,
            scout: scoutResult,
            acceptedAnswerCount: acceptedStitchedItems.length,
            routedAnswerCount: routedQuestionSet.size,
            strongReadCount: strongReads.length,
            vetoCount: decisions.filter((item) => item.decision?.veto === true).length,
            applied: safetyApplication.applied,
            decisions,
          }
          payload.v3AcceptedAnswerSafetyShadow = result
          partialDebug.v3AcceptedAnswerSafetyShadow = result
          if (lastLiveOcrDebug.value) {
            lastLiveOcrDebug.value.v3AcceptedAnswerSafetyShadow = result
            if (safetyApplication.applied.length) {
              lastLiveOcrDebug.value.predictions = payload.predictions
              lastLiveOcrDebug.value.questionCorrect = payload.questionCorrect
              lastLiveOcrDebug.value.questionReview = payload.questionReview
              lastLiveOcrDebug.value.questionReviewCount = payload.questionReviewCount
              lastLiveOcrDebug.value.answerGroups = payload.answerGroups
              lastLiveOcrDebug.value.annotationRegions = payload.annotationRegions
              lastLiveOcrDebug.value.markedSheetDataUrl = payload.annotatedImageUrl || null
            }
            void uploadLiveOcrDebug(lastLiveOcrDebug.value, 'accepted-answer-safety-shadow-complete')
          }
          if (safetyApplication.applied.length || holdAcceptedSafetyPresentation) {
            ocrResult.value = { ...payload }
          }
        })
        .catch((error) => {
          const result = {
            status: 'error',
            affectsGrade: false,
            error: String(error?.message || error),
            decisions: [],
          }
          payload.v3AcceptedAnswerSafetyShadow = result
          partialDebug.v3AcceptedAnswerSafetyShadow = result
          if (lastLiveOcrDebug.value) lastLiveOcrDebug.value.v3AcceptedAnswerSafetyShadow = result
          if (holdAcceptedSafetyPresentation) ocrResult.value = { ...payload }
        })
      if (holdAcceptedSafetyPresentation) {
        candidatePresentationPromise = acceptedSafetyPromise
      }
    }

    // Experimental browser-local larger-grayscale reader. It is deliberately
    // detached from grading and review promotion: a disposable worker reads
    // only current yellow answers, records evidence, then terminates. Candidate
    // 6 remains byte-for-byte authoritative even if this times out or crashes.
    const browserLocalStrongConfig = browserLocalStrongShadowConfig()
    if (
      hybridV3Enabled() &&
      browserLocalStrongConfig.requested &&
      !browserLocalCandidateConfig.requested
    ) {
      const shadowQuestionNums = displayedYellowQuestionNumbers(
        layout.question_groups,
        questionReview,
        answerGroups,
      )
      const shadowQuestionSet = new Set(shadowQuestionNums.map(Number))
      const shadowReviewFlags = layout.question_groups.map((group) => shadowQuestionSet.has(Number(group?.question_num)))
      const shadowItems = browserLocalStrongShadowItems(
        layout.question_groups,
        shadowReviewFlags,
        rawCrops,
        layout,
      )
      payload.v3BrowserLocalStrongShadow = {
        status: browserLocalStrongConfig.enabled ? 'pending' : 'configuration-error',
        affectsGrade: false,
        requested: shadowItems.length,
      }
      requestBrowserLocalStrongShadow(shadowItems, browserLocalStrongConfig)
        .then((result) => {
          payload.v3BrowserLocalStrongShadow = result
          if (lastLiveOcrDebug.value) lastLiveOcrDebug.value.v3BrowserLocalStrongShadow = result
        })
        .catch((error) => {
          const result = { status: 'error', affectsGrade: false, error: String(error?.message || error), results: [] }
          payload.v3BrowserLocalStrongShadow = result
          if (lastLiveOcrDebug.value) lastLiveOcrDebug.value.v3BrowserLocalStrongShadow = result
        })
    }

    const v3LargeModelUrl = optionalWholeAnswerReviewUrl()
    const v3CompactModelUrl = optionalV3CompactModelUrl()
    if (
      hybridV3Enabled() &&
      !browserLocalCandidateConfig.requested &&
      (v3LargeModelUrl || v3CompactModelUrl) &&
      v3SequenceItems.length
    ) {
      primaryV3Started = true
      const localFirstMode = v3LocalFirstReviewEnabled()
      // This evidence is prepared locally but is sent only after a teacher
      // opens an unresolved yellow answer and asks for another reader. It is
      // never used by the automatic consensus/promotion path.
      const selectedStitchedReviewItems = localFirstMode && v3StitchedOnDemandReviewEnabled()
        ? wholeAnswerReviewItemsForFrame(
            layout.question_groups,
            layout.question_groups.map(() => true),
            rawCrops
          ).map((item) => ({ ...item, reviewOnly: true }))
        : []
      const initiallyYellowQuestionNums = displayedYellowQuestionNumbers(
        layout.question_groups,
        questionReview,
        payload.answerGroups,
      )
      const initiallySuspiciousAcceptedQuestionNums = v3ConfidenceSafetyEnabled()
        ? confidenceSafetyCandidateQuestionNumbers(layout.question_groups, predictions)
        : []
      const initialPendingReviewQuestionNums = progressivePendingQuestionNumbers({
        yellowQuestionNums: initiallyYellowQuestionNums,
        suspiciousAcceptedQuestionNums: initiallySuspiciousAcceptedQuestionNums,
      })
      payload.v3Shadow = {
        status: 'pending',
        policyVersion: V3_POLICY_VERSION,
        affectsGrade: false,
        pendingReviewQuestionNums: initialPendingReviewQuestionNums,
      }
      const selectedCompactItems = partialDebug.v3AnswerZones.map((zone) => ({
        id: `question-${zone.questionNum}`,
        questionNum: zone.questionNum,
        cropVariant: 'primary-continuous-zone',
        continuousImageDataUrl: zone.imageDataUrl
      }))
      const selectedContextCompactItems = (partialDebug.v3ContextAnswerZones || []).map((zone) => ({
        id: `question-${zone.questionNum}-expanded-context`,
        questionNum: zone.questionNum,
        cropVariant: 'expanded-context',
        continuousImageDataUrl: zone.imageDataUrl,
      }))
      if (partialDebug.v3GeometryRescue?.imageDataUrl) {
        selectedCompactItems.push({
          id: `question-${partialDebug.v3GeometryRescue.questionNum}-geometry-rescue`,
          questionNum: partialDebug.v3GeometryRescue.questionNum,
          cropVariant: 'same-page-geometry-outlier-rescue',
          continuousImageDataUrl: partialDebug.v3GeometryRescue.imageDataUrl,
        })
      }
      const burstFramesSnapshot = pendingHybridBurstFrames.map((frame) => ({ ...frame }))
      const v3Run = startAsyncV3Shadow({
        localResult: payload,
        work: async () => {
          const timingStarted = performance.now()
          const stageTimingsMs = {}
          const markStage = (name) => { stageTimingsMs[name] = Math.round(performance.now() - timingStarted) }
          const reviewQuestionNums = [...initiallyYellowQuestionNums]
          const confidenceSafetyQuestionNums = [...initiallySuspiciousAcceptedQuestionNums]
          const compactQuestionNums = [...new Set([...reviewQuestionNums, ...confidenceSafetyQuestionNums])]
          let immediateCompactReads = []
          let immediateCompactChoices = []
          let confidenceSafetyVetoRecords = []
          if (localFirstMode) {
            const preparing = {}
            for (const questionNum of reviewQuestionNums) preparing[questionNum] = 'preparing'
            localFirstStrongStatusByQuestion.value = preparing
            const immediatePrimaryItems = filterItemsToYellowQuestions(selectedCompactItems, compactQuestionNums)
            immediateCompactReads = v3CompactModelUrl && immediatePrimaryItems.length
              ? await requestCompactWholeAnswers({
                  baseUrl: v3CompactModelUrl,
                  items: immediatePrimaryItems,
                  accessToken: optionalReviewAccessToken(),
                  timeoutMs: 8000,
                  onError: (error) => console.warn('[ScanGrade] Optional immediate V3 compact model unavailable:', error),
                })
              : []
            immediateCompactChoices = applyCompactReviewChoices(layout.question_groups, predictions, immediateCompactReads)
            confidenceSafetyVetoRecords = v3ConfidenceSafetyEnabled()
              ? confidenceSafetyVetoes({
                  questionGroups: layout.question_groups,
                  answerGroups: payload.answerGroups,
                  predictions,
                  compactReads: immediateCompactReads,
                })
              : []
            if (confidenceSafetyVetoRecords.length && !confidenceClearanceVetoRecords.length) {
              applyConfidenceSafetyVetoes(predictions, confidenceSafetyVetoRecords)
              for (const veto of confidenceSafetyVetoRecords) {
                if (!reviewQuestionNums.includes(veto.questionNum)) reviewQuestionNums.push(veto.questionNum)
              }
              reviewQuestionNums.sort((a, b) => a - b)
              const updatedQuestionReview = buildQuestionReviewFlags(layout.question_groups, predictions, questionCorrect)
              const updatedAnswerGroups = buildAnswerGroups(layout.question_groups, predictions, questionCorrect, layout.id)
              const updatedAnnotationRegions = buildAnnotationRegions(
                layout.question_groups,
                annotationGeometry,
                predictions,
                questionCorrect
              )
              payload.digits = predictions.map((prediction) => prediction.digit)
              payload.confidences = predictions.map((prediction) => prediction.confidence)
              payload.predictions = predictions
              payload.needsReview = true
              payload.questionReview = updatedQuestionReview
              payload.questionReviewCount = updatedQuestionReview.filter(Boolean).length
              payload.answerGroups = updatedAnswerGroups
              payload.annotationRegions = updatedAnnotationRegions
              payload.confidenceSafetyVetoes = confidenceSafetyVetoRecords
              partialDebug.questionReview = updatedQuestionReview
              partialDebug.answerGroups = updatedAnswerGroups
              partialDebug.annotationRegions = updatedAnnotationRegions
              partialDebug.confidenceSafetyVetoes = confidenceSafetyVetoRecords
              try {
                if (payload.annotationBaseUrl) {
                  payload.annotatedImageUrl = await composeStudentAnnotatedImage(
                    payload.annotationBaseUrl,
                    annotationWidth,
                    annotationHeight,
                    predictions,
                    annotationCrops,
                    annotationLayout,
                    questionCorrect,
                    payload.manualCorrections,
                    payload.annotationSeed
                  )
                }
              } catch (error) {
                console.warn('[ScanGrade] confidence safety annotation refresh failed:', error)
              }
              if (lastLiveOcrDebug.value) {
                lastLiveOcrDebug.value.predictions = predictions
                lastLiveOcrDebug.value.questionReview = updatedQuestionReview
                lastLiveOcrDebug.value.questionReviewCount = updatedQuestionReview.filter(Boolean).length
                lastLiveOcrDebug.value.answerGroups = updatedAnswerGroups
                lastLiveOcrDebug.value.annotationRegions = updatedAnnotationRegions
                lastLiveOcrDebug.value.confidenceSafetyVetoes = confidenceSafetyVetoRecords
                lastLiveOcrDebug.value.markedSheetDataUrl = payload.annotatedImageUrl || null
                lastLiveOcrDebug.value.overlayDebug = buildOverlayDebugSnapshot({
                  questionGroups: annotationLayout?.question_groups,
                  layoutId: annotationLayout?.layout_id || layout?.layout_id || null,
                  annotationGeometry,
                  annotationRegions: updatedAnnotationRegions,
                  predictions,
                  questionCorrect,
                  questionReview: updatedQuestionReview,
                  annotationBaseMode,
                  annotationSeed: payload.annotationSeed,
                  markedSheetAvailable: !!payload.annotatedImageUrl,
                })
              }
            }
            payload.v3Shadow = {
              status: 'compact-ready',
              policyVersion: V3_POLICY_VERSION,
              affectsGrade: false,
              reviewArchitecture: 'local-first-on-demand-strong',
              compactChoiceCount: immediateCompactChoices.length,
              contextCropChoiceCount: 0,
              contextCropReviewOnly: true,
              contextCropInferenceDeferred: true,
              strongInferenceDeferred: true,
              confidenceSafetyEnabled: v3ConfidenceSafetyEnabled(),
              confidenceSafetyCandidateCount: confidenceSafetyQuestionNums.length,
              confidenceSafetyVetoCount: confidenceSafetyVetoRecords.length,
              pendingReviewQuestionNums: [...reviewQuestionNums],
            }
            partialDebug.v3Shadow = payload.v3Shadow
            if (lastLiveOcrDebug.value) {
              lastLiveOcrDebug.value.v3Shadow = payload.v3Shadow
              lastLiveOcrDebug.value.predictions = predictions
            }
            ocrResult.value = { ...payload }
          }
          markStage('compactReady')
          const burst = await buildV3BurstShadowItems({
            questionGroups: layout.question_groups,
            layout,
            qrLocation: qrPayload?.qr_location || null,
            selectedSequenceItems: v3SequenceItems,
            selectedCompactItems,
            selectedZones: partialDebug.v3AnswerZones,
            selectedRawCrops: rawCrops,
            selectedSourceAnchors: worksheetResult.sourceAnchors,
            selectedAlternateItems: selectedAlternateCropSequenceItems,
            burstFrames: burstFramesSnapshot,
            reviewQuestionNums,
            includeCompactItems: !localFirstMode,
          })
          markStage('primaryFrameCropsReady')
          const frameFusionMode = experimentalFrameFusionMode()
          const frameFusionItems = frameFusionMode !== 'off'
            ? await medianFusedFrameItems(burst.sequenceItems, { align: frameFusionMode === 'aligned' })
            : []
          const alternateCrop = v3SharedFrameProcessingEnabled()
            ? { sequenceItems: burst.alternateSequenceItems, frames: burst.alternateFrames }
            : localFirstMode && !v3NumberBondShiftEvidenceEnabled() && !v3NonrowTrimEvidenceEnabled()
            ? { sequenceItems: [], frames: [] }
            : await buildV3AlternateCropReviewItems({
                questionGroups: layout.question_groups,
                questionReview,
                layout,
                qrLocation: qrPayload?.qr_location || null,
                burstFrames: burstFramesSnapshot,
              })
          markStage('alternateFrameCropsReady')
          const availableCoreCropItems = v3CoreCropEvidenceEnabled()
            ? filterItemsToYellowQuestions(selectedCoreCropSequenceItems, reviewQuestionNums)
            : []
          let coreCropItems = []
          let coreCropReads = []
          let coreCropDecisions = []
          const deferCorroboration = v3DeferredCorroborationEnabled()
          let alternateCropItemsRequested = deferCorroboration ? [] : alternateCrop.sequenceItems
          partialDebug.hybridBurstProcessing = burst.frames
          const [sequenceReads, compactReads, alternateSequenceReads, frameFusionReads] = await Promise.all([
            v3LargeModelUrl && (!localFirstMode || v3ConsensusPromotionEnabled())
              ? requestWholeAnswerReviewSuggestions(
                  layout.question_groups,
                  layout.question_groups.map(() => true),
                  rawCrops,
                  burst.sequenceItems
                )
              : Promise.resolve([]),
            v3CompactModelUrl && !localFirstMode
              ? requestCompactWholeAnswers({
                  baseUrl: v3CompactModelUrl,
                  items: burst.compactItems,
                  accessToken: optionalReviewAccessToken(),
                  timeoutMs: 8000,
                  onError: (error) => console.warn('[ScanGrade] Optional V3 compact model unavailable:', error)
                })
              : Promise.resolve(immediateCompactReads),
            v3LargeModelUrl && alternateCropItemsRequested.length
              ? requestWholeAnswerReviewSuggestions(
                  layout.question_groups,
                  questionReview,
                  rawCrops,
                  alternateCropItemsRequested
                )
              : Promise.resolve([]),
            v3LargeModelUrl && frameFusionItems.length
              ? requestWholeAnswerReviewSuggestions(
                  layout.question_groups,
                  questionReview,
                  rawCrops,
                  frameFusionItems,
                )
              : Promise.resolve([]),
          ])
          markStage('initialModelReadsReady')
          const decisions = buildV3ShadowDecisions({
            questionGroups: layout.question_groups,
            predictions,
            sequenceReads,
            compactReads: localFirstMode
              ? compactReads.filter((read) => read?.cropVariant !== 'expanded-context')
              : compactReads,
            zones: partialDebug.v3AnswerZones,
            requireCompact: !!v3CompactModelUrl,
          })
          const alternateDecisions = alternateSequenceReads.length
            ? buildV3ShadowDecisions({
                questionGroups: layout.question_groups,
                predictions,
                sequenceReads: alternateSequenceReads,
                compactReads: [],
                zones: partialDebug.v3AnswerZones,
                requireCompact: false,
              })
            : []
          let effectiveAlternateDecisions = alternateDecisions
          const consensusPromotionDecisions = []
          let consensusApplication = null
          if (v3ConsensusPromotionEnabled()) {
            const answerByQuestion = new Map((payload.answerGroups || []).map((group) => [
              Number(group?.questionNum),
              group,
            ]))
            const shadowByQuestion = new Map(decisions.map((decision) => [Number(decision.questionNum), decision]))
            let alternateShadowByQuestion = new Map(effectiveAlternateDecisions.map((decision) => [Number(decision.questionNum), decision]))
            const predictionsById = new Map(predictions.map((prediction) => [Number(prediction.id), prediction]))
            const compactByQuestion = new Map()
            for (const read of compactReads || []) {
              const questionNum = Number(read?.questionNum)
              if (!Number.isFinite(questionNum)) continue
              if (!compactByQuestion.has(questionNum)) compactByQuestion.set(questionNum, [])
              compactByQuestion.get(questionNum).push(read)
            }
            const safetyVetoQuestions = new Set([
              ...(confidenceClearanceVetoRecords || []),
              ...(confidenceSafetyVetoRecords || []),
            ].map((veto) => Number(veto.questionNum)))
            const buildPromotionDecisions = (coreDecisions = []) => {
              const coreCropShadowByQuestion = new Map(coreDecisions.map((decision) => [Number(decision.questionNum), decision]))
              return (layout.question_groups || []).map((group) => {
                const questionNum = Number(group?.question_num)
                const answerGroup = answerByQuestion.get(questionNum)
                const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
                const groupPredictions = ids.map((id) => predictionsById.get(Number(id))).filter(Boolean)
                const ambiguity = detectAnswerAmbiguity({ predictions: groupPredictions })
                const decision = consensusPromotionDecision({
                  currentRead: answerGroup?.answerText || '',
                  currentAutomatic: answerGroup?.reviewNeeded !== true,
                  currentPredictions: groupPredictions,
                  confidenceSafetyVetoed: safetyVetoQuestions.has(questionNum),
                  sequenceFrameConsensus: shadowByQuestion.get(questionNum)?.sequenceFrameConsensus || null,
                  alternateSequenceFrameConsensus: alternateShadowByQuestion.get(questionNum)?.sequenceFrameConsensus || null,
                  coreCropConsensus: coreCropShadowByQuestion.get(questionNum)?.sequenceFrameConsensus || null,
                  compactReads: compactByQuestion.get(questionNum) || [],
                  slotCount: maxHandwrittenDigitsForGroup(group),
                  ambiguity,
                })
                return { questionNum, ...decision, ambiguity }
              })
            }
            const preliminaryDecisions = buildPromotionDecisions()
            if (v3LargeModelUrl && (availableCoreCropItems.length || (deferCorroboration && alternateCrop.sequenceItems.length))) {
              const eligibleQuestionNums = coreCropReviewEligibleQuestionNums(preliminaryDecisions)
              coreCropItems = filterItemsToYellowQuestions(availableCoreCropItems, eligibleQuestionNums)
              const deferredAlternateItems = deferCorroboration
                ? filterItemsToYellowQuestions(alternateCrop.sequenceItems, eligibleQuestionNums)
                : []
              alternateCropItemsRequested.push(...deferredAlternateItems)
              const corroborationItems = [...deferredAlternateItems, ...coreCropItems]
              if (corroborationItems.length) {
                const corroborationReads = await requestWholeAnswerReviewSuggestions(
                  layout.question_groups,
                  questionReview,
                  rawCrops,
                  corroborationItems
                )
                if (deferCorroboration) {
                  const deferredAlternateReads = corroborationReads.filter((read) =>
                    !String(read?.cropVariant || '').startsWith('core-'))
                  alternateSequenceReads.push(...deferredAlternateReads)
                  effectiveAlternateDecisions = alternateSequenceReads.length
                    ? buildV3ShadowDecisions({
                        questionGroups: layout.question_groups,
                        predictions,
                        sequenceReads: alternateSequenceReads,
                        compactReads: [],
                        zones: partialDebug.v3AnswerZones,
                        requireCompact: false,
                      })
                    : []
                  alternateShadowByQuestion = new Map(effectiveAlternateDecisions.map((decision) => [
                    Number(decision.questionNum),
                    decision,
                  ]))
                }
                coreCropReads = corroborationReads.filter((read) =>
                  String(read?.cropVariant || '').startsWith('core-'))
              }
            }
            coreCropDecisions = coreCropReads.length
              ? buildV3ShadowDecisions({
                  questionGroups: layout.question_groups,
                  predictions,
                  sequenceReads: coreCropReads,
                  compactReads: [],
                  zones: partialDebug.v3AnswerZones,
                  requireCompact: false,
                })
              : []
            markStage('corroborationReadsReady')
            consensusPromotionDecisions.push(...(coreCropDecisions.length
              ? buildPromotionDecisions(coreCropDecisions)
              : preliminaryDecisions))
            const manualCorrectionActive = predictions.some((prediction) => prediction?.manualCorrected === true) ||
              Object.keys(payload.manualCorrections || {}).length > 0
            if (!manualCorrectionActive) {
              consensusApplication = applyConsensusPromotionsToPredictions({
                questionGroups: layout.question_groups,
                predictions,
                decisions: consensusPromotionDecisions,
              })
              const consensusReviewVetoes = new Set(consensusReviewVetoQuestionNums({
                shadowDecisions: decisions,
                promotionDecisions: consensusPromotionDecisions,
              }))
              if (consensusApplication.applied.length || consensusReviewVetoes.size) {
                predictions = consensusApplication.predictions.map((prediction) =>
                  consensusReviewVetoes.has(Number(prediction?.questionNum))
                    ? {
                        ...prediction,
                        reviewNeeded: true,
                        consensusReviewVeto: true,
                        reviewReason: prediction?.reviewReason || 'independent-whole-answer-transcription-dispute',
                      }
                    : prediction)
                const promotedQuestionCorrect = buildQuestionCorrect(layout.question_groups, predictions)
                const promotedQuestionReview = buildQuestionReviewFlags(layout.question_groups, predictions, promotedQuestionCorrect)
                const promotedAnswerGroups = buildAnswerGroups(layout.question_groups, predictions, promotedQuestionCorrect, layout.id)
                const promotedAnnotationRegions = buildAnnotationRegions(
                  layout.question_groups,
                  annotationGeometry,
                  predictions,
                  promotedQuestionCorrect,
                )
                payload.digits = predictions.map((prediction) => prediction.digit)
                payload.confidences = predictions.map((prediction) => prediction.confidence)
                payload.predictions = predictions
                delete payload.correct
                payload.questionCorrect = promotedQuestionCorrect
                payload.questionCount = promotedQuestionCorrect?.length || 0
                payload.questionScore = promotedQuestionCorrect?.filter(Boolean).length || 0
                payload.questionReview = promotedQuestionReview
                payload.questionReviewCount = promotedQuestionReview?.filter(Boolean).length || 0
                payload.answerGroups = promotedAnswerGroups
                payload.annotationRegions = promotedAnnotationRegions
                payload.needsReview = !!forcedFallbackReviewReason || baseNeedsReview ||
                  predictions.some((prediction) => prediction.reviewNeeded) ||
                  promotedQuestionReview?.some(Boolean)
                partialDebug.predictions = predictions
                partialDebug.questionCorrect = promotedQuestionCorrect
                partialDebug.questionReview = promotedQuestionReview
                partialDebug.answerGroups = promotedAnswerGroups
                partialDebug.annotationRegions = promotedAnnotationRegions
                try {
                  if (payload.annotationBaseUrl) {
                    payload.annotatedImageUrl = await composeStudentAnnotatedImage(
                      payload.annotationBaseUrl,
                      annotationWidth,
                      annotationHeight,
                      predictions,
                      annotationCrops,
                      annotationLayout,
                      promotedQuestionCorrect,
                      payload.manualCorrections,
                      payload.annotationSeed,
                    )
                  }
                } catch (error) {
                  console.warn('[ScanGrade] experimental consensus annotation refresh failed:', error)
                }
              }
            }
          }
          const compactChoices = localFirstMode
            ? immediateCompactChoices
            : applyCompactReviewChoices(layout.question_groups, predictions, compactReads)
          const strongSuggestions = localFirstMode ? [] : [
            ...applyWholeAnswerReviewSuggestions(layout.question_groups, predictions, sequenceReads, { allowRelaxedMultiFrame: layout.question_groups.length === 8 }),
            ...applyWholeAnswerReviewSuggestions(layout.question_groups, predictions, alternateSequenceReads, { allowRelaxedMultiFrame: layout.question_groups.length === 8 }),
          ]
          const suggestions = [...compactChoices, ...strongSuggestions]
          if (localFirstMode) {
            const deferred = {}
            for (const questionNum of reviewQuestionNums) deferred[questionNum] = 'deferred'
            localFirstStrongStatusByQuestion.value = deferred
            const finalReviewQuestionNums = displayedYellowQuestionNumbers(
              layout.question_groups,
              payload.questionReview,
              payload.answerGroups,
            )
            localFirstStrongContext.value = {
              questionGroups: layout.question_groups,
              predictions,
              sequenceItems: selectedStitchedReviewItems.length
                ? filterItemsToYellowQuestions(selectedStitchedReviewItems, finalReviewQuestionNums)
                : burst.sequenceItems,
              strongEvidenceMode: selectedStitchedReviewItems.length
                ? 'selected-frame-stitched-review-only'
                : 'three-frame-continuous-review-only',
              contextCompactItems: filterItemsToYellowQuestions(selectedContextCompactItems, reviewQuestionNums),
              contextAttemptedByQuestion: {},
              payload,
            }
          }
          markStage('complete')
          return {
            shadow: {
              status: 'complete', policyVersion: V3_POLICY_VERSION,
              affectsGrade: v3ConsensusPromotionEnabled() && (consensusApplication?.applied?.length || 0) > 0,
              decisions, suggestions: suggestions.length,
              reviewArchitecture: v3ConsensusPromotionEnabled()
                ? 'yellow-only-three-frame-consensus-experimental'
                : localFirstMode ? 'local-first-on-demand-strong' : 'eager-strong-shadow',
              compactChoiceCount: compactChoices.length,
              confidenceSafetyEnabled: v3ConfidenceSafetyEnabled(),
              confidenceSafetyCandidateCount: confidenceSafetyQuestionNums.length,
              confidenceSafetyVetoCount: confidenceSafetyVetoRecords.length,
              confidenceSafetyVetoes: confidenceSafetyVetoRecords,
              consensusPromotionEnabled: v3ConsensusPromotionEnabled(),
              consensusPromotionDecisions,
              consensusApplication,
              consensusPromotionCount: consensusApplication?.applied?.length || 0,
              strongInferenceDeferred: localFirstMode && !v3ConsensusPromotionEnabled(),
              frameProcessing: burst.frames,
              frameCount: burst.frames.filter((frame) => frame.processed).length,
              alternateCropReview: {
                enabled: v3DualCropReviewEnabled() || v3NumberBondShiftEvidenceEnabled() || v3NonrowTrimEvidenceEnabled(),
                variant: v3NumberBondShiftEvidenceEnabled()
                  ? 'number-bond-down-0.04'
                  : v3NonrowTrimEvidenceEnabled() ? 'nonrow-trim-all-0.04' : 'eight-frame-column-order-alternate',
                deferred: deferCorroboration,
                itemCount: alternateCropItemsRequested.length,
                frames: alternateCrop.frames,
                suggestionCount: alternateSequenceReads.length,
                decisions: effectiveAlternateDecisions,
                affectsGrade: (v3NumberBondShiftEvidenceEnabled() || v3NonrowTrimEvidenceEnabled()) && v3ConsensusPromotionEnabled(),
              },
              coreCropReview: {
                enabled: v3CoreCropEvidenceEnabled(),
                variant: 'selected-original-plus-trim-0.02-and-0.04',
                itemCount: coreCropItems.length,
                suggestionCount: coreCropReads.length,
                decisions: coreCropDecisions,
                affectsGrade: v3CoreCropEvidenceEnabled() && v3ConsensusPromotionEnabled(),
              },
              frameFusionReview: {
                enabled: frameFusionMode !== 'off',
                variant: frameFusionMode === 'aligned'
                  ? 'locally-aligned-three-frame-median'
                  : 'page-aligned-three-frame-median',
                itemCount: frameFusionItems.length,
                suggestionCount: frameFusionReads.length,
                decisions: frameFusionReads.length
                  ? buildV3ShadowDecisions({
                      questionGroups: layout.question_groups,
                      predictions,
                      sequenceReads: frameFusionReads,
                      compactReads: [],
                      zones: partialDebug.v3AnswerZones,
                      requireCompact: false,
                    })
                  : [],
                affectsGrade: false,
              },
              largeModelAvailable: sequenceReads.length > 0,
              compactModelAvailable: compactReads.length > 0,
              stageTimingsMs,
            },
            suggestions,
          }
        },
        onComplete: ({ shadow, suggestions }) => {
          payload.v3Shadow = shadow
          partialDebug.v3Shadow = shadow
          partialDebug.wholeAnswerReviewSuggestions = suggestions
          if (lastLiveOcrDebug.value) {
            lastLiveOcrDebug.value.v3Shadow = shadow
            lastLiveOcrDebug.value.wholeAnswerReviewSuggestions = suggestions
            if (shadow?.consensusPromotionCount > 0) {
              lastLiveOcrDebug.value.predictions = payload.predictions
              lastLiveOcrDebug.value.questionCorrect = payload.questionCorrect
              lastLiveOcrDebug.value.questionReview = payload.questionReview
              lastLiveOcrDebug.value.questionReviewCount = payload.questionReviewCount
              lastLiveOcrDebug.value.answerGroups = payload.answerGroups
              lastLiveOcrDebug.value.annotationRegions = payload.annotationRegions
              lastLiveOcrDebug.value.markedSheetDataUrl = payload.annotatedImageUrl || null
              lastLiveOcrDebug.value.overlayDebug = buildOverlayDebugSnapshot({
                questionGroups: annotationLayout?.question_groups,
                layoutId: annotationLayout?.layout_id || layout?.layout_id || null,
                annotationGeometry,
                annotationRegions: payload.annotationRegions,
                predictions: payload.predictions,
                questionCorrect: payload.questionCorrect,
                questionReview: payload.questionReview,
                annotationBaseMode,
                annotationSeed: payload.annotationSeed,
                markedSheetAvailable: !!payload.annotatedImageUrl,
              })
            }
            void uploadLiveOcrDebug(lastLiveOcrDebug.value, 'v3-shadow-complete')
          }
          if (localFirstMode || v3ConsensusPromotionEnabled()) ocrResult.value = { ...payload }
          resolvePrimaryV3Completion()
        },
        onError: (e) => {
          payload.v3Shadow = {
            status: 'unavailable', policyVersion: V3_POLICY_VERSION, affectsGrade: false,
            error: String(e?.message || e)
          }
          partialDebug.v3Shadow = payload.v3Shadow
          resolvePrimaryV3Completion()
        },
      })
      void v3Run.shadow
    }
    if (!primaryV3Started) resolvePrimaryV3Completion()

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
      await uploadLiveOcrDebug(lastLiveOcrDebug.value, 'ocr-error')
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
    if (candidatePresentationPromise) {
      // The candidate promise handles all of its own failures by restoring
      // Beta 15.3. Awaiting it here only orders the completion event after
      // that final, pre-acceptance result is available.
      await candidatePresentationPromise
    }
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

function currentDebugPageUrl() {
  if (typeof window === 'undefined') return ''
  try {
    const url = new URL(window.location.href)
    url.searchParams.delete('debugUploadToken')
    url.searchParams.delete('debugToken')
    return url.toString()
  } catch {
    return ''
  }
}

async function uploadLiveOcrDebug(data, uploadReason = 'ocr-complete') {
  if (!liveOcrDebugExportEnabled.value || !debugUploadConfig.autoUpload || !data) return
  if (!debugUploadConfig.url) {
    debugAutoUploadState.value = 'failed'
    debugAutoUploadStatus.value = 'Debug auto-save needs an upload URL'
    return
  }

  debugAutoUploadState.value = 'uploading'
  debugAutoUploadStatus.value = 'Saving debug bundle...'

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  let timeout = null
  try {
    const headers = { 'Content-Type': 'application/json' }
    if (debugUploadConfig.token) headers['X-ScanGrade-Debug-Token'] = debugUploadConfig.token
    const uploadRequest = fetch(debugUploadConfig.url, {
      method: 'POST',
      headers,
      ...(controller ? { signal: controller.signal } : {}),
      body: JSON.stringify({
        source: 'scangrade-browser-debug',
        uploadReason,
        pageUrl: currentDebugPageUrl(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        debug: data
      })
    })
    const timeoutRequest = new Promise((_, reject) => {
      timeout = window.setTimeout(() => {
        controller?.abort()
        reject(new Error('Upload timed out'))
      }, DEBUG_UPLOAD_TIMEOUT_MS)
    })
    const response = await Promise.race([uploadRequest, timeoutRequest])
    const payload = await response.json().catch(() => ({}))
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `Upload failed (${response.status})`)
    }
    debugAutoUploadState.value = 'saved'
    debugAutoUploadStatus.value = payload?.id ? `Debug saved: ${payload.id}` : 'Debug saved'
  } catch (err) {
    debugAutoUploadState.value = 'failed'
    debugAutoUploadStatus.value = `Debug auto-save failed: ${err?.message || err}`
    console.warn('[ScanGrade] live OCR debug upload failed:', err)
  } finally {
    if (timeout != null) window.clearTimeout(timeout)
  }
}

async function exportLiveOcrDebugJson() {
  const data = lastLiveOcrDebug.value
  if (!data) return { ok: false, error: 'Debug evidence is not ready yet' }
  debugExportBusy.value = true
  debugExportStatus.value = ''
  try {
    const result = await exportDebugJson(data)
    debugExportStatus.value = result.method === 'share'
      ? 'Share sheet opened. Save or attach the JSON file.'
      : result.method === 'copy'
        ? 'Debug JSON copied.'
        : 'Debug JSON downloaded.'
    return { ok: true, method: result.method, status: debugExportStatus.value }
  } catch (err) {
    if (err?.name === 'AbortError') {
      debugExportStatus.value = 'Export cancelled.'
    } else {
      debugExportStatus.value = `Could not export: ${err?.message || err}. Try Copy debug JSON.`
    }
    return {
      ok: false,
      cancelled: err?.name === 'AbortError',
      error: err?.message || String(err),
      status: debugExportStatus.value,
    }
  } finally {
    debugExportBusy.value = false
  }
}

async function copyLiveOcrDebugJson() {
  const data = lastLiveOcrDebug.value
  if (!data) return { ok: false, error: 'Debug evidence is not ready yet' }
  debugExportBusy.value = true
  debugExportStatus.value = ''
  try {
    await copyDebugJson(data)
    debugExportStatus.value = 'Debug JSON copied. Paste it into the Codex conversation.'
    return { ok: true, method: 'copy', status: debugExportStatus.value }
  } catch (err) {
    debugExportStatus.value = `Could not copy: ${err?.message || err}`
    return { ok: false, error: err?.message || String(err), status: debugExportStatus.value }
  } finally {
    debugExportBusy.value = false
  }
}

const retake = () => {
  resetProgressiveMarking()
  pendingHybridBurstFrames = []
  captureGateTelemetry = newCaptureGateTelemetry()
  capturedImage.value = null
  ocrResult.value = null
  activeCorrectionQuestion.value = null
  manualCorrectionText.value = ''
  manualCorrectionClearedForSession.value = false
  correctionError.value = ''
  localFirstStrongStatusByQuestion.value = {}
  localFirstStrongContext.value = null
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

onUnmounted(() => {
  clearProgressiveMarkingTimer()
  stopStream()
  if (typeof window !== 'undefined') {
    delete window.__SCANGRADE_SET_V3_BURST_FRAMES
    delete window.__SCANGRADE_OPEN_REVIEW_QUESTION
    delete window.__SCANGRADE_LOCAL_FIRST_CONTEXT_SUMMARY
  }
})
</script>

<style scoped>
.camera-capture {
  --teacher-highlighter-rgb: 238, 255, 0;
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
  flex: 1 1 auto;
  min-height: 0;
  overflow: hidden;
  justify-content: center;
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
  width: min(100%, calc((100dvh - 218px) * 8.5 / 11));
  height: auto;
  max-height: calc(100dvh - 218px);
  max-width: min(100%, calc((100dvh - 218px) * 8.5 / 11));
  margin: 0;
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
    0 0 16px rgba(18, 108, 57, 0.34),
    0 0 34px rgba(18, 108, 57, 0.20),
    inset 0 0 0 1px rgba(255, 255, 255, 0.78),
    inset 0 0 20px rgba(18, 108, 57, 0.14);
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

.captured-image-wrap--completion-glow::after {
  content: '';
  position: absolute;
  z-index: 12;
  inset: 0;
  box-sizing: border-box;
  border: 3px solid rgba(18, 108, 57, 0.96);
  box-shadow:
    inset 0 0 0 1px rgba(18, 108, 57, 0.72),
    inset 0 0 16px rgba(18, 108, 57, 0.30),
    inset 0 0 34px rgba(18, 108, 57, 0.18),
    inset 0 0 0 2px rgba(255, 255, 255, 0.42);
  pointer-events: none;
  animation: worksheet-completion-glow 720ms ease-out both;
}

@keyframes worksheet-completion-glow {
  0% {
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  62% {
    opacity: 0.86;
  }
  100% {
    opacity: 0;
  }
}

.progressive-marking-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.scanning-date-layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.scanning-date-stamp {
  opacity: 1;
}

.recognition-read-overlay {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}

.recognition-read-label {
  position: absolute;
  transform: translate(-50%, -100%);
  min-width: 1.15em;
  padding: 0 2px 1px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.72);
  color: #245aa4;
  font-family: inherit;
  font-size: clamp(9px, 1.65vw, 14px);
  line-height: 1;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-align: center;
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.92);
}

.progressive-marking-reveal {
  opacity: 1;
}

.progressive-score-ink {
  mix-blend-mode: multiply;
}

.progressive-direct-incorrect-ink {
  mix-blend-mode: multiply;
}

.progressive-marking-stroke {
  stroke-dasharray: none;
  stroke-dashoffset: 0;
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
  background: transparent;
}

.annotation-hotspot--active {
  border-color: transparent;
  box-shadow: none;
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

.on-sheet-correction-focus {
  position: absolute;
  z-index: 9;
  display: grid;
  grid-template-columns: repeat(var(--correction-preview-slots, 1), minmax(0, 1fr));
  align-items: stretch;
  box-sizing: border-box;
  overflow: visible;
  border: 2px solid rgba(36, 90, 164, 0.72);
  border-radius: 3px;
  background: transparent;
  box-shadow:
    0 0 0 2px rgba(176, 224, 255, 0.14),
    0 0 8px rgba(36, 90, 164, 0.18);
  animation: correction-focus-breathe 1.5s ease-in-out infinite;
  pointer-events: none;
  transition:
    background-color 90ms ease-out,
    border-color 0ms linear,
    border-radius 90ms ease-out,
    box-shadow 0ms linear;
}

.on-sheet-correction-ink {
  position: absolute;
  z-index: 8;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.on-sheet-correction-focus--entered {
  overflow: visible;
  border-radius: 3px;
  background: transparent;
  border-color: transparent;
  box-shadow: none;
  animation: none;
}

.on-sheet-correction-focus--committing {
  border-color: transparent;
  box-shadow: none;
  animation: none;
}

@keyframes correction-focus-breathe {
  0%,
  100% {
    border-color: rgba(36, 90, 164, 0.5);
    box-shadow:
      0 0 0 2px rgba(176, 224, 255, 0.08),
      0 0 7px rgba(36, 90, 164, 0.1);
  }
  50% {
    border-color: rgba(36, 90, 164, 0.7);
    box-shadow:
      0 0 0 3px rgba(176, 224, 255, 0.13),
      0 0 10px rgba(36, 90, 164, 0.17);
  }
}

.correction-keypad {
  position: fixed;
  z-index: 30;
  left: 50%;
  bottom: max(76px, calc(env(safe-area-inset-bottom, 0px) + 68px));
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 5px;
  width: min(94vw, 390px);
  box-sizing: border-box;
  padding: 7px;
  border: 1px solid rgba(36, 90, 164, 0.24);
  border-radius: 13px;
  background: rgba(247, 248, 250, 0.94);
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.22);
  font-family: 'Lexend', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.correction-keypad-key {
  appearance: none;
  min-width: 0;
  height: 43px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.98);
  color: #1d1d1f;
  font: inherit;
  font-size: 21px;
  line-height: 1;
  font-weight: 700;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
  -webkit-tap-highlight-color: transparent;
}

.correction-keypad-key:active {
  transform: scale(0.95);
  background: #e9eef6;
}

.correction-keypad-key--blank {
  color: #245aa4;
  font-weight: 800;
}

.correction-keypad-key--backspace {
  color: #55565a;
  font-size: 20px;
}

.correction-keypad-error {
  grid-column: 1 / -1;
  margin: 0;
  color: #b42318;
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.correction-keypad-check-again {
  grid-column: 1 / -1;
  min-height: 34px;
  border: 0;
  border-radius: 8px;
  background: #e8e8ed;
  color: #1d1d1f;
  font: inherit;
  font-size: 12px;
  font-weight: 750;
}

.correction-keypad-message {
  grid-column: 1 / -1;
  margin: 0;
  color: #694f20;
  font-size: 11px;
  font-weight: 650;
  text-align: center;
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

@media (max-width: 640px) {
  .camera-capture--student .preview-area--portrait {
    width: min(100%, calc((100dvh - 208px) * 8.5 / 11));
    max-width: min(100%, calc((100dvh - 208px) * 8.5 / 11));
    max-height: calc(100dvh - 208px);
    margin: 0;
  }

  .controls--student {
    width: min(100%, calc(62svh * 8.5 / 11));
    max-width: min(100%, calc(62svh * 8.5 / 11));
    gap: 8px;
  }

  .controls--student .btn {
    padding: 12px 16px;
  }

  .file-btn--student {
    padding: 6px 10px;
  }
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

.camera-capture--student .processing {
  position: fixed;
  top: max(88px, calc(env(safe-area-inset-top, 0px) + 94px));
  right: max(14px, calc(50vw - 178px));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 6px 10px 6px 7px;
  border: 1px solid rgba(224, 210, 139, 0.72);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  color: #202124;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.12);
  text-align: left;
  pointer-events: none;
}

.camera-capture--student .processing p {
  margin: 0;
  font-size: 13px;
  line-height: 1;
  font-weight: 800;
}

.marking-loader {
  position: relative;
  width: 76px;
  height: 34px;
  margin: 0 auto 12px;
  transform: rotate(-4deg);
}

.marking-loader::before {
  content: "";
  position: absolute;
  left: 8px;
  right: 8px;
  top: 17px;
  height: 2px;
  background: rgba(46, 51, 56, 0.24);
  border-radius: 999px;
}

.marking-loader span {
  position: absolute;
  left: 5px;
  top: 8px;
  width: 44px;
  height: 12px;
  border-radius: 999px;
  background: rgba(var(--teacher-highlighter-rgb), 0.58);
  mix-blend-mode: normal;
  transform-origin: left center;
  animation: highlighter-swipe 1.15s ease-in-out infinite;
}

.camera-capture--student .marking-loader {
  width: 38px;
  height: 20px;
  margin: 0;
}

.camera-capture--student .marking-loader::before {
  left: 6px;
  right: 5px;
  top: 10px;
  height: 1.5px;
}

.camera-capture--student .marking-loader span {
  left: 3px;
  top: 4px;
  width: 24px;
  height: 7px;
}

.camera-capture--student .marking-loader span:nth-child(2) {
  top: 8px;
  width: 30px;
}

.camera-capture--student .marking-loader span:nth-child(3) {
  top: 12px;
  width: 19px;
}

.marking-loader span:nth-child(2) {
  top: 15px;
  width: 58px;
  animation-delay: 0.11s;
  opacity: 0.82;
}

.marking-loader span:nth-child(3) {
  top: 22px;
  width: 34px;
  animation-delay: 0.22s;
  opacity: 0.62;
}

@keyframes highlighter-swipe {
  0% {
    opacity: 0;
    transform: translateX(-8px) scaleX(0.08) skewX(-12deg);
  }
  42% {
    opacity: 0.85;
    transform: translateX(8px) scaleX(1) skewX(-12deg);
  }
  100% {
    opacity: 0;
    transform: translateX(25px) scaleX(0.72) skewX(-12deg);
  }
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

.debug-auto-upload-status {
  width: 100%;
  margin: 12px 0 0;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.debug-auto-upload-status--saved {
  color: #126c39;
  font-weight: 700;
}

.debug-auto-upload-status--failed {
  color: #b42318;
  font-weight: 700;
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

.scantron-letter-bubble {
  width: 22px;
  height: 17.1px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1px solid #c4c8ce;
  border-radius: 50% / 50%;
  color: #626b74;
  background: transparent;
  box-shadow: none;
  font-size: 10.5px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0;
}

.student-answer-label {
  justify-self: center;
}

.student-answer-pills {
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: 31px;
  position: relative;
  align-items: center;
  justify-content: start;
  gap: 0;
  width: max-content;
  overflow: hidden;
  border: 2px solid #2e3338;
  border-radius: 1px;
  background: #ffffff;
}

.student-answer-pill {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 31px;
  height: 34px;
  border: 0;
  border-radius: 0;
  background: #ffffff;
  font-size: 17px;
  font-weight: 750;
  color: #202124;
  font-family: inherit;
  line-height: 1;
  padding: 0;
  margin: 0;
}

.student-answer-pill + .student-answer-pill {
  border-left: 0;
}

.student-answer-pill--clickable {
  cursor: pointer;
}

.student-answer-pill--clickable:active {
  background: #f7f7f3;
}

.student-answer-pill:disabled {
  opacity: 1;
  color: #202124;
}

.student-answer-pill:focus-visible {
  outline: 3px solid rgba(240, 199, 68, 0.34);
  outline-offset: -3px;
}

.student-answer-pills--double::before,
.student-answer-pills--double::after {
  content: "";
  position: absolute;
  left: 50%;
  width: 1.5px;
  height: 9px;
  transform: translateX(-50%);
  background: #6f747a;
  pointer-events: none;
}

.student-answer-pills--double::before {
  top: 0;
}

.student-answer-pills--double::after {
  bottom: 0;
}

.student-answer-item--correct {
  border-color: #c7e3ce;
  background: #fbfdfb;
}

.student-answer-item--incorrect {
  border-color: #ffd0cc;
  background: #fff8f7;
}

.student-answer-item--review {
  border-color: #eadcae;
  background: #fffdf7;
}

.student-answer-item--correct .student-answer-pills,
.student-answer-item--incorrect .student-answer-pills,
.student-answer-item--review .student-answer-pills {
  border-color: #2e3338;
}

.student-answer-pill--blank {
  color: transparent;
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
  z-index: 8;
  box-sizing: border-box;
  min-width: 156px;
  max-width: calc(100% - 12px);
  max-height: min(56%, 174px);
  overflow: visible;
  margin: 0;
  padding: 7px;
  box-shadow: 0 14px 38px rgba(0, 0, 0, 0.18);
}

.student-correction-panel--image.student-correction-panel--double {
  min-width: 170px;
}

.student-correction-panel--image::after {
  content: "";
  position: absolute;
  width: 0;
  height: 0;
  pointer-events: none;
}

.student-correction-panel--right::after {
  left: -10px;
  top: var(--correction-arrow-y, 50%);
  transform: translateY(-50%);
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-right: 10px solid rgba(255, 253, 244, 0.96);
  filter: drop-shadow(-1px 1px 0 rgba(240, 199, 68, 0.72));
}

.student-correction-panel--left::after {
  right: -10px;
  top: var(--correction-arrow-y, 50%);
  transform: translateY(-50%);
  border-top: 10px solid transparent;
  border-bottom: 10px solid transparent;
  border-left: 10px solid rgba(255, 253, 244, 0.96);
  filter: drop-shadow(1px 1px 0 rgba(240, 199, 68, 0.72));
}

.student-correction-panel--above::after {
  left: var(--correction-arrow-x, 50%);
  bottom: -10px;
  transform: translateX(-50%);
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-top: 10px solid rgba(255, 253, 244, 0.96);
  filter: drop-shadow(1px 1px 0 rgba(240, 199, 68, 0.72));
}

.student-correction-panel--below::after {
  left: var(--correction-arrow-x, 50%);
  top: -10px;
  transform: translateX(-50%);
  border-left: 10px solid transparent;
  border-right: 10px solid transparent;
  border-bottom: 10px solid rgba(255, 253, 244, 0.96);
  filter: drop-shadow(1px -1px 0 rgba(240, 199, 68, 0.72));
}

.student-correction-panel--image .student-correction-choices,
.student-correction-panel--image .student-correction-actions {
  gap: 4px;
}

.student-correction-panel--image .student-correction-choices {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.local-first-none-btn {
  width: 100%;
  margin-top: 6px;
}

.local-first-strong-message {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.25;
  color: #694f20;
}

.student-correction-panel--image .correction-choice-btn {
  flex: 0 0 auto;
  min-width: 0;
  height: 36px;
  padding: 0 4px;
}

.student-correction-panel--image .student-correction-empty-choice {
  color: #6e6e73;
  font-size: 20px;
  line-height: 1;
}

.student-correction-panel--image .student-correction-manual input {
  width: 44px;
  min-width: 44px;
  height: 44px;
  padding: 0 2px;
  text-align: center;
  font-size: 22px;
  line-height: 1.1;
}

.student-correction-panel--image .student-correction-manual {
  margin-top: 0;
}

.student-correction-blank-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  margin-top: 5px;
}

.student-correction-blank-actions .btn {
  min-width: 0;
  padding: 6px 3px;
  font-size: 10px;
  font-weight: 750;
}

.student-correction-blank-actions .student-correction-position-choice {
  display: grid;
  grid-template-columns: repeat(2, minmax(15px, 1fr));
  align-items: end;
  gap: 2px;
  height: 38px;
  padding: 4px 5px 5px;
  color: #1d1d1f;
  font-size: 18px;
  line-height: 1;
}

.student-correction-position-choice span {
  display: block;
  text-align: center;
}

.student-correction-empty-slot {
  color: #77777c;
  font-weight: 650;
}

.student-correction-blank-link {
  display: block;
  width: auto;
  margin: 4px 0 0 auto;
  padding: 1px 2px;
  border: 0;
  background: transparent;
  color: #6e6e73;
  font: inherit;
  font-size: 10px;
  font-weight: 750;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.student-correction-panel--image.student-correction-panel--double .student-correction-manual input {
  width: 58px;
  min-width: 58px;
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
  flex: 0 0 auto;
}

.student-correction-heading {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 1px;
  line-height: 1.02;
}

.student-correction-heading strong,
.student-correction-panel--image .student-correction-heading strong {
  overflow: hidden;
  color: #1d1d1f;
  font-size: 12.5px;
  font-weight: 800;
  line-height: 1.02;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.student-correction-heading span {
  overflow: hidden;
  color: #5f6368;
  font-size: 10.5px;
  font-weight: 700;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  grid-template-columns: 22px 44px 64px;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: #1d1d1f;
  font-size: 14px;
  font-weight: 700;
}

.student-correction-panel--image.student-correction-panel--double .student-correction-manual {
  grid-template-columns: 22px 58px 64px;
}

.student-correction-manual input {
  width: 100%;
  height: 50px;
  box-sizing: border-box;
  border: 1px solid #d2d2d7;
  border-radius: 8px;
  padding: 12px 14px;
  text-align: center;
  font-size: 22px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: 0;
}

.student-correction-save {
  min-width: 0;
  padding: 8px 10px;
}

.student-correction-panel--image .student-correction-save {
  flex: 0 0 auto;
  width: 64px;
  min-width: 64px;
  height: 44px;
  padding: 0 7px;
  font-size: 16px;
  line-height: 1;
}

@media (max-width: 430px) {
  .student-correction-panel--image {
    min-width: 128px;
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

.debug-auto-upload-toast {
  position: absolute;
  left: 50%;
  bottom: 68px;
  z-index: 42;
  max-width: calc(100% - 28px);
  margin: 0;
  padding: 7px 12px;
  border: 1px solid rgba(18, 108, 57, 0.2);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.94);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.14);
  color: #3f4a46;
  font-size: 12px;
  line-height: 1.25;
  text-align: center;
  transform: translateX(-50%);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
