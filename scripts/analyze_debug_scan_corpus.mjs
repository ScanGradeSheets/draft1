#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DEFAULT_ROOT = path.join(ROOT, 'private-evidence', 'debug-scans')
const DEFAULT_OUT_DIR = path.join(ROOT, 'private-evidence', 'reports')

function parseArgs(argv) {
  const opts = {
    root: DEFAULT_ROOT,
    outDir: DEFAULT_OUT_DIR,
    includeAll: false,
    maxExamples: 8
  }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--root') {
      opts.root = path.resolve(argv[++i])
    } else if (arg === '--out-dir') {
      opts.outDir = path.resolve(argv[++i])
    } else if (arg === '--all') {
      opts.includeAll = true
    } else if (arg === '--max-examples') {
      opts.maxExamples = Number(argv[++i]) || opts.maxExamples
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return opts
}

async function walk(dir) {
  const out = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walk(file))
    else out.push(file)
  }
  return out
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

function addCount(map, key, by = 1) {
  map.set(key, (map.get(key) || 0) + by)
}

function topEntries(map, limit = 8) {
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .slice(0, limit)
}

function pct(num, den) {
  return den ? `${((num / den) * 100).toFixed(1)}%` : 'n/a'
}

function plain(value) {
  if (value == null) return ''
  return String(value)
}

function layoutFromDebug(debug, summary, file) {
  return debug?.layoutId ||
    debug?.qrPayload?.layout_id ||
    debug?.qrPayload?.template_id ||
    summary?.layoutId ||
    summary?.templateId ||
    path.basename(path.dirname(file)).replace(/^\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}-\d{3}-/, '')
}

function isClassroomLayout(layoutId) {
  return /^sg-g1-lw-/.test(layoutId) || layoutId === 'g2-mixed-within-50-v1'
}

function predictionQuestionNum(prediction) {
  const questionNum = Number(prediction?.questionNum)
  if (Number.isInteger(questionNum) && questionNum > 0) return questionNum
  const id = Number(prediction?.id)
  return Number.isInteger(id) ? Math.floor(id / 2) + 1 : null
}

function predictionDigitIndex(prediction) {
  const digitIndex = Number(prediction?.digitIndex)
  if (Number.isInteger(digitIndex)) return digitIndex
  const id = Number(prediction?.id)
  return Number.isInteger(id) ? id % 2 : 0
}

function predictionsByQuestion(predictions) {
  const map = new Map()
  for (const prediction of predictions || []) {
    const questionNum = predictionQuestionNum(prediction)
    if (!Number.isInteger(questionNum)) continue
    if (!map.has(questionNum)) map.set(questionNum, [])
    map.get(questionNum).push(prediction)
  }
  for (const rows of map.values()) {
    rows.sort((a, b) => predictionDigitIndex(a) - predictionDigitIndex(b))
  }
  return map
}

function expectedSlotsForGroup(group) {
  const ids = Array.isArray(group?.digitBoxIds) ? group.digitBoxIds : []
  const answerText = group?.answer == null ? '' : String(group.answer).replace(/\D/g, '')
  const digits = answerText.split('')
  const blanks = Math.max(0, ids.length - digits.length)
  return [...Array(blanks).fill(null), ...digits].slice(-ids.length)
}

function reviewReason(prediction) {
  return prediction?.preprocessReviewReason ||
    prediction?.forcedReviewReason ||
    prediction?.confidencePolicyClearanceReason ||
    prediction?.robustOverride ||
    (prediction?.reviewNeeded ? 'review-without-recorded-reason' : '')
}

function pathForDisplay(file) {
  return path.relative(ROOT, file)
}

function makeBucket(layoutId) {
  return {
    layoutId,
    scans: 0,
    noGradeScans: 0,
    questions: 0,
    answerKeyCorrect: 0,
    reviewed: 0,
    autoGraded: 0,
    autoAnswerKeyWrong: 0,
    allAnswerKeyWrong: 0,
    digitPredictions: 0,
    reviewedDigits: 0,
    optionalBlankOverrides: 0,
    unusableTwoDigitScans: 0,
    twoDigitCropFailures: 0,
    twoDigitRecognitionFailures: 0,
    digitEngineFallbacks: 0,
    reviewReasons: new Map(),
    slotStats: new Map(),
    mismatchPairs: new Map(),
    examples: {
      autoAnswerKeyWrong: [],
      reviewedAnswerKeyWrong: [],
      unusable: [],
      noGrade: []
    }
  }
}

