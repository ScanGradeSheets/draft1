# ScanGrade Separate-Cell Migration Plan

Date: 2026-07-04

Status: Draft plan with first synthetic-authentic bakeoff result. Do not promote this to the production worksheet standard until Tony reviews the result and the September printed-sheet validation is complete.

## Decision Context

Tony prefers answer-box candidate #1: two separate digit cells instead of one joined answer box with a divider.

The likely product direction is:

- Keep worksheet activities flexible.
- Standardize the answer region aggressively.
- Let future worksheet designs vary in prompts, diagrams, manipulatives, and work space.
- Keep the machine-readable answer boxes boring, predictable, and auditable.

This plan describes how to move to separate cells without breaking existing worksheets or over-claiming reliability before September classroom validation.

## Why Separate Cells Are Promising

Separate cells may improve ScanGrade reliability because:

- Each digit crop has a real printed boundary around it.
- The OCR crop no longer has to ignore a divider line inside the same outer box.
- One-digit answers can use an intentionally blank tens cell and a filled ones cell.
- Teacher review can point at a single cell more clearly.
- Future three-, four-, and five-digit answers can extend the same cell pattern.

This does not prove that separate cells will perform better on printed student work. The current bakeoff is synthetic-authentic: it uses real student handwriting, but places it into synthetic answer boxes.

## Evidence Gates

Separate cells can become the new default only after these gates are satisfied.

1. Static fixture audit passes.

   Command:

   ```text
   npm run bakeoff:answer-boxes -- --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704 --generate-only
   ```

   Current status: passed with 24 generated pages, 12 paired handwriting sets, 0 errors, 0 warnings.

2. Synthetic-authentic OCR bakeoff is scored through the real app pipeline.

   Command:

   ```text
   npm run bakeoff:answer-boxes -- --out-dir private-evidence/reports/answer-box-bakeoff-synthetic-20260704 --url https://127.0.0.1:5174
   ```

   Current result from `private-evidence/reports/answer-box-bakeoff-synthetic-20260704/summary.json`:

   - Joined/open-divider filled digit accuracy: 129/186 (`69.4%`)
   - Separate-cell filled digit accuracy: 131/186 (`70.4%`)
   - Joined/open-divider exact question accuracy: 68/120 (`56.7%`)
   - Separate-cell exact question accuracy: 70/120 (`58.3%`)
   - Joined/open-divider blank-slot cleanliness: 54/54 (`100%`)
   - Separate-cell blank-slot cleanliness: 54/54 (`100%`)
   - Paired filled-slot comparison: 121 both correct, 10 separate-cell only correct, 8 joined/open-divider only correct, 47 neither correct.

   Interpretation:

   - Separate cells showed a small directional improvement.
   - The gain is not large enough to claim that answer-box geometry alone solves the reliability problem.
   - The main remaining limitation appears to be digit-model robustness on real primary-student handwriting, especially ambiguous `1`, `7`, `0`, `4`, `8`, and `9` shapes.

   Required readout for any future rerun:

   - filled-slot accuracy for joined/open-divider
   - filled-slot accuracy for separate-cells
   - blank-slot cleanliness for joined/open-divider
   - blank-slot cleanliness for separate-cells
   - representative miss examples
   - contact sheet review

3. Layout contract is updated only after Tony accepts the interpretation of the bakeoff result.

   File:

   ```text
   docs/SCANGRADE_LAYOUT_CONTRACT.md
   ```

4. Worksheet generator emits separate-cell layouts behind an explicit style flag first.

   The first implementation should support both styles, not delete current joined/open-divider support.

5. September classroom validation confirms real printed performance.

   Real validation must use fresh student-completed sheets, not only the handwriting crops used in the bakeoff.

## Required Design Rules

If separate cells become the new answer-box standard:

- Every digit gets its own printed rectangular cell.
- Cell sizes must be consistent across a worksheet.
- Cell gaps must be large enough that homography/crop jitter cannot merge adjacent cells.
- One-digit answers should be represented as blank tens + filled ones for two-cell questions unless a layout explicitly declares a one-cell answer.
- Blank cells are meaningful and must be tested as blanks.
- Question bubbles must stay outside answer cells and must never overlap crop boxes.
- Work space belongs outside the answer cells.
- The answer region should be vertically centered with its prompt and letter bubble.
- The layout JSON must declare slot count, canonical digits, accepted placements, and answer-box style.

## Layout JSON Shape

Future separate-cell layouts should declare answer regions like this:

```json
{
  "question_num": 1,
  "digit_box_ids": [0, 1],
  "answer_box_style": "separate-cells",
  "slot_count": 2,
  "canonical_digits": [null, 7],
  "accepted_digit_responses": [
    { "label": "_7", "digits": [null, 7] },
    { "label": "7_", "digits": [7, null] },
    { "label": "07", "digits": [0, 7] }
  ]
}
```

The production app should not infer separate-cell semantics from geometry alone when the layout can declare it.

## Backward Compatibility

Existing worksheets and QR codes must keep working.

Rules:

- Do not remove joined/open-divider support.
- Do not change old layout IDs in place unless the QR target and public files are intentionally migrated.
- New worksheet packs should get new layout IDs.
- Teacher review should display both styles correctly.
- Replay scripts must be able to compare old and new styles.

## Implementation Sequence

1. Finish the synthetic-authentic bakeoff scoring. Done for `20260704`.
2. Summarize whether separate cells improved. First result:
   - filled digit recognition
   - blank slot cleanliness
   - review burden
   - visual clarity

   Separate cells improved filled recognition slightly and reduced preprocess-review flags slightly, while blank cleanliness tied. This supports further exploration but does not justify a reliability claim.

3. If Tony approves the direction, update the layout contract.
4. Add a generator-level answer-box style option.
5. Generate one tiny separate-cell pilot packet.
6. Run static layout audit.
7. Run replay tests against synthetic/authentic fixtures.
8. Run app build and smoke checks.
9. Keep public QR sheets unchanged until Tony approves a new packet.
10. In September, print and test separate-cell sheets with real students.

## Do Not Do Yet

- Do not change OCR confidence thresholds just because separate cells look cleaner.
- Do not claim separate cells are proven on real classroom sheets until September validation.
- Do not train a model solely on the synthetic separate-cell fixtures and then report those same fixtures as proof.
- Do not collapse one-digit answers into one-cell boxes unless that style has separate evidence.
- Do not change current public QR worksheet behavior during this bakeoff.
- Do not expect the separate-cell box change alone to take ScanGrade from roughly 50% confident coverage to 90-95%; model and review-system work still matter.

## September Validation Target

The real target for a narrow launch is not just higher raw OCR accuracy. The product needs:

- near-zero confident wrong reads
- high confident coverage on supported worksheet types
- fast, obvious teacher review for the remaining yellow cells
- clear behavior on real student mistakes
- predictable scanning on iPhone and classroom iPads

Separate cells are a promising answer-region standard, not a complete product solution by themselves.
