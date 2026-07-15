#!/usr/bin/env node

// Offline, key-blind capture-gate experiment. It uses only page-level image and
// geometry measurements that are available before answer recognition. Gates
// are selected on the calibration packet block and then reported unchanged on
// validation and holdout blocks.

import fs from 'node:fs';

const input = process.argv[2] || 'private-evidence/reports/pipeline-fidelity-audit-20260709.json';
const output = process.argv[3] || 'private-evidence/reports/capture-retake-gate-20260713.json';
const audit = JSON.parse(fs.readFileSync(input, 'utf8'));

const metricSpecs = [
  { name: 'widthRatio', direction: 'max' },
  { name: 'perspectiveSeverity', direction: 'max' },
  { name: 'maxAngleDeviation', direction: 'max' },
  { name: 'captureLumaVariance', direction: 'max' },
  { name: 'captureLumaMean', direction: 'min' },
  { name: 'occupancy', direction: 'range' },
];

const pagesById = new Map();
for (const row of audit.rows || []) {
  const key = row.captureId;
  if (!pagesById.has(key)) {
    pagesById.set(key, {
      captureId: key,
      split: row.split,
      family: row.family,
      digits: 0,
      digitCorrect: 0,
      questions: new Map(),
      ...Object.fromEntries(metricSpecs.map(({ name }) => [name, Number(row[name])])),
    });
  }
  const page = pagesById.get(key);
  page.digits += 1;
  page.digitCorrect += row.currentDigitCorrect ? 1 : 0;
  const qKey = `${row.questionLabel}`;
  if (!page.questions.has(qKey)) {
    page.questions.set(qKey, {
      auto: !row.groupReview,
      correct: Boolean(row.groupCorrectAgainstTruth),
    });
  }
}
const pages = [...pagesById.values()];

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (index - lo);
}

function summarize(items, passes = () => true) {
  const kept = items.filter(passes);
  const rejected = items.filter((item) => !passes(item));
  const reduce = (set) => set.reduce((out, page) => {
    out.pages += 1;
    out.digits += page.digits;
    out.digitCorrect += page.digitCorrect;
    out.digitErrors += page.digits - page.digitCorrect;
    for (const question of page.questions.values()) {
      out.answers += 1;
      if (question.auto) {
        out.auto += 1;
        if (question.correct) out.autoCorrect += 1;
        else out.autoWrong += 1;
      } else {
        out.yellow += 1;
      }
    }
    return out;
  }, { pages: 0, digits: 0, digitCorrect: 0, digitErrors: 0, answers: 0, auto: 0, autoCorrect: 0, autoWrong: 0, yellow: 0 });
  const decorate = (value) => ({
    ...value,
    digitAccuracyPct: value.digits ? +(100 * value.digitCorrect / value.digits).toFixed(1) : 0,
    autoCoveragePct: value.answers ? +(100 * value.auto / value.answers).toFixed(1) : 0,
    autoAccuracyPct: value.auto ? +(100 * value.autoCorrect / value.auto).toFixed(1) : 0,
  });
  return {
    retainedPct: items.length ? +(100 * kept.length / items.length).toFixed(1) : 0,
    kept: decorate(reduce(kept)),
    rejected: decorate(reduce(rejected)),
  };
}

const calibration = pages.filter((page) => page.split === 'calibration');
const candidates = [];
for (const spec of metricSpecs) {
  const values = calibration.map((page) => page[spec.name]).filter(Number.isFinite);
  if (spec.direction === 'max') {
    for (const q of [0.7, 0.75, 0.8, 0.85, 0.9]) {
      const threshold = quantile(values, q);
      candidates.push({
        name: `${spec.name} <= calibration p${Math.round(q * 100)}`,
        rules: [{ metric: spec.name, op: '<=', threshold }],
      });
    }
  } else if (spec.direction === 'min') {
    for (const q of [0.1, 0.15, 0.2, 0.25]) {
      const threshold = quantile(values, q);
      candidates.push({
        name: `${spec.name} >= calibration p${Math.round(q * 100)}`,
        rules: [{ metric: spec.name, op: '>=', threshold }],
      });
    }
  } else {
    for (const tail of [0.05, 0.1, 0.15]) {
      const low = quantile(values, tail);
      const high = quantile(values, 1 - tail);
      candidates.push({
        name: `${spec.name} calibration p${Math.round(tail * 100)}-p${Math.round((1 - tail) * 100)}`,
        rules: [{ metric: spec.name, op: '>=', threshold: low }, { metric: spec.name, op: '<=', threshold: high }],
      });
    }
  }
}

