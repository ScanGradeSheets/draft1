# ScanGrade Layout Contract

This contract is the rulebook for future worksheet variations. It exists so ScanGrade does not become a collection of one-off fixes for individual sheets.

## Core Rule

Every worksheet can look different, but every graded answer area must be boring and explicit to the scanner.

The printed page may include ten frames, dot collections, number bonds, stacked algorithms, patterns, place value, word prompts, or work space. The answer region still needs to declare exactly:

- which digit boxes belong to one question,
- how many answer slots the question has,
- where the printed guide lines or dividers are,
- which digit position each box represents,
- which digit placements are accepted for young-student handwriting.

If a future layout cannot express this cleanly in JSON, the layout is not ready for app grading.

## Required Layout Metadata

Each layout must include:

- `layout_id`
- `answer_key`
- `boxes`
- `question_groups`

Each graded box must include:

- `id`
- `question_num`
- `digit_index`
- `digit_place`
- `x`, `y`, `width`, `height`
- `expected_type`
- `expected_digit`

Each question group must include:

- `question_num`
- `answer`
- `digit_box_ids`
- `canonical_digits`
- `guide_line.slot_count`
- `accepted_digit_responses`

The `digit_box_ids` array is the source of truth for the answer area. Do not infer answer regions from visible text or nearby drawings.

## Geometry Rules

For each question group:

- Digit boxes must be in the same row and have similar size.
- `digit_index` values must run from `0` to `slot_count - 1`.
- `guide_line.slot_count` must match `digit_box_ids.length`.
- Multi-slot frames should include printed guide metadata, including divider `x_values`.
- Answer boxes must stay fully inside the normalized page.
- Diagrams, connector lines, and work areas must stay out of the answer-box safe zone.

For visual worksheets such as ten frames, dots, number bonds, and patterns:

- Prefer one consistent answer slot count across the page.
- If some answers are one digit and others are two digits, use the same printed two-slot answer frame for all questions and accept `_5`, `05`, and `5_` where appropriate.
- Avoid single-slot answer boxes mixed with two-slot answer boxes unless that layout has its own replay evidence.
- Keep answer frames separated from pictures, number-bond lines, dot arrays, and student work areas by a visible gutter.

## Multi-Digit Future Work

The OCR pipeline is digit-based, so three or more slots are possible in principle. They are not automatically market-ready.

Before shipping layouts with three, four, or five digit answers:

- generate layouts with explicit `digit_box_ids` for every slot,
- run the layout audit,
- collect real student writing,
- replay against handwritten truth,
- prove confident wrong reads stay at zero on a held-out set.

Do not assume Grade 1/2 reliability transfers to Grade 4-6 multi-digit layouts without evidence.

## Required Workflow

After generating or editing worksheet layouts:

```text
npm run audit:layouts
```

For OCR/capture/confidence changes:

```text
npm run build
node scripts/replay_live_ocr_captured.mjs --allow-imperfect --url https://127.0.0.1:5174 --out-dir <private-report-dir> private-evidence/debug-scans
node scripts/score_replay_against_handwritten_truth.mjs --out <private-score.json> <private-report-dir>
```

A worksheet/layout change only counts as progress when it improves or preserves handwritten-truth scoring, not merely answer-key scoring.

## Product Principle

ScanGrade should support many worksheet formats, but the scanner should see a small number of dependable answer-region patterns. Variety belongs in the math prompt and work area. The answer region is the machine-readable handshake.
