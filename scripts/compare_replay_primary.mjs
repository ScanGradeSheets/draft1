#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [leftDir, rightDir] = process.argv.slice(2);
const verbose = process.argv.includes('--verbose');
if (!leftDir || !rightDir) {
  console.error('Usage: node scripts/compare_replay_primary.mjs <left-dir> <right-dir>');
  process.exit(1);
}

function replayFiles(dir) {
  return new Map(fs.readdirSync(dir)
    .filter((name) => name.endsWith('-replay-result.json'))
    .map((name) => [name, path.join(dir, name)]));
}

function primarySnapshot(file) {
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  return {
    file: data.file,
    predictions: data.predictions,
    groups: (data.groups || []).map((group) => ({
      label: group.label,
      predicted: group.predicted,
      review: group.review
    })),
    details: (data.predictionDetails || []).map((item) => ({
      id: item.id,
      digit: item.digit,
      reviewNeeded: item.reviewNeeded,
      preprocessDisagreement: item.preprocessDisagreement,
      preprocessReviewReason: item.preprocessReviewReason,
      robustOverride: item.robustOverride,
      confidencePolicyClearanceReason: item.confidencePolicyClearanceReason
    }))
  };
}

const left = replayFiles(leftDir);
const right = replayFiles(rightDir);
const differences = [];
for (const [name, leftFile] of left) {
  const rightFile = right.get(name);
  if (!rightFile) {
    differences.push({ name, missing: 'right' });
    continue;
  }
  const a = primarySnapshot(leftFile);
  const b = primarySnapshot(rightFile);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    const groupChanges = [];
    const count = Math.max(a.groups.length, b.groups.length);
    for (let index = 0; index < count; index += 1) {
      if (JSON.stringify(a.groups[index]) !== JSON.stringify(b.groups[index])) {
        groupChanges.push({ index, left: a.groups[index], right: b.groups[index] });
      }
    }
    differences.push(verbose ? { name, left: a, right: b } : { name, groupChanges });
  }
}
for (const name of right.keys()) {
  if (!left.has(name)) differences.push({ name, missing: 'left' });
}

console.log(JSON.stringify({
  leftDir,
  rightDir,
  leftFiles: left.size,
  rightFiles: right.size,
  differenceCount: differences.length,
  differences
}, null, 2));
