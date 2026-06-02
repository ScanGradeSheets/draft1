/**
 * ScanGrade Homography Module
 *
 * Detects 4 corner markers → warps to top-down → crops answer boxes
 * Uses pure geometric approach (no box contour detection)
 */

const WARP_WIDTH = 1700;
const WARP_HEIGHT = 2200;
const MNIST_SIZE = 28;

function cornerTargets(cols, rows) {
  return {
    tl: { x: cols * 0.05, y: rows * 0.05 },
    tr: { x: cols * 0.95, y: rows * 0.05 },
    br: { x: cols * 0.95, y: rows * 0.95 },
    bl: { x: cols * 0.05, y: rows * 0.95 }
  };
}

function anchorsPassCornerValidation(anchors, cols, rows, toleranceFrac = 0.22) {
  if (!Array.isArray(anchors) || anchors.length !== 4) return false;
  const targets = cornerTargets(cols, rows);
  const tolX = cols * toleranceFrac;
  const tolY = rows * toleranceFrac;
  return anchors.every((anchor) => {
    const target = targets[anchor.id];
    return !!target &&
      Math.abs(anchor.x - target.x) <= tolX &&
      Math.abs(anchor.y - target.y) <= tolY;
  });
}

function markerAreaRange(cols, rows, layout) {
  const markerSizeNorm = layout?.homography?.marker_size != null && layout.homography.marker_size <= 1
    ? layout.homography.marker_size
    : null;
  const minArea = markerSizeNorm != null
    ? Math.pow(markerSizeNorm * Math.min(cols, rows), 2) * 0.03
    : Math.pow((layout?.homography?.marker_size_mm || 17.3) * 5, 2);
  return {
    minArea,
    maxArea: cols * rows * 0.05
  };
}

function anchorsFormPlausiblePageQuad(anchors, cols, rows, layout) {
  if (!Array.isArray(anchors) || anchors.length !== 4) return false;
  const byId = Object.fromEntries(anchors.map((anchor) => [anchor.id, anchor]));
  const tl = byId.tl;
  const tr = byId.tr;
  const br = byId.br;
  const bl = byId.bl;
  if (!tl || !tr || !br || !bl) return false;

  const topW = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const bottomW = Math.hypot(br.x - bl.x, br.y - bl.y);
  const leftH = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const rightH = Math.hypot(br.x - tr.x, br.y - tr.y);
  const avgW = (topW + bottomW) / 2;
  const avgH = (leftH + rightH) / 2;
  const aspect = avgH > 0 ? avgW / avgH : 0;
  const targetAspect = layout?.page?.aspect_ratio || 0.773;
  const rotatedTargetAspect = targetAspect > 0 ? 1 / targetAspect : 1.294;
  const aspectOk =
    (aspect >= targetAspect * 0.55 && aspect <= targetAspect * 1.45) ||
    (aspect >= rotatedTargetAspect * 0.55 && aspect <= rotatedTargetAspect * 1.45);
  const cross =
    (tr.x - tl.x) * (bl.y - tl.y) -
    (tr.y - tl.y) * (bl.x - tl.x);
  return (
    cross > 0 &&
    tl.x < tr.x &&
    bl.x < br.x &&
    tl.y < bl.y &&
    tr.y < br.y &&
    avgW > cols * 0.42 &&
    avgH > rows * 0.42 &&
    aspectOk
  );
}

function pageGeometryUsableForAnchorEstimate(pageGeometry, cols, rows, layout) {
  const rect = pageGeometry?.rect;
  if (!rect) return false;
  const targetAspect = layout?.page?.aspect_ratio || 0.773;
  const aspect = rect.height > 0 ? rect.width / rect.height : 0;
  return (
    rect.width >= cols * 0.55 &&
    rect.height >= rows * 0.55 &&
    rect.x <= cols * 0.20 &&
    rect.y <= rows * 0.20 &&
    rect.x + rect.width >= cols * 0.78 &&
    rect.y + rect.height >= rows * 0.78 &&
    aspect >= targetAspect * 0.62 &&
    aspect <= targetAspect * 1.42
  );
}

function orderQuadPoints(points) {
  if (!Array.isArray(points) || points.length !== 4) return null;
  const sorted = points.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const tl = sorted[0];
  const br = sorted[3];
  const remaining = sorted.slice(1, 3).sort((a, b) => (a.x - a.y) - (b.x - b.y));
  const bl = remaining[0];
  const tr = remaining[1];
  return [tl, tr, br, bl];
}

function bilinearPoint(quad, nx, ny) {
  const [tl, tr, br, bl] = quad;
  const topX = tl.x + (tr.x - tl.x) * nx;
  const topY = tl.y + (tr.y - tl.y) * nx;
  const botX = bl.x + (br.x - bl.x) * nx;
  const botY = bl.y + (br.y - bl.y) * nx;
  return {
    x: topX + (botX - topX) * ny,
    y: topY + (botY - topY) * ny
  };
}

function lineIntersection(a1, a2, b1, b2) {
  const den = (a1.x - a2.x) * (b1.y - b2.y) - (a1.y - a2.y) * (b1.x - b2.x);
  if (Math.abs(den) < 1e-6) return null;
  const detA = a1.x * a2.y - a1.y * a2.x;
  const detB = b1.x * b2.y - b1.y * b2.x;
  return {
    x: (detA * (b1.x - b2.x) - (a1.x - a2.x) * detB) / den,
    y: (detA * (b1.y - b2.y) - (a1.y - a2.y) * detB) / den
  };
}

function markerCenterFromApprox(approx, rect, offsetX = 0, offsetY = 0) {
  if (approx && approx.rows === 4) {
    const pts = [];
    for (let i = 0; i < 4; i++) {
      pts.push({
        x: approx.data32S[i * 2],
        y: approx.data32S[i * 2 + 1]
      });
    }
    const quad = orderQuadPoints(pts);
    if (quad) {
      const p = lineIntersection(quad[0], quad[2], quad[1], quad[3]);
      if (p) {
        return { x: p.x + offsetX, y: p.y + offsetY };
      }
    }
  }
  return {
    x: offsetX + rect.x + rect.width / 2,
    y: offsetY + rect.y + rect.height / 2
  };
}

function quadLooksPlausible(quad, rect) {
  if (!Array.isArray(quad) || quad.length !== 4 || !rect) return false;
  const [tl, tr, br, bl] = quad;
  const minBottomY = Math.min(br.y, bl.y);
  const maxTopY = Math.max(tl.y, tr.y);
  const minRightX = Math.min(tr.x, br.x);
  const maxLeftX = Math.max(tl.x, bl.x);
  return (
    minBottomY > maxTopY + rect.height * 0.45 &&
    minRightX > maxLeftX + rect.width * 0.45
  );
}

function expandPageRect(rect, cols, rows) {
  if (!rect) return null;
  const padLeft = Math.max(24, Math.round(rect.width * 0.04));
  const padRight = Math.max(24, Math.round(rect.width * 0.04));
  const padTop = Math.max(24, Math.round(rect.height * 0.03));
  const padBottom = Math.max(48, Math.round(rect.height * 0.22));
  const x = Math.max(0, rect.x - padLeft);
  const y = Math.max(0, rect.y - padTop);
  const right = Math.min(cols, rect.x + rect.width + padRight);
  const bottom = Math.min(rows, rect.y + rect.height + padBottom);
  return new cv.Rect(x, y, Math.max(1, right - x), Math.max(1, bottom - y));
}

function measureBinaryOccupancy(binary, rect) {
  const x0 = Math.max(0, rect.x);
  const y0 = Math.max(0, rect.y);
  const x1 = Math.min(binary.cols, rect.x + rect.width);
  const y1 = Math.min(binary.rows, rect.y + rect.height);
  const width = Math.max(0, x1 - x0);
  const height = Math.max(0, y1 - y0);
  const area = Math.max(1, width * height);
  let ink = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (binary.ucharAt(y, x) > 0) ink++;
    }
  }
  return ink / area;
}

function estimateAnchorsFromPageGeometry(pageGeometry, layout) {
  if (!pageGeometry?.rect) return null;
  const layoutAnchors = Array.isArray(layout?.homography?.anchors) ? layout.homography.anchors : null;
  const ids = ['tl', 'tr', 'br', 'bl'];
  const quad = Array.isArray(pageGeometry.quad) && pageGeometry.quad.length === 4
    ? pageGeometry.quad
    : null;
  return ids.map((id) => {
    const fallback = { tl: [0.05, 0.05], tr: [0.95, 0.05], br: [0.95, 0.95], bl: [0.05, 0.95] }[id];
    const layoutAnchor = layoutAnchors?.find((a) => a.id === id);
    const nx = typeof layoutAnchor?.x === 'number' ? layoutAnchor.x : fallback[0];
    const ny = typeof layoutAnchor?.y === 'number' ? layoutAnchor.y : fallback[1];
    if (quad) {
      const p = bilinearPoint(quad, nx, ny);
      return { id, x: p.x, y: p.y };
    }
    return {
      id,
      x: pageGeometry.rect.x + pageGeometry.rect.width * nx,
      y: pageGeometry.rect.y + pageGeometry.rect.height * ny
    };
  });
}

/**
 * Stage 1 (page-first): find the worksheet page region before marker detection.
 * Returns page geometry with bounding rect and perspective quad when available.
 */
function detectPageGeometry(src) {
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const pageMask = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(11, 11));
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    // White worksheet page should be bright in most captures.
    cv.threshold(blur, pageMask, 170, 255, cv.THRESH_BINARY);
    cv.morphologyEx(pageMask, pageMask, cv.MORPH_CLOSE, kernel);
    cv.findContours(pageMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const total = src.cols * src.rows;
    let best = null;
    let bestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area < total * 0.12 || area > total * 0.98) {
        cnt.delete();
        continue;
      }
      const rect = cv.boundingRect(cnt);
      const aspect = rect.height > 0 ? rect.width / rect.height : 0;
      if (aspect < 0.45 || aspect > 0.95) {
        cnt.delete();
        continue;
      }
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
    let quad = null;
      if (approx.rows === 4) {
        const pts = [];
        for (let j = 0; j < 4; j++) {
          pts.push({
            x: approx.data32S[j * 2],
            y: approx.data32S[j * 2 + 1]
          });
        }
        quad = orderQuadPoints(pts);
      }
      if (quad && !quadLooksPlausible(quad, rect)) {
        quad = null;
      }
      if (area > bestArea) {
        bestArea = area;
        best = { rect: expandPageRect(rect, src.cols, src.rows), quad };
      }
      approx.delete();
      cnt.delete();
    }
    return best;
  } finally {
    gray.delete();
    blur.delete();
    pageMask.delete();
    kernel.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function detectPageRoiRect(src) {
  return detectPageGeometry(src)?.rect || null;
}

/**
 * Stage 2 fallback: detect one marker candidate per page corner window.
 * This avoids interior answer-box squares hijacking marker selection.
 */
function detectCornerMarkersByCornerWindows(src, pageRect, minArea, maxArea) {
  const roiX = pageRect ? pageRect.x : 0;
  const roiY = pageRect ? pageRect.y : 0;
  const pageMat = pageRect
    ? src.roi(new cv.Rect(pageRect.x, pageRect.y, pageRect.width, pageRect.height)).clone()
    : src.clone();
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const binary = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  try {
    cv.cvtColor(pageMat, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(
      blur,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      51,
      10
    );
    cv.morphologyEx(binary, binary, cv.MORPH_OPEN, kernel);

    const w = pageMat.cols;
    const h = pageMat.rows;
    const wx = Math.max(1, Math.floor(w * 0.28));
    const wy = Math.max(1, Math.floor(h * 0.28));
    const windows = [
      { id: 'tl', rect: new cv.Rect(0, 0, wx, wy), cx: 0, cy: 0 },
      { id: 'tr', rect: new cv.Rect(w - wx, 0, wx, wy), cx: w - 1, cy: 0 },
      { id: 'br', rect: new cv.Rect(w - wx, h - wy, wx, wy), cx: w - 1, cy: h - 1 },
      { id: 'bl', rect: new cv.Rect(0, h - wy, wx, wy), cx: 0, cy: h - 1 }
    ];

    const picks = [];
    for (const win of windows) {
      const sub = binary.roi(win.rect);
      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(sub, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      let best = null;
      let bestScore = -Infinity;
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);
        const rect = cv.boundingRect(cnt);
        const rectArea = Math.max(1, rect.width * rect.height);
        const aspect = rect.height > 0 ? rect.width / rect.height : 0;
        const fillRatio = area / rectArea;
        const inkRatio = measureBinaryOccupancy(sub, rect);
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.05 * peri, true);
        if (
          area < minArea * 0.15 ||
          area > maxArea * 1.2 ||
          aspect < 0.5 ||
          aspect > 1.8 ||
          fillRatio < 0.18
        ) {
          approx.delete();
          cnt.delete();
          continue;
        }
        const center = markerCenterFromApprox(approx, rect, win.rect.x, win.rect.y);
        approx.delete();
        if (!center) {
          cnt.delete();
          continue;
        }
        const cx = center.x;
        const cy = center.y;
        const d = Math.hypot(cx - win.cx, cy - win.cy);
        const squareness = 1 - Math.min(1, Math.abs(1 - aspect));
        const density = Math.max(fillRatio * 0.35, inkRatio);
        const score = area * density * (0.7 + 0.3 * squareness) - d * 120;
        if (score > bestScore) {
          bestScore = score;
          best = { id: win.id, x: cx + roiX, y: cy + roiY };
        }
        cnt.delete();
      }
      contours.delete();
      hierarchy.delete();
      sub.delete();
      if (!best) return null;
      picks.push(best);
    }
    return picks;
  } finally {
    pageMat.delete();
    gray.delete();
    blur.delete();
    binary.delete();
    kernel.delete();
  }
}

/**
 * Detect 4 corner markers from image
 * @param {cv.Mat} src - Input image (OpenCV Mat)
 * @param {Object} layout - Layout JSON with homography.anchors metadata
 * @returns {Array|null} - [{id, x, y}, ...] for tl, tr, br, bl or null if failed
 */
