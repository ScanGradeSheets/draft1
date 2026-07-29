import { createApp, nextTick } from 'vue'
import App from './App.vue'

// DEV-only QR round-trip test harness
if (import.meta.env.DEV) {
  import('../templates/qr-generator.js')
    .then(({ encodeQrPayload, decodeQrPayload }) => {
      const samplePayload = {
        id: 'ws-dev-test-qr',
        version: 1,
        answers: [3, 0, 9, 5, 1, 6, 2, 8, 7, 4],
      }

      console.log('[QR Test] Original:', samplePayload)
      const encoded = encodeQrPayload(samplePayload)
      console.log('[QR Test] Encoded:', encoded)
      const decoded = decodeQrPayload(encoded)
      console.log('[QR Test] Decoded:', decoded)

      if (JSON.stringify(samplePayload) === JSON.stringify(decoded)) {
        console.log('[QR Test] Encode/Decode Round-trip SUCCESSFUL')
      } else {
        console.error('[QR Test] Encode/Decode Round-trip FAILED: Mismatch')
      }
    })
    .catch((error) => {
      console.error('[QR Test] Failed to load qr-generator:', error)
    })
}

createApp(App).mount('#app')

// Installability is intentionally independent of student data. The service
// worker caches only public shell assets; scans and corrections remain in the
// existing browser-local workflow and are never added to Cache Storage.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}sw.js`
    try {
      let registration
      try {
        registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
          scope: import.meta.env.BASE_URL,
          updateViaCache: 'none',
        })
      } catch {
        // Older supported WebKit releases may reject updateViaCache even
        // though they support installable service workers.
        registration = await navigator.serviceWorker.register(serviceWorkerUrl, {
          scope: import.meta.env.BASE_URL,
        })
      }
      // Check on each fresh launch. A new worker may take control without
      // forcibly reloading an in-progress worksheet scan.
      await registration.update().catch(() => {})
    } catch (error) {
      console.warn('[ScanGrade] App installation support unavailable:', error)
    }
  }, { once: true })
}

nextTick(() => {
  const loading = document.getElementById('loading')
  if (!loading) return
  loading.classList.add('hidden')
  window.setTimeout(() => loading.remove(), 350)
})
