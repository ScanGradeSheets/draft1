import { applyConsensusPromotionsToPredictions } from './consensus-application.js'

export function applyBrowserLocalCandidateToPredictions({
  questionGroups = [],
  predictions = [],
  decisions = [],
} = {}) {
  const demotionByQuestion = new Map((decisions || [])
    .filter((item) =>
      item?.initiallyAutomatic === true &&
      item?.decision?.automatic === false)
    .map((item) => [Number(item.questionNum), item]))
  const demoted = []
  let nextPredictions = (predictions || []).map((prediction) => {
    const item = demotionByQuestion.get(Number(prediction?.questionNum))
    if (!item) return { ...prediction }
    if (!demoted.some((row) => row.questionNum === Number(item.questionNum))) {
      demoted.push({
        questionNum: Number(item.questionNum),
        reason: item.decision.reason,
        preservedRead: String(item.currentRead || ''),
      })
    }
    return {
      ...prediction,
      reviewNeeded: true,
      browserLocalCandidateVeto: true,
      reviewReason: prediction?.reviewReason || item.decision.reason,
    }
  })

  const promotionDecisions = (decisions || [])
    .filter((item) => {
      if (item?.decision?.automatic !== true) return false
      if (item?.initiallyAutomatic === false) return true
      return (
        item?.decision?.preAcceptance === true &&
        String(item?.decision?.read || '') !== String(item?.currentRead || '')
      )
    })
    .map((item) => ({
      questionNum: Number(item.questionNum),
      promote: true,
      automaticText: item.decision.read,
      reason: item.decision.reason,
      policyVersion: item.initiallyAutomatic === true
        ? 'browser-local-pre-acceptance-replacement-1'
        : 'browser-local-strict-candidate-1',
      evidence: item.evidence || null,
    }))
  const promotion = applyConsensusPromotionsToPredictions({
    questionGroups,
    predictions: nextPredictions,
    decisions: promotionDecisions,
  })
  nextPredictions = promotion.predictions
  const replaced = promotion.applied.filter((applied) =>
    applied.policyVersion === 'browser-local-pre-acceptance-replacement-1')
  const promoted = promotion.applied.filter((applied) =>
    applied.policyVersion !== 'browser-local-pre-acceptance-replacement-1')
  return {
    predictions: nextPredictions,
    demoted,
    promoted,
    replaced,
    answerKeyUsed: false,
  }
}
