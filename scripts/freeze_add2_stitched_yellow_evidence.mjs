import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const reportsDir = path.join(root, 'private-evidence', 'reports')
const outputPath = process.argv[2] || path.join(
  reportsDir,
  'add2-stitched-yellow-min-0999-evidence-20260815.json',
)
const layoutId = 'sg-g1-lw-02-add-2digit'
const threshold = 0.999
const repeatedTruth = ['11', '12', '15', '16', '14', '16', '18', '17']

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
}

function summarize(rows) {
  const selected = rows.filter((row) => Number(row.probability) >= threshold)
  const errors = selected.filter((row) => row.read !== row.truth)
  return {
    scoredRows: rows.length,
    selected: selected.length,
    correct: selected.length - errors.length,
    confidentErrors: errors.length,
    unselected: rows.length - selected.length,
    errorIds: errors.map((row) => row.id),
  }
}

const frontierPath = path.join(reportsDir, 'current-live-candidate-frontier-20260815.json')
const historicalPath = path.join(reportsDir, 'historical-row-yellow-stitched-webkit-20260815.json')
const recentNames = fs.readdirSync(reportsDir)
  .filter((name) => name.startsWith('recent-add2-exact-stitched-') && name.endsWith('-20260815.json'))
  .concat('iphone16-public-capture-exact-saved-strong-views-20260815.json')
  .sort()

const frontier = readJson(frontierPath)
const canonicalRows = frontier.rows
  .filter((row) => row.layoutId === layoutId && row.integrated?.automatic !== true)
  .filter((row) => row.readerEvidence?.stitched)
  .map((row) => ({
    id: row.uid,
    read: String(row.readerEvidence.stitched.read || ''),
    truth: String(row.truthText || ''),
    probability: Number(row.readerEvidence.stitched.minTokenProbability) || 0,
  }))

const historical = readJson(historicalPath)
const historicalRows = historical.rows
  .filter((row) => row.layoutId === layoutId)
  .map((row) => ({
    id: row.id,
    read: String(row.read || ''),
    truth: String(row.truth || ''),
    probability: Number(row.minTokenProbability) || 0,
  }))

const recentRows = recentNames.flatMap((name) => {
  const report = readJson(path.join(reportsDir, name))
  return (report.views?.stitched?.results || []).map((row) => ({
    id: `${name}|${row.questionNum}`,
    read: String(row.text || ''),
    truth: repeatedTruth[Number(row.questionNum) - 1] || '',
    probability: Number(row.minTokenProbability) || 0,
  }))
})

const latestKnownYellowQuestions = new Set([2, 3, 4, 7, 8])
const latestName = 'iphone16-public-capture-exact-saved-strong-views-20260815.json'
const latestReport = readJson(path.join(reportsDir, latestName))
const latestKnownYellowRows = (latestReport.views?.stitched?.results || [])
  .filter((row) => latestKnownYellowQuestions.has(Number(row.questionNum)))
  .map((row) => ({
    id: `${latestName}|${row.questionNum}`,
    read: String(row.text || ''),
    truth: repeatedTruth[Number(row.questionNum) - 1] || '',
    probability: Number(row.minTokenProbability) || 0,
  }))

const sources = [frontierPath, historicalPath, ...recentNames.map((name) => path.join(reportsDir, name))]
const cohorts = {
  canonical345IntegratedYellows: summarize(canonicalRows),
  historicalSavedYellowCaptures: summarize(historicalRows),
  recentRepeatedIphoneStitchedReads: summarize(recentRows),
  latestPhysicalKnownYellows: summarize(latestKnownYellowRows),
}
const independentCohortNames = [
  'canonical345IntegratedYellows',
  'historicalSavedYellowCaptures',
  'recentRepeatedIphoneStitchedReads',
]
const allSelected = independentCohortNames.reduce((sum, name) => sum + cohorts[name].selected, 0)
const allErrors = independentCohortNames.reduce((sum, name) => sum + cohorts[name].confidentErrors, 0)
const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policyStatus: 'retrospective-private-candidate-not-public-deployment-authority',
  policy: {
    name: 'add2-original-yellow-single-stitched-min-0.999',
    layoutId,
    originalYellowOnly: true,
    acceptedBrowserAnswersChanged: false,
    cropVariant: 'stitched-original-grayscale',
    minTokenProbability: threshold,
    answerKeyProvidedToRecognizer: false,
    truthProvidedToRecognizer: false,
  },
  integrity: {
    sealedPacketsUsed: false,
    truthJoinedOnlyAfterSavedPredictions: true,
    sourceFiles: sources.map((file) => ({
      path: path.relative(root, file),
      sha256: sha256(file),
    })),
  },
  cohorts,
  combinedCohorts: independentCohortNames,
  combinedSelectedObservations: allSelected,
  combinedCorrectObservations: allSelected - allErrors,
  combinedConfidentErrorObservations: allErrors,
  knownBlockedCounterexample: {
    id: 'P05|sg-g1-lw-02-add-2digit|7',
    truth: '18',
    replayRead: '14',
    minTokenProbability: 0.9982894306555333,
    selectedAt099: true,
    selectedAt0999: false,
  },
  limitations: [
    'Retrospective evidence is not a substitute for prospective physical qualification.',
    'Recent iPhone captures repeat one writer and one already-opened sheet.',
    'Cohorts can overlap historically; combined values count observations, not unique answers.',
    'The 0.999 boundary must not be relaxed without rerunning this falsification set.',
  ],
}

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`)
console.log(JSON.stringify({ outputPath, cohorts, combinedSelectedObservations: allSelected, combinedConfidentErrorObservations: allErrors }, null, 2))
