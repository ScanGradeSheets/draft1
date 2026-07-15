export const AMBIGUITY_POLICY_VERSION = 'answer-ambiguity-shadow-1'
export const AMBIGUITY_MAX_SELECTED_CONFIDENCE = 0.50
export const AMBIGUITY_MIN_RIVAL_PROBABILITY = 0.25
export const AMBIGUITY_MAX_TOP_GAP = 0.20
export const AMBIGUITY_MIN_ENTROPY = 0.70

function finalDigit(prediction) {
  if (prediction?.blank === true || prediction?.empty === true || prediction?.digit == null) return null
  const digit = Number(prediction.digit)
  return Number.isInteger(digit) ? digit : null
}

function materialRival(prediction) {
  const selected = finalDigit(prediction)
  const topK = Array.isArray(prediction?.topK) ? prediction.topK : []
  return topK.find((choice) => Number(choice?.digit) !== selected)
}

/**
 * Key-blind ambiguity signals that are allowed to force review but never to
 * choose a transcription. The first rule targets a narrow failure shape:
 * acceptance depended on an override even though the selected class remained
 * weak, a rival class was material, the gap was small, and entropy was high.
 */
export function detectAnswerAmbiguity({
  predictions = [],
  modelFamilyReads = [],
  cropQuality = null,
} = {}) {
  const reasons = []
  for (const prediction of predictions || []) {
    const selected = finalDigit(prediction)
    const rival = materialRival(prediction)
    const overrideAccepted = Boolean(
      prediction?.confidencePolicyCleared === true ||
      (prediction?.robustOverride && prediction.robustOverride !== 'box-safe-default')
    )
    if (
      selected != null &&
      overrideAccepted &&
      Number(prediction?.confidence || 0) < AMBIGUITY_MAX_SELECTED_CONFIDENCE &&
      Number(rival?.confidence || 0) >= AMBIGUITY_MIN_RIVAL_PROBABILITY &&
      Number(prediction?.topGap || 0) < AMBIGUITY_MAX_TOP_GAP &&
      Number(prediction?.entropyNorm || 0) >= AMBIGUITY_MIN_ENTROPY
    ) {
      reasons.push({
        reason: 'override-retained-material-rival',
        predictionId: prediction?.id,
        digitIndex: Number(prediction?.digitIndex),
        selectedDigit: selected,
        selectedConfidence: Number(prediction?.confidence || 0),
        rivalDigit: Number(rival?.digit),
        rivalProbability: Number(rival?.confidence || 0),
        topGap: Number(prediction?.topGap || 0),
        entropyNorm: Number(prediction?.entropyNorm || 0),
        robustOverride: prediction?.robustOverride || null,
        confidencePolicyClearanceReason: prediction?.confidencePolicyClearanceReason || null,
      })
    }
  }

  const normalizedFamilyReads = [...new Set((modelFamilyReads || [])
    .map((value) => String(value ?? '').replace(/\D/g, ''))
    .filter(Boolean))]
  if (normalizedFamilyReads.length > 1) {
    reasons.push({ reason: 'model-families-disagree', reads: normalizedFamilyReads })
  }
  if (cropQuality?.clipped === true || cropQuality?.inkTouchesCropEdge === true) {
    reasons.push({
      reason: 'answer-ink-may-be-clipped',
      clipped: cropQuality?.clipped === true,
      inkTouchesCropEdge: cropQuality?.inkTouchesCropEdge === true,
    })
  }

  return {
    policyVersion: AMBIGUITY_POLICY_VERSION,
    detected: reasons.length > 0,
    forcesReview: reasons.length > 0,
    answerKeyUsed: false,
    reasons,
  }
}