export function detectCornerMarkers(src, layout, options = {}) {
  const allowFallback = options.allowFallback !== false;
  const fullAreaRange = markerAreaRange(src.cols, src.rows, layout);
  const fullFrameCornerAnchors = detectCornerMarkersByCornerWindows(
    src,
    null,
    fullAreaRange.minArea,
    fullAreaRange.maxArea
  );
  const fullFrameCornerValid =
    anchorsPassCornerValidation(fullFrameCornerAnchors, src.cols, src.rows, 0.30) &&
    anchorsFormPlausiblePageQuad(fullFrameCornerAnchors, src.cols, src.rows, layout);
  if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_MARKERS) {
    window.__SCANGRADE_DEBUG_FULL_FRAME_ANCHORS = fullFrameCornerAnchors;
    window.__SCANGRADE_DEBUG_FULL_FRAME_VALID = fullFrameCornerValid;
  }
  if (fullFrameCornerValid) {
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_MARKERS) {
      window.__SCANGRADE_DEBUG_FALLBACK_USED = true;
      window.__SCANGRADE_DEBUG_FALLBACK_VALID = true;
      window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_USED = false;
      window.__SCANGRADE_DEBUG_FULL_FRAME_MARKERS_USED = true;
    }
    return fullFrameCornerAnchors;
  }

  // Stage 1: detect worksheet page ROI and limit marker detection to that region.
  const pageGeometry = detectPageGeometry(src);
  const pageRect = pageGeometry?.rect || null;
  const roiX = pageRect ? pageRect.x : 0;
  const roiY = pageRect ? pageRect.y : 0;
  const markerSrc = pageRect
    ? src.roi(new cv.Rect(pageRect.x, pageRect.y, pageRect.width, pageRect.height)).clone()
    : src;
  const ownsMarkerSrc = markerSrc !== src;
  const workCols = markerSrc.cols;
  const workRows = markerSrc.rows;

  // Convert to grayscale
  const gray = new cv.Mat();
  cv.cvtColor(markerSrc, gray, cv.COLOR_RGBA2GRAY);

  // Threshold: black markers on white paper (stable baseline for current worksheet photos).
  const binary = new cv.Mat();
  cv.threshold(gray, binary, 100, 255, cv.THRESH_BINARY_INV);

  // Find contours
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

  const markers = [];
  const { minArea, maxArea } = markerAreaRange(workCols, workRows, layout);

  // Target marker positions: 5% and 95% of canvas
  const targets = cornerTargets(workCols, workRows);
  const targetTL = targets.tl;
  const targetTR = targets.tr;
  const targetBR = targets.br;
  const targetBL = targets.bl;

  const debugMarkers = typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_MARKERS;
  const debugContours = debugMarkers ? [] : null;

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    const area = cv.contourArea(cnt);
    const rect = cv.boundingRect(cnt);
    const rectArea = Math.max(1, rect.width * rect.height);
    const fillRatio = area / rectArea;
    const inkRatio = measureBinaryOccupancy(binary, rect);

    if (debugContours) {
      const rec = { area, minArea, maxArea, fillRatio, inkRatio, x: rect.x, y: rect.y, w: rect.width, h: rect.height };
      if (area < minArea) rec.reject = 'area_too_small';
      else if (area > maxArea) rec.reject = 'area_too_large';
      debugContours.push(rec);
    }

    // Size filter
    if (area < minArea || area > maxArea) {
      cnt.delete();
      continue;
    }

    // Approximate polygon - should be 4 corners (square-ish)
    const peri = cv.arcLength(cnt, true);
    const approx = new cv.Mat();
    cv.approxPolyDP(cnt, approx, 0.05 * peri, true);

    const aspect = rect.height > 0 ? rect.width / rect.height : 0;
    const squareish = aspect > 0.5 && aspect < 1.8;
    const filledish = fillRatio >= 0.18 && inkRatio >= 0.24;
    if (approx.rows >= 4 && approx.rows <= 8 && squareish && filledish) {
      const center = markerCenterFromApprox(approx, rect);
      const cx = center.x;
      const cy = center.y;
      if (debugContours && debugContours.length > 0) {
        const last = debugContours[debugContours.length - 1];
        delete last.reject;
        last.passedApprox = true;
        last.cx = Math.round(cx);
        last.cy = Math.round(cy);
      }
      markers.push({
        x: cx,
        y: cy,
        xGlobal: cx + roiX,
        yGlobal: cy + roiY,
        area: area,
        approx: approx
      });
    } else {
      if (debugContours && debugContours.length > 0) {
        const last = debugContours[debugContours.length - 1];
        delete last.reject;
        last.reject = !filledish ? 'fill_ratio_too_low' : 'approx_not_4_corners';
        last.approxRows = approx.rows;
      }
      approx.delete();
    }

    cnt.delete();
  }

  if (debugMarkers) {
    try {
      const w = binary.cols;
      const h = binary.rows;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      const id = ctx.getImageData(0, 0, w, h);
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const v = binary.ucharAt(r, c);
          const i = (r * w + c) * 4;
          id.data[i] = id.data[i + 1] = id.data[i + 2] = v;
          id.data[i + 3] = 255;
        }
      }
      ctx.putImageData(id, 0, 0);
      window.__SCANGRADE_DEBUG_BINARY_URL = canvas.toDataURL('image/png');
    } catch (e) {
      window.__SCANGRADE_DEBUG_BINARY_ERROR = String(e);
    }
    window.__SCANGRADE_DEBUG_CONTOURS = debugContours;
    window.__SCANGRADE_DEBUG_MARKER_COUNT_AFTER_LOOP = markers.length;
    window.__SCANGRADE_DEBUG_MIN_MAX_AREA = { minArea, maxArea, cols: workCols, rows: workRows };
      window.__SCANGRADE_DEBUG_PAGE_ROI = pageRect
        ? { x: pageRect.x, y: pageRect.y, width: pageRect.width, height: pageRect.height }
        : null;
      window.__SCANGRADE_DEBUG_PAGE_QUAD = Array.isArray(pageGeometry?.quad)
        ? pageGeometry.quad
        : null;
    console.log('[ScanGrade] Marker debug: binary image in window.__SCANGRADE_DEBUG_BINARY_URL, contours in __SCANGRADE_DEBUG_CONTOURS, count=', markers.length);
  }

  // Clean up
  gray.delete();
  binary.delete();
  contours.delete();
  hierarchy.delete();
  if (ownsMarkerSrc) markerSrc.delete();
  const cornerWindowAnchors = detectCornerMarkersByCornerWindows(src, pageRect, minArea, maxArea);
  const cornerWindowValid = anchorsPassCornerValidation(
    cornerWindowAnchors
      ? cornerWindowAnchors.map((a) => ({ id: a.id, x: a.x - roiX, y: a.y - roiY }))
      : null,
    workCols,
    workRows
  );
  const tryFallback = () => {
    if (!allowFallback) {
      if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_MARKERS) {
        window.__SCANGRADE_DEBUG_FALLBACK_USED = false;
        window.__SCANGRADE_DEBUG_FALLBACK_VALID = false;
        window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_USED = false;
      }
      return null;
    }
    const usePageRectEstimate =
      !cornerWindowValid &&
      pageGeometryUsableForAnchorEstimate(pageGeometry, src.cols, src.rows, layout);
    const pageRectEstimate = usePageRectEstimate ? estimateAnchorsFromPageGeometry(pageGeometry, layout) : null;
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_MARKERS) {
      window.__SCANGRADE_DEBUG_FALLBACK_USED = !!cornerWindowAnchors;
      window.__SCANGRADE_DEBUG_FALLBACK_VALID = cornerWindowValid;
      window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_USED = !!pageRectEstimate;
      window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_REJECTED = !cornerWindowValid && !usePageRectEstimate;
    }
    return cornerWindowValid ? cornerWindowAnchors : pageRectEstimate;
  };

  if (cornerWindowValid) {
    markers.forEach((m) => m.approx.delete());
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_MARKERS) {
      window.__SCANGRADE_DEBUG_FALLBACK_USED = true;
      window.__SCANGRADE_DEBUG_FALLBACK_VALID = true;
      window.__SCANGRADE_DEBUG_PAGE_RECT_ESTIMATE_USED = false;
    }
    return cornerWindowAnchors;
  }

  // Need at least 4 markers; if more (e.g. digits/boxes), pick 4 closest to corner targets
  if (markers.length < 4) {
    markers.forEach(m => m.approx.delete());
    return tryFallback();
  }
  if (markers.length > 4) {
    const dist = (m, t) => Math.hypot(m.x - t.x, m.y - t.y);
    const targets = [targetTL, targetTR, targetBR, targetBL];
    const chosen = [];
    const used = new Set();
    for (const t of targets) {
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < markers.length; i++) {
        if (used.has(i)) continue;
        const d = dist(markers[i], t);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best != null) {
        chosen.push(markers[best]);
        used.add(best);
      }
    }
    markers.forEach(m => {
      if (!chosen.includes(m)) m.approx.delete();
    });
    markers.length = 0;
    markers.push(...chosen);
  }
  if (markers.length !== 4) {
    markers.forEach(m => m.approx.delete());
    return tryFallback();
  }

  // Assign tl, tr, br, bl using x+y / x-y sorting
  const sorted = markers.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y));
  const tl = sorted[0];
  const br = sorted[3];
  const remaining = sorted.slice(1, 3);
  remaining.sort((a, b) => (a.x - a.y) - (b.x - b.y));
  const bl = remaining[0];
  const tr = remaining[1];

  // Validate marker positions are at 5%/95% coordinates
  const tolerance = 0.22;
  const tlValid = Math.abs(tl.x - targetTL.x) < workCols * tolerance && Math.abs(tl.y - targetTL.y) < workRows * tolerance;
  const trValid = Math.abs(tr.x - targetTR.x) < workCols * tolerance && Math.abs(tr.y - targetTR.y) < workRows * tolerance;
  const brValid = Math.abs(br.x - targetBR.x) < workCols * tolerance && Math.abs(br.y - targetBR.y) < workRows * tolerance;
  const blValid = Math.abs(bl.x - targetBL.x) < workCols * tolerance && Math.abs(bl.y - targetBL.y) < workRows * tolerance;

  if (debugMarkers) {
    window.__SCANGRADE_DEBUG_POSITION = {
      tolerance,
      tl: { x: tl.x, y: tl.y, target: targetTL, valid: tlValid },
      tr: { x: tr.x, y: tr.y, target: targetTR, valid: trValid },
      br: { x: br.x, y: br.y, target: targetBR, valid: brValid },
      bl: { x: bl.x, y: bl.y, target: targetBL, valid: blValid },
      allValid: tlValid && trValid && brValid && blValid
    };
  }

  if (!(tlValid && trValid && brValid && blValid)) {
    markers.forEach(m => m.approx.delete());
    return tryFallback();
  }

  // Clean up approx mats (keep only the 4 we return)
  markers.forEach(m => {
    if (m !== tl && m !== tr && m !== br && m !== bl) {
      m.approx.delete();
    }
  });

  return [
    { id: 'tl', x: tl.x + roiX, y: tl.y + roiY },
    { id: 'tr', x: tr.x + roiX, y: tr.y + roiY },
    { id: 'br', x: br.x + roiX, y: br.y + roiY },
    { id: 'bl', x: bl.x + roiX, y: bl.y + roiY }
  ];
}

/**
 * Compute homography and warp image to template coordinates
 * @param {cv.Mat} src - Input image
 * @param {Array} anchors - [{id, x, y}, ...] from detectCornerMarkers (source pixel coords)
 * @param {Object} layout - Layout JSON; if layout.homography.anchors has x,y in 0–1, use them as warp destination.
 *   Anchor x,y must be the **printed marker centers** in the same page-normalized system as layout.boxes (0–1 over the physical page), not nominal “5%” unless markers are actually centered there.
 * @returns {cv.Mat} - Warped image (1700×2200)
 */
export function warpToTemplate(src, anchors, layout) {
  // Source points from detected anchors (order: tl, tr, br, bl)
  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
    anchors.find(a => a.id === 'tl').x, anchors.find(a => a.id === 'tl').y,
    anchors.find(a => a.id === 'tr').x, anchors.find(a => a.id === 'tr').y,
    anchors.find(a => a.id === 'br').x, anchors.find(a => a.id === 'br').y,
    anchors.find(a => a.id === 'bl').x, anchors.find(a => a.id === 'bl').y
  ]);

  // Destination points: from layout homography anchors (normalized 0–1 → pixels) or fixed
  const layoutAnchors = layout?.homography?.anchors;
  const hasLayoutAnchors = Array.isArray(layoutAnchors) && layoutAnchors.length === 4 &&
    ['tl', 'tr', 'br', 'bl'].every(id => {
      const a = layoutAnchors.find(an => an.id === id);
      return a && typeof a.x === 'number' && typeof a.y === 'number' && a.x >= 0 && a.x <= 1 && a.y >= 0 && a.y <= 1;
    });

  let dstPoints;
  if (hasLayoutAnchors) {
    const tl = layoutAnchors.find(a => a.id === 'tl');
    const tr = layoutAnchors.find(a => a.id === 'tr');
    const br = layoutAnchors.find(a => a.id === 'br');
    const bl = layoutAnchors.find(a => a.id === 'bl');
    dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      tl.x * WARP_WIDTH, tl.y * WARP_HEIGHT,
      tr.x * WARP_WIDTH, tr.y * WARP_HEIGHT,
      br.x * WARP_WIDTH, br.y * WARP_HEIGHT,
      bl.x * WARP_WIDTH, bl.y * WARP_HEIGHT
    ]);
  } else {
    dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
      0, 0,
      WARP_WIDTH, 0,
      WARP_WIDTH, WARP_HEIGHT,
      0, WARP_HEIGHT
    ]);
  }

  const H = cv.findHomography(srcPoints, dstPoints);
  const warped = new cv.Mat();
  cv.warpPerspective(src, warped, H, new cv.Size(WARP_WIDTH, WARP_HEIGHT));

  srcPoints.delete();
  dstPoints.delete();
  H.delete();

  return warped;
}

function refineBoxRectFromOutline(warped, expectedRect) {
  const padX = Math.max(8, Math.round(expectedRect.w * 0.45));
  const padY = Math.max(8, Math.round(expectedRect.h * 0.45));
  const sx = Math.max(0, Math.floor(expectedRect.x - padX));
  const sy = Math.max(0, Math.floor(expectedRect.y - padY));
  const ex = Math.min(warped.cols, Math.ceil(expectedRect.x + expectedRect.w + padX));
  const ey = Math.min(warped.rows, Math.ceil(expectedRect.y + expectedRect.h + padY));
  const sw = Math.max(1, ex - sx);
  const sh = Math.max(1, ey - sy);

  const roi = warped.roi(new cv.Rect(sx, sy, sw, sh)).clone();
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const binary = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0);
    cv.adaptiveThreshold(
      blur,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      31,
      6
    );
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best = null;
    let bestScore = -Infinity;
    const expAspect = expectedRect.h > 0 ? expectedRect.w / expectedRect.h : 1;
    const expArea = Math.max(1, expectedRect.w * expectedRect.h);
    const expCx = expectedRect.x + expectedRect.w / 2;
    const expCy = expectedRect.y + expectedRect.h / 2;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      const rect = cv.boundingRect(cnt);
      const rectArea = Math.max(1, rect.width * rect.height);
      const fillRatio = area / rectArea;
      const aspect = rect.height > 0 ? rect.width / rect.height : 0;
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.04 * peri, true);

      const globalRect = {
        x: sx + rect.x,
        y: sy + rect.y,
        w: rect.width,
        h: rect.height
      };
      const cx = globalRect.x + globalRect.w / 2;
      const cy = globalRect.y + globalRect.h / 2;
      const areaRatio = rectArea / expArea;
      const centerDist = Math.hypot(cx - expCx, cy - expCy);
      const aspectPenalty = Math.abs(aspect - expAspect);

      const acceptable =
        approx.rows >= 4 &&
        approx.rows <= 8 &&
        areaRatio >= 0.7 &&
        areaRatio <= 2.2 &&
        fillRatio >= 0.03 &&
        fillRatio <= 0.45 &&
        aspect >= Math.max(0.4, expAspect * 0.50) &&
        aspect <= Math.min(4.8, expAspect * 1.85) &&
        centerDist <= Math.max(expectedRect.w, expectedRect.h) * 0.85;

      if (acceptable) {
        const score =
          500
          - centerDist * 2.2
          - Math.abs(areaRatio - 1) * 120
          - aspectPenalty * 90
          + Math.min(40, peri / 20);
        if (score > bestScore) {
          bestScore = score;
          best = globalRect;
        }
      }

      approx.delete();
      cnt.delete();
    }

    return best;
  } finally {
    roi.delete();
    gray.delete();
    blur.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function refineAnswerFrameFromHorizontalLines(warped, expectedRect) {
  if (!warped || !expectedRect) return null;
  const padX = Math.max(10, Math.round(expectedRect.w * 0.42));
  const padY = Math.max(10, Math.round(expectedRect.h * 0.95));
  const sx = Math.max(0, Math.floor(expectedRect.x - padX));
  const sy = Math.max(0, Math.floor(expectedRect.y - padY));
  const ex = Math.min(warped.cols, Math.ceil(expectedRect.x + expectedRect.w + padX));
  const ey = Math.min(warped.rows, Math.ceil(expectedRect.y + expectedRect.h + padY));
  const sw = Math.max(1, ex - sx);
  const sh = Math.max(1, ey - sy);
  if (sw < 4 || sh < 4) return null;

  const roi = warped.roi(new cv.Rect(sx, sy, sw, sh)).clone();
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const binary = new cv.Mat();
  const horizontal = new cv.Mat();
  const kernelWidth = Math.max(9, Math.round(expectedRect.w * 0.20));
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kernelWidth, 1));
  try {
    cv.cvtColor(roi, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0);
    cv.adaptiveThreshold(
      blur,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      31,
      5
    );
    cv.morphologyEx(binary, horizontal, cv.MORPH_OPEN, kernel);

    const rx0 = clampNumber(Math.floor(expectedRect.x - sx - expectedRect.w * 0.12), 0, sw - 1);
    const rx1 = clampNumber(Math.ceil(expectedRect.x - sx + expectedRect.w * 1.12), rx0 + 1, sw);
    const rowScores = [];
    for (let y = 0; y < sh; y++) {
      let score = 0;
      for (let x = rx0; x < rx1; x++) {
        if (horizontal.ucharPtr(y, x)[0] > 0) score++;
      }
      rowScores.push(score);
    }

    const minRowScore = Math.max(7, expectedRect.w * 0.16);
    const peaks = [];
    let start = -1;
    let weighted = 0;
    let total = 0;
    let maxScore = 0;
    for (let y = 0; y <= rowScores.length; y++) {
      const score = rowScores[y] || 0;
      if (score >= minRowScore) {
        if (start < 0) start = y;
        weighted += y * score;
        total += score;
        maxScore = Math.max(maxScore, score);
      } else if (start >= 0) {
        const end = y - 1;
        peaks.push({
          y: total > 0 ? weighted / total : (start + end) / 2,
          start,
          end,
          score: total,
          maxScore
        });
        start = -1;
        weighted = 0;
        total = 0;
        maxScore = 0;
      }
    }

    const expectedCenterY = expectedRect.y + expectedRect.h / 2;
    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < peaks.length; i++) {
      for (let j = i + 1; j < peaks.length; j++) {
        const top = peaks[i];
        const bottom = peaks[j];
        const sep = bottom.y - top.y;
        if (sep < expectedRect.h * 0.55 || sep > expectedRect.h * 1.52) continue;
        const globalTop = sy + top.y;
        const globalBottom = sy + bottom.y;
        const centerY = (globalTop + globalBottom) / 2;
        const centerDist = Math.abs(centerY - expectedCenterY);
        if (centerDist > expectedRect.h * 1.18) continue;
        const score =
          top.score + bottom.score
          - Math.abs(sep - expectedRect.h) * 0.85
          - centerDist * 0.45
          + Math.min(top.maxScore, bottom.maxScore) * 8;
        if (score > bestScore) {
          bestScore = score;
          best = {
            x: expectedRect.x,
            y: Math.max(0, globalTop),
            w: expectedRect.w,
            h: Math.max(1, globalBottom - globalTop)
          };
        }
      }
    }

    return best;
  } finally {
    roi.delete();
    gray.delete();
    blur.delete();
    binary.delete();
    horizontal.delete();
    kernel.delete();
  }
}

