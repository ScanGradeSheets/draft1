import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas } from 'canvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WIDTH = 1920;
const HEIGHT = 1080;
const MARKER_SIZE = 100;

function drawMarkers(ctx) {
  const tlX = WIDTH * 0.05, tlY = HEIGHT * 0.05;
  const trX = WIDTH * 0.95, trY = HEIGHT * 0.05;
  const brX = WIDTH * 0.95, brY = HEIGHT * 0.95;
  const blX = WIDTH * 0.05, blY = HEIGHT * 0.95;
  ctx.fillStyle = '#000000';
  ctx.fillRect(tlX - MARKER_SIZE/2, tlY - MARKER_SIZE/2, MARKER_SIZE, MARKER_SIZE);
  ctx.fillRect(trX - MARKER_SIZE/2, trY - MARKER_SIZE/2, MARKER_SIZE, MARKER_SIZE);
  ctx.fillRect(brX - MARKER_SIZE/2, brY - MARKER_SIZE/2, MARKER_SIZE, MARKER_SIZE);
  ctx.fillRect(blX - MARKER_SIZE/2, blY - MARKER_SIZE/2, MARKER_SIZE, MARKER_SIZE);
}

const canvas = createCanvas(WIDTH, HEIGHT);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#FFFFFF';
ctx.fillRect(0, 0, WIDTH, HEIGHT);
drawMarkers(ctx);

// Fake digit boxes (visual reference only)
ctx.strokeStyle = '#CCCCCC';
ctx.lineWidth = 2;
for (let row = 0; row < 2; row++) {
  for (let col = 0; col < 5; col++) {
    const boxX = WIDTH * 0.2 + col * (WIDTH * 0.12);
    const boxY = HEIGHT * 0.2 + row * (HEIGHT * 0.25);
    ctx.strokeRect(boxX, boxY, 100, 100);
  }
}

const calibratedPath = path.join(__dirname, '../public/test-worksheet-calibrated.png');
fs.writeFileSync(calibratedPath, canvas.toBuffer('image/png'));
console.log('✅ Generated calibrated test image:', calibratedPath);

// Worksheet with digits: same markers + layout boxes + answer_key digits
const layoutPath = path.join(__dirname, '../public/layouts/sg-10-box-v1.json');
const layout = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
const boxes = layout.boxes;
const answerKey = layout.answer_key || [7, 2, 9, 3, 5, 1, 8, 4, 6, 0];

ctx.fillStyle = '#FFFFFF';
ctx.fillRect(0, 0, WIDTH, HEIGHT);
drawMarkers(ctx);

ctx.strokeStyle = '#CCCCCC';
ctx.lineWidth = 2;
for (const box of boxes) {
  const left = (box.x - box.width / 2) * WIDTH;
  const top = (box.y - box.height / 2) * HEIGHT;
  const w = box.width * WIDTH;
  const h = box.height * HEIGHT;
  ctx.strokeRect(left, top, w, h);
}

ctx.fillStyle = '#000000';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
const fontSize = Math.round(Math.min(boxes[0].width * WIDTH, boxes[0].height * HEIGHT) * 0.6);
ctx.font = `bold ${fontSize}px Arial`;
for (const box of boxes) {
  const digit = answerKey[box.id];
  const centerX = box.x * WIDTH;
  const centerY = box.y * HEIGHT;
  ctx.fillText(String(digit), centerX, centerY);
}

const withDigitsPath = path.join(__dirname, '../public/test-worksheet-with-digits.png');
fs.writeFileSync(withDigitsPath, canvas.toBuffer('image/png'));
console.log('✅ Generated worksheet with digits:', withDigitsPath);
console.log('   Answer key drawn:', answerKey.join(', '));
