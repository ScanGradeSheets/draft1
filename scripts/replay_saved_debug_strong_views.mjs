#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { webkit } from 'playwright'

const root = process.cwd()
const sourcePath = path.resolve(process.env.SG_SOURCE_DEBUG || process.argv[2] || '')
if (!sourcePath || !fs.existsSync(sourcePath)) {
  throw new Error('Set SG_SOURCE_DEBUG or pass a saved debug.json path')
}
const raw = JSON.parse(fs.readFileSync(sourcePath, 'utf8'))
const debug = raw?.debug && typeof raw.debug === 'object' ? raw.debug : raw
const appUrl = process.env.SG_APP_URL || 'https://127.0.0.1:5174'
const modelBase = process.env.SG_MODEL_BASE || 'https://127.0.0.1:8792'
const outputPath = path.resolve(process.env.SG_OUT || path.join(
  root,
  'private-evidence/reports/saved-debug-strong-views-20260815.json',
))

const layoutId = String(debug.layoutId || '')
const layoutFamily = /sg-g1-lw-(0[1-5])-/.test(layoutId) ? 'row'
  : layoutId.includes('number-bonds') ? 'number-bond'
    : layoutId.includes('ten-frames') ? 'ten-frame'
      : layoutId.includes('dot-collections') ? 'dot-collection'
        : layoutId.includes('number-patterns') ? 'number-pattern'
          : layoutId.includes('place-value') ? 'place-value' : 'unknown'
const groupByQuestion = new Map((debug.answerGroups || []).map((group) => [
  Number(group.questionNum),
  group,
]))

function itemsFor(zones, cropVariant) {
  return (zones || []).filter((zone) => zone?.imageDataUrl).map((zone) => {
    const questionNum = Number(zone.questionNum)
    const group = groupByQuestion.get(questionNum)
    const slotCount = Array.isArray(group?.digitBoxIds)
      ? group.digitBoxIds.length
      : Array.isArray(zone.digitBoxIds) ? zone.digitBoxIds.length : 2
    return {
      id: `${layoutId}|${questionNum}|${cropVariant}`,
      questionNum,
      imageDataUrl: zone.imageDataUrl,
      cropVariant,
      contract: {
        layoutFamily,
        physicalSlotCount: slotCount,
        maxHandwrittenDigits: Math.max(1, slotCount),
        optionalSlotIndices: [],
      },
    }
  })
}