function rectCenter(rect) {
  return {
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2
  };
}

function rectOverlapRatio(a, b) {
  const x0 = Math.max(a.x, b.x);
  const y0 = Math.max(a.y, b.y);
  const x1 = Math.min(a.x + a.w, b.x + b.w);
  const y1 = Math.min(a.y + a.h, b.y + b.h);
  const iw = Math.max(0, x1 - x0);
  const ih = Math.max(0, y1 - y0);
  const intersection = iw * ih;
  const smaller = Math.max(1, Math.min(a.w * a.h, b.w * b.h));
  return intersection / smaller;
}

function rectSizeRatio(candidate, expected) {
  const expectedArea = Math.max(1, expected.w * expected.h);
  const candidateArea = Math.max(1, candidate.w * candidate.h);
  return candidateArea / expectedArea;
}

function answerRectLooksLocal(candidate, expected) {
  if (!candidate || !expected) return false;
  const ec = rectCenter(expected);
  const cc = rectCenter(candidate);
  const dx = Math.abs(cc.x - ec.x);
  const dy = Math.abs(cc.y - ec.y);
  const areaRatio = rectSizeRatio(candidate, expected);
  const aspect = candidate.h > 0 ? candidate.w / candidate.h : 0;
  const expectedAspect = expected.h > 0 ? expected.w / expected.h : 1;

  return (
    dx <= expected.w * 1.05 &&
    dy <= expected.h * 1.25 &&
    areaRatio >= 0.45 &&
    areaRatio <= 1.85 &&
    aspect >= expectedAspect * 0.55 &&
    aspect <= expectedAspect * 1.85
  );
}

function answerFrameLooksLocal(candidate, expected) {
  if (!candidate || !expected) return false;
  const ec = rectCenter(expected);
  const cc = rectCenter(candidate);
  const dx = Math.abs(cc.x - ec.x);
  const dy = Math.abs(cc.y - ec.y);
  const areaRatio = rectSizeRatio(candidate, expected);
  const aspect = candidate.h > 0 ? candidate.w / candidate.h : 0;
  const expectedAspect = expected.h > 0 ? expected.w / expected.h : 1;

  return (
    dx <= expected.w * 0.48 &&
    dy <= expected.h * 0.62 &&
    areaRatio >= 0.66 &&
    areaRatio <= 1.46 &&
    aspect >= expectedAspect * 0.72 &&
    aspect <= expectedAspect * 1.34
  );
}

function virtualAnswerFrameLooksLocal(candidate, expected) {
  if (!candidate || !expected) return false;
  const ec = rectCenter(expected);
  const cc = rectCenter(candidate);
  const dx = Math.abs(cc.x - ec.x);
  const dy = Math.abs(cc.y - ec.y);
  const areaRatio = rectSizeRatio(candidate, expected);
  const aspect = candidate.h > 0 ? candidate.w / candidate.h : 0;
  const expectedAspect = expected.h > 0 ? expected.w / expected.h : 1;

  return (
    dx <= expected.w * 0.54 &&
    dy <= expected.h * 1.80 &&
    areaRatio >= 0.58 &&
    areaRatio <= 1.68 &&
    aspect >= expectedAspect * 0.58 &&
    aspect <= expectedAspect * 1.55
  );
}

function digitRectLooksLocal(candidate, expected) {
  if (!candidate || !expected) return false;
  const ec = rectCenter(expected);
  const cc = rectCenter(candidate);
  const dx = Math.abs(cc.x - ec.x);
  const dy = Math.abs(cc.y - ec.y);
  const areaRatio = rectSizeRatio(candidate, expected);
  const aspect = candidate.h > 0 ? candidate.w / candidate.h : 0;
  const expectedAspect = expected.h > 0 ? expected.w / expected.h : 1;

  return (
    dx <= expected.w * 0.58 &&
    dy <= expected.h * 0.62 &&
    areaRatio >= 0.68 &&
    areaRatio <= 1.42 &&
    aspect >= expectedAspect * 0.70 &&
    aspect <= expectedAspect * 1.38
  );
}

function virtualDigitRectLooksLocal(candidate, expected) {
  if (!candidate || !expected) return false;
  const ec = rectCenter(expected);
  const cc = rectCenter(candidate);
  const dx = Math.abs(cc.x - ec.x);
  const dy = Math.abs(cc.y - ec.y);
  const areaRatio = rectSizeRatio(candidate, expected);
  const aspect = candidate.h > 0 ? candidate.w / candidate.h : 0;
  const expectedAspect = expected.h > 0 ? expected.w / expected.h : 1;

  return (
    dx <= expected.w * 0.62 &&
    dy <= expected.h * 0.72 &&
    areaRatio >= 0.68 &&
    areaRatio <= 1.42 &&
    aspect >= expectedAspect * 0.68 &&
    aspect <= expectedAspect * 1.45
  );
}

function blendRects(expected, candidate, candidateWeight = 0.38) {
  if (!expected || !candidate) return expected || candidate || null;
  const w = clampNumber(candidateWeight, 0, 1);
  const ew = 1 - w;
  return {
    x: expected.x * ew + candidate.x * w,
    y: expected.y * ew + candidate.y * w,
    w: expected.w * ew + candidate.w * w,
    h: expected.h * ew + candidate.h * w
  };
}

function blendRectsByAxis(expected, candidate, weights = {}) {
  if (!expected || !candidate) return expected || candidate || null;
  const wx = clampNumber(weights.x ?? 0.38, 0, 1);
  const wy = clampNumber(weights.y ?? wx, 0, 1);
  const ww = clampNumber(weights.w ?? wx, 0, 1);
  const wh = clampNumber(weights.h ?? wy, 0, 1);
  return {
    x: expected.x * (1 - wx) + candidate.x * wx,
    y: expected.y * (1 - wy) + candidate.y * wy,
    w: expected.w * (1 - ww) + candidate.w * ww,
    h: expected.h * (1 - wh) + candidate.h * wh
  };
}

function unionRects(rects) {
  const valid = (rects || []).filter(Boolean);
  if (valid.length === 0) return null;
  const x0 = Math.min(...valid.map((rect) => rect.x));
  const y0 = Math.min(...valid.map((rect) => rect.y));
  const x1 = Math.max(...valid.map((rect) => rect.x + rect.w));
  const y1 = Math.max(...valid.map((rect) => rect.y + rect.h));
  return {
    x: x0,
    y: y0,
    w: x1 - x0,
    h: y1 - y0
  };
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function guideLineRelX(group, expectedFrame) {
  const guideX = group?.guide_line?.x;
  if (!Number.isFinite(guideX) || !expectedFrame?.w) return 0.5;
  const guidePx = guideX >= 0 && guideX <= 1 ? guideX * WARP_WIDTH : guideX;
  return clampNumber((guidePx - expectedFrame.x) / expectedFrame.w, 0.38, 0.62);
}

function splitFrameByPrintedDigitGuide(refinedFrame, expectedFrame, digitRects, group) {
  if (!refinedFrame || !expectedFrame || !Array.isArray(digitRects) || digitRects.length !== 2) return null;
  const sorted = digitRects.slice().sort((a, b) => a.x - b.x);
  const expectedGap = Math.max(0, sorted[1].x - (sorted[0].x + sorted[0].w));
  const expectedGapRel = expectedFrame.w > 0 ? expectedGap / expectedFrame.w : 0.035;
  const halfGuideGap = refinedFrame.w * clampNumber(expectedGapRel / 2, 0.010, 0.030);
  const splitX = refinedFrame.x + guideLineRelX(group, expectedFrame) * refinedFrame.w;
  const leftW = Math.max(1, splitX - halfGuideGap - refinedFrame.x);
  const rightX = Math.min(refinedFrame.x + refinedFrame.w - 1, splitX + halfGuideGap);
  const rightW = Math.max(1, refinedFrame.x + refinedFrame.w - rightX);

  return new Map([
    [sorted[0].id, { x: refinedFrame.x, y: refinedFrame.y, w: leftW, h: refinedFrame.h }],
    [sorted[1].id, { x: rightX, y: refinedFrame.y, w: rightW, h: refinedFrame.h }]
  ]);
}

function frameFromExpectedDigitRects(expectedFrame, digitRects) {
  if (!expectedFrame || !Array.isArray(digitRects) || digitRects.length === 0) return null;
  return new Map(digitRects.map((digitRect) => {
    const relX = expectedFrame.w > 0 ? (digitRect.x - expectedFrame.x) / expectedFrame.w : 0;
    const relY = expectedFrame.h > 0 ? (digitRect.y - expectedFrame.y) / expectedFrame.h : 0;
    const relW = expectedFrame.w > 0 ? digitRect.w / expectedFrame.w : 1 / digitRects.length;
    const relH = expectedFrame.h > 0 ? digitRect.h / expectedFrame.h : 1;
    return [digitRect.id, { relX, relY, relW, relH }];
  }));
}

function buildVirtualDigitBoxRects(warped, layout, expectedRects) {
  const frameRects = [];
  const expectedById = new Map(expectedRects.map((rect) => [rect.id, rect]));
  const groups = Array.isArray(layout.question_groups) ? layout.question_groups : [];

  for (const group of groups) {
    const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : [];
    if (ids.length < 2) continue;
    const digitRects = ids.map((id) => expectedById.get(id)).filter(Boolean);
    const expectedFrame = unionRects(digitRects);
    if (!expectedFrame) continue;
    frameRects.push({
      ...expectedFrame,
      id: `question-${group.question_num}`,
      questionNum: group.question_num,
      digitIds: ids,
      digitRects,
      guide_line: group.guide_line
    });
  }

  const assignedFrames = detectAnswerBoxRects(warped, frameRects);
  const assignments = new Map();
  const virtualFrameDebug = [];

  for (const expectedFrame of frameRects) {
    const detectedFrame = assignedFrames.get(expectedFrame.id);
    const trustedPhysicalFrame = detectedFrame?.trustedPhysicalAnswerFrame === true;
    const hasDetectedFrame = trustedPhysicalFrame || virtualAnswerFrameLooksLocal(detectedFrame, expectedFrame);
    let refinedFrameCandidate = null;
    let usedLineFrame = false;

    // Two-digit worksheet answer frames contain a printed center guide. The
    // template gives stable row order, but phone/tablet captures can leave the
    // printed answer boxes shifted after the page homography. When the physical
    // answer frame is detected near the expected slot, trust it directly so OCR
    // follows the real ink instead of a stale template position.
    if (hasDetectedFrame) {
      refinedFrameCandidate = detectedFrame;
    } else {
      const outlineFrameCandidate = refineBoxRectFromOutline(warped, expectedFrame);
      const lineSearchFrame = virtualAnswerFrameLooksLocal(outlineFrameCandidate, expectedFrame)
        ? outlineFrameCandidate
        : expectedFrame;
      const rawLineFrameCandidate = refineAnswerFrameFromHorizontalLines(warped, lineSearchFrame);
      const lineFrameCandidate = rawLineFrameCandidate &&
        virtualAnswerFrameLooksLocal(rawLineFrameCandidate, expectedFrame) &&
        Math.abs(rectCenter(rawLineFrameCandidate).y - rectCenter(expectedFrame).y) <= expectedFrame.h * 0.95 &&
        (!outlineFrameCandidate ||
          Math.abs(rectCenter(rawLineFrameCandidate).y - rectCenter(outlineFrameCandidate).y) <= expectedFrame.h * 0.50)
        ? rawLineFrameCandidate
        : null;
      refinedFrameCandidate = lineFrameCandidate
        ? {
          ...lineSearchFrame,
          y: lineFrameCandidate.y,
          h: lineFrameCandidate.h
        }
        : outlineFrameCandidate;
      usedLineFrame = !!lineFrameCandidate;
    }

    const frameCandidateLooksSafe = hasDetectedFrame
      ? (trustedPhysicalFrame || virtualAnswerFrameLooksLocal(refinedFrameCandidate, expectedFrame))
      : (
        refinedFrameCandidate &&
        Math.abs(rectCenter(refinedFrameCandidate).x - rectCenter(expectedFrame).x) <= expectedFrame.w * 0.54 &&
        Math.abs(rectCenter(refinedFrameCandidate).y - rectCenter(expectedFrame).y) <= expectedFrame.h * 0.86 &&
        rectSizeRatio(refinedFrameCandidate, expectedFrame) >= 0.66 &&
        rectSizeRatio(refinedFrameCandidate, expectedFrame) <= 1.46
      );
    const refinedFrame = frameCandidateLooksSafe
      ? blendRectsByAxis(expectedFrame, refinedFrameCandidate, {
        x: trustedPhysicalFrame ? 0.98 : (hasDetectedFrame ? 0.92 : 0.38),
        w: trustedPhysicalFrame ? 0.96 : (hasDetectedFrame ? 0.90 : 0.40),
        y: trustedPhysicalFrame ? 0.98 : (hasDetectedFrame ? 0.94 : (usedLineFrame ? 0.42 : 0.36)),
        h: trustedPhysicalFrame ? 0.94 : (hasDetectedFrame ? 0.86 : (usedLineFrame ? 0.38 : 0.34))
      })
      : expectedFrame;

    const guidedSplit = splitFrameByPrintedDigitGuide(refinedFrame, expectedFrame, expectedFrame.digitRects, expectedFrame);
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_ANSWER_BOXES) {
      virtualFrameDebug.push({
        id: expectedFrame.id,
        questionNum: expectedFrame.questionNum,
        expectedFrame: { ...expectedFrame },
        detectedFrame: detectedFrame ? { ...detectedFrame } : null,
        trustedPhysicalFrame,
        hasDetectedFrame,
        usedLineFrame,
        refinedFrameCandidate: refinedFrameCandidate ? { ...refinedFrameCandidate } : null,
        frameCandidateLooksSafe,
        refinedFrame: refinedFrame ? { ...refinedFrame } : null,
        guidedSplit: guidedSplit
          ? Array.from(guidedSplit.entries()).map(([id, rect]) => ({ id, rect: { ...rect } }))
          : null
      });
    }
    if (guidedSplit) {
      for (const digitRect of expectedFrame.digitRects) {
        const guidedRect = guidedSplit.get(digitRect.id);
        const trustedGuidedRect = guidedRect
          ? {
              ...guidedRect,
              trustedPhysicalDigitBox: hasDetectedFrame && frameCandidateLooksSafe,
              parentAnswerFrameId: expectedFrame.id,
              answerFrameAssignmentMethod: detectedFrame?.answerFrameAssignmentMethod || null
            }
          : guidedRect;
        assignments.set(
          digitRect.id,
          hasDetectedFrame && frameCandidateLooksSafe
            ? trustedGuidedRect
            : (virtualDigitRectLooksLocal(guidedRect, digitRect) ? trustedGuidedRect : digitRect)
        );
      }
      continue;
    }

    const relativeDigitRects = frameFromExpectedDigitRects(expectedFrame, expectedFrame.digitRects);
    for (const digitRect of expectedFrame.digitRects) {
      const rel = relativeDigitRects?.get(digitRect.id);
      if (!rel) {
        assignments.set(digitRect.id, digitRect);
        continue;
      }
      assignments.set(digitRect.id, {
        x: refinedFrame.x + rel.relX * refinedFrame.w,
        y: refinedFrame.y + rel.relY * refinedFrame.h,
        w: rel.relW * refinedFrame.w,
        h: rel.relH * refinedFrame.h
      });
    }
  }

  if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_ANSWER_BOXES) {
    window.__SCANGRADE_DEBUG_VIRTUAL_FRAMES = virtualFrameDebug;
  }
  return assignments;
}

