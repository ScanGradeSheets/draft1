#!/usr/bin/env node
/**
 * Verify that softmax turns logits into a probability in [0,1].
 * Run: node scripts/verify-softmax-confidence.js
 */

function softmax(logits) {
  const arr = logits instanceof Float32Array ? logits : new Float32Array(logits);
  const max = Math.max(...arr);
  const exp = new Float32Array(arr.length);
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    exp[i] = Math.exp(arr[i] - max);
    sum += exp[i];
  }
  for (let i = 0; i < arr.length; i++) {
    exp[i] /= sum;
  }
  return exp;
}

// Example: MNIST-style logits (10 classes), raw model output
const sampleLogits = new Float32Array([2.1, -0.5, 0.3, 1.2, -1.0, 0.0, 0.8, -0.2, 0.5, 1.5]);
const probs = softmax(sampleLogits);
const maxIdx = probs.indexOf(Math.max(...probs));
const confidenceBefore = sampleLogits[maxIdx]; // raw logit
const confidenceAfter = probs[maxIdx];        // probability

console.log('=== Softmax confidence verification ===');
console.log('Sample logits (raw):', [...sampleLogits].map((x) => x.toFixed(2)).join(', '));
console.log('Argmax index:', maxIdx);
console.log('BEFORE (raw logit used as "confidence"):', confidenceBefore.toFixed(4), '- not in [0,1]');
console.log('AFTER (softmax probability):', confidenceAfter.toFixed(4), '- in [0,1], sum(probs)=', probs.reduce((a, b) => a + b, 0).toFixed(4));
console.log('Confidence as percentage:', (confidenceAfter * 100).toFixed(1) + '%');
console.log('=== Verification complete ===');
