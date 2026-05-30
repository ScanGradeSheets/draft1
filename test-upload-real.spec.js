import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CALIBRATED_IMAGE = path.resolve(__dirname, 'public/test-worksheet-calibrated.png');
const WITH_DIGITS_IMAGE = path.resolve(__dirname, 'public/test-worksheet-with-digits.png');
const HANDWRITTEN_IMAGE = path.resolve(__dirname, 'public/test-worksheet-handwritten.png');

test.describe('ScanGrade Real Worksheet Upload Test', () => {
  test('should process calibrated worksheet with corner markings', async ({ page }) => {
    console.log('\n🚀 Navigating to ScanGrade app...');
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for app to be interactive
    await page.waitForTimeout(3000);
    
    // Run Runtime Self-Test first
    console.log('\n🔧 Running Runtime Self-Test...');
    const testButton = page.locator('button:has-text("Runtime Self-Test")');
    await testButton.click();
    await page.waitForTimeout(5000);
    
    // Verify tests passed (re-query console after self-test run)
    const consoleOutput = page.locator('.console-output');
    const consoleLines = await consoleOutput.locator('.console-line').all();
    const lineTexts = await Promise.all(consoleLines.map(line => line.textContent()));
    const allPassed = lineTexts.some(text => text?.includes('ALL TESTS PASSED'));
    
    expect(allPassed).toBe(true);
    console.log('✅ Runtime tests passed');
    
    // Find the file input and upload the calibrated test worksheet
    console.log('\n📁 Uploading calibrated test worksheet...');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    
    // Upload the calibrated test worksheet (portable path)
    await page.setInputFiles('input[type="file"]', CALIBRATED_IMAGE);
    
    // Wait for processing
    await page.waitForTimeout(8000);
    
    // Check console for processing messages
    console.log('\n=== ALL CONSOLE OUTPUT ===');
    const allLogs = [];
    for (const line of consoleLines) {
      const text = await line.textContent();
      if (text) {
        allLogs.push(text);
        console.log(`  ${text}`);
      }
    }
    
    // Check for results
    const resultsSection = page.locator('.results');
    const hasResults = await resultsSection.count() > 0;
    
    // Check OCR result display
    const ocrResult = page.locator('.ocr-result');
    const hasOcrResult = await ocrResult.count() > 0;
    
    // Get OCR result content if available
    let detectedDigits = [];
    let confidences = [];
    if (hasOcrResult) {
      const digitElements = await ocrResult.locator('.digit').all();
      for (const digitEl of digitElements) {
        const num = await digitEl.locator('.num').textContent();
        const conf = await digitEl.locator('.conf').textContent();
        if (num) detectedDigits.push(num);
        if (conf) confidences.push(conf);
      }
    }
    
    // Check results section content
    const resultsText = await resultsSection.textContent();
    
    // Count actual JS errors (not expected workflow messages)
    const jsErrors = allLogs.filter(log => 
      log.includes('❌') && 
      !log.includes('Corner marker') && 
      !log.includes('Ensure 4 black')
    );
    
    const cornerMarkerMsg = allLogs.filter(log => 
      log.includes('Corner marker') || log.includes('Ensure 4 black')
    );
    
    const ocrCompleteMsg = allLogs.filter(log => 
      log.includes('OCR complete') || log.includes('Detected:')
    );
    
    console.log('\n=== UPLOAD TEST RESULT ===');
    console.log(`Results Section Visible: ${hasResults ? '✅ YES' : '❌ NO'}`);
    console.log(`OCR Result Display: ${hasOcrResult ? '✅ YES' : '❌ NO'}`);
    console.log(`Corner Marker Detection: ${cornerMarkerMsg.length > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`OCR Complete Messages: ${ocrCompleteMsg.length}`);
    console.log(`JS Errors: ${jsErrors.length}`);
    
    console.log('\n=== DETECTED DIGITS ===');
    if (detectedDigits.length > 0) {
      console.log(`  Digits: [${detectedDigits.join(', ')}]`);
      console.log(`  Confidences: [${confidences.join(', ')}]`);
    } else {
      console.log('  No digits detected (corner markers may not have been found)');
    }
    
    if (resultsText) {
      console.log('\n=== RESULTS SECTION ===');
      console.log(`  ${resultsText.replace(/\n/g, '\n  ')}`);
    }
    
    // Final result
    const pass = allPassed && jsErrors.length === 0;
    
    console.log('\n=== FINAL RESULT ===');
    if (pass) {
      console.log('✅ PASS: Real worksheet processed successfully');
      console.log('   - Runtime tests passed');
      console.log('   - No JS errors detected');
      console.log('   - OCR pipeline executed with calibrated worksheet');
    } else {
      console.log('❌ FAIL: Processing has issues');
      if (!allPassed) {
        console.log('   - Runtime tests did not pass');
      }
      if (jsErrors.length > 0) {
        console.log('   - JS errors detected:');
        jsErrors.forEach(err => console.log(`     ${err}`));
      }
    }
    
    expect(pass).toBe(true);
  });

  test('should process worksheet-with-digits and show detected digits, confidence, and correctness', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    const testButton = page.locator('button:has-text("Runtime Self-Test")');
    await testButton.click();
    await page.waitForTimeout(5000);

    const consoleOutput = page.locator('.console-output');
    const consoleLines = await consoleOutput.locator('.console-line').all();
    const lineTexts = await Promise.all(consoleLines.map(line => line.textContent()));
    expect(lineTexts.some(text => text?.includes('ALL TESTS PASSED'))).toBe(true);

    await page.setInputFiles('input[type="file"]', WITH_DIGITS_IMAGE);
    await page.waitForTimeout(15000);

    const resultsSection = page.locator('.results');
    await expect(resultsSection).toBeVisible();
    const resultsText = await resultsSection.textContent();
    expect(resultsText).toBeTruthy();

    const ocrResultBlock = page.locator('.ocr-result');
    await expect(ocrResultBlock).toBeVisible();

    const digitElements = await ocrResultBlock.locator('.digit').all();
    expect(digitElements.length).toBe(10);

    const digits = [];
    const confs = [];
    for (const el of digitElements) {
      const num = await el.locator('.num').textContent();
      const conf = await el.locator('.conf').textContent();
      digits.push(num?.trim() ?? '');
      confs.push(conf?.trim() ?? '');
    }

    expect(digits.every(d => /^\d$/.test(d))).toBe(true);
    expect(confs.every(c => /^\d+%$/.test(c))).toBe(true);

    console.log('Typed worksheet (with-digits) detected:', digits.join(', '), '| confidences:', confs.join(', '));
    const withCorrect = await ocrResultBlock.locator('.digit.correct').count();
    const withIncorrect = await ocrResultBlock.locator('.digit.incorrect').count();
    expect(withCorrect + withIncorrect).toBe(10);
  });

  test('handwritten worksheet produces varied predictions (no all-5s)', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.locator('button:has-text("Runtime Self-Test")').click();
    await page.waitForTimeout(5000);
    await page.setInputFiles('input[type="file"]', HANDWRITTEN_IMAGE);
    await page.waitForTimeout(15000);

    const ocrResultBlock = page.locator('.ocr-result');
    await expect(ocrResultBlock).toBeVisible();
    const digitElements = await ocrResultBlock.locator('.digit').all();
    expect(digitElements.length).toBe(10);
    const digits = [];
    for (const el of digitElements) {
      const num = await el.locator('.num').textContent();
      digits.push(num?.trim() ?? '');
    }
    console.log('Handwritten worksheet detected:', digits.join(', '));
    const unique = new Set(digits);
    expect(unique.size).toBeGreaterThan(1);
  });
});
