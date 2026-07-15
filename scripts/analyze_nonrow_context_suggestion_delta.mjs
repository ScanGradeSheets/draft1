import fs from 'node:fs'

const [basePath, candidatePath] = process.argv.slice(2)

if (!basePath || !candidatePath) {
  console.error('Usage: node scripts/analyze_nonrow_context_suggestion_delta.mjs <base-summary.json> <candidate-summary.json>')
  process.exit(1)
}

const readJson = (path) => JSON.parse(fs.readFileSync(path, 'utf8'))
const base = readJson(basePath)
const candidate = readJson(candidatePath)
const baseByKey = new Map((base.items || []).map((item) => [item.key, item]))

function getReplayDetails(item) {
  if (!item.replayFile || !fs.existsSync(item.replayFile)) return []
  const replay = readJson(item.replayFile)
  const questionNum = Number(item.questionLabel)
  return (replay.predictionDetails || [])
    .filter((detail) => Number(detail.questionNum) === questionNum)
    .map((detail) => {
      const votes = Array.isArray(detail.preprocessVoteSummary) ? detail.preprocessVoteSummary : []
      const topVotes = votes
        .slice()
        .sort((a, b) => (b.count || 0) - (a.count || 0))
        .slice(0, 3)
        .map((vote) => `${vote.digit}:${vote.count}`)
        .join(' ')
      const topK = (detail.preprocessVariants?.[0]?.topK || detail.baseTopK || [])
        .slice(0, 3)
        .map((entry) => `${entry.digit}:${Number(entry.confidence).toFixed(3)}`)
        .join(' ')
      return {
        slot: detail.digitIndex,
        digit: detail.digit,
        confidence: Number(detail.confidence || 0).toFixed(3),
        topGap: Number(detail.topGap || 0).toFixed(3),
        reviewNeeded: detail.reviewNeeded,
        reason: detail.preprocessReviewReason || '',
        topVotes,
        topK
      }
    })
}

const added = (candidate.items || []).filter((item) => {
  const baseItem = baseByKey.get(item.key)
  return item.suggestionText && !baseItem?.suggestionText
})

const totals = {
  added: added.length,
  correct: added.filter((item) => item.suggestionCorrect).length,
  wrong: added.filter((item) => item.suggestionCorrect === false).length
}

const byLayout = new Map()
for (const item of added) {
  const bucket = byLayout.get(item.layoutId) || { added: 0, correct: 0, wrong: 0 }
  bucket.added += 1
  if (item.suggestionCorrect) bucket.correct += 1
  else bucket.wrong += 1
  byLayout.set(item.layoutId, bucket)
}

console.log(JSON.stringify({
  basePolicy: base.policy,
  candidatePolicy: candidate.policy,
  totals,
  byLayout: Object.fromEntries(byLayout),
  added: added.map((item) => ({
    key: item.key,
    layoutId: item.layoutId,
    questionLabel: item.questionLabel,
    expected: item.expected,
    truth: item.truth,
    current: item.current,
    suggestion: item.suggestionText,
    suggestionCorrect: item.suggestionCorrect,
    suggestionConfidence: item.suggestionConfidence,
    suggestionSource: item.suggestionSource,
    replayDetails: getReplayDetails(item)
  }))
}, null, 2))
