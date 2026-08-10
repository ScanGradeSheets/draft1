#!/usr/bin/env node
import assert from 'node:assert/strict'
import { chromium, webkit } from 'playwright'

const url = process.env.SG_VERIFY_URL || 'https://127.0.0.1:5174'

for (const [browserName, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.cv?.Mat, null, { timeout: 30000 })
    const result = await page.evaluate(async () => {
      const { preprocessToMNISTWithDebug } = await import('/src/homography.js')
      const canvas = document.createElement('canvas')
      canvas.width = 96
      canvas.height = 112
      const context = canvas.getContext('2d')
      context.fillStyle = '#fff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.strokeStyle = '#555'
      context.lineWidth = 5
      context.beginPath()
      context.moveTo(47, 20)
      context.lineTo(47, 91)
      context.stroke()

      const crop = cv.imread(canvas)
      window.__SCANGRADE_DEBUG_PREPROCESS_STATS = []
      try {
        const processed = preprocessToMNISTWithDebug(crop, {
          protectInteriorStrokes: true,
          strictLineRemoval: true,
        })
        const finiteTensor = Array.from(processed.tensor).every(Number.isFinite)
        processed.debug?.gray?.delete()
        processed.debug?.inkMask?.delete()
        processed.debug?.framed?.delete()
        return {
          tensorLength: processed.tensor.length,
          finiteTensor,
          stats: window.__SCANGRADE_DEBUG_PREPROCESS_STATS,
        }
      } finally {
        crop.delete()
        delete window.__SCANGRADE_DEBUG_PREPROCESS_STATS
      }
    })

    assert.equal(result.tensorLength, 28 * 28)
    assert.equal(result.finiteTensor, true)
    assert.equal(result.stats.length, 1)
    assert.equal(result.stats[0].width, 96)
    assert.equal(result.stats[0].height, 112)
    assert.ok(Number.isFinite(result.stats[0].inkMean))
    console.log(JSON.stringify({ browser: browserName, ...result.stats[0] }))
  } finally {
    await browser.close()
  }
}
