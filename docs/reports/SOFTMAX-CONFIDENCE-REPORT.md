# Softmax confidence fix – report

## 1. Exact files changed

- **src/ocr-pipeline.js** – added softmax, use probability as confidence in `recognizeDigits` and `recognizeDigitGrid`, plus dev log.
- **scripts/verify-softmax-confidence.js** – new script used only to verify softmax behavior (can be kept or removed).

---

## 2. Exact logic added

**In `src/ocr-pipeline.js`:**

1. **`softmax(logits)`**  
   - Input: Float32Array or array-like of logits (e.g. length 10).  
   - Stable softmax: subtract max, then `exp(x_i - max)`, then normalize by sum so output sums to 1.  
   - Output: Float32Array of probabilities in [0, 1].

2. **`recognizeDigits`**  
   - After `digitSession.run`, the raw output is treated as **logits**.  
   - `const logits = results[...].data`  
   - `const probs = softmax(logits)`  
   - `const maxIdx = probs.indexOf(Math.max(...probs))`  
   - `const confidence = probs[maxIdx]` (probability in [0, 1]).  
   - In dev (`import.meta.env.DEV`): `console.log('[OCR] confidence (probability):', confidence.toFixed(4), 'digit:', maxIdx)`.

3. **`recognizeDigitGrid`**  
   - Same change: raw output → `softmax(logits)` → `confidence = probs[maxIdx]` so confidence is a probability.

**No UI code changes.** App and CameraCapture already show confidence as `confidences[i] * 100` and compare to `0.8`; they assume values in [0, 1].

---

## 3. How confidence behaves before vs after

| Aspect | Before | After |
|--------|--------|--------|
| **Source** | Raw logit at argmax: `output[maxIdx]` | Probability at argmax: `softmax(logits)[maxIdx]` |
| **Range** | Unbounded (can be negative or > 1) | [0, 1], sums to 1 over classes |
| **Display** | “Confidence” % could be negative or > 100% | Percentage is a real 0–100% (probability × 100) |
| **Low-flag (e.g. &lt; 80%)** | Threshold 0.8 was compared to a logit (misleading) | Same 0.8 threshold is a real probability threshold |

**Concrete verification (from `node scripts/verify-softmax-confidence.js`):**

```
Sample logits (raw): 2.10, -0.50, 0.30, 1.20, -1.00, 0.00, 0.80, -0.20, 0.50, 1.50
Argmax index: 0
BEFORE (raw logit used as "confidence"): 2.1000 - not in [0,1]
AFTER (softmax probability): 0.3405 - in [0,1], sum(probs)= 1.0000
Confidence as percentage: 34.0%
```

So confidence is now a true probability-like value in [0, 1], and the UI shows it correctly as a percentage.

---

## 4. Next bounded step

**Fix Playwright E2E so it can hit the app (port/HTTPS).**  
Align Playwright config with the dev server (e.g. baseURL `https://localhost:5175`, `ignoreHTTPSErrors: true` or a dedicated test server) so the existing E2E tests (and the single-pipeline verification test) can run and regress the flow.