function binaryFillRatio(binary, rect, insetFrac = 0) {
  if (!binary || !rect) return 1;
  const insetX = Math.max(0, Math.round(rect.width * insetFrac));
  const insetY = Math.max(0, Math.round(rect.height * insetFrac));
  const x0 = Math.max(0, rect.x + insetX);
  const y0 = Math.max(0, rect.y + insetY);
  const x1 = Math.min(binary.cols, rect.x + rect.width - insetX);
  const y1 = Math.min(binary.rows, rect.y + rect.height - insetY);
  let total = 0;
  let filled = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      total++;
      if (binary.ucharPtr(y, x)[0] > 0) filled++;
    }
  }
  return total ? filled / total : 1;
}

function binaryBandFillRatio(binary, x0, y0, x1, y1) {
  if (!binary) return 0;
  const sx = clampNumber(Math.floor(x0), 0, binary.cols);
  const sy = clampNumber(Math.floor(y0), 0, binary.rows);
  const ex = clampNumber(Math.ceil(x1), sx, binary.cols);
  const ey = clampNumber(Math.ceil(y1), sy, binary.rows);
  let total = 0;
  let filled = 0;
  for (let y = sy; y < ey; y++) {
    for (let x = sx; x < ex; x++) {
      total++;
      if (binary.ucharPtr(y, x)[0] > 0) filled++;
    }
  }
  return total ? filled / total : 0;
}

function binaryFrameStrength(binary, rect, borderFrac = 0.12) {
  if (!binary || !rect) return { all: 0, horizontal: 0, vertical: 0 };
  const bw = Math.max(2, Math.round(rect.width * borderFrac));
  const bh = Math.max(2, Math.round(rect.height * borderFrac));
  const x0 = rect.x;
  const y0 = rect.y;
  const x1 = rect.x + rect.width;
  const y1 = rect.y + rect.height;
  const top = binaryBandFillRatio(binary, x0, y0, x1, y0 + bh);
  const bottom = binaryBandFillRatio(binary, x0, y1 - bh, x1, y1);
  const left = binaryBandFillRatio(binary, x0, y0 + bh, x0 + bw, y1 - bh);
  const right = binaryBandFillRatio(binary, x1 - bw, y0 + bh, x1, y1 - bh);
  const horizontal = (top + bottom) / 2;
  const vertical = (left + right) / 2;
  return {
    all: (top + bottom + left + right) / 4,
    horizontal,
    vertical
  };
}

function medianNumber(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function chooseBestOrderedSubset(candidates, expectedRow, expW, expH) {
  if (candidates.length < expectedRow.length) return null;
  const sortedCandidates = candidates.slice().sort((a, b) => a.cx - b.cx);
  const targetCount = expectedRow.length;
  let best = null;

  const scoreSubset = (subset) => {
    const expectedCenters = expectedRow.map((rect) => rectCenter(rect).x);
    const actualCenters = subset.map((candidate) => candidate.cx);
    const meanExpected = expectedCenters.reduce((sum, x) => sum + x, 0) / targetCount;
    const meanActual = actualCenters.reduce((sum, x) => sum + x, 0) / targetCount;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < targetCount; i++) {
      numerator += (expectedCenters[i] - meanExpected) * (actualCenters[i] - meanActual);
      denominator += Math.pow(expectedCenters[i] - meanExpected, 2);
    }
    const scale = Math.abs(denominator) > 1e-6 ? numerator / denominator : 1;
    const offset = meanActual - scale * meanExpected;
    const xResidual = actualCenters.reduce((sum, x, idx) => {
      const predicted = scale * expectedCenters[idx] + offset;
      return sum + Math.abs(x - predicted) / Math.max(1, expW);
    }, 0) / targetCount;
    const yMedian = medianNumber(subset.map((candidate) => candidate.cy));
    const yResidual = subset.reduce((sum, candidate) => (
      sum + Math.abs(candidate.cy - yMedian) / Math.max(1, expH)
    ), 0) / targetCount;
    const sizeScore = subset.reduce((sum, candidate) => sum + candidate.sizeScore, 0) / targetCount;
    const frameStrength = subset.reduce((sum, candidate) => sum + (candidate.frameStrength || 0), 0) / targetCount;
    return xResidual + yResidual * 0.35 + sizeScore * 0.12 - frameStrength * 0.10;
  };

  const walk = (start, picked) => {
    if (picked.length === targetCount) {
      const score = scoreSubset(picked);
      if (!best || score < best.score) {
        best = { subset: picked.slice(), score };
      }
      return;
    }
    const remainingNeeded = targetCount - picked.length;
    for (let i = start; i <= sortedCandidates.length - remainingNeeded; i++) {
      picked.push(sortedCandidates[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return best;
}

function countAxisClusters(values, threshold) {
  const sorted = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  let clusters = 1;
  let center = sorted[0];
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    const value = sorted[i];
    if (Math.abs(value - center) > threshold) {
      clusters++;
      center = value;
      count = 1;
    } else {
      center = (center * count + value) / (count + 1);
      count++;
    }
  }
  return clusters;
}

function looksLikeTwoColumnWorksheetLayout(expectedRects, expW, expH) {
  if (expectedRects.length !== 10) return false;
  const centers = expectedRects.map(rectCenter);
  const xClusters = countAxisClusters(centers.map((center) => center.x), expW * 1.35);
  const yClusters = countAxisClusters(centers.map((center) => center.y), expH * 1.28);
  return xClusters === 2 && yClusters >= 4;
}

function chooseBestOrderedSubsetByY(candidates, expectedColumn, expW, expH) {
  if (candidates.length < expectedColumn.length) return null;
  const sortedCandidates = candidates.slice().sort((a, b) => a.cy - b.cy);
  const targetCount = expectedColumn.length;
  let best = null;

  const scoreSubset = (subset) => {
    const expectedCenters = expectedColumn.map((rect) => rectCenter(rect).y);
    const actualCenters = subset.map((candidate) => candidate.cy);
    const meanExpected = expectedCenters.reduce((sum, y) => sum + y, 0) / targetCount;
    const meanActual = actualCenters.reduce((sum, y) => sum + y, 0) / targetCount;
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < targetCount; i++) {
      numerator += (expectedCenters[i] - meanExpected) * (actualCenters[i] - meanActual);
      denominator += Math.pow(expectedCenters[i] - meanExpected, 2);
    }
    const scale = Math.abs(denominator) > 1e-6 ? numerator / denominator : 1;
    const offset = meanActual - scale * meanExpected;
    const yResidual = actualCenters.reduce((sum, y, idx) => {
      const predicted = scale * expectedCenters[idx] + offset;
      return sum + Math.abs(y - predicted) / Math.max(1, expH);
    }, 0) / targetCount;
    const expectedX = medianNumber(expectedColumn.map((rect) => rectCenter(rect).x));
    const xResidual = subset.reduce((sum, candidate) => (
      sum + Math.abs(candidate.cx - expectedX) / Math.max(1, expW)
    ), 0) / targetCount;
    const sizeScore = subset.reduce((sum, candidate) => sum + candidate.sizeScore, 0) / targetCount;
    const frameStrength = subset.reduce((sum, candidate) => sum + (candidate.frameStrength || 0), 0) / targetCount;
    const monotonicPenalty = scale <= 0 ? 3 : Math.abs(scale - 1) * 0.18;
    return yResidual + xResidual * 0.28 + sizeScore * 0.14 + monotonicPenalty - frameStrength * 0.12;
  };

  const walk = (start, picked) => {
    if (picked.length === targetCount) {
      const score = scoreSubset(picked);
      if (!best || score < best.score) {
        best = { subset: picked.slice(), score };
      }
      return;
    }
    const remainingNeeded = targetCount - picked.length;
    for (let i = start; i <= sortedCandidates.length - remainingNeeded; i++) {
      picked.push(sortedCandidates[i]);
      walk(i + 1, picked);
      picked.pop();
    }
  };
  walk(0, []);
  return best;
}

function columnSubsetLooksPhysicallySane(subset, expectedColumn, expW, expH) {
  if (!Array.isArray(subset) || !Array.isArray(expectedColumn)) return false;
  if (subset.length !== expectedColumn.length || subset.length < 2) return false;

  const sorted = subset.slice().sort((a, b) => a.cy - b.cy);
  const xMedian = medianNumber(sorted.map((candidate) => candidate.cx));
  const maxXDrift = sorted.reduce((max, candidate) => (
    Math.max(max, Math.abs(candidate.cx - xMedian))
  ), 0);
  if (maxXDrift > expW * 0.72) return false;

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(sorted[i].cy - sorted[i - 1].cy);
  }
  const medianGap = medianNumber(gaps);
  if (!Number.isFinite(medianGap) || medianGap < expH * 0.74 || medianGap > expH * 2.25) return false;
  const gapTolerance = Math.max(expH * 0.52, medianGap * 0.38);
  if (gaps.some((gap) => Math.abs(gap - medianGap) > gapTolerance)) return false;

  const expectedSorted = expectedColumn.slice().sort((a, b) => rectCenter(a).y - rectCenter(b).y);
  const expectedGaps = [];
  for (let i = 1; i < expectedSorted.length; i++) {
    expectedGaps.push(rectCenter(expectedSorted[i]).y - rectCenter(expectedSorted[i - 1]).y);
  }
  const expectedMedianGap = medianNumber(expectedGaps);
  if (Number.isFinite(expectedMedianGap) && expectedMedianGap > 0) {
    const gapScale = medianGap / expectedMedianGap;
    if (gapScale < 0.62 || gapScale > 1.62) return false;
  }

  return sorted.every((candidate) => (
    candidate.rect &&
    candidate.rect.w >= expW * 0.52 &&
    candidate.rect.w <= expW * 1.62 &&
    candidate.rect.h >= expH * 0.52 &&
    candidate.rect.h <= expH * 1.72 &&
    (candidate.frameStrength || 0) >= 0.018
  ));
}

function assignmentsFromColumnSubsets(columnSubsets, expectedColumns, method = 'column-order') {
  const assignments = new Map();
  for (let columnIdx = 0; columnIdx < 2; columnIdx++) {
    const subset = columnSubsets[columnIdx].slice().sort((a, b) => a.cy - b.cy);
    const expectedColumn = expectedColumns[columnIdx].slice().sort((a, b) => rectCenter(a).y - rectCenter(b).y);
    for (let i = 0; i < expectedColumn.length; i++) {
      assignments.set(expectedColumn[i].id, {
        ...subset[i].rect,
        trustedPhysicalAnswerFrame: true,
        answerFrameAssignmentMethod: method
      });
    }
  }
  return assignments;
}

function assignAnswerBoxesByColumnOrder(candidates, expectedRects, expW, expH) {
  if (!looksLikeTwoColumnWorksheetLayout(expectedRects, expW, expH) || candidates.length < 10) return null;

  const expectedSortedByX = expectedRects.slice().sort((a, b) => rectCenter(a).x - rectCenter(b).x);
  const expectedColumns = [
    expectedSortedByX.slice(0, 5).sort((a, b) => rectCenter(a).y - rectCenter(b).y),
    expectedSortedByX.slice(5, 10).sort((a, b) => rectCenter(a).y - rectCenter(b).y)
  ];
  const expectedColumnCenters = expectedColumns.map((column) => (
    medianNumber(column.map((rect) => rectCenter(rect).x))
  ));
  const boundary = (expectedColumnCenters[0] + expectedColumnCenters[1]) / 2;
  const candidateColumns = [
    candidates.filter((candidate) => candidate.cx < boundary),
    candidates.filter((candidate) => candidate.cx >= boundary)
  ];
  if (candidateColumns[0].length < 5 || candidateColumns[1].length < 5) return null;

  const directColumns = candidateColumns.map((column) => column.slice().sort((a, b) => a.cy - b.cy));
  if (
    directColumns[0].length === expectedColumns[0].length &&
    directColumns[1].length === expectedColumns[1].length &&
    columnSubsetLooksPhysicallySane(directColumns[0], expectedColumns[0], expW, expH) &&
    columnSubsetLooksPhysicallySane(directColumns[1], expectedColumns[1], expW, expH)
  ) {
    return assignmentsFromColumnSubsets(directColumns, expectedColumns, 'column-direct');
  }

  const columnAssignments = [
    chooseBestOrderedSubsetByY(candidateColumns[0], expectedColumns[0], expW, expH),
    chooseBestOrderedSubsetByY(candidateColumns[1], expectedColumns[1], expW, expH)
  ];
  if (!columnAssignments[0] || !columnAssignments[1]) return null;
  if (
    !columnSubsetLooksPhysicallySane(columnAssignments[0].subset, expectedColumns[0], expW, expH) ||
    !columnSubsetLooksPhysicallySane(columnAssignments[1].subset, expectedColumns[1], expW, expH)
  ) return null;
  if (columnAssignments[0].score > 4.25 || columnAssignments[1].score > 4.25) return null;

  return assignmentsFromColumnSubsets(
    columnAssignments.map((assignment) => assignment.subset),
    expectedColumns,
    'column-subset'
  );
}

function assignAnswerBoxesByGridOrder(candidates, expectedRects, expW, expH) {
  // The template positions are ideal, but live webcam homography can retain
  // slight projective skew. When all printed boxes are visible, physical
  // reading order is safer than nearest-neighbor matching to ideal coordinates.
  if (expectedRects.length !== 10 || candidates.length < 10) return null;

  const expectedByRow = expectedRects
    .slice()
    .sort((a, b) => rectCenter(a).y - rectCenter(b).y)
    .reduce((rows, rect, idx) => {
      rows[idx < 5 ? 0 : 1].push(rect);
      return rows;
    }, [[], []])
    .map((row) => row.sort((a, b) => rectCenter(a).x - rectCenter(b).x));

  let rowCenters = [
    medianNumber(candidates.map((candidate) => candidate.cy)) - expH,
    medianNumber(candidates.map((candidate) => candidate.cy)) + expH
  ];
  for (let iter = 0; iter < 8; iter++) {
    const rows = [[], []];
    for (const candidate of candidates) {
      const rowIdx = Math.abs(candidate.cy - rowCenters[0]) <= Math.abs(candidate.cy - rowCenters[1]) ? 0 : 1;
      rows[rowIdx].push(candidate);
    }
    for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
      if (rows[rowIdx].length > 0) {
        rowCenters[rowIdx] = medianNumber(rows[rowIdx].map((candidate) => candidate.cy));
      }
    }
    rowCenters = rowCenters.sort((a, b) => a - b);
  }

  const candidateRows = [[], []];
  for (const candidate of candidates) {
    const rowIdx = Math.abs(candidate.cy - rowCenters[0]) <= Math.abs(candidate.cy - rowCenters[1]) ? 0 : 1;
    candidateRows[rowIdx].push(candidate);
  }
  if (candidateRows[0].length < 5 || candidateRows[1].length < 5) return null;

  const rowAssignments = [
    chooseBestOrderedSubset(candidateRows[0], expectedByRow[0], expW, expH),
    chooseBestOrderedSubset(candidateRows[1], expectedByRow[1], expW, expH)
  ];
  if (!rowAssignments[0] || !rowAssignments[1]) return null;
  if (rowAssignments[0].score > 1.25 || rowAssignments[1].score > 1.25) return null;

  const assignments = new Map();
  for (let rowIdx = 0; rowIdx < 2; rowIdx++) {
    const subset = rowAssignments[rowIdx].subset.slice().sort((a, b) => a.cx - b.cx);
    const expectedRow = expectedByRow[rowIdx];
    for (let i = 0; i < expectedRow.length; i++) {
      assignments.set(expectedRow[i].id, subset[i].rect);
    }
  }
  return assignments;
}

