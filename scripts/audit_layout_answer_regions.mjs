#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'

const DEFAULT_LAYOUT_DIR = 'layouts'
const DEFAULT_IGNORED_LAYOUT_FILES = new Set([
  'registry.json',
  'sg-10-box-v1.json'
])
const SUPPORTED_VALIDATED_SLOT_COUNTS = new Set([1, 2])
const SOFT_SUPPORTED_SLOT_COUNTS = new Set([3])

function parseArgs(argv) {
  const opts = {
    includeLegacy: false,
    json: false,
    paths: []
  }
  for (const arg of argv) {
    if (arg === '--include-legacy') opts.includeLegacy = true
    else if (arg === '--json') opts.json = true
    else opts.paths.push(arg)
  }
  if (!opts.paths.length) opts.paths.push(DEFAULT_LAYOUT_DIR)
  return opts
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'))
}

async function collectLayoutFiles(entry, opts) {
  const stat = await fs.stat(entry).catch(() => null)
  if (!stat) return []
  if (stat.isFile()) return entry.endsWith('.json') ? [entry] : []
  if (!stat.isDirectory()) return []

  const children = await fs.readdir(entry, { withFileTypes: true })
  const files = []
  for (const child of children) {
    const childPath = path.join(entry, child.name)
    if (child.isDirectory()) files.push(...await collectLayoutFiles(childPath, opts))
    else if (child.isFile() && child.name.endsWith('.json')) {
      if (!opts.includeLegacy && DEFAULT_IGNORED_LAYOUT_FILES.has(child.name)) continue
      files.push(childPath)
    }
  }
  return files
}

function finiteNumber(value) {
  return Number.isFinite(Number(value))
}

function rectForBox(box) {
  return {
    x: Number(box?.x),
    y: Number(box?.y),
    w: Number(box?.width ?? box?.w),
    h: Number(box?.height ?? box?.h)
  }
}

function rectRight(rect) {
  return rect.x + rect.w
}

function rectBottom(rect) {
  return rect.y + rect.h
}

function pctDiff(a, b) {
  const aa = Math.abs(Number(a))
  const bb = Math.abs(Number(b))
  const denom = Math.max(aa, bb, 1e-9)
  return Math.abs(aa - bb) / denom
}

function digitsFromAnswer(answer) {
  const chars = String(answer ?? '').match(/\d/g) || []
  return chars.map((char) => Number(char))
}

function normalizedDigits(digits) {
  return Array.isArray(digits)
    ? digits.map((digit) => digit == null ? null : Number(digit))
    : []
}

function responseMatchesCanonical(response, canonical) {
  const digits = normalizedDigits(response?.digits)
  if (digits.length !== canonical.length) return false
  return digits.every((digit, index) => digit === canonical[index])
}

function addIssue(issues, severity, code, message, extra = {}) {
  issues.push({ severity, code, message, ...extra })
}