function addExample(list, item, limit) {
  if (list.length < limit) list.push(item)
}

async function analyze(opts) {
  const files = (await walk(opts.root)).filter((file) => file.endsWith('/debug.json')).sort()
  const buckets = new Map()
  const corpus = {
    generatedAt: new Date().toISOString(),
    root: opts.root,
    filesSeen: files.length,
    scans: 0,
    classroomScans: 0,
    markedSheets: 0,
    layoutCounts: new Map(),
    reviewReasons: new Map(),
    mismatchPairs: new Map(),
    rows: []
  }

  for (const file of files) {
    const outer = await readJson(file)
    const debug = outer.debug || outer
    const summaryPath = path.join(path.dirname(file), 'summary.json')
    let summary = null
    try {
      summary = await readJson(summaryPath)
    } catch {
      summary = null
    }
    const layoutId = layoutFromDebug(debug, summary, file)
    if (!opts.includeAll && !isClassroomLayout(layoutId)) continue

    corpus.scans += 1
    if (isClassroomLayout(layoutId)) corpus.classroomScans += 1
    addCount(corpus.layoutCounts, layoutId)

    try {
      await fs.access(path.join(path.dirname(file), 'marked-sheet.jpg'))
      corpus.markedSheets += 1
    } catch {
      // Not every early debug upload includes a marked sheet.
    }

    if (!buckets.has(layoutId)) buckets.set(layoutId, makeBucket(layoutId))
    const bucket = buckets.get(layoutId)
    bucket.scans += 1

    const groups = Array.isArray(debug.answerGroups) ? debug.answerGroups : []
    const predictions = Array.isArray(debug.predictions) ? debug.predictions : []
    const groupedPredictions = predictionsByQuestion(predictions)
    const optionalOverrides = Array.isArray(debug.optionalSingleDigitBlankOverrides)
      ? debug.optionalSingleDigitBlankOverrides.length
      : 0

    if (!groups.length) {
      bucket.noGradeScans += 1
      addExample(bucket.examples.noGrade, pathForDisplay(file), opts.maxExamples)
    }

    if (debug.digitEngineFallback) bucket.digitEngineFallbacks += 1
    if (debug.unusableTwoDigitScan) {
      bucket.unusableTwoDigitScans += 1
      addExample(bucket.examples.unusable, pathForDisplay(file), opts.maxExamples)
    }
    if (debug.twoDigitCropFailure) bucket.twoDigitCropFailures += 1
    if (debug.twoDigitRecognitionFailure) bucket.twoDigitRecognitionFailures += 1
    bucket.optionalBlankOverrides += optionalOverrides

    let scanAnswerKeyCorrect = 0
    let scanReviewed = 0
    let scanAutoWrong = 0

    for (const group of groups) {
      const questionNum = Number(group?.questionNum)
      const groupPredictions = groupedPredictions.get(questionNum) || []
      const correct = group?.correct === true
      const reviewNeeded = group?.reviewNeeded === true || groupPredictions.some((prediction) => prediction?.reviewNeeded === true)

      bucket.questions += 1
      if (correct) {
        bucket.answerKeyCorrect += 1
        scanAnswerKeyCorrect += 1
      } else {
        bucket.allAnswerKeyWrong += 1
      }
      if (reviewNeeded) {
        bucket.reviewed += 1
        scanReviewed += 1
        if (!correct) addExample(bucket.examples.reviewedAnswerKeyWrong, `${pathForDisplay(file)} q${questionNum} ${group?.answerText || ''}->${group?.answer}`, opts.maxExamples)
      } else {
        bucket.autoGraded += 1
        if (!correct) {
          bucket.autoAnswerKeyWrong += 1
          scanAutoWrong += 1
          addExample(bucket.examples.autoAnswerKeyWrong, `${pathForDisplay(file)} q${questionNum} ${group?.answerText || ''}->${group?.answer}`, opts.maxExamples)
        }
      }

      const expectedSlots = expectedSlotsForGroup(group)
      const ids = Array.isArray(group?.digitBoxIds) ? group.digitBoxIds : []
      for (let slotIndex = 0; slotIndex < ids.length; slotIndex += 1) {
        const prediction = predictions.find((candidate) => Number(candidate?.id) === Number(ids[slotIndex]))
        if (!prediction) continue
        const slotKey = ids.length === 1 ? 'single' : slotIndex === 0 ? 'left' : slotIndex === ids.length - 1 ? 'right' : `slot-${slotIndex}`
        if (!bucket.slotStats.has(slotKey)) {
          bucket.slotStats.set(slotKey, { total: 0, reviewed: 0, expectedMismatch: 0, optionalUnexpectedDigit: 0 })
        }
        const slot = bucket.slotStats.get(slotKey)
        const expectedDigit = expectedSlots[slotIndex]
        const predictedDigit = prediction?.digit == null ? '' : String(prediction.digit)
        const digitReviewed = prediction?.reviewNeeded === true || group?.slotStatuses?.[slotIndex] === 'review'
        slot.total += 1
        bucket.digitPredictions += 1
        if (digitReviewed) {
          slot.reviewed += 1
          bucket.reviewedDigits += 1
        }
        if (expectedDigit == null) {
          if (predictedDigit !== '') slot.optionalUnexpectedDigit += 1
        } else if (predictedDigit !== String(expectedDigit)) {
          slot.expectedMismatch += 1
          const pair = `${slotKey} ${expectedDigit}->${predictedDigit || '_'}`
          addCount(bucket.mismatchPairs, pair)
          addCount(corpus.mismatchPairs, pair)
        }
      }
    }

    for (const prediction of predictions) {
      const reason = reviewReason(prediction)
      if (prediction?.reviewNeeded === true && reason) {
        addCount(bucket.reviewReasons, reason)
        addCount(corpus.reviewReasons, reason)
      }
    }

    corpus.rows.push({
      file: pathForDisplay(file),
      layoutId,
      questions: groups.length,
      answerKeyCorrect: scanAnswerKeyCorrect,
      reviewed: scanReviewed,
      autoAnswerKeyWrong: scanAutoWrong,
      optionalOverrides,
      unusableTwoDigitScan: Boolean(debug.unusableTwoDigitScan),
      digitEngineFallback: Boolean(debug.digitEngineFallback),
      markedSheet: await fs.access(path.join(path.dirname(file), 'marked-sheet.jpg')).then(() => true, () => false)
    })
  }

  return { corpus, buckets: Array.from(buckets.values()).sort((a, b) => a.layoutId.localeCompare(b.layoutId)) }
}

