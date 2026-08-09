import { chromium, webkit } from 'playwright'

const targetUrl = process.env.SG_BENCHMARK_URL || 'https://127.0.0.1:5174/'
const width = 1080
const height = 1398

async function measure(browserType, name) {
  const browser = await browserType.launch({ headless: true })
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => Boolean(window.cv?.Mat), null, { timeout: 120_000 })
    const result = await page.evaluate(({ width, height }) => {
      const binary = new cv.Mat(height, width, cv.CV_8UC1)
      for (let i = 0; i < binary.data.length; i++) {
        binary.data[i] = ((i * 17 + Math.floor(i / width) * 29) % 101) < 23 ? 255 : 0
      }

      const legacyCanvas = document.createElement('canvas')
      legacyCanvas.width = width
      legacyCanvas.height = height
      const legacyCtx = legacyCanvas.getContext('2d')
      const legacyStart = performance.now()
      const imageData = legacyCtx.getImageData(0, 0, width, height)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const value = binary.ucharAt(y, x)
          const offset = (y * width + x) * 4
          imageData.data[offset] = value
          imageData.data[offset + 1] = value
          imageData.data[offset + 2] = value
          imageData.data[offset + 3] = 255
        }
      }
      legacyCtx.putImageData(imageData, 0, 0)
      const legacyUrl = legacyCanvas.toDataURL('image/png')
      const legacyMs = performance.now() - legacyStart

      const bulkCanvas = document.createElement('canvas')
      bulkCanvas.width = width
      bulkCanvas.height = height
      const bulkStart = performance.now()
      cv.imshow(bulkCanvas, binary)
      const bulkUrl = bulkCanvas.toDataURL('image/png')
      const bulkMs = performance.now() - bulkStart

      const legacyPixels = legacyCtx.getImageData(0, 0, width, height).data
      const bulkPixels = bulkCanvas.getContext('2d').getImageData(0, 0, width, height).data
      let mismatchCount = 0
      for (let i = 0; i < legacyPixels.length; i++) {
        if (legacyPixels[i] !== bulkPixels[i]) mismatchCount++
      }
      binary.delete()
      return {
        legacyMs: Math.round(legacyMs * 1000) / 1000,
        bulkMs: Math.round(bulkMs * 1000) / 1000,
        speedup: Math.round((legacyMs / Math.max(0.001, bulkMs)) * 10) / 10,
        mismatchCount,
        dataUrlEqual: legacyUrl === bulkUrl,
      }
    }, { width, height })
    return { browser: name, width, height, ...result }
  } finally {
    await browser.close()
  }
}

const results = []
for (const [browserType, name] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
  results.push(await measure(browserType, name))
}

console.log(JSON.stringify({ targetUrl, results }, null, 2))
if (results.some((result) => result.mismatchCount !== 0 || !result.dataUrlEqual)) {
  process.exitCode = 1
}