let views = {
  continuous: itemsFor(debug.v3AnswerZones, 'saved-live-continuous'),
  context: itemsFor(debug.v3ContextAnswerZones, 'saved-live-context'),
  uniform: itemsFor(debug.v3UniformAnswerViews, 'saved-live-uniform'),
}
const browser = await webkit.launch({ headless: true })
const nonReadRequests = []
const results = {}
try {
  const context = await browser.newContext({ ignoreHTTPSErrors: true })
  const page = await context.newPage()
  page.on('request', (request) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      nonReadRequests.push({ method: request.method(), url: request.url() })
    }
  })
  await page.route('**/*', async (route) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
      await route.abort('blockedbyclient')
      return
    }
    await route.continue()
  })
  await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
  if ((!views.continuous.length || !views.stitched?.length) &&
      debug.warpedDataUrl && debug.annotationGeometry?.crops) {
    const reconstructed = await page.evaluate(async ({
      warpedDataUrl,
      annotationGeometry,
      answerGroups,
      rawCropDataUrls,
      layoutId,
      layoutFamily,
    }) => {
      const loadImage = (src) => new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = src
      })
      const warped = await loadImage(warpedDataUrl)
      const cropById = new Map((annotationGeometry.crops || [])
        .map((crop) => [Number(crop.id), crop]))
      const continuous = []
      const stitched = []
      for (const group of answerGroups || []) {
        const questionNum = Number(group.questionNum)
        const ids = Array.isArray(group.digitBoxIds) ? group.digitBoxIds.map(Number) : []
        const crops = ids.map((id) => cropById.get(id)).filter(Boolean)
        if (!ids.length || crops.length !== ids.length) continue
        const rects = crops.map((crop) => crop.boxRect || crop.cropRect).filter(Boolean)
        if (rects.length !== ids.length) continue
        const x0 = Math.min(...rects.map((rect) => rect.x))
        const y0 = Math.min(...rects.map((rect) => rect.y))
        const x1 = Math.max(...rects.map((rect) => rect.x + rect.w))
        const y1 = Math.max(...rects.map((rect) => rect.y + rect.h))
        const margin = Math.max(2, Math.min(...rects.map((rect) => rect.h)) * 0.08)
        const rect = {
          x: Math.max(0, Math.floor(x0 - margin)),
          y: Math.max(0, Math.floor(y0 - margin)),
        }
        rect.w = Math.max(1, Math.min(warped.width, Math.ceil(x1 + margin)) - rect.x)
        rect.h = Math.max(1, Math.min(warped.height, Math.ceil(y1 + margin)) - rect.y)
        const canvas = document.createElement('canvas')
        canvas.width = rect.w
        canvas.height = rect.h
        canvas.getContext('2d').drawImage(
          warped,
          rect.x, rect.y, rect.w, rect.h,
          0, 0, rect.w, rect.h,
        )
        continuous.push({
          id: `${layoutId}|${questionNum}|reconstructed-live-continuous`,
          questionNum,
          imageDataUrl: canvas.toDataURL('image/png'),
          cropVariant: 'reconstructed-live-continuous',
          contract: {
            layoutFamily,
            physicalSlotCount: ids.length,
            maxHandwrittenDigits: Math.max(1, ids.length),
            optionalSlotIndices: [],
          },
        })

        const slotImages = await Promise.all(ids.map((id) => loadImage(rawCropDataUrls?.[id])))
        if (slotImages.every(Boolean)) {
          const gap = 10
          const pad = 8
          const stitchedCanvas = document.createElement('canvas')
          stitchedCanvas.width = slotImages.reduce((sum, image) => sum + image.width, 0) +
            gap * Math.max(0, slotImages.length - 1) + pad * 2
          stitchedCanvas.height = Math.max(...slotImages.map((image) => image.height)) + pad * 2
          const context = stitchedCanvas.getContext('2d')
          context.fillStyle = '#fff'
          context.fillRect(0, 0, stitchedCanvas.width, stitchedCanvas.height)
          context.imageSmoothingEnabled = false
          let drawX = pad
          for (const image of slotImages) {
            context.drawImage(
              image,
              drawX,
              pad + Math.floor((stitchedCanvas.height - pad * 2 - image.height) / 2),
            )
            drawX += image.width + gap
          }
          stitched.push({
            id: `${layoutId}|${questionNum}|reconstructed-live-stitched`,
            questionNum,
            imageDataUrl: stitchedCanvas.toDataURL('image/png'),
            cropVariant: 'reconstructed-live-stitched',
            contract: {
              layoutFamily,
              physicalSlotCount: ids.length,
              maxHandwrittenDigits: Math.max(1, ids.length),
              optionalSlotIndices: [],
            },
          })
        }
      }
      return { continuous, stitched }
    }, {
      warpedDataUrl: debug.warpedDataUrl,
      annotationGeometry: debug.annotationGeometry,
      answerGroups: debug.answerGroups,
      rawCropDataUrls: debug.rawCropDataUrls,
      layoutId,
      layoutFamily,
    })
    views = {
      ...views,
      continuous: views.continuous.length
        ? views.continuous
        : reconstructed.continuous,
      stitched: reconstructed.stitched,
    }
  }
  for (const [view, items] of Object.entries(views)) {
    if (!items.length) continue
    results[view] = await page.evaluate(async ({ items, modelBase }) => {
      const module = await import('/src/v3/trocr-small-shadow-client.js')
      return module.requestBrowserLocalStrongPersistentShadow(items, {
        enabled: true,
        encoderUrl: `${modelBase}/models/encoder-fp32.onnx`,
        decoderUrl: `${modelBase}/models/decoder-int8.onnx`,
        limit: items.length,
        timeoutMs: 120000,
      })
    }, { items, modelBase })
  }
} finally {
  await browser.close()
}

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  policyStatus: 'key-blind-saved-evidence-replay-only',
  sourceDebug: path.relative(root, sourcePath),
  layoutId,
  layoutFamily,
  answerKeyProvidedToRecognizer: false,
  truthProvidedToRecognizer: false,
  nonReadRequests,
  views: results,
}
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify({
  outputPath: path.relative(root, outputPath),
  layoutId,
  views: Object.fromEntries(Object.entries(results).map(([view, result]) => [
    view,
    {
      status: result.status,
      elapsedMs: result.elapsedMs,
      reads: (result.results || []).map((row) => ({
        questionNum: row.questionNum,
        text: row.text,
        minTokenProbability: row.minTokenProbability,
      })),
    },
  ])),
  nonReadRequests,
}, null, 2))
