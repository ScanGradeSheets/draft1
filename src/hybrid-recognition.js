// Key-blind policy for combining independent ScanGrade transcription lanes.
// This module never accepts a mathematical answer key. Automatic promotion is
// intentionally disabled until prospective packet-level evidence authorizes it.

export const HYBRID_POLICY_VERSION = 'hybrid-v2-shadow-1'
export const WHOLE_ANSWER_SHADOW_MIN_PROBABILITY = 0.999
export const CROSS_FRAME_MIN_AGREEING_FRAMES = 2
export const CROSS_FRAME_MIN_AGREEMENT_FRACTION = 2 / 3
export const CROSS_FRAME_MIN_CONFIDENCE = 0.95

export function normalizeTranscription(value) {
  const text = String(value ?? '').replace(/\D/g, '')
  return text.length <= 4 ? text : ''
}

export function retainTopCaptureCandidates(current, candidate, limit = 3) {
  const keepCount = Math.max(0, Number(limit) || 0)
  const ranked = [...(Array.isArray(current) ? current : []), candidate]
    .filter(Boolean)
    .sort((a, b) => Number(b?.score || 0) - Number(a?.score || 0))
  return {
    retained: ranked.slice(0, keepCount),
    discarded: ranked.slice(keepCount),
  }
}

function finiteProbability(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.max(0, Math.min(1, number))
}

export function crossFrameConsensus(reads = []) {
  const usable = reads
    .map((item, index) => ({
      frameIndex: Number.isFinite(Number(item?.frameIndex)) ? Number(item.frameIndex) : index,
      text: normalizeTranscription(item?.text ?? item?.read),
      confidence: finiteProbability(item?.confidence ?? item?.minTokenProbability),
    }))
    .filter((item) => item.text)
  if (!usable.length) return null

  const groups = new Map()
  for (const item of usable) {
    if (!groups.has(item.text)) groups.set(item.text, [])
    groups.get(item.text).push(item)
  }
  const ranked = [...groups.entries()]
    .map(([text, items]) => ({
      text,
      count: items.length,
      fraction: items.length / usable.length,
      minConfidence: Math.min(...items.map((item) => item.confidence)),
      meanConfidence: items.reduce((sum, item) => sum + item.confidence, 0) / items.length,
      frameIndices: items.map((item) => item.frameIndex),
    }))
    .sort((a, b) => b.count - a.count || b.minConfidence - a.minConfidence || b.meanConfidence - a.meanConfidence)
  const best = ranked[0]
  const tied = ranked.length > 1 && ranked[1].count === best.count
  return {
    ...best,
    usableFrameCount: usable.length,
    tied,
    strong:
      !tied &&
      best.count >= CROSS_FRAME_MIN_AGREEING_FRAMES &&
      best.fraction >= CROSS_FRAME_MIN_AGREEMENT_FRACTION &&
      best.minConfidence >= CROSS_FRAME_MIN_CONFIDENCE,
  }
}

function addChoice(choices, seen, text, source, metadata = {}) {
  const normalized = normalizeTranscription(text)
  if (!normalized || seen.has(normalized)) return
  seen.add(normalized)
  choices.push({ text: normalized, source, ...metadata })
}

export function buildHybridAnswerDecision({
  currentText,
  currentNeedsReview = true,
  currentConfidence = null,
  wholeAnswer = null,
  builtInSuggestion = null,
  frameReads = [],
} = {}) {
  const current = normalizeTranscription(currentText)
  const whole = normalizeTranscription(wholeAnswer?.text ?? wholeAnswer?.read)
  const wholeProbability = finiteProbability(
    wholeAnswer?.minTokenProbability ?? wholeAnswer?.confidence
  )
  const builtIn = normalizeTranscription(builtInSuggestion?.text ?? builtInSuggestion)
  const frameConsensus = crossFrameConsensus(frameReads)
  const choices = []
  const seen = new Set()

  // The direct browser OCR is always first and is never silently displaced.
  addChoice(choices, seen, current, 'current-browser-ocr', {
    confidence: finiteProbability(currentConfidence),
  })
  addChoice(choices, seen, whole, 'key-blind-whole-answer-model', {
    confidence: wholeProbability,
    reviewOnly: true,
  })
  if (frameConsensus?.strong) {
    addChoice(choices, seen, frameConsensus.text, 'cross-frame-consensus', {
      confidence: frameConsensus.minConfidence,
      agreeingFrames: frameConsensus.count,
      usableFrames: frameConsensus.usableFrameCount,
      reviewOnly: true,
    })
  }
  addChoice(choices, seen, builtIn, 'current-ocr-alternative', { reviewOnly: true })

  const independentWholeAgreement = Boolean(
    whole &&
    frameConsensus?.strong &&
    whole === frameConsensus.text
  )
  const shadowPromotionEligible = Boolean(
    currentNeedsReview &&
    whole &&
    wholeProbability >= WHOLE_ANSWER_SHADOW_MIN_PROBABILITY &&
    independentWholeAgreement
  )

  return {
    policyVersion: HYBRID_POLICY_VERSION,
    currentText: current,
    currentNeedsReview: Boolean(currentNeedsReview),
    choices,
    frameConsensus,
    shadowPromotionEligible,
    shadowPromotionText: shadowPromotionEligible ? whole : null,
    automaticText: currentNeedsReview ? null : current,
    requiresTeacherReview: Boolean(currentNeedsReview),
    answerKeyUsed: false,
  }
}
