export const STUDENT_MANUAL_CAPTURE_FOCUS_MIN = 340
export const STUDENT_AUTO_CAPTURE_TRIGGER_FOCUS_MIN = 220
export const STUDENT_AUTO_CAPTURE_STABILITY_HOLD_MS = 100
export const STUDENT_AUTO_CAPTURE_FINAL_FOCUS_MIN = 560

export const STUDENT_MARKER_DARK_FRACTION_MIN = 0.06
export const STUDENT_MARKER_MEAN_MAX = 220
export const STUDENT_PAPER_USABLE_MEAN_MIN = 105
export const STUDENT_PAPER_USABLE_BRIGHT_FRACTION_MIN = 0.12
export const STUDENT_PAPER_USABLE_DARK_FRACTION_MAX = 0.28

// The detector has several internal failure reasons, but the teacher only
// needs one clear action at a time. Keep the public instruction vocabulary
// small without changing any marker, geometry, or sharpness thresholds.
export function studentCaptureGuidance({
  status = '',
  cameraReady = false,
  captureAttemptActive = false,
} = {}) {
  const message = String(status || '').toLowerCase()
  // The preliminary burst is not yet a committed capture. Keep asking the
  // teacher to hold steady until a frame passes every final gate; saying
  // “Capturing” too early reasonably invites them to move the page.
  if (captureAttemptActive) return 'Hold steady'
  if (!cameraReady || message.includes('warming')) return 'Starting camera…'
  if (message.includes('choosing') || message.includes('captur')) return 'Capturing…'
  if (message.includes('hold') || message.includes('focus')) return 'Hold steady'
  if (message.includes('4 corner') || message.includes('4 black')) return 'Show all 4 squares'
  if (message.includes('closer')) return 'Move closer'
  if (message.includes('center') || message.includes('inside')) return 'Center full page'
  if (message.includes('flatten') || message.includes('directly above')) return 'Hold phone level'
  if (message.includes('qr')) return 'Show QR code'
  return 'Center full page'
}

export function studentSheetAppearanceDecision({
  markerStats = [],
  paperStats = {},
} = {}) {
  const darkMarkerCount = Array.isArray(markerStats)
    ? markerStats.filter((stat) =>
      Number(stat?.darkFraction) >= STUDENT_MARKER_DARK_FRACTION_MIN &&
      Number(stat?.mean) <= STUDENT_MARKER_MEAN_MAX
    ).length
    : 0
  const paperLooksPreferred =
    Number(paperStats?.mean) >= 125 &&
    Number(paperStats?.brightFraction) >= 0.52 &&
    Number(paperStats?.darkFraction) <= 0.20
  const paperLooksUsable =
    Number(paperStats?.mean) >= STUDENT_PAPER_USABLE_MEAN_MIN &&
    Number(paperStats?.brightFraction) >= STUDENT_PAPER_USABLE_BRIGHT_FRACTION_MIN &&
    Number(paperStats?.darkFraction) <= STUDENT_PAPER_USABLE_DARK_FRACTION_MAX

  if (darkMarkerCount < 4) {
    return {
      accepted: false,
      preferred: false,
      status: 'Find all 4 black squares',
      darkMarkerCount,
    }
  }
  if (!paperLooksUsable) {
    return {
      accepted: false,
      preferred: false,
      status: 'Find the worksheet page',
      darkMarkerCount,
    }
  }
  return {
    accepted: true,
    preferred: paperLooksPreferred,
    status: 'Hold steady',
    darkMarkerCount,
  }
}

export function studentCaptureFocusDecision({ source = 'manual', focusScore } = {}) {
  const threshold = source === 'auto'
    ? STUDENT_AUTO_CAPTURE_FINAL_FOCUS_MIN
    : STUDENT_MANUAL_CAPTURE_FOCUS_MIN
  const score = Number(focusScore)
  return {
    accepted: Number.isFinite(score) && score >= threshold,
    threshold,
  }
}