function detectAnswerBoxRects(warped, expectedRects) {
  if (!Array.isArray(expectedRects) || expectedRects.length === 0) return new Map();

  const expW = medianNumber(expectedRects.map((r) => r.w));
  const expH = medianNumber(expectedRects.map((r) => r.h));
  const expArea = Math.max(1, expW * expH);
  const minX = Math.min(...expectedRects.map((r) => r.x)) - expW * 1.05;
  const maxX = Math.max(...expectedRects.map((r) => r.x + r.w)) + expW * 1.05;
  const minY = Math.min(...expectedRects.map((r) => r.y)) - expH * 1.25;
  const maxY = Math.max(...expectedRects.map((r) => r.y + r.h)) + expH * 1.25;

  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const binary = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  try {
    cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(3, 3), 0);
    cv.adaptiveThreshold(
      blur,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      31,
      6
    );
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates = [];
    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const contourArea = cv.contourArea(cnt);
      const rect = cv.boundingRect(cnt);
      const w = rect.width;
      const h = rect.height;
      const rectArea = Math.max(1, w * h);
      const fillRatio = contourArea / rectArea;
      const aspect = h > 0 ? w / h : 0;
      const areaRatio = rectArea / expArea;
      const cx = rect.x + w / 2;
      const cy = rect.y + h / 2;
      const filledRatio = binaryFillRatio(binary, rect, 0);
      const innerFilledRatio = binaryFillRatio(binary, rect, 0.22);
      const frameInk = binaryFrameStrength(binary, rect, 0.13);
      const frameStrength = frameInk.horizontal * 2.2 + frameInk.vertical * 1.15 + frameInk.all * 0.75;

      const plausible =
        cx >= minX &&
        cx <= maxX &&
        cy >= minY &&
        cy <= maxY &&
        w >= expW * 0.45 &&
        w <= expW * 1.55 &&
        h >= expH * 0.45 &&
        h <= expH * 1.65 &&
        areaRatio >= 0.30 &&
        areaRatio <= 2.50 &&
        aspect >= 0.45 &&
        aspect <= 2.20 &&
        fillRatio >= 0.015 &&
        fillRatio <= 1.02 &&
        filledRatio >= 0.025 &&
        filledRatio <= 0.58 &&
        innerFilledRatio <= 0.42 &&
        frameInk.horizontal >= 0.025 &&
        frameInk.all >= 0.020;

      if (plausible) {
        const sizeScore = Math.abs(Math.log(Math.max(0.01, areaRatio))) +
          Math.abs(Math.log(Math.max(0.01, aspect / (expW / expH)))) +
          Math.max(0, innerFilledRatio - 0.22) * 1.8 +
          Math.max(0, 0.13 - frameInk.horizontal) * 2.4 +
          Math.max(0, 0.09 - frameInk.all) * 1.4 -
          Math.min(0.45, frameStrength * 0.55);
        candidates.push({
          rect: { x: rect.x, y: rect.y, w, h },
          cx,
          cy,
          areaRatio,
          fillRatio,
          filledRatio,
          innerFilledRatio,
          frameInk,
          frameStrength,
          sizeScore
        });
      }
      cnt.delete();
    }

    // De-duplicate nested/duplicate contours from thick or partially broken box outlines.
    const deduped = [];
    for (const candidate of candidates.sort((a, b) => a.sizeScore - b.sizeScore)) {
      const duplicate = deduped.some((other) => {
        const dx = candidate.cx - other.cx;
        const dy = candidate.cy - other.cy;
        return Math.hypot(dx, dy) < Math.max(expW, expH) * 0.35 ||
          rectOverlapRatio(candidate.rect, other.rect) > 0.55;
      });
      if (!duplicate) deduped.push(candidate);
    }
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_ANSWER_BOXES) {
      window.__SCANGRADE_DEBUG_ANSWER_BOX_CANDIDATES = deduped.map((candidate) => ({
        rect: candidate.rect,
        cx: candidate.cx,
        cy: candidate.cy,
        areaRatio: candidate.areaRatio,
        fillRatio: candidate.fillRatio,
        filledRatio: candidate.filledRatio,
        innerFilledRatio: candidate.innerFilledRatio,
        frameInk: candidate.frameInk,
        frameStrength: candidate.frameStrength,
        sizeScore: candidate.sizeScore
      }));
    }

    const columnAssignments = assignAnswerBoxesByColumnOrder(deduped, expectedRects, expW, expH);
    if (columnAssignments) {
      if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_ANSWER_BOXES) {
        window.__SCANGRADE_DEBUG_ANSWER_BOX_ASSIGNMENTS = Array.from(columnAssignments.entries()).map(([id, rect]) => ({
          id,
          method: rect.answerFrameAssignmentMethod || 'column-order',
          rect
        }));
      }
      return columnAssignments;
    }

    const gridAssignments = assignAnswerBoxesByGridOrder(deduped, expectedRects, expW, expH);
    if (gridAssignments) {
      if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_ANSWER_BOXES) {
        window.__SCANGRADE_DEBUG_ANSWER_BOX_ASSIGNMENTS = Array.from(gridAssignments.entries()).map(([id, rect]) => ({
          id,
          method: rect.answerFrameAssignmentMethod || 'grid-order',
          rect
        }));
      }
      return gridAssignments;
    }

    const pairs = [];
    for (const expected of expectedRects) {
      const ec = rectCenter(expected);
      for (const candidate of deduped) {
        const dist = Math.hypot(candidate.cx - ec.x, candidate.cy - ec.y) / Math.max(expW, expH);
        const sizePenalty = Math.abs(Math.log(Math.max(0.01, candidate.areaRatio))) * 0.35;
        const score = dist + sizePenalty + candidate.sizeScore * 0.12;
        pairs.push({ expected, candidate, score });
      }
    }

    const assignments = new Map();
    const usedCandidates = new Set();
    const usedExpected = new Set();
    for (const pair of pairs.sort((a, b) => a.score - b.score)) {
      if (pair.score > 2.15) continue;
      if (usedExpected.has(pair.expected.id) || usedCandidates.has(pair.candidate)) continue;
      assignments.set(pair.expected.id, pair.candidate.rect);
      usedExpected.add(pair.expected.id);
      usedCandidates.add(pair.candidate);
    }
    if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_ANSWER_BOXES) {
      window.__SCANGRADE_DEBUG_ANSWER_BOX_ASSIGNMENTS = Array.from(assignments.entries()).map(([id, rect]) => ({
        id,
        method: rect.answerFrameAssignmentMethod || 'nearest-fallback',
        rect
      }));
    }
    return assignments;
  } finally {
    gray.delete();
    blur.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();
  }
}

function virtualDigitLineEraseOptions(digitIndex, overrides = {}) {
  const index = Number(digitIndex);
  return {
    digitIndex: index,
    // Erase the printed answer-box frame and the faint center guide. The guide
    // is useful for splitting two-digit boxes, but if it survives into the
    // model input it can be read as a handwritten 1 on older-camera captures.
    eraseLeft: index === 0,
    eraseRight: index === 1,
    eraseCenterGuide: true,
    eraseHorizontal: true,
    eraseHorizontalFullWidth: true,
    ...overrides
  };
}

function virtualDigitInnerRect(rect, digitIndex, options = {}) {
  if (!rect) return null;
  const index = Number(digitIndex);
  const outerInsetFrac = options.outerInsetFrac ?? 0.08;
  const centerInsetFrac = options.centerInsetFrac ?? 0.075;
  const topInsetFrac = options.topInsetFrac ?? 0.09;
  const bottomInsetFrac = options.bottomInsetFrac ?? 0.13;
  const leftInsetFrac = index === 1 ? centerInsetFrac : outerInsetFrac;
  const rightInsetFrac = index === 0 ? centerInsetFrac : outerInsetFrac;
  const insetLeft = rect.w * leftInsetFrac;
  const insetRight = rect.w * rightInsetFrac;
  const insetTop = rect.h * topInsetFrac;
  const insetBottom = rect.h * bottomInsetFrac;
  return {
    x: rect.x + insetLeft,
    y: rect.y + insetTop,
    w: Math.max(1, rect.w - insetLeft - insetRight),
    h: Math.max(1, rect.h - insetTop - insetBottom)
  };
}

function clampRectToMat(mat, rect) {
  if (!mat || !rect) return null;
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  let w = Math.max(1, Math.ceil(rect.w));
  let h = Math.max(1, Math.ceil(rect.h));
  if (x + w > mat.cols) w = mat.cols - x;
  if (y + h > mat.rows) h = mat.rows - y;
  if (w < 1 || h < 1) return null;
  return { x, y, w, h };
}

function cloneVirtualDigitCropVariant(warped, sourceRect, eraseDigitRect, digitIndex, name, options = {}) {
  const cropRect = clampRectToMat(warped, sourceRect);
  if (!cropRect) return null;
  const image = warped.roi(new cv.Rect(cropRect.x, cropRect.y, cropRect.w, cropRect.h)).clone();
  eraseKnownVirtualDigitLines(
    image,
    cropRect,
    eraseDigitRect,
    virtualDigitLineEraseOptions(digitIndex, options.eraseOptions || {})
  );
  return {
    name,
    image,
    cropRect,
    preprocessOptions: options.preprocessOptions || null
  };
}

function roundDebugRect(rect) {
  if (!rect) return null;
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    w: Math.round(rect.w),
    h: Math.round(rect.h)
  };
}

/**
 * Crop digit boxes from warped image using layout coordinates
 * @param {cv.Mat} warped - Warped image (1700×2200)
 * @param {Object} layout - Layout JSON with boxes array
 * @returns {Array} - [{id, image, centerX, centerY}, ...]
 */
export function cropBoxes(warped, layout) {
  const crops = [];
  const normalized = layout.page?.units === 'normalized';
  const scaleX = normalized ? WARP_WIDTH : WARP_WIDTH / layout.page.width_mm;
  const scaleY = normalized ? WARP_HEIGHT : WARP_HEIGHT / layout.page.height_mm;
  // Normalized layout (e.g. sg-10-box-v1): box.x, box.y are bottom-right corner; legacy mm: box.cx, box.cy are center
  const getRect = (box) => {
    if (normalized) {
      const left = (box.x - box.width) * scaleX;
      const top = (box.y - box.height) * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;
      return { x: left, y: top, w, h, cx: left + w / 2, cy: top + h / 2 };
    }
    const cx = box.cx * scaleX;
    const cy = box.cy * scaleY;
    const w = box.width * scaleX;
    const h = box.height * scaleY;
    return { x: cx - w / 2, y: cy - h / 2, w, h, cx, cy };
  };

  // OCR should see the handwritten digit, not the printed answer-box border.
  // Keep boxRect as the full printed box for annotation, but crop the interior
  // for recognition so faint pencil strokes are not drowned out by dark borders.
  const BOX_OCR_INSET_X_FRAC = 0.12;
  const BOX_OCR_INSET_Y_FRAC = 0.12;
  const VIRTUAL_DIGIT_OCR_INSET_X_FRAC = 0.055;
  const VIRTUAL_DIGIT_OCR_INSET_TOP_FRAC = 0.070;
  const VIRTUAL_DIGIT_OCR_INSET_BOTTOM_FRAC = 0.105;
  const VIRTUAL_DIGIT_EDGE_ERASE_FRAC = 0.032;
  const layoutBoxes = Array.isArray(layout.boxes) ? layout.boxes : [];
  const usesVirtualDigitBoxes = Array.isArray(layout.question_groups) &&
    layout.question_groups.some((group) => Array.isArray(group?.digit_box_ids) && group.digit_box_ids.length > 1) &&
    layoutBoxes.some((box) => Number.isFinite(box?.digit_index));

  const expectedRects = layoutBoxes.map((box) => ({
    ...getRect(box),
    id: box.id
  }));
  const detectedRects = usesVirtualDigitBoxes
    ? buildVirtualDigitBoxRects(warped, layout, expectedRects)
    : detectAnswerBoxRects(warped, expectedRects);

  for (let i = 0; i < layoutBoxes.length; i++) {
    const box = layoutBoxes[i];
    const expected = expectedRects[i];
    const { x, y, w, h, cx, cy } = expected;
    const expectedRect = { x, y, w, h };
    const detectedRect = detectedRects.get(box.id);
    const refinedCandidate = usesVirtualDigitBoxes
      ? ((detectedRect?.trustedPhysicalDigitBox === true || virtualDigitRectLooksLocal(detectedRect, expectedRect))
        ? detectedRect
        : expectedRect)
      : (answerRectLooksLocal(detectedRect, expectedRect)
        ? detectedRect
        : refineBoxRectFromOutline(warped, expectedRect));
    const refinedRect = usesVirtualDigitBoxes
      ? refinedCandidate
      : (answerRectLooksLocal(refinedCandidate, expectedRect)
        ? refinedCandidate
        : expectedRect);
    const ocrRect = refinedRect;
    const digitIndex = Number.isFinite(box?.digit_index) ? Number(box.digit_index) : null;
    // Two-digit worksheet frames use one wide printed answer box with a faint
    // center guide. The split rect is already one digit slot, so keep the OCR
    // crop inside that slot; pulling across borders feeds the model frame
    // fragments instead of handwriting on older-camera captures.
    const innerRect = usesVirtualDigitBoxes
      ? virtualDigitInnerRect(ocrRect, digitIndex, {
        outerInsetFrac: VIRTUAL_DIGIT_OCR_INSET_X_FRAC,
        centerInsetFrac: 0.060,
        topInsetFrac: VIRTUAL_DIGIT_OCR_INSET_TOP_FRAC,
        bottomInsetFrac: VIRTUAL_DIGIT_OCR_INSET_BOTTOM_FRAC
      })
      : {
        x: ocrRect.x + ocrRect.w * BOX_OCR_INSET_X_FRAC,
        y: ocrRect.y + ocrRect.h * BOX_OCR_INSET_Y_FRAC,
        w: Math.max(1, ocrRect.w * (1 - BOX_OCR_INSET_X_FRAC * 2)),
        h: Math.max(1, ocrRect.h * (1 - BOX_OCR_INSET_Y_FRAC * 2))
      };
    const clampedInner = clampRectToMat(warped, innerRect);
    if (!clampedInner) continue;
    const { x: xPx, y: yPx, w: widthPx, h: heightPx } = clampedInner;
    const rect = new cv.Rect(xPx, yPx, widthPx, heightPx);
    const cropped = warped.roi(rect).clone();
    let variantImages = [];
    if (usesVirtualDigitBoxes) {
      eraseKnownVirtualDigitLines(
        cropped,
        { x: xPx, y: yPx, w: widthPx, h: heightPx },
        ocrRect,
        virtualDigitLineEraseOptions(digitIndex, {
          edgeBandFrac: VIRTUAL_DIGIT_EDGE_ERASE_FRAC,
          centerGuideThicknessMultiplier: 1.12,
          horizontalThicknessMultiplier: 0.95
        })
      );
      const trustedVirtualSlot = detectedRect?.trustedPhysicalDigitBox === true;
      const variantBaseRect = trustedVirtualSlot ? ocrRect : expectedRect;
      variantImages = [
        cloneVirtualDigitCropVariant(
          warped,
          virtualDigitInnerRect(variantBaseRect, digitIndex, {
            outerInsetFrac: 0.060,
            centerInsetFrac: 0.078,
            topInsetFrac: 0.074,
            bottomInsetFrac: 0.115
          }),
          variantBaseRect,
          digitIndex,
          'center-safe-slot',
          {
            eraseOptions: {
              edgeBandFrac: 0.038,
              thicknessMultiplier: 0.85,
              centerGuideThicknessMultiplier: 1.1,
              horizontalThicknessMultiplier: 0.85
            },
            preprocessOptions: {
              protectInteriorStrokes: true,
              strictLineRemoval: false,
              ruleArtifactEraseBelow: 1.16
            }
          }
        ),
        cloneVirtualDigitCropVariant(
          warped,
          virtualDigitInnerRect(variantBaseRect, digitIndex, {
            outerInsetFrac: 0.055,
            centerInsetFrac: 0.065,
            topInsetFrac: 0.065,
            bottomInsetFrac: 0.105
          }),
          variantBaseRect,
          digitIndex,
          'expected-slot',
          {
            eraseOptions: {
              edgeBandFrac: 0.034,
              centerGuideThicknessMultiplier: 1.15,
              horizontalThicknessMultiplier: 0.95
            },
            preprocessOptions: {
              protectInteriorStrokes: true,
              strictLineRemoval: false,
              ruleArtifactEraseBelow: 1.12
            }
          }
        ),
        cloneVirtualDigitCropVariant(
          warped,
          virtualDigitInnerRect(variantBaseRect, digitIndex, {
            outerInsetFrac: 0.065,
            centerInsetFrac: 0.078,
            topInsetFrac: 0.088,
            bottomInsetFrac: 0.135
          }),
          variantBaseRect,
          digitIndex,
          'edge-band-slot',
          {
            eraseOptions: {
              edgeBandFrac: 0.050,
              centerGuideThicknessMultiplier: 1.25,
              horizontalThicknessMultiplier: 1.15
            },
            preprocessOptions: {
              protectInteriorStrokes: true,
              strictLineRemoval: false,
              ruleArtifactEraseBelow: 1.08
            }
          }
        ),
        cloneVirtualDigitCropVariant(
          warped,
          virtualDigitInnerRect(ocrRect, digitIndex, {
            outerInsetFrac: 0.035,
            centerInsetFrac: 0.055,
            topInsetFrac: 0.055,
            bottomInsetFrac: 0.095
          }),
          ocrRect,
          digitIndex,
          'wide-slot',
          {
            eraseOptions: {
              edgeBandFrac: 0.028,
              centerGuideThicknessMultiplier: 1.15,
              horizontalThicknessMultiplier: 1.0
            },
            preprocessOptions: {
              protectInteriorStrokes: true,
              strictLineRemoval: false,
              ruleArtifactEraseBelow: 1.12
            }
          }
        ),
        cloneVirtualDigitCropVariant(
          warped,
          virtualDigitInnerRect(ocrRect, digitIndex, {
            outerInsetFrac: 0.045,
            centerInsetFrac: 0.060,
            topInsetFrac: 0.060,
            bottomInsetFrac: 0.100
          }),
          ocrRect,
          digitIndex,
          'no-side-erase',
          {
            eraseOptions: {
              edgeBandFrac: 0.026,
              eraseLeft: false,
              eraseRight: false,
              centerGuideThicknessMultiplier: 1.25,
              horizontalThicknessMultiplier: 1.15
            },
            preprocessOptions: {
              protectInteriorStrokes: true,
              strictLineRemoval: false,
              skipRuleArtifactCleanup: true,
              skipPrintedLineCleanup: true
            }
          }
        )
      ].filter(Boolean);
    }
    crops.push({
      id: box.id,
      questionNum: box.question_num,
      image: cropped,
      centerX: cx,
      centerY: cy,
      boxRect: {
        x: Math.round(refinedRect.x),
        y: Math.round(refinedRect.y),
        w: Math.round(refinedRect.w),
        h: Math.round(refinedRect.h)
      },
      /** Actual OCR ROI in warped pixel space (interior-only), for debug overlays */
      cropRect: { x: xPx, y: yPx, w: widthPx, h: heightPx },
      digitIndex,
      expectedRect: roundDebugRect(expectedRect),
      refinedRect: roundDebugRect(refinedRect),
      isVirtualDigitBox: usesVirtualDigitBoxes,
      variantImages
    });
  }

  return crops;
}