function auditLayout(layout, file) {
  const issues = []
  const layoutId = layout?.layout_id || path.basename(file, '.json')
  const boxes = Array.isArray(layout?.boxes) ? layout.boxes : []
  const groups = Array.isArray(layout?.question_groups) ? layout.question_groups : []

  if (!layout?.layout_id) addIssue(issues, 'error', 'missing-layout-id', 'Layout is missing layout_id.')
  if (!Array.isArray(layout?.answer_key)) addIssue(issues, 'error', 'missing-answer-key', 'Layout is missing answer_key array.')
  if (!boxes.length) addIssue(issues, 'error', 'missing-boxes', 'Layout has no boxes.')
  if (!groups.length) addIssue(issues, 'error', 'missing-question-groups', 'Layout has no question_groups.')

  const boxesById = new Map()
  const boxIds = new Set()
  for (const box of boxes) {
    const id = box?.id
    if (id == null) {
      addIssue(issues, 'error', 'box-missing-id', 'A box is missing id.')
      continue
    }
    if (boxIds.has(id)) addIssue(issues, 'error', 'duplicate-box-id', `Duplicate box id ${id}.`, { boxId: id })
    boxIds.add(id)
    boxesById.set(id, box)

    const rect = rectForBox(box)
    for (const key of ['x', 'y', 'w', 'h']) {
      if (!finiteNumber(rect[key])) {
        addIssue(issues, 'error', 'box-invalid-rect', `Box ${id} has invalid ${key}.`, { boxId: id })
      }
    }
    if (finiteNumber(rect.x) && finiteNumber(rect.y) && finiteNumber(rect.w) && finiteNumber(rect.h)) {
      if (rect.w <= 0 || rect.h <= 0) addIssue(issues, 'error', 'box-nonpositive-size', `Box ${id} has non-positive size.`, { boxId: id })
      if (rect.x < 0 || rect.y < 0 || rectRight(rect) > 1 || rectBottom(rect) > 1) {
        addIssue(issues, 'error', 'box-out-of-bounds', `Box ${id} is outside the normalized page.`, { boxId: id })
      }
      if (rect.w < 0.042 || rect.h < 0.045) {
        addIssue(issues, 'warning', 'box-small-for-primary-writing', `Box ${id} may be small for Grade 1/2 handwriting.`, { boxId: id })
      }
    }

    if (!finiteNumber(box?.question_num)) addIssue(issues, 'error', 'box-missing-question', `Box ${id} is missing question_num.`, { boxId: id })
    if (!finiteNumber(box?.digit_index)) addIssue(issues, 'error', 'box-missing-digit-index', `Box ${id} is missing digit_index.`, { boxId: id })
    if (box?.expected_type == null) addIssue(issues, 'warning', 'box-missing-expected-type', `Box ${id} is missing expected_type.`, { boxId: id })
  }

  const usedBoxIds = new Set()
  const slotCounts = new Set()
  const groupNumbers = new Set()

  for (const group of groups) {
    const questionNum = group?.question_num
    if (!finiteNumber(questionNum)) {
      addIssue(issues, 'error', 'group-missing-question-num', 'A question group is missing question_num.')
      continue
    }
    if (groupNumbers.has(questionNum)) {
      addIssue(issues, 'warning', 'duplicate-question-num', `Question ${questionNum} appears more than once.`, { questionNum })
    }
    groupNumbers.add(questionNum)

    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : []
    const slotCount = ids.length
    slotCounts.add(slotCount)
    if (!slotCount) {
      addIssue(issues, 'error', 'group-missing-digit-boxes', `Question ${questionNum} has no digit_box_ids.`, { questionNum })
      continue
    }

    if (!SUPPORTED_VALIDATED_SLOT_COUNTS.has(slotCount)) {
      const severity = SOFT_SUPPORTED_SLOT_COUNTS.has(slotCount) ? 'warning' : 'warning'
      const note = SOFT_SUPPORTED_SLOT_COUNTS.has(slotCount)
        ? 'Three-slot layouts need their own replay evidence before launch.'
        : 'Four-plus-slot layouts are not validated for launch yet.'
      addIssue(issues, severity, 'slot-count-needs-validation', `Question ${questionNum} uses ${slotCount} slots. ${note}`, { questionNum, slotCount })
    }

    const canonical = normalizedDigits(group?.canonical_digits)
    if (canonical.length !== slotCount) {
      addIssue(issues, 'error', 'canonical-slot-mismatch', `Question ${questionNum} canonical_digits length does not match digit_box_ids.`, { questionNum })
    }

    const answerDigits = digitsFromAnswer(group?.answer)
    if (answerDigits.length > slotCount) {
      addIssue(issues, 'error', 'answer-does-not-fit-slots', `Question ${questionNum} answer does not fit ${slotCount} slots.`, { questionNum, slotCount })
    }

    const guideSlotCount = Number(group?.guide_line?.slot_count)
    if (group?.guide_line && finiteNumber(guideSlotCount) && guideSlotCount !== slotCount) {
      addIssue(issues, 'error', 'guide-slot-mismatch', `Question ${questionNum} guide_line.slot_count does not match digit_box_ids.`, { questionNum, slotCount, guideSlotCount })
    }

    if (slotCount > 1) {
      const xValues = Array.isArray(group?.guide_line?.x_values) ? group.guide_line.x_values : []
      const legacySingleDivider = xValues.length === 0 && slotCount === 2 && finiteNumber(group?.guide_line?.x)
      const dividerCount = legacySingleDivider ? 1 : xValues.length
      if (!group?.guide_line) addIssue(issues, 'warning', 'missing-guide-line', `Question ${questionNum} has multiple slots but no guide_line metadata.`, { questionNum })
      else if (dividerCount !== slotCount - 1) {
        addIssue(issues, 'warning', 'guide-divider-count-mismatch', `Question ${questionNum} guide_line.x_values should have ${slotCount - 1} divider(s).`, { questionNum })
      }
    }

    const responses = Array.isArray(group?.accepted_digit_responses) ? group.accepted_digit_responses : []
    if (!responses.length) {
      addIssue(issues, 'warning', 'missing-accepted-responses', `Question ${questionNum} has no accepted_digit_responses.`, { questionNum })
    } else if (canonical.length === slotCount && !responses.some((response) => responseMatchesCanonical(response, canonical))) {
      addIssue(issues, 'warning', 'canonical-not-accepted', `Question ${questionNum} canonical digit placement is not listed in accepted_digit_responses.`, { questionNum })
    }

    const groupBoxes = ids.map((id) => boxesById.get(id))
    groupBoxes.forEach((box, index) => {
      const id = ids[index]
      if (!box) {
        addIssue(issues, 'error', 'group-references-missing-box', `Question ${questionNum} references missing box ${id}.`, { questionNum, boxId: id })
      } else {
        usedBoxIds.add(id)
        if (Number(box.question_num) !== Number(questionNum)) {
          addIssue(issues, 'error', 'box-question-mismatch', `Question ${questionNum} uses box ${id} from question ${box.question_num}.`, { questionNum, boxId: id })
        }
      }
    })
    if (groupBoxes.some((box) => !box)) continue

    const digitIndexes = groupBoxes.map((box) => Number(box.digit_index)).sort((a, b) => a - b)
    const expectedIndexes = Array.from({ length: slotCount }, (_, index) => index)
    if (digitIndexes.some((digitIndex, index) => digitIndex !== expectedIndexes[index])) {
      addIssue(issues, 'error', 'digit-index-sequence', `Question ${questionNum} digit_index values must run 0..${slotCount - 1}.`, { questionNum, digitIndexes })
    }

    const rects = groupBoxes.map(rectForBox).sort((a, b) => a.x - b.x)
    const first = rects[0]
    for (let i = 1; i < rects.length; i += 1) {
      const rect = rects[i]
      if (Math.abs(rect.y - first.y) > Math.max(first.h, rect.h) * 0.22) {
        addIssue(issues, 'warning', 'slot-row-misaligned', `Question ${questionNum} slot ${i} is not horizontally aligned with the first slot.`, { questionNum })
      }
      if (pctDiff(rect.w, first.w) > 0.18 || pctDiff(rect.h, first.h) > 0.18) {
        addIssue(issues, 'warning', 'slot-size-mismatch', `Question ${questionNum} digit slots differ noticeably in size.`, { questionNum })
      }
      const gap = rect.x - rectRight(rects[i - 1])
      if (gap < -Math.max(first.w, rect.w) * 0.12) {
        addIssue(issues, 'error', 'slot-overlap', `Question ${questionNum} digit slots overlap.`, { questionNum })
      }
      if (gap > Math.max(first.w, rect.w) * 0.24) {
        addIssue(issues, 'warning', 'slot-gap-large', `Question ${questionNum} digit slots have a large gap; frame detection may split poorly.`, { questionNum })
      }
    }
  }

  for (const box of boxes) {
    if (!usedBoxIds.has(box.id)) {
      addIssue(issues, 'warning', 'unused-box', `Box ${box.id} is not used by any question_group.`, { boxId: box.id })
    }
  }

  if (slotCounts.has(1) && [...slotCounts].some((slotCount) => slotCount > 1)) {
    addIssue(
      issues,
      'warning',
      'mixed-slot-counts',
      'Layout mixes single-slot and multi-slot answer regions. This needs replay evidence; visual worksheets usually perform better with one consistent printed answer frame style.'
    )
  }

  return {
    file,
    layoutId,
    questionCount: groups.length,
    boxCount: boxes.length,
    slotCounts: [...slotCounts].sort((a, b) => a - b),
    errors: issues.filter((issue) => issue.severity === 'error'),
    warnings: issues.filter((issue) => issue.severity === 'warning')
  }
}

