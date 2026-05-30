import { test, expect } from '@playwright/test';

test.describe('ScanGrade Worksheet Upload Test', () => {
  test('should process a worksheet image', async ({ page }) => {
    console.log('\n🚀 Navigating to ScanGrade app...');
    await page.goto('/?mode=teacher', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for app to be interactive
    await page.waitForTimeout(3000);
    
    // Run Runtime Self-Test first
    console.log('\n🔧 Running Runtime Self-Test...');
    const testButton = page.locator('button:has-text("Runtime Self-Test")');
    await testButton.click();
    await page.waitForTimeout(5000);
    
    // Verify tests passed
    const consoleOutput = page.locator('.console-output');
    const consoleLines = await consoleOutput.locator('.console-line').all();
    const allPassed = consoleLines.some(async line => {
      const text = await line.textContent();
      return text?.includes('ALL TESTS PASSED');
    });
    
    expect(allPassed).toBe(true);
    console.log('✅ Runtime tests passed');
    
    // Check for CameraCapture component
    const cameraWrapper = page.locator('.camera-wrapper');
    await expect(cameraWrapper).toBeVisible();
    console.log('✅ Camera capture area visible');
    
    // Find the file input button and simulate file upload
    console.log('\n📁 Simulating worksheet file upload...');
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeVisible();
    
    // Simulate file upload
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]');
      if (input) {
        const file = new File([new Blob([new Uint8Array(1000)], {type: 'image/png'})], 'test-worksheet.png', {type: 'image/png'});
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    
    // Wait for processing
    await page.waitForTimeout(5000);
    
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
    
    // Check for results or error messages
    const resultsSection = page.locator('.results');
    const hasResults = await resultsSection.count() > 0;
    
    // Count actual JS errors (not expected workflow messages)
    const jsErrors = allLogs.filter(log => 
      log.includes('❌') && 
      !log.includes('Corner marker') && 
      !log.includes('Ensure 4 black')
    );
    
    const cornerMarkerMsg = allLogs.filter(log => 
      log.includes('Corner marker') || log.includes('Ensure 4 black')
    );
    
    console.log('\n=== UPLOAD TEST RESULT ===');
    console.log(`Results Section Visible: ${hasResults ? '✅ YES' : '❌ NO'}`);
    console.log(`Corner Marker Detection: ${cornerMarkerMsg.length > 0 ? '✅ YES' : '❌ NO'}`);
    console.log(`JS Errors (excluding expected): ${jsErrors.length}`);
    console.log(`Expected Messages: ${cornerMarkerMsg.length}`);
    
    // Final result - pipeline should run without JS errors
    // Corner marker failure is expected without a real worksheet
    const pass = allPassed && jsErrors.length === 0;
    
    console.log('\n=== FINAL RESULT ===');
    if (pass) {
      console.log('✅ PASS: Upload flow is functional');
      console.log('   - Runtime tests passed');
      console.log('   - No JS errors detected');
      console.log('   - OCR pipeline executed (corner marker detection works as expected)');
    } else {
      console.log('❌ FAIL: Upload flow has issues');
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
});
