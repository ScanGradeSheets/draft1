#!/usr/bin/env node
import assert from 'node:assert/strict'
import { chromium, webkit } from 'playwright'

const url = process.env.SG_BENCHMARK_URL || 'https://127.0.0.1:5174'

for (const [browserName, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const result = await page.evaluate(async () => {
      const { summarizePreprocessDebugStats } = await import('/src/homography.js')
      const width = 96
      const height = 116
      const total = width * height
      const channels = 4
      const ink = new Float32Array(total)
      const luminance = new Float32Array(total)
      const connectedEdgeProtection = new Uint8Array(total)
      const data = new Uint8ClampedArray(total * channels)
      for (let i = 0; i < total; i++) {
        ink[i] = (i % 101) / 100
        luminance[i] = (i * 17) % 256
        connectedEdgeProtection[i] = i % 37 === 0 ? 1 : 0
        data[i * channels + 3] = (i * 29) % 256
      }
      const input = { ink, luminance, connectedEdgeProtection, data, channels, total }
      const legacy = () => {
        const alphaValues = []
        for (let i = 0; i < total; i++) alphaValues.push(data[i * channels + 3])
        return {
          connectedEdgeProtectedPixels: connectedEdgeProtection.reduce((sum, value) => sum + value, 0),
          inkMean: Array.from(ink).reduce((sum, value) => sum + value, 0) / Math.max(1, ink.length),
          inkMax: Math.max(...ink),
          luminanceMin: Math.min(...luminance),
          luminanceMax: Math.max(...luminance),
          alphaMin: Math.min(...alphaValues),
          alphaMax: Math.max(...alphaValues),
        }
      }
      const candidate = () => summarizePreprocessDebugStats(input)
      const batches = 144
      const rounds = 20
      const measure = (fn) => {
        const samples = []
        for (let round = 0; round < rounds + 3; round++) {
          const start = performance.now()
          for (let i = 0; i < batches; i++) fn()
          const elapsed = performance.now() - start
          if (round >= 3) samples.push(elapsed)
        }
        samples.sort((a, b) => a - b)
        return samples[Math.floor(samples.length / 2)]
      }
      const legacyResult = legacy()
      const candidateResult = candidate()
      const legacyMs = measure(legacy)
      const candidateMs = measure(candidate)
      return { legacyResult, candidateResult, legacyMs, candidateMs }
    })

    assert.deepEqual(result.candidateResult, result.legacyResult)
    console.log(JSON.stringify({
      browser: browserName,
      legacyMs: Number(result.legacyMs.toFixed(1)),
      candidateMs: Number(result.candidateMs.toFixed(1)),
      speedup: Number((result.legacyMs / result.candidateMs).toFixed(1)),
    }))
  } finally {
    await browser.close()
  }
}
