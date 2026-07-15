import { decideV3Answer } from './decision-policy.js'

/** Return local grading immediately and expose optional V3 work as a promise. */
export function startAsyncV3Shadow({ localResult, work, requestSequenceReads, answers, onComplete, onError }) {
  const shadow = Promise.resolve()
    .then(async () => {
      if (typeof work === 'function') return work()
      const sequenceReads = await requestSequenceReads(answers)
      const byId = new Map((sequenceReads || []).map((item) => [item.id, item]))
      return (answers || []).map((answer) => ({
        id: answer.id,
        decision: decideV3Answer({ slot: answer.slot, sequence: byId.get(answer.id), blank: answer.blank, quality: answer.quality }),
      }))
    })
    .then((result) => {
      onComplete?.(result)
      return result
    })
    .catch((error) => {
      onError?.(error)
      return []
    })
  return { localResult, shadow }
}