function expectedLayoutBoxRects(layout) {
  const normalized = layout.page?.units === 'normalized';
  const scaleX = normalized ? WARP_WIDTH : WARP_WIDTH / layout.page.width_mm;
  const scaleY = normalized ? WARP_HEIGHT : WARP_HEIGHT / layout.page.height_mm;
  const layoutBoxes = Array.isArray(layout.boxes) ? layout.boxes : [];

  return layoutBoxes.map((box) => {
    if (normalized) {
      const left = (box.x - box.width) * scaleX;
      const top = (box.y - box.height) * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;
      return { x: left, y: top, w, h, id: box.id };
    }
    const cx = box.cx * scaleX;
    const cy = box.cy * scaleY;
    const w = box.width * scaleX;
    const h = box.height * scaleY;
    return { x: cx - w / 2, y: cy - h / 2, w, h, id: box.id };
  });
}

function expectedAnswerFrameRects(layout) {
  const expectedRects = expectedLayoutBoxRects(layout);
  const expectedById = new Map(expectedRects.map((rect) => [rect.id, rect]));
  const groups = Array.isArray(layout.question_groups) ? layout.question_groups : [];
  const usesVirtualDigitBoxes = groups.some((group) => (
    Array.isArray(group?.digit_box_ids) && group.digit_box_ids.length > 1
  ));

  if (!usesVirtualDigitBoxes) return expectedRects;

  return groups
    .map((group) => {
      const ids = Array.isArray(group?.digit_box_ids) ? group.digit_box_ids : [];
      const digitRects = ids.map((id) => expectedById.get(id)).filter(Boolean);
      const expectedFrame = unionRects(digitRects);
      if (!expectedFrame) return null;
      return {
        ...expectedFrame,
        id: `question-${group.question_num}`,
        questionNum: group.question_num
      };
    })
    .filter(Boolean);
}

function scoreWarpedAnswerBoxAlignment(warped, layout) {
  const expectedFrames = expectedAnswerFrameRects(layout);
  if (!expectedFrames.length) return { score: -Infinity, localCount: 0, total: 0 };

  const detected = detectAnswerBoxRects(warped, expectedFrames);
  let localCount = 0;
  let distancePenalty = 0;
  let sizePenalty = 0;

  for (const expected of expectedFrames) {
    const candidate = detected.get(expected.id);
    if (!candidate) {
      distancePenalty += 3;
      sizePenalty += 2;
      continue;
    }

    const ec = rectCenter(expected);
    const cc = rectCenter(candidate);
    const distance = Math.hypot(cc.x - ec.x, cc.y - ec.y) / Math.max(1, Math.max(expected.w, expected.h));
    const areaRatio = rectSizeRatio(candidate, expected);
    distancePenalty += distance;
    sizePenalty += Math.abs(Math.log(Math.max(0.01, areaRatio))) * 0.6;

    if (
      answerFrameLooksLocal(candidate, expected) ||
      virtualAnswerFrameLooksLocal(candidate, expected)
    ) {
      localCount += 1;
    }
  }

  return {
    score: localCount * 12 - distancePenalty - sizePenalty,
    localCount,
    total: expectedFrames.length,
    distancePenalty,
    sizePenalty
  };
}

function rotatedAnchorCandidates(anchors) {
  const byId = new Map((anchors || []).map((anchor) => [anchor.id, anchor]));
  const ids = ['tl', 'tr', 'br', 'bl'];
  if (!ids.every((id) => byId.has(id))) return [];

  return ids.map((_, shift) => ({
    shift,
    anchors: ids.map((id, idx) => {
      const source = byId.get(ids[(idx + shift) % ids.length]);
      return { id, x: source.x, y: source.y };
    })
  }));
}

function qrLocationCenter(qrLocation) {
  if (!qrLocation || typeof qrLocation !== 'object') return null;
  const names = ['topLeftCorner', 'topRightCorner', 'bottomRightCorner', 'bottomLeftCorner'];
  const points = names
    .map((name) => qrLocation[name])
    .filter((point) => Number.isFinite(point?.x) && Number.isFinite(point?.y));
  if (!points.length) return null;
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length
  };
}

function expectedQrCenter(layout) {
  const qr = layout?.metadata?.qr_position;
  if (
    !qr ||
    !Number.isFinite(qr.x) ||
    !Number.isFinite(qr.y) ||
    !Number.isFinite(qr.width) ||
    !Number.isFinite(qr.height)
  ) {
    return null;
  }
  return {
    x: (qr.x + qr.width / 2) * WARP_WIDTH,
    y: (qr.y + qr.height / 2) * WARP_HEIGHT
  };
}

function transformPointToTemplate(point, anchors, layout) {
  if (!point || !Array.isArray(anchors) || anchors.length !== 4) return null;
  const layoutAnchors = layout?.homography?.anchors;
  if (!Array.isArray(layoutAnchors) || layoutAnchors.length < 4) return null;

  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
  const layoutById = new Map(layoutAnchors.map((anchor) => [anchor.id, anchor]));
  const ids = ['tl', 'tr', 'br', 'bl'];
  if (!ids.every((id) => byId.has(id) && layoutById.has(id))) return null;

  const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, ids.flatMap((id) => {
    const anchor = byId.get(id);
    return [anchor.x, anchor.y];
  }));
  const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, ids.flatMap((id) => {
    const anchor = layoutById.get(id);
    return [anchor.x * WARP_WIDTH, anchor.y * WARP_HEIGHT];
  }));
  const pointMat = cv.matFromArray(1, 1, cv.CV_32FC2, [point.x, point.y]);
  const warpedPoint = new cv.Mat();
  let H = null;
  try {
    H = cv.getPerspectiveTransform(srcPoints, dstPoints);
    cv.perspectiveTransform(pointMat, warpedPoint, H);
    return {
      x: warpedPoint.data32F[0],
      y: warpedPoint.data32F[1]
    };
  } finally {
    srcPoints.delete();
    dstPoints.delete();
    pointMat.delete();
    warpedPoint.delete();
    if (H) H.delete();
  }
}

function scoreQrPlacementForAnchors(anchors, layout, qrLocation) {
  const detectedCenter = qrLocationCenter(qrLocation);
  const expectedCenter = expectedQrCenter(layout);
  if (!detectedCenter || !expectedCenter) {
    return { qrScore: 0, qrDistance: null, warpedQrCenter: null };
  }

  const warpedQrCenter = transformPointToTemplate(detectedCenter, anchors, layout);
  if (!warpedQrCenter || !Number.isFinite(warpedQrCenter.x) || !Number.isFinite(warpedQrCenter.y)) {
    return { qrScore: -40, qrDistance: null, warpedQrCenter: null };
  }

  const normalizedDistance = Math.hypot(
    (warpedQrCenter.x - expectedCenter.x) / WARP_WIDTH,
    (warpedQrCenter.y - expectedCenter.y) / WARP_HEIGHT
  );

  return {
    qrScore: Math.max(-80, 45 - normalizedDistance * 180),
    qrDistance: normalizedDistance,
    warpedQrCenter
  };
}

function warpToBestTemplateOrientation(src, anchors, layout, options = {}) {
  const candidates = rotatedAnchorCandidates(anchors);
  if (candidates.length <= 1) {
    return {
      warped: warpToTemplate(src, anchors, layout),
      anchors
    };
  }

  let best = null;
  const debug = [];
  for (const candidate of candidates) {
    const warped = warpToTemplate(src, candidate.anchors, layout);
    const alignment = scoreWarpedAnswerBoxAlignment(warped, layout);
    const qrPlacement = scoreQrPlacementForAnchors(candidate.anchors, layout, options.qrLocation);
    const combined = {
      ...alignment,
      score: alignment.score + qrPlacement.qrScore,
      alignmentScore: alignment.score,
      ...qrPlacement
    };
    debug.push({ shift: candidate.shift, anchors: candidate.anchors, ...combined });

    if (!best || combined.score > best.combined.score) {
      if (best?.warped) best.warped.delete();
      best = { warped, combined, shift: candidate.shift, anchors: candidate.anchors };
    } else {
      warped.delete();
    }
  }

  if (typeof window !== 'undefined') {
    window.__SCANGRADE_DEBUG_WARP_ORIENTATION = {
      selectedShift: best?.shift ?? 0,
      detectedAnchors: anchors,
      candidates: debug
    };
  }

  return best
    ? { warped: best.warped, anchors: best.anchors }
    : { warped: warpToTemplate(src, anchors, layout), anchors };
}

function eraseKnownVirtualDigitLines(crop, cropRect, digitRect, options = {}) {
  if (!crop || !cropRect || !digitRect) return;
  const paper = new cv.Scalar(255, 255, 255, 255);
  const baseThickness = Math.max(4, Math.round(Math.min(digitRect.w, digitRect.h) * 0.052));
  const thickness = Math.max(3, Math.round(baseThickness * (options.thicknessMultiplier ?? 1)));
  const eraseRect = (x, y, w, h) => {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(crop.cols, Math.round(x + w));
    const y1 = Math.min(crop.rows, Math.round(y + h));
    if (x1 <= x0 || y1 <= y0) return;
    cv.rectangle(
      crop,
      new cv.Point(x0, y0),
      new cv.Point(x1, y1),
      paper,
      -1
    );
  };

  const edgeBandFrac = Math.max(0, Math.min(0.12, options.edgeBandFrac || 0));
  if (edgeBandFrac > 0) {
    const edgeX = Math.max(1, Math.round(crop.cols * edgeBandFrac));
    const edgeY = Math.max(1, Math.round(crop.rows * edgeBandFrac));
    eraseRect(0, 0, edgeX, crop.rows);
    eraseRect(crop.cols - edgeX, 0, edgeX, crop.rows);
    eraseRect(0, 0, crop.cols, edgeY);
    eraseRect(0, crop.rows - edgeY, crop.cols, edgeY);
  }

  const left = digitRect.x - cropRect.x;
  const right = digitRect.x + digitRect.w - cropRect.x;
  const top = digitRect.y - cropRect.y;
  const bottom = digitRect.y + digitRect.h - cropRect.y;
  if (options.eraseLeft !== false) {
    eraseRect(left - thickness / 2, top - thickness / 2, thickness, digitRect.h + thickness);
  }
  if (options.eraseRight !== false) {
    eraseRect(right - thickness / 2, top - thickness / 2, thickness, digitRect.h + thickness);
  }
  if (options.eraseCenterGuide !== false) {
    const digitIndex = Number(options.digitIndex);
    const centerGuideX = digitIndex === 0 ? right : (digitIndex === 1 ? left : null);
    if (Number.isFinite(centerGuideX)) {
      const guideThickness = Math.max(
        3,
        Math.round(thickness * 0.65 * (options.centerGuideThicknessMultiplier ?? 1))
      );
      eraseRect(
        centerGuideX - guideThickness / 2,
        top - thickness / 2,
        guideThickness,
        digitRect.h + thickness
      );
    }
  }
  if (options.eraseHorizontal !== false) {
    const horizontalThickness = Math.max(
      3,
      Math.round(thickness * (options.horizontalThicknessMultiplier ?? 1))
    );
    const horizontalLeft = options.eraseHorizontalFullWidth ? 0 : left - thickness / 2;
    const horizontalWidth = options.eraseHorizontalFullWidth ? crop.cols : digitRect.w + thickness;
    eraseRect(horizontalLeft, top - horizontalThickness / 2, horizontalWidth, horizontalThickness);
    eraseRect(horizontalLeft, bottom - horizontalThickness / 2, horizontalWidth, horizontalThickness);
  }
}

/**
 * Preprocess cropped box to MNIST-format tensor
 * @param {cv.Mat} boxImg - Cropped box image (RGBA)
 * @returns {Float32Array} - Normalized 28×28 MNIST-format tensor
 */
function preprocessToMNISTCore(boxImg, withDebug = false, options = {}) {
  if (!boxImg || boxImg.rows === 0 || boxImg.cols === 0) {
    return withDebug
      ? { tensor: new Float32Array(MNIST_SIZE * MNIST_SIZE), debug: null }
      : new Float32Array(MNIST_SIZE * MNIST_SIZE);
  }
  const debug = withDebug ? {} : null;
  const extracted = extractWorksheetInk(boxImg, options);
  const preserveFaintInk = options.protectInteriorStrokes === true;
  const tensor = centerInkToMNIST(
    extracted.ink,
    extracted.width,
    extracted.height,
    preserveFaintInk ? 0.075 : 0.16,
    preserveFaintInk ? 21 : 20
  );

  if (debug) {
    debug.gray = matFromUint8(extracted.gray, extracted.width, extracted.height);
    debug.inkMask = matFromFloatInk(extracted.ink, extracted.width, extracted.height);
    debug.framed = matFromFloatInk(tensor, MNIST_SIZE, MNIST_SIZE);
  }
  if (debug) {
    return { tensor, debug };
  }
  return tensor;
}

function getMatChannelCount(mat) {
  if (typeof mat.channels === 'function') return mat.channels();
  const pixels = Math.max(1, mat.rows * mat.cols);
  return Math.max(1, Math.round((mat.data?.length || pixels) / pixels));
}

