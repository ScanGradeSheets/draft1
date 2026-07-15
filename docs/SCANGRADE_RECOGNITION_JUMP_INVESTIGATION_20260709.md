# ScanGrade recognition-jump investigation

Date: July 9, 2026
Status: R&D evidence; no production OCR, capture, confidence, homography, or iPad behavior changed

## Decision

There is a credible route to a substantial recognition improvement without reducing ScanGrade to row worksheets or making a home Mac mini a production dependency.

The next architecture should be a **hybrid, cloud-hosted recognition cascade**:

1. Keep the current client capture, QR/layout identification, rectification, crop extraction, and conservative accept policy.
2. Add a ScanGrade-specific **whole-answer recognizer** as a server-side second opinion. The first candidate should be the TrOCR-base model with a small ScanGrade LoRA adapter tested here.
3. Initially use that model only to rank or prefill yellow-review choices. Do not let it silently override the student's writing or auto-accept based on its raw confidence.
4. After collecting genuinely unseen-student calibration data, allow auto-accept only under a separately calibrated consensus policy.
5. Host the service on managed cloud infrastructure. The Mac mini remains a training and replay machine, never the availability dependency.

This is a stronger route than replacing the app with a generic multimodal model or generic cloud OCR. The experiment found that domain adaptation, not model fashion, produced the jump.

## What was tested

All private student images remained on the local Mac. No mathematical answer key was supplied to any tested recognizer.

### Baseline evidence

- Fresh replay of the July 2 saved-capture slice: 374 truth-matched answers.
- Current policy auto-accepted 233/374 (62.3%).
- All 233 accepted reads matched the handwritten truth in that replay.
- Row coverage: 136/176 (77.3%).
- Non-row coverage: 97/198 (49.0%).
- The broader digit analysis found the correct digit in the current-or-variant candidate set for 745/865 filled slots (86.1%). This confirms that selection is a major existing bottleneck.

### Local generic vision-language model

Qwen3-VL 4B was run locally through Ollama on representative yellow crops.

- It sometimes contained useful visual evidence, including one difficult two-digit crop.
- It was slow (roughly 2.8–7.3 seconds per crop in the probes).
- Its thinking-oriented output was difficult to constrain into a reliable transcription contract.
- It also made plausible-looking visual guesses.

Verdict: potentially useful later as an asynchronous adjudicator or experiment, not a primary production recognizer.

### Generic specialist handwriting model

Microsoft `microsoft/trocr-base-handwritten` (MIT-licensed, about 334.7 million parameters) was tested locally and key-blind on all 582 whole-answer crops.

| Test | Exact answer accuracy |
|---|---:|
| Original crops | 202/582 (34.7%) |
| Contrast crops | 205/582 (35.2%) |
| One-digit answers, original | 114/268 (42.5%) |
| Two-digit answers, original | 88/310 (28.4%) |

It ran at about 188 ms/crop on the M4 Mac mini when batched. Zero-shot TrOCR was not a replacement for the app. It did, however, correctly read 76 answers that the historical app prediction missed, demonstrating complementary information.

### ScanGrade-adapted whole-answer model

A LoRA adapter was trained on decoder attention projections only:

- Base: `microsoft/trocr-base-handwritten`
- Trainable parameters: 761,856 of 334,683,648 (0.23%)
- Adapter artifact: 2.9 MB
- Training data: 328 labelled development crops
- Validation: 136 crops from intact page blocks
- Holdout: 114 crops from separate intact page blocks
- Training time: about 54 seconds/epoch on the M4 Mac mini
- Epoch chosen only by validation accuracy: epoch 2

| Model | Validation | Page-block holdout |
|---|---:|---:|
| Zero-shot TrOCR | 39/136 (28.7%) | 44/114 (38.6%) |
| One adaptation epoch | 90/136 (66.2%) | 78/114 (68.4%) |
| Two adaptation epochs | **105/136 (77.2%)** | **92/114 (80.7%)** |

The approximate 95% Wilson interval for the 92/114 holdout result is 72.5%–86.9%. The sample is too small and correlated to support a market claim.

On validation plus holdout (250 crops), the adapted model achieved:

- 197/250 exact answers (78.8%).
- 120/136 rows (88.2%).
- 77/114 non-row answers (67.5%).
- 98/110 one-digit answers (89.1%).
- 99/140 two-digit answers (70.7%).
- 67/100 answers in the app's yellow pool (67%), compared with 24/100 for the app's displayed prediction.
- It rescued 48 yellow answers whose app prediction did not match handwritten truth.

This is the most important result of the investigation: **less than two minutes of domain adaptation more than doubled generic-model accuracy and materially improved the difficult non-row/yellow population.**

## The safety result

Raw model confidence is not calibrated well enough for automatic grading.

- A minimum-token-probability threshold chosen for zero added errors on validation accepted 15 yellow answers.
- Applied to holdout, it accepted 10 yellow answers and one was wrong.
- Agreement between the adapted model and the historical app was also imperfect: 3 wrong agreements among 151 agreements across validation and holdout, all in the yellow pool.

Therefore:

- The adapted model is ready to be tested as a **review assistant**.
- It is not ready to expand automatic confident coverage.
- The current conservative app policy should remain authoritative until new-student calibration demonstrates safety.

