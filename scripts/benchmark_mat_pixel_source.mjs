#!/usr/bin/env node
import { chromium, webkit } from 'playwright'

const url = process.env.SG_BENCHMARK_URL || 'https://127.0.0.1:5174'
const iterations = Number(process.env.SG_BENCHMARK_ITERATIONS || 144)

for (const [name, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.cv?.Mat && window.cv?.imshow, null, { timeout: 30000 })
    const result = await page.evaluate(({ iterations }) => {
      const sourceCanvas = document.createElement('canvas')
      sourceCanvas.width = 108
      sourceCanvas.height = 140
      const sourceContext = sourceCanvas.getContext('2d')
      const sourcePixels = sourceContext.createImageData(sourceCanvas.width, sourceCanvas.height)
      for (let index = 0; index < sourcePixels.data.length; index += 4) {
        const pixel = index / 4
        sourcePixels.data[index] = (pixel * 17 + 11) % 256
        sourcePixels.data[index + 1] = (pixel * 29 + 37) % 256
        sourcePixels.data[index + 2] = (pixel * 43 + 71) % 256
        sourcePixels.data[index + 3] = 255
      }
      sourceContext.putImageData(sourcePixels, 0, 0)

      const source = cv.imread(sourceCanvas)
      const transform = cv.matFromArray(3, 3, cv.CV_64FC1, [
        1, 0.012, 0.4,
        -0.008, 1, 0.7,
        0.00001, -0.00002, 1,
      ])
      const warped = new cv.Mat()
      cv.warpPerspective(source, warped, transform, new cv.Size(108, 140))
      const crop = warped.roi(new cv.Rect(10, 10, 88, 120)).clone()

      const displayCanvas = document.createElement('canvas')
      displayCanvas.width = crop.cols
      displayCanvas.height = crop.rows
      cv.imshow(displayCanvas, crop)
      const displayed = displayCanvas.getContext('2d').getImageData(0, 0, crop.cols, crop.rows).data
      const raw = crop.data
      const continuous = crop.isContinuous()
      const step0 = crop.step[0]
      const step1 = crop.step[1]
      const rowBytes = crop.cols * 4
      const stridePixels = new Uint8Array(rowBytes * crop.rows)
      for (let y = 0; y < crop.rows; y += 1) {
        const offset = raw.byteOffset + y * step0
        stridePixels.set(cv.HEAPU8.subarray(offset, offset + rowBytes), y * rowBytes)
      }
      let mismatches = 0
      for (let index = 0; index < stridePixels.length; index += 1) {
        if (stridePixels[index] !== displayed[index]) mismatches += 1
      }

      const strideStartedAt = performance.now()
      let strideChecksum = 0
      for (let pass = 0; pass < iterations; pass += 1) {
        for (let y = 0; y < crop.rows; y += 1) {
          const offset = raw.byteOffset + y * step0
          stridePixels.set(cv.HEAPU8.subarray(offset, offset + rowBytes), y * rowBytes)
        }
        strideChecksum = (strideChecksum + stridePixels[(pass * 101) % stridePixels.length]) >>> 0
      }
      const strideMs = performance.now() - strideStartedAt

      const canvasStartedAt = performance.now()
      let canvasChecksum = 0
      for (let pass = 0; pass < iterations; pass += 1) {
        cv.imshow(displayCanvas, crop)
        const pixels = displayCanvas.getContext('2d').getImageData(0, 0, crop.cols, crop.rows).data
        canvasChecksum = (canvasChecksum + pixels[(pass * 101) % pixels.length]) >>> 0
      }
      const canvasMs = performance.now() - canvasStartedAt

      source.delete()
      transform.delete()
      crop.delete()
      warped.delete()
      return {
        width: displayCanvas.width,
        height: displayCanvas.height,
        bytes: raw.length,
        continuous,
        step0,
        step1,
        mismatches,
        strideMs,
        canvasMs,
        speedup: canvasMs / Math.max(0.001, strideMs),
        checksumEqual: strideChecksum === canvasChecksum,
      }
    }, { iterations })
    console.log(JSON.stringify({ browser: name, iterations, ...result }))
  } finally {
    await browser.close()
  }
}
