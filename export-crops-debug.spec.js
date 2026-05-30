/**
 * One-off debug: run app, upload image, trigger "Export crop preview", save the PNG.
 * Run: npx playwright test export-crops-debug.spec.js
 * Requires: dev server on 5174.
 */
import { test } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('Export crops debug', () => {
  test('export crops for handwritten worksheet', async ({ page }) => {
    const imagePath = path.resolve(__dirname, 'public/test-worksheet-handwritten.png');
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Runtime Self-Test")').click();
    await page.waitForTimeout(5000);
    await page.setInputFiles('input[type="file"]', imagePath);
    await page.waitForTimeout(15000);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Export crop preview")').click()
    ]);
    await download.saveAs(path.join(__dirname, 'debug-crops-handwritten.png'));
  });

  test('export crops for typed worksheet', async ({ page }) => {
    const imagePath = path.resolve(__dirname, 'public/test-worksheet-with-digits.png');
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Runtime Self-Test")').click();
    await page.waitForTimeout(5000);
    await page.setInputFiles('input[type="file"]', imagePath);
    await page.waitForTimeout(15000);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('button:has-text("Export crop preview")').click()
    ]);
    await download.saveAs(path.join(__dirname, 'debug-crops-typed.png'));
  });

  test('capture first-tensor debug from console (browser vs Python)', async ({ page }) => {
    const debugLogs = []
    page.on('console', (msg) => {
      const text = msg.text()
      if (text.includes('[OCR debug first tensor]')) debugLogs.push(text)
    })
    const imagePath = path.resolve(__dirname, 'public/test-worksheet-with-digits.png')
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(2000)
    await page.locator('button:has-text("Runtime Self-Test")').click()
    await page.waitForTimeout(5000)
    await page.setInputFiles('input[type="file"]', imagePath)
    await page.waitForTimeout(15000)
    for (const line of debugLogs) {
      console.log(line)
    }
  })

  test('export tensors JSON for Python verify', async ({ page }) => {
    const imagePath = path.resolve(__dirname, 'public/test-worksheet-with-digits.png');
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.locator('button:has-text("Runtime Self-Test")').click();
    await page.waitForTimeout(5000);
    await page.setInputFiles('input[type="file"]', imagePath);
    await page.waitForTimeout(15000);
    const data = await page.evaluate(() => {
      const t = window.__scangradeLastTensors;
      if (!t || !t.length) return null;
      return t.map(({ id, tensor }) => ({ id, tensor: Array.from(tensor) }));
    });
    const fs = await import('fs');
    fs.writeFileSync(path.join(__dirname, 'debug-tensors.json'), JSON.stringify(data));
  });
});