function summarize(results) {
  const errors = results.reduce((sum, result) => sum + result.errors.length, 0)
  const warnings = results.reduce((sum, result) => sum + result.warnings.length, 0)
  return {
    layoutCount: results.length,
    errors,
    warnings,
    failedLayouts: results.filter((result) => result.errors.length).map((result) => result.layoutId),
    warnedLayouts: results.filter((result) => result.warnings.length).map((result) => result.layoutId)
  }
}

function formatIssues(result) {
  const lines = []
  for (const issue of [...result.errors, ...result.warnings]) {
    const tag = issue.severity === 'error' ? 'ERROR' : 'WARN'
    const where = issue.questionNum != null
      ? ` q${issue.questionNum}`
      : issue.boxId != null
        ? ` box ${issue.boxId}`
        : ''
    lines.push(`  ${tag} ${issue.code}${where}: ${issue.message}`)
  }
  return lines
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const files = (await Promise.all(opts.paths.map((entry) => collectLayoutFiles(entry, opts)))).flat().sort()
  if (!files.length) throw new Error(`No layout JSON files found in ${opts.paths.join(', ')}`)

  const results = []
  for (const file of files) {
    const layout = await readJson(file)
    results.push(auditLayout(layout, file))
  }
  const summary = summarize(results)

  if (opts.json) {
    console.log(JSON.stringify({ summary, results }, null, 2))
  } else {
    console.log(`Audited ${summary.layoutCount} layout(s): ${summary.errors} error(s), ${summary.warnings} warning(s).`)
    for (const result of results) {
      if (!result.errors.length && !result.warnings.length) continue
      console.log(`\n${result.layoutId} (${result.file})`)
      console.log(formatIssues(result).join('\n'))
    }
  }

  if (summary.errors > 0) process.exitCode = 1
}

await main()