function predicate(candidate) {
  return (page) => candidate.rules.every((rule) =>
    rule.op === '<=' ? page[rule.metric] <= rule.threshold : page[rule.metric] >= rule.threshold);
}

for (const candidate of candidates) candidate.calibration = summarize(calibration, predicate(candidate));
const eligible = candidates.filter((candidate) => candidate.calibration.retainedPct >= 75);
eligible.sort((a, b) => {
  const aRemoved = a.calibration.rejected.digitErrors / Math.max(1, a.calibration.rejected.digits);
  const bRemoved = b.calibration.rejected.digitErrors / Math.max(1, b.calibration.rejected.digits);
  return bRemoved - aRemoved || b.calibration.kept.digitAccuracyPct - a.calibration.kept.digitAccuracyPct;
});

// Combining the top independent single-metric gates is deliberately limited to
// two rules to keep the result interpretable and reduce small-corpus overfit.
const topSingles = eligible.slice(0, 8);
for (let i = 0; i < topSingles.length; i += 1) {
  for (let j = i + 1; j < topSingles.length; j += 1) {
    if (topSingles[i].rules[0].metric === topSingles[j].rules[0].metric) continue;
    const candidate = {
      name: `${topSingles[i].name} AND ${topSingles[j].name}`,
      rules: [...topSingles[i].rules, ...topSingles[j].rules],
    };
    candidate.calibration = summarize(calibration, predicate(candidate));
    if (candidate.calibration.retainedPct >= 75) eligible.push(candidate);
  }
}

eligible.sort((a, b) =>
  b.calibration.kept.digitAccuracyPct - a.calibration.kept.digitAccuracyPct ||
  b.calibration.retainedPct - a.calibration.retainedPct);

const selected = eligible[0];
const report = {
  generatedAt: new Date().toISOString(),
  method: 'Exploratory capture-only retake gate; calibrated on calibration packet block, frozen before validation/holdout scoring.',
  warning: 'Small historical packet blocks without durable student IDs. This can justify capture-protocol testing, not a production gate.',
  pageCounts: Object.fromEntries(['calibration', 'validation', 'holdout'].map((split) => [split, pages.filter((page) => page.split === split).length])),
  baseline: Object.fromEntries(['calibration', 'validation', 'holdout'].map((split) => [split, summarize(pages.filter((page) => page.split === split))])),
  selected: selected ? {
    name: selected.name,
    rules: selected.rules.map((rule) => ({ ...rule, threshold: +rule.threshold.toFixed(4) })),
    calibration: selected.calibration,
    validation: summarize(pages.filter((page) => page.split === 'validation'), predicate(selected)),
    holdout: summarize(pages.filter((page) => page.split === 'holdout'), predicate(selected)),
    all: summarize(pages, predicate(selected)),
  } : null,
  topSingleMetricCandidates: candidates
    .sort((a, b) => b.calibration.kept.digitAccuracyPct - a.calibration.kept.digitAccuracyPct)
    .slice(0, 12)
    .map((candidate) => ({
      name: candidate.name,
      rules: candidate.rules,
      calibration: candidate.calibration,
      validation: summarize(pages.filter((page) => page.split === 'validation'), predicate(candidate)),
      holdout: summarize(pages.filter((page) => page.split === 'holdout'), predicate(candidate)),
    })),
};

fs.mkdirSync(new URL('../private-evidence/reports/', import.meta.url), { recursive: true });
fs.writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report.selected, null, 2));
console.log(output);