The useful UX opportunity is still large. Correctly prefilling 67% of yellow answers can reduce teacher effort even when the teacher must confirm the reading. Confirmation must be a deliberate tap; it must not silently become ground truth.

## Corpus limitations

The historical label file contains 582 answer crops from 86 pages, but it lacks durable student IDs, packet IDs, and template-instance IDs. The experiment kept ten-page page blocks intact, but these cannot honestly be called unseen-student splits.

Additional limitations:

- 302 truth records are manually labelled; 276 were seeded as auto-correct; 4 are blanks.
- The evaluation covers one recorded iPhone/Safari environment.
- The same worksheet families occur across the R&D splits.
- The holdout was observed during this investigation and is no longer a final untouched set.
- The saved debug format contains the chosen capture, not a complete synchronized multi-frame set, so a true cross-frame-consensus replay could not be performed.

The result is a strong architecture signal, not launch evidence.

## Cloud deployment conclusion

There is no free hosted generic model I would trust as ScanGrade's primary recognizer. “Free model” and “free reliable production service” are different things.

Recommended deployment experiment:

- Package the open TrOCR base plus the 2.9 MB private adapter in a container.
- Deploy one private, authenticated Cloud Run service with request-based billing and scale-to-zero for the pilot.
- Send only anonymous answer crops plus non-identifying layout metadata.
- Do not send student names, full worksheets, answer keys, or teacher/class identifiers.
- Set short request/log retention and disable image logging.
- Keep the existing on-device pipeline as graceful fallback when the service is unavailable.

Cloud Run currently includes a monthly free allowance of 240,000 vCPU-seconds and 450,000 GiB-seconds under instance-based billing. A low-volume pilot may fit within free allowance, but cold-start time and memory must be measured. Free allowance is not an uptime guarantee and should not be part of the product promise.

Alternative deployment:

- Hugging Face Inference Endpoints is easier operationally but not free; current CPU instances start around $0.033/hour and a more plausible 4 GB instance is about $0.067/hour before scale-to-zero behavior.
- Cloudflare Workers AI includes 10,000 neurons/day free, but it runs its catalog models rather than this custom TrOCR adapter. It is suitable for experiments with a generic second reviewer, not for hosting the winning model from this test.
- Google Cloud Vision's first 1,000 feature units/month are free. It remains worth a small, consented bake-off, but it cannot be assumed to match child digits in ScanGrade answer cells and it does not create ScanGrade's defensible model.

The Mac mini should train, replay, and build adapters. It should not serve teacher traffic.

## Exact next move

### Next 48 hours

1. Build a local HTTP inference service around the saved adapter and reproduce the 114-crop holdout outputs through the service boundary.
2. Add a shadow-only integration: the web app sends anonymous yellow crops and records the returned suggestion, latency, model version, and failure reason, but production behavior does not change.
3. Prototype a yellow-review card with the model's suggested transcription selected visually but requiring one explicit teacher confirmation.
4. Containerize and benchmark on local CPU with 1, 2, and 4 concurrent requests. Cloud Run feasibility depends more on CPU latency, memory, and cold start than on GPU throughput at this stage.

### Following two weeks

1. Run a provider bake-off on a consented, non-holdout sample: adapted TrOCR, PP-OCRv5, Google Cloud Vision handwriting, and one catalog VLM. Keep the answer key hidden.
2. Export/quantize the adapted model (ONNX first) and measure CPU latency, memory, artifact size, and accuracy parity.
3. Deploy a private Cloud Run pilot with authentication, health checks, timeouts, no image logs, and client fallback.
4. Label every remaining ambiguous truth record with two-pass QA.
5. Define a new September collection protocol with pseudonymous student, packet, template, device, and capture-condition IDs.

### September gate

Collect a genuinely untouched set from unseen students before expanding auto-accept:

- At least 1,000 answers for a directional gate, including at least 300 yellow/difficult answers.
- Prefer 3,000+ answers across at least 30 students and multiple devices for a credible safety estimate.
- No training or threshold changes after unsealing the final test set.
- Evaluate confident transcription errors separately from raw accuracy and math correctness.

Suggested product gates:

- Review-assistant beta: suggestion top-1 exact accuracy at least 80% on yellow answers, median confirm/correct time below 2 seconds, service completion at least 99%, and no silent acceptance.
- Expanded auto-accept: zero catastrophic confident errors, no more than 1 ordinary confident error per 1,000 accepted answers in the launch suite, and a confidence interval compatible with the claim. A zero-error result on a few hundred answers is insufficient.
- If the adapted model cannot reach 85% yellow top-1 accuracy or save at least 40% of review time on new students, stop scaling this architecture and test a purpose-built digit-sequence encoder/CTC model.

## What to stop

- Stop spending primary effort on hand-written rules that select among ever more preprocessing variants.
- Stop treating generic VLMs as likely primary OCR.
- Stop tuning against the July corpus as though it were an untouched test set.
- Do not build production availability around the home Mac mini.
- Do not auto-accept the adapted model's output based on its current confidence.

## Bottom line

Do not scale back the vision yet. Change the recognition layer.

The evidence supports a server-assisted, ScanGrade-specific whole-answer model layered behind the safe existing client pipeline. It produced the first large, measurable jump on difficult answers, is small to adapt, and can be hosted independently of the founder's hardware. The immediate commercial path is to turn that recognition gain into a dramatically faster confirmation workflow while September data establishes whether it can safely raise automatic coverage.
