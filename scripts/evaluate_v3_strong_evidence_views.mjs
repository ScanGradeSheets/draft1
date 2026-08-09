#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const manifestPath = path.resolve(ROOT, process.argv[2] || 'private-evidence/v3/strong-evidence-candidate5-20260717/manifest.json')
const outputPath = path.resolve(ROOT, process.argv[3] || 'private-evidence/reports/v3-strong-evidence-view-benchmark-20260717.json')
const teacherUrl = process.env.SG_TEACHER_URL || 'http://127.0.0.1:8771/recognize'
const teacherOrigin = process.env.SG_TEACHER_ORIGIN || ''
const batchSize = Math.max(1, Number(process.env.SG_TEACHER_BATCH || 24))
const defaultViews = ['continuous', 'continuousClean', 'context', 'stitched', 'stitchedClean']

function dataUrl(relative) {
  return `data:image/png;base64,${fs.readFileSync(path.resolve(ROOT, relative)).toString('base64')}`
}

function normalize(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function pct(numerator, denominator) {
  return denominator ? Number((100 * numerator / denominator).toFixed(1)) : 0
}

function summarize(rows, view) {
  const correct = rows.filter(row => row.reads[view]?.read === row.truth).length
  const highConfidence = rows.filter(row => Number(row.reads[view]?.minTokenProbability || 0) >= 0.995)
  const highConfidenceCorrect = highConfidence.filter(row => row.reads[view]?.read === row.truth).length
  return {
    total: rows.length,
    correct,
    accuracyPct: pct(correct, rows.length),
    highConfidence: highConfidence.length,
    highConfidenceCorrect,
    highConfidenceWrong: highConfidence.length - highConfidenceCorrect,
  }
}

function sliceSummaries(rows, view, field) {
  return Object.fromEntries([...new Set(rows.map(row => String(row[field])))].sort().map(value => [
    value,
    summarize(rows.filter(row => String(row[field]) === value), view),
  ]))
}

async function recognize(batch, view) {
  const payload = {
    items: batch.map(row => ({
      id: row.uid,
      questionNum: row.questionNum,
      imageDataUrl: dataUrl(row.paths[view]),
    })),
  }
  const response = await fetch(teacherUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(teacherOrigin ? { origin: teacherOrigin } : {}),
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`${teacherUrl}: HTTP ${response.status} ${await response.text()}`)
  return response.json()
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const answerKeyStored = manifest.answerKeyStoredInManifest ?? manifest.answerKeyStored
  if (answerKeyStored !== false || manifest.answerKeyProvidedToRecognizer !== false) {
    throw new Error('manifest must explicitly exclude answer keys')
  }
  const requestedViews = String(process.env.SG_VIEWS || '').split(',').map(value => value.trim()).filter(Boolean)
  const availableViews = Array.isArray(manifest.views) && manifest.views.length ? manifest.views : defaultViews
  const views = requestedViews.length ? requestedViews : availableViews
  const missingViews = views.filter(view => !availableViews.includes(view))
  if (missingViews.length) throw new Error(`unknown views: ${missingViews.join(', ')}`)
  const requestedUids = new Set(String(process.env.SG_UIDS || '').split(',').map(value => value.trim()).filter(Boolean))
  const selectedEntries = requestedUids.size
    ? manifest.entries.filter(row => requestedUids.has(String(row.uid)))
    : manifest.entries
  if (requestedUids.size && selectedEntries.length !== requestedUids.size) {
    throw new Error(`requested ${requestedUids.size} UIDs but found ${selectedEntries.length}`)
  }
  const rows = selectedEntries.map(row => ({
    uid: row.uid,
    packetId: row.packetId,
    captureId: row.captureId,
    layoutId: row.layoutId,
    layoutFamily: row.layoutFamily,
    questionNum: row.questionNum,
    split: row.split,
    truth: String(row.truth),
    answerLength: row.answerLength,
    slotCount: row.slotCount,
    candidate5Review: row.candidate5Review,
    candidate5Read: row.candidate5Read,
    candidate5DecisionReason: row.candidate5DecisionReason,
    paths: row.paths,
    sha256: row.sha256,
    quality: row.quality,
    reads: {},
  }))
  const timings = {}
  for (const view of views) {
    let serviceInferenceMs = 0
    const wallStarted = performance.now()
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize)
      const response = await recognize(batch, view)
      serviceInferenceMs += Number(response.inferenceMs || 0)
      const byId = new Map((response.results || []).map(result => [String(result.id), result]))
      for (const row of batch) {
        const result = byId.get(String(row.uid))
        if (!result) throw new Error(`missing ${view} result: ${row.uid}`)
        row.reads[view] = {
          read: normalize(result.read),
          rawRead: result.rawRead,
          minTokenProbability: Number(result.minTokenProbability || 0),
          meanTokenProbability: Number(result.meanTokenProbability || 0),
          correct: normalize(result.read) === row.truth,
        }
      }
      console.log(`${view} ${Math.min(offset + batch.length, rows.length)}/${rows.length}`)
    }
    timings[view] = {
      serviceInferenceMs: Number(serviceInferenceMs.toFixed(1)),
      wallMs: Number((performance.now() - wallStarted).toFixed(1)),
      averageServiceMsPerAnswer: Number((serviceInferenceMs / rows.length).toFixed(2)),
    }
  }

  for (const row of rows) {
    const counts = new Map()
    for (const view of views) {
      const read = row.reads[view].read
      if (read) counts.set(read, (counts.get(read) || 0) + 1)
    }
    row.multiView = {
      oracleCorrect: views.some(view => row.reads[view].correct),
      unanimousRead: new Set(views.map(view => row.reads[view].read)).size === 1 ? row.reads[views[0]].read : null,
      majorityRead: [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || null,
      majorityCount: Math.max(0, ...counts.values()),
    }
    row.multiView.majorityCorrect = row.multiView.majorityRead === row.truth
  }

  const byView = Object.fromEntries(views.map(view => {
    const yellow = rows.filter(row => row.candidate5Review)
    const numberBonds = rows.filter(row => row.layoutId === 'sg-g1-lw-08-number-bonds')
    return [view, {
      overall: summarize(rows, view),
      bySplit: sliceSummaries(rows, view, 'split'),
      byPacket: sliceSummaries(rows, view, 'packetId'),
      byLayoutFamily: sliceSummaries(rows, view, 'layoutFamily'),
      byAnswerLength: sliceSummaries(rows, view, 'answerLength'),
      bySlotCount: sliceSummaries(rows, view, 'slotCount'),
      candidate5Reviews: summarize(yellow, view),
      numberBonds: summarize(numberBonds, view),
      timing: timings[view],
    }]
  }))
  const baselineView = views.includes('continuous') ? 'continuous' : views[0]
  const continuousCorrect = new Set(rows.filter(row => row.reads[baselineView].correct).map(row => row.uid))
  const comparisonsToContinuous = Object.fromEntries(views.filter(view => view !== baselineView).map(view => {
    const correct = new Set(rows.filter(row => row.reads[view].correct).map(row => row.uid))
    return [view, {
      uniqueGains: [...correct].filter(uid => !continuousCorrect.has(uid)),
      uniqueLosses: [...continuousCorrect].filter(uid => !correct.has(uid)),
      candidate5ReviewUniqueGains: rows.filter(row => row.candidate5Review && row.reads[view].correct && !row.reads[baselineView].correct).map(row => row.uid),
      candidate5ReviewUniqueLosses: rows.filter(row => row.candidate5Review && !row.reads[view].correct && row.reads[baselineView].correct).map(row => row.uid),
    }]
  }))
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    purpose: manifest.purpose || 'Key-blind matched-view adapted-TrOCR benchmark before any distillation.',
    sourceManifest: path.relative(ROOT, manifestPath),
    teacherUrl,
    teacherIdentity: {
      baseModel: 'microsoft/trocr-base-handwritten',
      adapter: 'private-evidence/models/trocr-lora-calibrated-2epoch-20260709',
    },
    requestItemFields: ['id', 'questionNum', 'imageDataUrl'],
    answerKeyProvidedToTeacher: false,
    p05Used: Boolean(
      manifest.p05PostTruthDevelopmentOnly
      || selectedEntries.some(row => String(row.packetId || '').toUpperCase() === 'P05')
    ),
    lockedPacketsUsed: false,
    views,
    byView,
    comparisonsToContinuous,
    multiViewCeiling: {
      oracle: {
        total: rows.length,
        correct: rows.filter(row => row.multiView.oracleCorrect).length,
        accuracyPct: pct(rows.filter(row => row.multiView.oracleCorrect).length, rows.length),
      },
      majority: {
        total: rows.length,
        correct: rows.filter(row => row.multiView.majorityCorrect).length,
        accuracyPct: pct(rows.filter(row => row.multiView.majorityCorrect).length, rows.length),
      },
      unanimous: {
        selected: rows.filter(row => row.multiView.unanimousRead).length,
        correct: rows.filter(row => row.multiView.unanimousRead === row.truth).length,
        wrong: rows.filter(row => row.multiView.unanimousRead && row.multiView.unanimousRead !== row.truth).length,
      },
    },
    rows,
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' })
  console.log(JSON.stringify({
    output: path.relative(ROOT, outputPath),
    byView: Object.fromEntries(views.map(view => [view, {
      overall: byView[view].overall,
      validation: byView[view].bySplit.validation,
      holdout: byView[view].bySplit.holdout,
      candidate5Reviews: byView[view].candidate5Reviews,
    }])),
    multiViewCeiling: report.multiViewCeiling,
  }, null, 2))
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
