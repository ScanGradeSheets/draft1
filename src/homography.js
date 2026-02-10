/**
 * ScanGrade Homography Module
 * 
 * Detects 4 corner markers → warps to top-down → crops answer boxes
 * Uses pure geometric approach (no box contour detection)
 */

const WARP_WIDTH = 1700;
const WARP_HEIGHT = 2200;
const MNIST_SIZE = 28;

/**
 * Detect 4 corner markers from image
 * @param {cv.Mat} src - Input image (OpenCV Mat)
 * @param {Object} layout - Layout JSON with homography.anchors metadata
 * @returns {Array|null} - [{id, x, y}, ...] for tl, tr, br, bl or null if failed
 */
export function detectCornerMarkers(src, layout) {
  // Convert to grayscale
  const gray = new cv.Mat();
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
  
  // Threshold: black markers on white paper
  const binary = new cv.Mat();
  cv.threshold(gray, binary, 80, 255, cv.THRESH_BINARY_INV);
  
  // Find contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  
  const markers = [];
  const minArea = Math.pow(layout.homography.marker_size_mm * 5, 2); // Approximate
  const maxArea = src.cols * src.rows * 0.05; // Max 5% of image
  
  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    
    // Size filter
    if (area < minArea || area > maxArea) {
      cnt.delete();
      continue;
    }
    
    // Approximate polygon - should be 4 corners (square-ish)
    const peri = cv.arcLength(cnt, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, 0.05 * peri, true);
    
    if (approx.rows === 4) {
      // Get centroid
      const moments = cv.moments(cnt);
      const cx = moments.m10 / moments.m00;
      const cy = moments.m01 / moments.m00;
      
      markers.push({
        x: cx,
        y: cy,
        area: area,
        approx: approx
      });
    } else {
      approx.delete();
    }
    
    cnt.delete();
  }
  
  // Clean up
  gray.delete();
  binary.delete();
  contours.delete();
  hierarchy.delete();
  
  // Need exactly 4 markers
  if (markers.length !== 4) {
    markers.forEach(m => m.approx.delete());
    return null;
  }
  
  // Assign tl, tr, br, bl using x+y / x-y sorting
  // tl: min(x+y), tr: max(x-y), br: max(x+y), bl: min(x-y)
  const sorted = markers.sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const tl = sorted[0];
  const br = sorted[3];
  
  const remaining = sorted.slice(1, 3);
  remaining.sort((a, b) => (a.x - a.y) - (b.x - b.y));
  const bl = remaining[0];
  const tr = remaining[1];
  
  // Clean up approx mats (keep only the 4 we return)
  markers.forEach(m => {
    if (m !== tl && m !== tr && m !== br && m !== bl) {
      m.approx.delete();
    }
  });
  
  return [
    { id: 'tl', x: tl.x, y: tl.y },
    { id: 'tr', x: tr.x, y: tr.y },
    { id: 'br', x: br.x, y: br.y },
    { id: 'bl', x: bl.x, y: bl.y }
  ];
}

/**
 * Compute homography and warp image to template coordinates
 * @param {cv.Mat} src - Input image
 * @param {Array} anchors - [{id, x, y}, ...] from detectCornerMarkers
 * @returns {cv.Mat} - Warped image (1700×2200)
 */
export function warpToTemplate(src, anchors) {
  // Source points from detected anchors
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    anchors.find(a => a.id === 'tl').x, anchors.find(a => a.id === 'tl').y,
    anchors.find(a => a.id === 'tr').x, anchors.find(a => a.id === 'tr').y,
    anchors.find(a => a.id === 'br').x, anchors.find(a => a.id === 'br').y,
    anchors.find(a => a.id === 'bl').x, anchors.find(a => a.id === 'bl').y
  ]);
  
  // Destination points: fixed template size
  // Order: tl, tr, br, bl
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    0, 0,
    WARP_WIDTH, 0,
    WARP_WIDTH, WARP_HEIGHT,
    0, WARP_HEIGHT
  ]);
  
  // Compute homography
  const H = cv.findHomography(srcPoints, dstPoints);
  
  // Warp
  const warped = new cv.Mat();
  cv.warpPerspective(src, warped, H, new cv.Size(WARP_WIDTH, WARP_HEIGHT));
  
  // Clean up
  srcPoints.delete();
  dstPoints.delete();
  H.delete();
  
  return warped;
}

/**
 * Crop digit boxes from warped image using layout coordinates
 * @param {cv.Mat} warped - Warped image (1700×2200)
 * @param {Object} layout - Layout JSON with boxes array
 * @returns {Array} - [{id, image, centerX, centerY}, ...]
 */