function quantile(values, q) {
  if (!values || values.length === 0) return 0;
  const sorted = Array.from(values).sort((a, b) => a - b);
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * q)));
  return sorted[idx];
}

function computeLocalMean(values, width, height, radius) {
  const out = new Float32Array(width * height);
  const stride = width + 1;
  const integral = new Float64Array((height + 1) * stride);

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    const outRow = (y + 1) * stride;
    const prevRow = y * stride;
    const srcRow = y * width;
    for (let x = 0; x < width; x++) {
      rowSum += values[srcRow + x];
      integral[outRow + x + 1] = integral[prevRow + x + 1] + rowSum;
    }
  }

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    const top = y0 * stride;
    const bottom = (y1 + 1) * stride;
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const sum =
        integral[bottom + x1 + 1] -
        integral[top + x1 + 1] -
        integral[bottom + x0] +
        integral[top + x0];
      out[row + x] = sum / Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
    }
  }

  return out;
}

function extractWorksheetInk(boxImg, options = {}) {
  const pixelSource = getDisplayPixelSource(boxImg);
  const { width, height, channels, data } = pixelSource;
  const total = width * height;
  const luminance = new Float32Array(total);
  const saturation = new Float32Array(total);
  const gray = new Uint8Array(total);

  for (let i = 0; i < total; i++) {
    const offset = i * channels;
    const r = data[offset] ?? 0;
    const g = channels > 1 ? data[offset + 1] : r;
    const b = channels > 2 ? data[offset + 2] : r;
    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    luminance[i] = lum;
    saturation[i] = maxc - minc;
    gray[i] = Math.max(0, Math.min(255, Math.round(lum)));
  }

  const strict = options.strictLineRemoval === true;
  const preserveFaintInk = options.protectInteriorStrokes === true;
  const skipRuleArtifactCleanup = options.skipRuleArtifactCleanup === true;
  const skipPrintedLineCleanup = options.skipPrintedLineCleanup === true;
  const bg = quantile(luminance, strict ? (preserveFaintInk ? 0.82 : 0.76) : 0.82);
  const localRadius = Math.max(
    5,
    Math.round(Math.min(width, height) * (strict ? (preserveFaintInk ? 0.30 : 0.22) : 0.16))
  );
  const localMean = computeLocalMean(luminance, width, height, localRadius);
  const noiseFloor = strict ? (preserveFaintInk ? 1.35 : 3.6) : 2.6;
  const darkness = new Float32Array(total);
  const positives = [];
  for (let i = 0; i < total; i++) {
    const localDark = Math.max(0, localMean[i] - luminance[i] - noiseFloor);
    const cappedGlobalBg = Math.min(bg, localMean[i] + (strict ? (preserveFaintInk ? 18 : 9) : 14));
    const globalDark = Math.max(0, cappedGlobalBg - luminance[i] - noiseFloor);
    const colorBoost = Math.max(0, saturation[i] - 18) * (strict ? 0.34 : 0.26);
    const value =
      localDark * (strict ? (preserveFaintInk ? 1.45 : 1.75) : 1.25) +
      globalDark * (strict ? (preserveFaintInk ? 0.42 : 0.12) : 0.28) +
      colorBoost;
    darkness[i] = value;
    if (value > 1.4) positives.push(value);
  }

  const scale = Math.max(
    strict ? (preserveFaintInk ? 4.6 : 7.5) : 9,
    quantile(positives, strict ? (preserveFaintInk ? 0.86 : 0.90) : 0.94)
  );
  const ink = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    ink[i] = Math.max(0, Math.min(1, darkness[i] / scale));
  }

  if (height >= 5 && width >= 5) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if ((y < 2 || y >= height - 2 || x < 2 || x >= width - 2) && ink[y * width + x] > 0.75) {
          ink[y * width + x] = 0;
        }
      }
    }
  }

  removeLongEdgeLinesFromInk(ink, width, height);
  removeDashedEdgeGuidesFromInk(ink, width, height);
  if (!skipRuleArtifactCleanup && options.strictLineRemoval === true && preserveFaintInk) {
    removeVirtualDigitRuleArtifactsFromInk(ink, width, height, {
      eraseBelow: options.ruleArtifactEraseBelow
    });
  } else if (!skipRuleArtifactCleanup && options.strictLineRemoval === true) {
    removeSlantedEdgeRulesFromInk(ink, width, height);
    removeResidualEdgeRuleBandsFromInk(ink, width, height);
  }
  if (!skipPrintedLineCleanup) {
    removePrintedLineComponentsFromInk(ink, width, height, {
      protectInteriorStrokes: options.protectInteriorStrokes === true,
      strictLineRemoval: options.strictLineRemoval === true
    });
  }
  suppressWeakBackgroundInk(ink, strict ? (preserveFaintInk ? 0.065 : 0.19) : 0.15);
  removeSmallInkComponents(ink, width, height, {
    threshold: preserveFaintInk ? 0.14 : 0.24,
    minValueToRemove: preserveFaintInk ? 0.74 : 0.82
  });
  if (typeof window !== 'undefined' && window.__SCANGRADE_DEBUG_PREPROCESS_STATS) {
    const alphaValues = [];
    if (channels >= 4) {
      for (let i = 0; i < total; i++) alphaValues.push(data[i * channels + 3]);
    }
    window.__SCANGRADE_DEBUG_PREPROCESS_STATS.push({
      width,
      height,
      channels,
      bg,
      localRadius,
      scale,
      inkMean: Array.from(ink).reduce((sum, value) => sum + value, 0) / Math.max(1, ink.length),
      inkMax: Math.max(...ink),
      luminanceMin: Math.min(...luminance),
      luminanceMax: Math.max(...luminance),
      alphaMin: alphaValues.length ? Math.min(...alphaValues) : null,
      alphaMax: alphaValues.length ? Math.max(...alphaValues) : null,
      firstPixels: Array.from(data.slice(0, Math.min(data.length, channels * 8)))
    });
  }
  return { ink, gray, width, height };
}

function getDisplayPixelSource(mat) {
  if (typeof document !== 'undefined' && typeof cv !== 'undefined' && typeof cv.imshow === 'function') {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = mat.cols;
      canvas.height = mat.rows;
      cv.imshow(canvas, mat);
      const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      return {
        width: canvas.width,
        height: canvas.height,
        channels: 4,
        data: imageData.data
      };
    } catch (_) {
      // Fall through to raw Mat access below.
    }
  }
  return {
    width: mat.cols,
    height: mat.rows,
    channels: getMatChannelCount(mat),
    data: mat.data
  };
}

function removeLongEdgeLinesFromInk(ink, width, height) {
  const threshold = 0.35;
  const rowLimit = width * 0.55;
  const colLimit = height * 0.55;

  for (let y = 0; y < height; y++) {
    let count = 0;
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      if (ink[rowOffset + x] > threshold) count++;
    }
    if (count >= rowLimit && (y < height * 0.18 || y > height * 0.82)) {
      for (let yy = Math.max(0, y - 1); yy < Math.min(height, y + 2); yy++) {
        const offset = yy * width;
        for (let x = 0; x < width; x++) ink[offset + x] = 0;
      }
    }
  }

  for (let x = 0; x < width; x++) {
    let count = 0;
    for (let y = 0; y < height; y++) {
      if (ink[y * width + x] > threshold) count++;
    }
    if (count >= colLimit && (x < width * 0.18 || x > width * 0.82)) {
      for (let y = 0; y < height; y++) {
        const offset = y * width;
        for (let xx = Math.max(0, x - 1); xx < Math.min(width, x + 2); xx++) {
          ink[offset + xx] = 0;
        }
      }
    }
  }
}

function removeDashedEdgeGuidesFromInk(ink, width, height) {
  const threshold = 0.22;
  const xEdge = Math.max(2, Math.round(width * 0.18));
  const yEdge = Math.max(2, Math.round(height * 0.18));
  const colLimit = height * 0.16;
  const rowLimit = width * 0.16;

  for (let x = 0; x < width; x++) {
    const nearEdge = x <= xEdge || x >= width - xEdge - 1;
    if (!nearEdge) continue;
    let count = 0;
    for (let y = 0; y < height; y++) {
      const value = ink[y * width + x];
      if (value > threshold) {
        count++;
      }
    }
    if (count >= colLimit) {
      for (let y = 0; y < height; y++) {
        const offset = y * width;
        for (let xx = Math.max(0, x - 1); xx < Math.min(width, x + 2); xx++) {
          if (ink[offset + xx] < 0.9) ink[offset + xx] = 0;
        }
      }
    }
  }

  for (let y = 0; y < height; y++) {
    if (y > yEdge && y < height - yEdge - 1) continue;
    let count = 0;
    const offset = y * width;
    for (let x = 0; x < width; x++) {
      if (ink[offset + x] > threshold) count++;
    }
    if (count >= rowLimit) {
      for (let yy = Math.max(0, y - 1); yy < Math.min(height, y + 2); yy++) {
        const rowOffset = yy * width;
        for (let x = 0; x < width; x++) {
          if (ink[rowOffset + x] < 0.9) ink[rowOffset + x] = 0;
        }
      }
    }
  }
}

function removeSlantedEdgeRulesFromInk(ink, width, height) {
  if (!ink || width < 12 || height < 12) return;
  const threshold = 0.18;
  const centerX = (width - 1) / 2;
  const minCoverage = Math.max(4, Math.round(width * 0.28));
  const regions = [
    {
      minY: Math.max(0, Math.round(height * 0.02)),
      maxY: Math.max(0, Math.round(height * 0.42))
    },
    {
      minY: Math.min(height - 1, Math.round(height * 0.58)),
      maxY: Math.min(height - 1, Math.round(height * 0.98))
    }
  ];

  const sampleLine = (slope, centerY) => {
    let hits = 0;
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const y = Math.round(centerY + slope * (x - centerX));
      if (y < 0 || y >= height) continue;
      let best = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
        best = Math.max(best, ink[yy * width + x]);
      }
      if (best > threshold) {
        hits += 1;
        sum += best;
      }
    }
    return { hits, mean: hits ? sum / hits : 0 };
  };

  const eraseLine = (slope, centerY) => {
    const radius = Math.max(1, Math.round(height * 0.065));
    for (let x = 0; x < width; x++) {
      const y = Math.round(centerY + slope * (x - centerX));
      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
        const idx = yy * width + x;
        if (ink[idx] > 0.10) ink[idx] = 0;
      }
    }
  };

  for (const region of regions) {
    const candidates = [];
    for (let s = -24; s <= 24; s++) {
      const slope = s * 0.035;
      for (let y = region.minY; y <= region.maxY; y++) {
        const sampled = sampleLine(slope, y);
        if (sampled.hits < minCoverage || sampled.mean < 0.18) continue;
        candidates.push({
          slope,
          centerY: y,
          score: sampled.hits * (0.65 + sampled.mean),
          hits: sampled.hits,
          mean: sampled.mean
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const selected = [];
    for (const candidate of candidates) {
      const duplicate = selected.some((line) => (
        Math.abs(line.centerY - candidate.centerY) <= Math.max(2, Math.round(height * 0.10)) &&
        Math.abs(line.slope - candidate.slope) <= 0.08
      ));
      if (duplicate) continue;
      selected.push(candidate);
      eraseLine(candidate.slope, candidate.centerY);
      if (selected.length >= 3) break;
    }
  }
}

function longestRunInRow(ink, width, y, threshold) {
  let best = 0;
  let current = 0;
  const offset = y * width;
  for (let x = 0; x < width; x++) {
    if (ink[offset + x] > threshold) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

function removeResidualEdgeRuleBandsFromInk(ink, width, height) {
  if (!ink || width < 12 || height < 12) return;
  const threshold = 0.16;
  const minRowCount = Math.max(4, Math.round(width * 0.28));
  const minRowRun = Math.max(5, Math.round(width * 0.22));
  const minColCount = Math.max(5, Math.round(height * 0.32));

  for (let y = 0; y < height; y++) {
    const nearHorizontalEdge = y <= height * 0.42 || y >= height * 0.58;
    if (!nearHorizontalEdge) continue;
    let count = 0;
    const offset = y * width;
    for (let x = 0; x < width; x++) {
      if (ink[offset + x] > threshold) count += 1;
    }
    if (count < minRowCount && longestRunInRow(ink, width, y, threshold) < minRowRun) continue;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
      const rowOffset = yy * width;
      for (let x = 0; x < width; x++) {
        if (ink[rowOffset + x] > 0.10) ink[rowOffset + x] = 0;
      }
    }
  }

  for (let x = 0; x < width; x++) {
    const nearVerticalEdge = x <= width * 0.18 || x >= width * 0.82;
    if (!nearVerticalEdge) continue;
    let count = 0;
    for (let y = 0; y < height; y++) {
      if (ink[y * width + x] > threshold) count += 1;
    }
    if (count < minColCount) continue;
    for (let y = 0; y < height; y++) {
      const offset = y * width;
      for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        if (ink[offset + xx] > 0.10) ink[offset + xx] = 0;
      }
    }
  }
}

function removeVirtualDigitRuleArtifactsFromInk(ink, width, height, options = {}) {
  if (!ink || width < 12 || height < 12) return;
  const threshold = 0.13;
  const eraseBelow = Number.isFinite(options.eraseBelow) ? options.eraseBelow : 0.98;
  const minRowRun = Math.max(8, Math.round(width * 0.52));
  const minColRun = Math.max(8, Math.round(height * 0.40));
  const rowEdgeSpan = Math.max(3, Math.round(width * 0.12));
  const colEdgeSpan = Math.max(3, Math.round(height * 0.12));
  const minRowEdgeHits = Math.max(2, Math.round(rowEdgeSpan * 0.28));
  const minColEdgeHits = Math.max(2, Math.round(colEdgeSpan * 0.28));

  for (let y = 0; y < height; y++) {
    const nearEdgeBand = y <= height * 0.30 || y >= height * 0.70;
    let run = 0;
    let bestRun = 0;
    let edgeHits = 0;
    const offset = y * width;
    for (let x = 0; x < width; x++) {
      if (ink[offset + x] > threshold) {
        run += 1;
        bestRun = Math.max(bestRun, run);
        if (x < rowEdgeSpan || x >= width - rowEdgeSpan) edgeHits += 1;
      } else {
        run = 0;
      }
    }
    if (!nearEdgeBand && bestRun < width * 0.68) continue;
    if (bestRun < minRowRun) continue;
    if (edgeHits < minRowEdgeHits && bestRun < width * 0.82) continue;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
      const rowOffset = yy * width;
      for (let x = 0; x < width; x++) {
        const idx = rowOffset + x;
        if (ink[idx] > 0.09 && ink[idx] < eraseBelow) ink[idx] = 0;
      }
    }
  }

  for (let x = 0; x < width; x++) {
    const nearEdge = x <= width * 0.18 || x >= width * 0.82;
    if (!nearEdge) continue;
    let run = 0;
    let bestRun = 0;
    let edgeHits = 0;
    for (let y = 0; y < height; y++) {
      if (ink[y * width + x] > threshold) {
        run += 1;
        bestRun = Math.max(bestRun, run);
        if (y < colEdgeSpan || y >= height - colEdgeSpan) edgeHits += 1;
      } else {
        run = 0;
      }
    }
    if (bestRun < minColRun) continue;
    if (edgeHits < minColEdgeHits && bestRun < height * 0.74) continue;
    for (let y = 0; y < height; y++) {
      const offset = y * width;
      for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
        const idx = offset + xx;
        if (ink[idx] > 0.09 && ink[idx] < eraseBelow) ink[idx] = 0;
      }
    }
  }

  removeVirtualDigitSlantedRuleArtifacts(ink, width, height, threshold, eraseBelow);
}

function removeVirtualDigitSlantedRuleArtifacts(ink, width, height, threshold, eraseBelow) {
  const centerX = (width - 1) / 2;
  const minHits = Math.max(9, Math.round(width * 0.40));
  const minEdgeHits = Math.max(1, Math.round(width * 0.05));
  const edgeSpan = Math.max(2, Math.round(width * 0.16));
  const regions = [
    {
      minY: Math.max(0, Math.round(height * 0.02)),
      maxY: Math.max(0, Math.round(height * 0.45))
    },
    {
      minY: Math.min(height - 1, Math.round(height * 0.55)),
      maxY: Math.min(height - 1, Math.round(height * 0.98))
    }
  ];

  const sampleLine = (slope, centerY) => {
    let hits = 0;
    let leftEdgeHits = 0;
    let rightEdgeHits = 0;
    let sum = 0;
    for (let x = 0; x < width; x++) {
      const y = Math.round(centerY + slope * (x - centerX));
      if (y < 0 || y >= height) continue;
      let best = 0;
      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
        best = Math.max(best, ink[yy * width + x]);
      }
      if (best > threshold) {
        hits += 1;
        sum += best;
        if (x < edgeSpan) leftEdgeHits += 1;
        if (x >= width - edgeSpan) rightEdgeHits += 1;
      }
    }
    return {
      hits,
      leftEdgeHits,
      rightEdgeHits,
      mean: hits ? sum / hits : 0
    };
  };

  const eraseLine = (slope, centerY) => {
    const radius = Math.max(1, Math.round(height * 0.055));
    for (let x = 0; x < width; x++) {
      const y = Math.round(centerY + slope * (x - centerX));
      for (let yy = Math.max(0, y - radius); yy <= Math.min(height - 1, y + radius); yy++) {
        const idx = yy * width + x;
        if (ink[idx] > 0.09 && ink[idx] < eraseBelow) ink[idx] = 0;
      }
    }
  };

  for (const region of regions) {
    const candidates = [];
    for (let s = -24; s <= 24; s++) {
      const slope = s * 0.035;
      for (let y = region.minY; y <= region.maxY; y++) {
        const sampled = sampleLine(slope, y);
        if (sampled.hits < minHits || sampled.mean < 0.14) continue;
        if (sampled.leftEdgeHits < minEdgeHits && sampled.rightEdgeHits < minEdgeHits) continue;
        candidates.push({
          slope,
          centerY: y,
          score: sampled.hits * (0.7 + sampled.mean) +
            (sampled.leftEdgeHits + sampled.rightEdgeHits) * 4
        });
      }
    }
    candidates.sort((a, b) => b.score - a.score);
    const selected = [];
    for (const candidate of candidates) {
      const duplicate = selected.some((line) => (
        Math.abs(line.centerY - candidate.centerY) <= Math.max(2, Math.round(height * 0.10)) &&
        Math.abs(line.slope - candidate.slope) <= 0.08
      ));
      if (duplicate) continue;
      selected.push(candidate);
      eraseLine(candidate.slope, candidate.centerY);
      if (selected.length >= 2) break;
    }
  }
}

