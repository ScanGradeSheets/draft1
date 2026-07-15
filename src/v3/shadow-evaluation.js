import { crossFrameConsensus } from '../hybrid-recognition.js'
import { decideV3Answer } from './decision-policy.js'

function answerText(predictions) {
  const text = (predictions || [])
    .filter((prediction) => prediction?.blank !== true && prediction?.empty !== true)
    .map((prediction) => prediction?.digit)
    .filter((digit) => digit !== null && digit !== undefined && digit !== '')
    .join('')
  return text || 'blank'
}

export function groupReadsByQuestion(reads = []) {
  const grouped = new Map()
  for (const item of reads || []) {
    const questionNum = Number(item?.questionNum)
    if (!Number.isFinite(questionNum)) continue
    if (!grouped.has(questionNum)) grouped.set(questionNum, [])
    grouped.get(questionNum).push(item)
  }
  return grouped
}

export function representativeFrameRead(items, readField = 'text', confidenceField = 'minTokenProbability') {
  const usable = (items || []).filter((item) => /^\d{1,4}$/.test(String(item?.[readField] ?? '')))
  if (!usable.length) return { consensus: null, item: null }
  const consensus = crossFrameConsensus(usable.map((item) => ({
    frameIndex: item.frameIndex,
    text: item[readField],
    confidence: item[confidenceField],
  })))
  const matching = consensus?.text
    ? usable.filter((item) => String(item[readField]) === consensus.text)
    : usable
  const item = [...matching].sort((a, b) => Number(b?.[confidenceField] || 0) - Number(a?.[confidenceField] || 0))[0]
  return { consensus, item }
}

/** Build key-blind all-answer shadow decisions without accessing answer keys. */
export function buildV3ShadowDecisions({
  questionGroups = [],
  predictions = [],
  sequenceReads = [],
  compactReads = [],
  zones = [],
  requireCompact = false,
} = {}) {
  const forbidden = questionGroups.some((group) => (
    'answerKey' in (group || {}) || 'expectedAnswer' in (group || {}) || 'mathematicalAnswer' in (group || {})
  ))
  if (forbidden) throw new Error('answer-key fields are forbidden in V3 shadow evaluation')
  const sequenceByQuestion = groupReadsByQuestion(sequenceReads)
  const compactByQuestion = groupReadsByQuestion(compactReads)
  const predictionsById = new Map(predictions.map((prediction) => [prediction.id, prediction]))
  const zonesByQuestion = new Map(zones.map((zone) => [Number(zone.questionNum), zone]))

  return questionGroups.map((group, index) => {
    const questionNum = Number(group?.question_num ?? index + 1)
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const groupPredictions = ids.map((id) => predictionsById.get(id)).filter(Boolean)
    const slotRead = answerText(groupPredictions)
    const sequenceRepresentative = representativeFrameRead(
      sequenceByQuestion.get(questionNum) || [], 'text', 'minTokenProbability'
    )
    const compactRepresentative = representativeFrameRead(
      compactByQuestion.get(questionNum) || [], 'read', 'minComponentProbability'
    )
    const sequence = sequenceRepresentative.item
    const compact = compactRepresentative.item
    const zone = zonesByQuestion.get(questionNum)
    const decision = decideV3Answer({
      slot: {
        read: slotRead === 'blank' ? '' : slotRead,
        confidence: groupPredictions.length
          ? Math.min(...groupPredictions.map((item) => Number(item.confidence || 0)))
          : 0,
      },
      sequence: sequence ? { read: sequence.text, confidence: sequence.minTokenProbability } : null,
      compact: compact ? { read: compact.read, confidence: compact.minComponentProbability } : null,
      blank: {
        isBlank: zone?.blankArtifact?.isBlankCandidate === true,
        confidence: Number(zone?.blankArtifact?.blankConfidence || 0),
      },
      quality: {
        usable: !!zone?.quality && zone.quality.contrastRange >= 3,
        artifactProbability: Number(zone?.blankArtifact?.artifactProbability || 0),
      },
    }, { requireCompact })
    return {
      questionNum,
      slotRead,
      sequenceRead: sequence?.text || null,
      compactRead: compact?.read || null,
      sequenceFrameConsensus: sequenceRepresentative.consensus,
      compactFrameConsensus: compactRepresentative.consensus,
      decision,
    }
  })
}
