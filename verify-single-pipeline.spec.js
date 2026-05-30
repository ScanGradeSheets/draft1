/**
 * One-off verification: one capture/upload → one OCR pipeline run, one result update, timing displayed.
 * Run with: npx playwright test verify-single-pipeline.spec.js --config=playwright.config.js
 * Dev server must be running: npm run dev
 */
import { test, expect } from '@playwright/test';

const APP_URL = '/';

test.describe('Single pipeline verification', () => {
  test('one upload produces one OCR result and timing', async ({ page }) => {
    // Collect console.logs to count "OCR Results:" (handleOCRComplete) and "OCR complete" (old App pipeline)
    const ocrResultLogs = [];
    const pipelineRunLogs = [];
    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('OCR Results:')) ocrResultLogs.push(text);
      // Legacy double-run would have logged "Running full OCR pipeline..." from App - should be absent
      if (text.includes('Running full OCR pipeline')) pipelineRunLogs.push(text);
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 20000, ignoreHTTPSErrors: true });

    // Wait for app and Runtime Self-Test
    await page.waitForTimeout(2000);
    const runtimeBtn = page.locator('button:has-text("Runtime Self-Test")');
    await expect(runtimeBtn).toBeVisible({ timeout: 10000 });
    await runtimeBtn.click();
    await page.waitForTimeout(6000);

    // Pipeline Smoke Test requires a captured image; skip for this check. Just do file upload.
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();

    // Upload a small fake image (will likely fail corner detection, but we still get one ocr-complete with error)
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (!input) return;
      const blob = new Blob([new Uint8Array(1000)], { type: 'image/png' });
      const file = new File([blob], 'test.png', { type: 'image/png' });
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Wait for processing to finish (one pipeline run)
    await page.waitForTimeout(8000);

    // Evidence: handleOCRComplete should have been called exactly once (one "OCR Results:" log)
    expect(ocrResultLogs.length).toBe(1);

    // Evidence: App should NOT have run the pipeline (no "Running full OCR pipeline...")
    expect(pipelineRunLogs.length).toBe(0);

    // One result area in parent (App .results) and one in child (CameraCapture .ocr-result)
    const appResults = page.locator('.results');
    const childOcrResult = page.locator('.ocr-result');
    await expect(appResults.or(childOcrResult)).toBeVisible();

    // When result has digits, it should include totalTime (CameraCapture sends it)
    const resultsText = await appResults.textContent().catch(() => '');
    const ocrResultText = await childOcrResult.textContent().catch(() => '');
    const combined = resultsText + ocrResultText;
    // Either we have "Time: Xms" (success path) or we have error; both paths now send totalTime
    const hasTime = combined.includes('Time:') && /\d+\.?\d*ms/.test(combined);
    const hasError = combined.includes('Corner marker') || combined.includes('Ensure 4 black');
    expect(hasTime || hasError).toBe(true);
  });
});
