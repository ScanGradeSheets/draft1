#!/usr/bin/env node
import { chromium, webkit } from 'playwright'

const url = process.env.SG_BENCHMARK_URL || 'https://127.0.0.1:5174'
const passes = Number(process.env.SG_BENCHMARK_PASSES || 144)

for (const [name, browserType] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await browserType.launch({ headless: true })
  try {
    const page = await browser.newPage({ ignoreHTTPSErrors: true })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const result = await page.evaluate(async ({ passes }) => {
      const { exactQuantile } = await import('/src/exact-quantile.js')
      let seed = 0x15982026
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 0x100000000
      }
      const values = Array.from({ length: 14000 }, () => Math.fround(random() * 255))
      const q = 0.90
      const target = Math.round((values.length - 1) * q)

      let sortedValue = 0
      const sortedStartedAt = performance.now()
      for (let pass = 0; pass < passes; pass += 1) {
        sortedValue = Array.from(values).sort((a, b) => a - b)[target]
      }
      const sortedMs = performance.now() - sortedStartedAt

      let selectedValue = 0
      const selectedStartedAt = performance.now()
      for (let pass = 0; pass < passes; pass += 1) {
        selectedValue = exactQuantile(values, q)
      }
      const selectedMs = performance.now() - selectedStartedAt
      return {
        values: values.length,
        passes,
        sortedValue,
        selectedValue,
        exact: Object.is(sortedValue, selectedValue),
        sortedMs,
        selectedMs,
        speedup: sortedMs / selectedMs,
      }
    }, { passes })
    console.log(JSON.stringify({ browser: name, ...result }))
  } finally {
    await browser.close()
  }
}
