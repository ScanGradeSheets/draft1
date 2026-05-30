import { test, expect } from '@playwright/test';

test.describe('ScanGrade App Health Check', () => {
  test('should load without errors', async ({ page }) => {
    const errors = [];
    const requests = [];
    
    // Monitor console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
        console.error('❌ Console Error:', msg.text());
      }
    });
    
    // Monitor requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('onnx') || url.includes('worker') || url.includes('models')) {
        requests.push({ url, status: null });
      }
    });
    
    page.on('response', async response => {
      const url = response.url();
      const matchingRequest = requests.find(r => r.url === url);
      if (matchingRequest) {
        matchingRequest.status = response.status();
        if (response.status() === 200) {
          console.log(`✅ ${matchingRequest.url.split('/').pop()}: 200 OK`);
        } else {
          console.error(`❌ ${matchingRequest.url.split('/').pop()}: ${response.status()}`);
        }
      }
    });
    
    // Navigate to app
    console.log('\n🚀 Launching browser...');
    await page.goto('/', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for app to initialize
    await page.waitForTimeout(3000);
    
    // Check for critical errors
    const wasmErrors = errors.filter(e => e.toLowerCase().includes('wasm') || e.toLowerCase().includes('onnx'));
    const jsErrors = errors.filter(e => !e.toLowerCase().includes('wasm') && !e.toLowerCase().includes('onnx'));
    
    // Check all model/worker requests succeeded
    const failedRequests = requests.filter(r => r.status !== 200);
    
    console.log('\n=== TEST RESULTS ===');
    console.log(`Console Errors: ${errors.length}`);
    console.log(`  - WASM/ONNX errors: ${wasmErrors.length}`);
    console.log(`  - JS errors: ${jsErrors.length}`);
    console.log(`Model/Worker Requests: ${requests.length}`);
    console.log(`  - Failed: ${failedRequests.length}`);
    
    const pass = errors.length === 0 && wasmErrors.length === 0 && failedRequests.length === 0;
    
    if (pass) {
      console.log('\n✅ PASS: App loaded successfully without errors');
    } else {
      console.log('\n❌ FAIL: App has errors');
      if (wasmErrors.length > 0) {
        console.log('  - WASM/ONNX errors detected');
      }
      if (jsErrors.length > 0) {
        console.log('  - JS errors detected');
      }
      if (failedRequests.length > 0) {
        console.log('  - Failed network requests');
      }
    }
    
    expect(pass).toBe(true);
  });
});