function serialBucket(bucket) {
  return {
    ...bucket,
    reviewReasons: Object.fromEntries(topEntries(bucket.reviewReasons, 20)),
    slotStats: Object.fromEntries(Array.from(bucket.slotStats.entries())),
    mismatchPairs: Object.fromEntries(topEntries(bucket.mismatchPairs, 20))
  }
}

function markdownReport(analysis) {
  const lines = []
  const { corpus, buckets } = analysis
  const totals = buckets.reduce((acc, bucket) => {
    acc.questions += bucket.questions
    acc.answerKeyCorrect += bucket.answerKeyCorrect
    acc.reviewed += bucket.reviewed
    acc.autoGraded += bucket.autoGraded
    acc.autoAnswerKeyWrong += bucket.autoAnswerKeyWrong
    acc.digitPredictions += bucket.digitPredictions
    acc.reviewedDigits += bucket.reviewedDigits
    acc.unusableTwoDigitScans += bucket.unusableTwoDigitScans
    acc.noGradeScans += bucket.noGradeScans
    return acc
  }, {
    questions: 0,
    answerKeyCorrect: 0,
    reviewed: 0,
    autoGraded: 0,
    autoAnswerKeyWrong: 0,
    digitPredictions: 0,
    reviewedDigits: 0,
    unusableTwoDigitScans: 0,
    noGradeScans: 0
  })

  lines.push('# ScanGrade Debug Scan Corpus Report')
  lines.push('')
  lines.push(`Generated: ${corpus.generatedAt}`)
  lines.push(`Root: \`${corpus.root}\``)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(`- Debug scans analyzed: ${corpus.scans}`)
  lines.push(`- Classroom-layout scans: ${corpus.classroomScans}`)
  lines.push(`- Marked-sheet screenshots available: ${corpus.markedSheets}/${corpus.scans}`)
  lines.push(`- Questions with app output: ${totals.questions}`)
  lines.push(`- Answer-key correctness: ${totals.answerKeyCorrect}/${totals.questions} (${pct(totals.answerKeyCorrect, totals.questions)})`)
  lines.push(`- Questions routed to review: ${totals.reviewed}/${totals.questions} (${pct(totals.reviewed, totals.questions)})`)
  lines.push(`- Auto-graded questions: ${totals.autoGraded}/${totals.questions} (${pct(totals.autoGraded, totals.questions)})`)
  lines.push(`- Auto-graded but answer-key-wrong: ${totals.autoAnswerKeyWrong}/${totals.questions} (${pct(totals.autoAnswerKeyWrong, totals.questions)})`)
  lines.push(`- Unusable two-digit scan guards: ${totals.unusableTwoDigitScans}`)
  lines.push(`- No-grade/debug-only scans: ${totals.noGradeScans}`)
  lines.push('')
  lines.push('Answer-key-wrong is not the same as OCR-wrong: students sometimes wrote incorrect math answers. Use this report for pattern finding, then verify suspected OCR failures visually.')
  lines.push('')
  lines.push('## By Layout')
  lines.push('')
  lines.push('| Layout | Scans | Questions | Answer-key correct | Review | Auto | Auto key-wrong | Unusable | No grade |')
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |')
  for (const bucket of buckets) {
    lines.push(`| ${bucket.layoutId} | ${bucket.scans} | ${bucket.questions} | ${bucket.answerKeyCorrect}/${bucket.questions} (${pct(bucket.answerKeyCorrect, bucket.questions)}) | ${bucket.reviewed}/${bucket.questions} (${pct(bucket.reviewed, bucket.questions)}) | ${bucket.autoGraded}/${bucket.questions} (${pct(bucket.autoGraded, bucket.questions)}) | ${bucket.autoAnswerKeyWrong} | ${bucket.unusableTwoDigitScans} | ${bucket.noGradeScans} |`)
  }
  lines.push('')
  lines.push('## Slot Position')
  lines.push('')
  lines.push('| Layout | Slot | Digits | Reviewed | Expected mismatch | Optional slot saw digit |')
  lines.push('| --- | --- | ---: | ---: | ---: | ---: |')
  for (const bucket of buckets) {
    for (const [slotKey, slot] of Array.from(bucket.slotStats.entries()).sort()) {
      lines.push(`| ${bucket.layoutId} | ${slotKey} | ${slot.total} | ${slot.reviewed} (${pct(slot.reviewed, slot.total)}) | ${slot.expectedMismatch} | ${slot.optionalUnexpectedDigit} |`)
    }
  }
  lines.push('')
  lines.push('## Top Review Reasons')
  lines.push('')
  for (const [reason, count] of topEntries(corpus.reviewReasons, 20)) {
    lines.push(`- ${reason}: ${count}`)
  }
  lines.push('')
  lines.push('## Top Answer-Key Mismatch Pairs')
  lines.push('')
  for (const [pair, count] of topEntries(corpus.mismatchPairs, 20)) {
    lines.push(`- ${pair}: ${count}`)
  }
  lines.push('')
  lines.push('## Examples To Inspect')
  lines.push('')
  for (const bucket of buckets) {
    const exampleLines = []
    if (bucket.examples.autoAnswerKeyWrong.length) {
      exampleLines.push(`auto key-wrong: ${bucket.examples.autoAnswerKeyWrong.join('; ')}`)
    }
    if (bucket.examples.unusable.length) {
      exampleLines.push(`unusable: ${bucket.examples.unusable.join('; ')}`)
    }
    if (bucket.examples.noGrade.length) {
      exampleLines.push(`no grade: ${bucket.examples.noGrade.join('; ')}`)
    }
    if (exampleLines.length) {
      lines.push(`### ${bucket.layoutId}`)
      lines.push('')
      for (const line of exampleLines) lines.push(`- ${line}`)
      lines.push('')
    }
  }
  return `${lines.join('\n')}\n`
}

const opts = parseArgs(process.argv.slice(2))
const analysis = await analyze(opts)
await fs.mkdir(opts.outDir, { recursive: true })
const jsonPath = path.join(opts.outDir, 'debug-scan-corpus-report.json')
const mdPath = path.join(opts.outDir, 'debug-scan-corpus-report.md')
await fs.writeFile(jsonPath, JSON.stringify({
  corpus: {
    ...analysis.corpus,
    layoutCounts: Object.fromEntries(analysis.corpus.layoutCounts),
    reviewReasons: Object.fromEntries(topEntries(analysis.corpus.reviewReasons, 50)),
    mismatchPairs: Object.fromEntries(topEntries(analysis.corpus.mismatchPairs, 50))
  },
  buckets: analysis.buckets.map(serialBucket)
}, null, 2))
await fs.writeFile(mdPath, markdownReport(analysis))
console.log(`Wrote ${path.relative(ROOT, mdPath)}`)
console.log(`Wrote ${path.relative(ROOT, jsonPath)}`)
console.log('')
console.log(markdownReport(analysis).split('\n').slice(0, 42).join('\n'))