function removePrintedLineComponentsFromInk(ink, width, height, options = {}) {
  const threshold = 0.24;
  const total = width * height;
  const visited = new Uint8Array(total);
  const stack = [];
  const pixels = [];
  const strict = options.strictLineRemoval === true;
  const minHorizontalSpan = Math.max(8, Math.round(width * (strict ? 0.16 : 0.19)));
  const maxHorizontalThickness = Math.max(3, Math.round(height * (strict ? 0.13 : 0.10)));
  const minVerticalSpan = Math.max(10, Math.round(height * (strict ? 0.34 : 0.38)));
  const maxVerticalThickness = Math.max(3, Math.round(width * (strict ? 0.13 : 0.10)));

  for (let start = 0; start < total; start++) {
    if (visited[start] || ink[start] <= threshold) continue;
    visited[start] = 1;
    stack.length = 0;
    pixels.length = 0;
    stack.push(start);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let sum = 0;

    while (stack.length) {
      const idx = stack.pop();
      pixels.push(idx);
      sum += ink[idx];
      const y = Math.floor(idx / width);
      const x = idx - y * width;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);

      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
          const next = yy * width + xx;
          if (!visited[next] && ink[next] > threshold) {
            visited[next] = 1;
            stack.push(next);
          }
        }
      }
    }

    const spanX = maxX - minX + 1;
    const spanY = maxY - minY + 1;
    const density = pixels.length / Math.max(1, spanX * spanY);
    const avg = sum / Math.max(1, pixels.length);
    const touchesCropEdge =
      minX <= 1 ||
      minY <= 1 ||
      maxX >= width - 2 ||
      maxY >= height - 2;
    const horizontalRule =
      spanX >= minHorizontalSpan &&
      spanY <= maxHorizontalThickness &&
      density >= (strict ? 0.24 : 0.34) &&
      (
        touchesCropEdge ||
        minY <= height * (strict ? 0.22 : 0.14) ||
        maxY >= height * (strict ? 0.78 : 0.86) ||
        (!options.protectInteriorStrokes && avg < 0.72)
      );
    const verticalRule =
      spanY >= minVerticalSpan &&
      spanX <= maxVerticalThickness &&
      density >= (strict ? 0.24 : 0.34) &&
      (
        touchesCropEdge ||
        (strict && (minX <= width * 0.18 || maxX >= width * 0.82))
      );

    if (horizontalRule || verticalRule) {
      for (const idx of pixels) {
        if (ink[idx] < 0.94 || touchesCropEdge) ink[idx] = 0;
      }
    }
  }
}

function suppressWeakBackgroundInk(ink, floor = 0.16) {
  if (!ink) return;
  const safeFloor = Math.max(0.04, Math.min(0.34, floor));
  const range = Math.max(0.12, 1 - safeFloor);
  for (let i = 0; i < ink.length; i++) {
    const value = ink[i];
    if (value <= safeFloor) {
      ink[i] = 0;
      continue;
    }
    // Re-expand real pencil strokes after dropping the low-level paper shadow
    // haze that otherwise becomes a false digit in two-slot answer boxes.
    ink[i] = Math.max(0, Math.min(1, ((value - safeFloor) / range) * 1.08));
  }
}

function removeSmallInkComponents(ink, width, height, options = {}) {
  const threshold = options.threshold ?? 0.24;
  const minValueToRemove = options.minValueToRemove ?? 0.82;
  const total = width * height;
  const visited = new Uint8Array(total);
  const stack = [];
  const pixels = [];
  const tinyArea = Math.max(3, Math.round(total * 0.0012));
  const smallArea = Math.max(6, Math.round(total * 0.0024));
  const smallSpan = Math.max(3, Math.round(Math.min(width, height) * 0.13));

  for (let start = 0; start < total; start++) {
    if (visited[start] || ink[start] <= threshold) continue;
    visited[start] = 1;
    stack.length = 0;
    pixels.length = 0;
    stack.push(start);
    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;
    let maxValue = 0;

    while (stack.length) {
      const idx = stack.pop();
      pixels.push(idx);
      const y = Math.floor(idx / width);
      const x = idx - y * width;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxValue = Math.max(maxValue, ink[idx]);

      for (let yy = Math.max(0, y - 1); yy <= Math.min(height - 1, y + 1); yy++) {
        for (let xx = Math.max(0, x - 1); xx <= Math.min(width - 1, x + 1); xx++) {
          const next = yy * width + xx;
          if (!visited[next] && ink[next] > threshold) {
            visited[next] = 1;
            stack.push(next);
          }
        }
      }
    }

    const area = pixels.length;
    const spanX = maxX - minX + 1;
    const spanY = maxY - minY + 1;
    const remove =
      area <= tinyArea ||
      (area <= smallArea && Math.max(spanX, spanY) <= smallSpan && maxValue < minValueToRemove);
    if (remove) {
      for (const idx of pixels) ink[idx] = 0;
    }
  }
}

function centerInkToMNIST(ink, width, height, threshold = 0.16, targetExtent = 20) {
  const out = new Float32Array(MNIST_SIZE * MNIST_SIZE);
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    const offset = y * width;
    for (let x = 0; x < width; x++) {
      if (ink[offset + x] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return out;

  let boxW = maxX - minX + 1;
  let boxH = maxY - minY + 1;
  const padX = Math.max(2, Math.round(boxW * 0.18));
  const padY = Math.max(2, Math.round(boxH * 0.18));
  minX = Math.max(0, minX - padX);
  maxX = Math.min(width - 1, maxX + padX);
  minY = Math.max(0, minY - padY);
  maxY = Math.min(height - 1, maxY + padY);
  boxW = maxX - minX + 1;
  boxH = maxY - minY + 1;

  const scale = Math.min(targetExtent / boxW, targetExtent / boxH);
  const drawW = Math.max(1, boxW * scale);
  const drawH = Math.max(1, boxH * scale);
  const offsetX = (MNIST_SIZE - drawW) / 2;
  const offsetY = (MNIST_SIZE - drawH) / 2;

  for (let oy = 0; oy < MNIST_SIZE; oy++) {
    for (let ox = 0; ox < MNIST_SIZE; ox++) {
      const sx = minX + (ox + 0.5 - offsetX) / scale;
      const sy = minY + (oy + 0.5 - offsetY) / scale;
      if (sx < minX || sx > maxX || sy < minY || sy > maxY) continue;

      const x0 = Math.max(0, Math.min(width - 1, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(height - 1, Math.floor(sy)));
      const x1 = Math.min(width - 1, x0 + 1);
      const y1 = Math.min(height - 1, y0 + 1);
      const fx = sx - x0;
      const fy = sy - y0;
      const top = ink[y0 * width + x0] * (1 - fx) + ink[y0 * width + x1] * fx;
      const bottom = ink[y1 * width + x0] * (1 - fx) + ink[y1 * width + x1] * fx;
      out[oy * MNIST_SIZE + ox] = Math.max(0, Math.min(1, top * (1 - fy) + bottom * fy));
    }
  }

  return out;
}

function matFromUint8(values, width, height) {
  const mat = new cv.Mat(height, width, cv.CV_8UC1);
  mat.data.set(values);
  return mat;
}

function matFromFloatInk(values, width, height) {
  const mat = new cv.Mat(height, width, cv.CV_8UC1);
  for (let i = 0; i < values.length; i++) {
    mat.data[i] = Math.max(0, Math.min(255, Math.round(values[i] * 255)));
  }
  return mat;
}

function removePrintedBoxLines(invertedGray) {
  const cleaned = invertedGray.clone();
  const binary = new cv.Mat();
  cv.threshold(invertedGray, binary, 90, 255, cv.THRESH_BINARY);

  const lineMask = cv.Mat.zeros(invertedGray.rows, invertedGray.cols, cv.CV_8UC1);
  const horizontal = new cv.Mat();
  const vertical = new cv.Mat();
  const hKernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(Math.max(9, Math.round(invertedGray.cols * 0.42)), 1)
  );
  const vKernel = cv.getStructuringElement(
    cv.MORPH_RECT,
    new cv.Size(1, Math.max(9, Math.round(invertedGray.rows * 0.42)))
  );
  cv.morphologyEx(binary, horizontal, cv.MORPH_OPEN, hKernel);
  cv.morphologyEx(binary, vertical, cv.MORPH_OPEN, vKernel);

  addEdgeLineComponents(horizontal, lineMask, 'horizontal');
  addEdgeLineComponents(vertical, lineMask, 'vertical');

  const dilateKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.dilate(lineMask, lineMask, dilateKernel);
  const linePixels = cv.countNonZero(lineMask);
  const maxSafeLinePixels = Math.round(invertedGray.rows * invertedGray.cols * 0.22);
  if (linePixels > 0 && linePixels <= maxSafeLinePixels) {
    cleaned.setTo(new cv.Scalar(0), lineMask);
  }

  binary.delete();
  lineMask.delete();
  horizontal.delete();
  vertical.delete();
  hKernel.delete();
  vKernel.delete();
  dilateKernel.delete();
  return cleaned;
}

function addEdgeLineComponents(sourceMask, targetMask, orientation) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(sourceMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
  const cols = sourceMask.cols;
  const rows = sourceMask.rows;
  for (let i = 0; i < contours.size(); i++) {
    const contour = contours.get(i);
    const r = cv.boundingRect(contour);
    const isHorizontal =
      orientation === 'horizontal' &&
      r.width >= cols * 0.42 &&
      (r.y <= rows * 0.28 || r.y + r.height >= rows * 0.72);
    const isVertical =
      orientation === 'vertical' &&
      r.height >= rows * 0.42 &&
      (r.x <= cols * 0.28 || r.x + r.width >= cols * 0.72);
    if (isHorizontal || isVertical) {
      for (let yy = r.y; yy < r.y + r.height; yy++) {
        for (let xx = r.x; xx < r.x + r.width; xx++) {
          if (sourceMask.ucharAt(yy, xx) > 0) {
            targetMask.ucharPtr(yy, xx)[0] = 255;
          }
        }
      }
    }
    contour.delete();
  }
  contours.delete();
  hierarchy.delete();
}

export function preprocessToMNIST(boxImg) {
  return preprocessToMNISTCore(boxImg, false);
}

/**
 * Same preprocessing pipeline as preprocessToMNIST, but also returns intermediate Mats for inspection.
 * Caller must delete returned debug Mats when done.
 */
export function preprocessToMNISTWithDebug(boxImg, options = {}) {
  return preprocessToMNISTCore(boxImg, true, options);
}

/**
 * Full pipeline: detect → warp → crop → preprocess
 * @param {HTMLCanvasElement|ImageData|cv.Mat} input - Input image
 * @param {Object} layout - Layout JSON
 * @returns {Object|null} - Pipeline results or null if detection failed
 */
export function processWorksheet(input, layout, options = {}) {
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

  // Step 2: Warp to template. Uploaded classroom photos may arrive rotated
  // sideways, so choose the marker-label orientation whose answer boxes line
  // up best with the template before cropping.
  const warpResult = warpToBestTemplateOrientation(src, anchors, layout, options);
  const warped = warpResult.warped;
  const sourceAnchors = warpResult.anchors || anchors;

  // Step 3: Crop boxes
  const crops = cropBoxes(warped, layout);

  // Step 4: Preprocess each crop. Two-digit worksheet cells are intentionally
  // run through a small family of line-cleanup settings because old iPad
  // captures can make the answer-box guide line look stronger than pencil.
  const processed = crops.map(crop => {
    const tensors = buildProcessedCropTensors(crop);
    return {
      id: crop.id,
      questionNum: crop.questionNum,
      rawImage: crop.image,
      tensor: tensors.tensor,
      tensorVariants: tensors.tensorVariants,
      centerX: crop.centerX,
      centerY: crop.centerY,
      digitIndex: crop.digitIndex,
      isVirtualDigitBox: crop.isVirtualDigitBox === true
    };
  });

  // Clean up source (warped kept for preview, caller must delete)
  src.delete();

  return {
    warpedImage: warped,
    rawCrops: crops.map(c => ({
      id: c.id,
      questionNum: c.questionNum,
      image: c.image,
      boxRect: c.boxRect,
      cropRect: c.cropRect,
      digitIndex: c.digitIndex,
      expectedRect: c.expectedRect,
      refinedRect: c.refinedRect,
      isVirtualDigitBox: c.isVirtualDigitBox === true
    })),
    processedTensors: processed,
    sourceAnchors
  };
}

function buildProcessedCropTensors(crop) {
  const isVirtualDigitBox = crop.isVirtualDigitBox === true;
  const baseOptions = {
    protectInteriorStrokes: isVirtualDigitBox,
    strictLineRemoval: isVirtualDigitBox
  };
  const tensor = preprocessToMNISTCore(crop.image, false, baseOptions);
  if (!isVirtualDigitBox) {
    return {
      tensor,
      tensorVariants: [{ name: 'base', tensor }]
    };
  }

  const variantTensors = [];
  for (const variant of crop.variantImages || []) {
    if (!variant?.image) continue;
    try {
      variantTensors.push({
        name: variant.name,
        tensor: preprocessToMNISTCore(variant.image, false, variant.preprocessOptions || baseOptions)
      });
    } finally {
      variant.image.delete();
    }
  }

  return {
    tensor,
    tensorVariants: [
      { name: 'strict', tensor },
      {
        name: 'edge-clean',
        tensor: preprocessToMNISTCore(crop.image, false, {
          ...baseOptions,
          ruleArtifactEraseBelow: 1.01
        })
      },
      {
        name: 'no-rule-cleanup',
        tensor: preprocessToMNISTCore(crop.image, false, {
          ...baseOptions,
          skipRuleArtifactCleanup: true
        })
      },
      {
        name: 'no-component-cleanup',
        tensor: preprocessToMNISTCore(crop.image, false, {
          ...baseOptions,
          skipPrintedLineCleanup: true
        })
      },
      {
        name: 'gentle',
        tensor: preprocessToMNISTCore(crop.image, false, {
          protectInteriorStrokes: true,
          strictLineRemoval: false,
          skipRuleArtifactCleanup: true,
          skipPrintedLineCleanup: true
        })
      },
      ...variantTensors
    ]
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