export function cropBoxes(warped, layout) {
  const crops = [];
  const scaleX = WARP_WIDTH / layout.page.width_mm;
  const scaleY = WARP_HEIGHT / layout.page.height_mm;
  
  for (const box of layout.boxes) {
    // Convert mm to pixels in warped space
    // Use center point and half-dimensions for crop
    const cx = box.cx * scaleX;
    const cy = box.cy * scaleY;
    const halfW = (box.width * scaleX) / 2;
    const halfH = (box.height * scaleY) / 2;
    
    const x = Math.max(0, Math.floor(cx - halfW));
    const y = Math.max(0, Math.floor(cy - halfH));
    const w = Math.floor(box.width * scaleX);
    const h = Math.floor(box.height * scaleY);
    
    const rect = new cv.Rect(x, y, w, h);
    const cropped = warped.roi(rect).clone();
    
    crops.push({
      id: box.id,
      questionNum: box.question_num,
      image: cropped,
      centerX: cx,
      centerY: cy
    });
  }
  
  return crops;
}

/**
 * Preprocess cropped box to MNIST-format tensor
 * @param {cv.Mat} boxImg - Cropped box image (RGBA)
 * @returns {Float32Array} - Normalized 28×28 MNIST-format tensor
 */
export function preprocessToMNIST(boxImg) {
  // Convert to grayscale
  const gray = new cv.Mat();
  cv.cvtColor(boxImg, gray, cv.COLOR_RGBA2GRAY);
  
  // Invert (dark digit on light background → light digit on dark)
  const inverted = new cv.Mat();
  cv.bitwise_not(gray, inverted);
  
  // Resize to 28×28
  const resized = new cv.Mat();
  cv.resize(inverted, resized, new cv.Size(MNIST_SIZE, MNIST_SIZE));
  
  // Normalize to 0-1, then mean=0, std=1 (MNIST standard)
  const floatData = new Float32Array(MNIST_SIZE * MNIST_SIZE);
  for (let i = 0; i < MNIST_SIZE; i++) {
    for (let j = 0; j < MNIST_SIZE; j++) {
      floatData[i * MNIST_SIZE + j] = resized.ucharAt(i, j) / 255.0;
    }
  }
  
  // Standardize (mean=0, std=1) - approximate MNIST normalization
  const mean = floatData.reduce((a, b) => a + b) / floatData.length;
  const std = Math.sqrt(floatData.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / floatData.length);
  
  for (let i = 0; i < floatData.length; i++) {
    floatData[i] = (floatData[i] - mean) / (std + 1e-7);
  }
  
  // Clean up
  gray.delete();
  inverted.delete();
  resized.delete();
  
  return floatData;
}

/**
 * Full pipeline: detect → warp → crop → preprocess
 * @param {HTMLCanvasElement|ImageData|cv.Mat} input - Input image
 * @param {Object} layout - Layout JSON
 * @returns {Object|null} - Pipeline results or null if detection failed
 */
export function processWorksheet(input, layout) {
  // Convert input to cv.Mat if needed
  let src;
  if (input instanceof cv.Mat) {
    src = input.clone();
  } else if (input instanceof HTMLCanvasElement) {
    src = cv.imread(input);
  } else {
    throw new Error('Input must be cv.Mat or HTMLCanvasElement');
  }
  
  // Step 1: Detect corner markers
  const anchors = detectCornerMarkers(src, layout);
  if (!anchors) {
    src.delete();
    return null;
  }
  
  // Step 2: Warp to template
  const warped = warpToTemplate(src, anchors);
  
  // Step 3: Crop boxes
  const crops = cropBoxes(warped, layout);
  
  // Step 4: Preprocess each crop
  const processed = crops.map(crop => ({
    id: crop.id,
    questionNum: crop.questionNum,
    rawImage: crop.image,
    tensor: preprocessToMNIST(crop.image),
    centerX: crop.centerX,
    centerY: crop.centerY
  }));
  
  // Clean up source (warped kept for preview, caller must delete)
  src.delete();
  
  return {
    warpedImage: warped,
    rawCrops: crops.map(c => ({ id: c.id, image: c.image })),
    processedTensors: processed
  };
}

/**
 * Draw debug overlay showing detected markers and boxes
 * @param {HTMLCanvasElement} canvas - Output canvas
 * @param {Array} anchors - Detected anchors
 * @param {Object} layout - Layout definition
 * @param {number} scaleX - Scale from detection image to display
 * @param {number} scaleY - Scale from detection image to display
 */
export function drawDebugOverlay(canvas, anchors, layout, scaleX = 1, scaleY = 1) {
  const ctx = canvas.getContext('2d');
  
  // Draw anchor markers
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 3;
  anchors.forEach(anchor => {
    ctx.beginPath();
    ctx.arc(anchor.x * scaleX, anchor.y * scaleY, 20, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = '#00ff00';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(anchor.id, anchor.x * scaleX + 25, anchor.y * scaleY);
  });
  
  // Draw box centers (if layout provided)
  if (layout && layout.boxes) {
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 2;
    
    // Note: these positions are in mm, need conversion to pixels
    // This is simplified - real overlay would need scale factors
    ctx.fillStyle = '#ff0000';
    layout.boxes.forEach(box => {
      ctx.beginPath();
      ctx.arc(box.cx * scaleX, box.cy * scaleY, 10, 0, Math.PI * 2);
      ctx.stroke();
    });
  }
}

// Export constants
export { WARP_WIDTH, WARP_HEIGHT, MNIST_SIZE };