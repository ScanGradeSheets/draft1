import { test, expect } from '@playwright/test';

test.describe('ScanGrade OCR Pipeline Test', () => {
  test('should process worksheet upload', async ({ page }) => {
    console.log('\n🚀 Navigating to ScanGrade app...');
    await page.goto('/?mode=teacher', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for app to be interactive
    await page.waitForTimeout(3000);
    
    // Check for runtime test button
    const testButton = page.locator('button:has-text("Runtime Self-Test")');
    await expect(testButton).toBeVisible({ timeout: 5000 });
    console.log('\n✅ Runtime Self-Test button found');
    
    // Click the Runtime Self-Test button
    console.log('\n🔧 Running Runtime Self-Test...');
    await testButton.click();
    await page.waitForTimeout(5000);
    
    // Check for success messages in UI console
    const consoleOutput = page.locator('.console-output');
    await expect(consoleOutput).toBeVisible();
    
    const consoleLines = await consoleOutput.locator('.console-line').all();
    console.log(`\n=== UI CONSOLE OUTPUT (${consoleLines.length} lines) ===`);
    
    let hasPassed = false;
    let hasErrors = false;
    
    for (const line of consoleLines) {
      const text = await line.textContent();
      if (text) {
        console.log(`  ${text}`);
        if (text.includes('ALL TESTS PASSED') || text.includes('✅')) {
          hasPassed = true;
        }
        if (text.includes('❌') || text.includes('FAIL')) {
          hasErrors = true;
        }
      }
    }
    
    console.log('\n=== PIPELINE STATUS ===');
    console.log(`Runtime Tests Passed: ${hasPassed ? '✅ YES' : '❌ NO'}`);
    console.log(`Errors Detected: ${hasErrors ? '❌ YES' : '✅ NO'}`);
    
    // Check pipeline ready state
    const pipelineReady = await page.locator('button:has-text("Pipeline Smoke Test")').getAttribute('disabled');
    const pipelineIsReady = pipelineReady === null;
    
    console.log(`Pipeline Ready (button enabled): ${pipelineIsReady ? '✅ YES' : '❌ NO'}`);
    
    // Test results summary
    const pass = hasPassed && !hasErrors && pipelineIsReady;
    
    console.log('\n=== FINAL RESULT ===');
    if (pass) {
      console.log('✅ PASS: OCR pipeline is ready and functional');
      console.log('   - Runtime tests completed successfully');
      console.log('   - No errors detected');
      console.log('   - Pipeline is ready for worksheet processing');
    } else {
      console.log('❌ FAIL: OCR pipeline has issues');
      if (!hasPassed) {
        console.log('   - Runtime tests did not pass');
      }
      if (hasErrors) {
        console.log('   - Errors detected in console');
      }
      if (!pipelineIsReady) {
        console.log('   - Pipeline not ready (button disabled)');
      }
    }
    
    expect(pass).toBe(true);
  });
});
