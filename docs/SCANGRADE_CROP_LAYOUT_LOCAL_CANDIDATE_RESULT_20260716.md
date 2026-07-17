# Crop/layout browser-local candidate result — 2026-07-16

## Boundary

Candidate 6 remained unchanged, P05 remained sealed, and no answer key was supplied to any recognizer, detector, crop builder, or selector. All new views are additional saved evidence; the original stitched grayscale is retained byte-for-byte. Nothing in this work was deployed.

## Independent geometry audit

The 19 packet-held-out TrOCR-small whole-answer misses were matched to 19 successful controls. Contact sheets hid cohort, truth, and OCR output while geometry labels were frozen from the visible image alone.

- Geometry failures among misses: 13/19 (68.4%).
- Geometry failures among matched controls: 5/19 (26.3%).
- Blinded separation: 68.4% sensitivity, 73.7% specificity.
- Fourteen of the 18 flagged examples were number bonds.

The existing key-blind containment features were then scored against the frozen labels. The fixed detector reached 61.1% sensitivity and 80.0% specificity. A packet-held-out outside-ink threshold reached 83.3% sensitivity and 80.0% specificity. This is sufficient to route alternate evidence for research/review, not to choose a transcription.

## Crop geometry results

Nine number-bond views were compared with four packet-held-out adapters on 22 answers. Primary recognition was 12/22. The existing 4%-down crop was best overall at 14/22. Larger symmetric or horizontal expansions were worse because they admitted more printed diagram. A detector-routed 4%-down view reached 15/22 when fold-specific thresholds were applied, but the routing evidence is not yet prospectively calibrated.

A separate TrOCR-small specialist trained with only detector-routed shifted examples scored 15/22 on shifted number-bond views. It was unsafe as a global replacement: 233/275 versus the primary model's 244/275. On the eight current number-bond reviews it fixed two but was wrong on five others; agreement between the ordinary and specialist shifted readers was 2/5 correct. It therefore cannot promote answers automatically.

## Print/template separation results

Two non-destructive template-residual implementations were tested. The original grayscale remained available as a separate lane.

- Existing answer-zone residual as a direct TrOCR view: 86/275 (31.3%).
- New bounded larger-context residual as a direct TrOCR view: 64/275 (23.3%).
- Detector-routed bounded-residual augmentation, held-out P02: 57/68 versus 58/68 control.

Template subtraction often removed pencil where it overlapped printed rules. This branch is rejected. Preserve the original pixels and do not use residual imagery as a primary recognition input.

## Decision

The demonstrated bottleneck is real but concentrated: answer-zone geometry materially contributes to number-bond misses. The strongest safe artifact is a key-blind boundary detector plus a small downward alternate crop exposed only as review/disagreement evidence. It does not clear the automatic-selector gate. Candidate 6 remains the product control; P05 must not be opened for this research branch.

The cheapest decisive next test is prospective collection of crop-containment labels and alternate-view reads on new students, with the crop policy frozen before truth is opened. Until then, do not redesign production crops globally and do not auto-select a shifted transcription.

## Reproducible artifacts

- `scripts/build_blinded_crop_geometry_audit.py`
- `scripts/score_blinded_crop_geometry_audit.py`
- `scripts/evaluate_crop_containment_detector.mjs`
- `scripts/export_crop_containment_features.mjs`
- `scripts/build_number_bond_geometry_variant_manifest.py`
- `scripts/analyze_number_bond_geometry_variants.py`
- `scripts/build_v3_context_residual_channels.mjs`
- `scripts/build_trocr_residual_view_manifest.py`
- `scripts/build_detector_routed_augmentation_manifest.py`
- `private-evidence/reports/v3-blinded-crop-geometry-score-20260716.json`
- `private-evidence/reports/v3-crop-containment-detector-score-20260716.json`
- `private-evidence/reports/v3-number-bond-geometry-variants-20260716.json`
- `private-evidence/v3/context-template-residual-20260716/manifest.json`
