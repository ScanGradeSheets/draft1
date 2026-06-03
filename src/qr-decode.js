/**
 * Minimal QR decode from image for ScanGrade capture flow.
 * Payload-only; no UI. Supports QR-SPEC (base64 JSON), raw JSON,
 * legacy SG1 strings, and ScanGrade URL-wrapped QR payloads.
 */
import jsQR from 'jsqr';

/**
 * Decode base64 URL-safe variant (QR-SPEC: - and _ instead of + and /)
 */
function base64UrlSafeToJson(base64) {
  const standard = base64.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(standard);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  try {
    return decodeURIComponent(Array.from(bytes, (byte) =>
      '%' + byte.toString(16).padStart(2, '0')
    ).join(''));
  } catch (_) {
    return binary;
  }
}

function clampRect(rect, width, height) {
  const x = Math.max(0, Math.min(width - 1, Math.round(rect.x)));
  const y = Math.max(0, Math.min(height - 1, Math.round(rect.y)));
  const w = Math.max(1, Math.min(width - x, Math.round(rect.w)));
  const h = Math.max(1, Math.min(height - y, Math.round(rect.h)));
  return { x, y, w, h };
}

function mapQrLocation(location, rect, scaleX, scaleY) {
  if (!location || typeof location !== 'object') return null;
  const mapPoint = (point) => {
    if (!point || typeof point !== 'object') return null;
    return {
      x: rect.x + Number(point.x || 0) / scaleX,
      y: rect.y + Number(point.y || 0) / scaleY
    };
  };
  return {
    topLeftCorner: mapPoint(location.topLeftCorner),
    topRightCorner: mapPoint(location.topRightCorner),
    bottomRightCorner: mapPoint(location.bottomRightCorner),
    bottomLeftCorner: mapPoint(location.bottomLeftCorner)
  };
}

function attachQrLocation(payload, location, source) {
  if (!payload || typeof payload !== 'object') return payload;
  if (location && typeof location === 'object') {
    payload.qr_location = {
      topLeftCorner: location.topLeftCorner || null,
      topRightCorner: location.topRightCorner || null,
      bottomRightCorner: location.bottomRightCorner || null,
      bottomLeftCorner: location.bottomLeftCorner || null
    };
  }
  if (source) payload.qr_decode_source = source;
  return payload;
}

function decodeImageData(imageData, source, rect, scaleX = 1, scaleY = 1) {
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  if (!code || !code.data) return null;
  const payload = parseQrPayloadString(code.data);
  if (!payload || typeof payload !== 'object') return payload;
  const location = rect
    ? mapQrLocation(code.location, rect, scaleX, scaleY)
    : code.location;
  return attachQrLocation(payload, location, source);
}

function decodeQrFromRegion(sourceCanvas, rect, source) {
  const sourceCtx = sourceCanvas.getContext('2d');
  if (!sourceCtx) return null;
  const normalized = clampRect(rect, sourceCanvas.width, sourceCanvas.height);

  try {
    const imageData = sourceCtx.getImageData(normalized.x, normalized.y, normalized.w, normalized.h);
    const direct = decodeImageData(imageData, `${source}:direct`, normalized, 1, 1);
    if (direct) return direct;
  } catch (_) {
    // Continue to the scaled attempt below; some older browsers are touchy
    // around readback but can still draw the crop into a fresh canvas.
  }

  const shortSide = Math.min(normalized.w, normalized.h);
  const longSide = Math.max(normalized.w, normalized.h);
  const targetLongSide = shortSide < 260 ? 960 : 720;
  const scale = Math.max(1, Math.min(4, targetLongSide / Math.max(1, longSide)));
  if (scale <= 1.08) return null;

  const outW = Math.max(1, Math.round(normalized.w * scale));
  const outH = Math.max(1, Math.round(normalized.h * scale));
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = outW;
  scaledCanvas.height = outH;
  const scaledCtx = scaledCanvas.getContext('2d');
  if (!scaledCtx) return null;
  scaledCtx.imageSmoothingEnabled = false;
  scaledCtx.drawImage(
    sourceCanvas,
    normalized.x,
    normalized.y,
    normalized.w,
    normalized.h,
    0,
    0,
    outW,
    outH
  );
  const scaledData = scaledCtx.getImageData(0, 0, outW, outH);
  return decodeImageData(scaledData, `${source}:scaled`, normalized, outW / normalized.w, outH / normalized.h);
}

function parseScanGradeUrlPayload(trimmed) {
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  const wrappedPayload =
    url.searchParams.get('sg') ||
    url.searchParams.get('payload') ||
    url.searchParams.get('d');
  if (wrappedPayload) return parseQrPayloadString(wrappedPayload);

  const pathMatch = url.pathname.match(/\/(?:s|sheet|worksheet)\/([^/?#]+)/);
  if (!pathMatch) return null;

  const sheetCode = decodeURIComponent(pathMatch[1] || '').trim();
  if (!sheetCode) return null;
  if (sheetCode.startsWith('SG1:')) return parseQrPayloadString(sheetCode);

  return {
    schema_version: 1,
    sheet_instance_id: sheetCode,
    sheet_lookup_code: sheetCode,
    source_url: trimmed
  };
}

/**
 * Try to parse QR data string as a ScanGrade payload (QR-SPEC or legacy).
 * @param {string} data - Raw string from jsQR (may be JSON or base64-encoded JSON)
 * @returns {object|null} - Parsed payload with at least answer_key or layout_id usable, or null
 */
export function parseQrPayloadString(data) {
  if (!data || typeof data !== 'string') return null;
  const trimmed = data.trim();
  if (!trimmed) return null;

  const urlPayload = parseScanGradeUrlPayload(trimmed);
  if (urlPayload) return urlPayload;

  if (trimmed.startsWith('SG1:')) {
    const [, layoutId, templateVersion = '1', answerKeyChecksum = ''] = trimmed.split(':');
    if (!layoutId) return null;
    return {
      schema_version: 1,
      template_id: layoutId,
      template_version: Number(templateVersion) || 1,
      sheet_instance_id: `${layoutId}-sheet`,
      layout_id: layoutId,
      answer_key_checksum: answerKeyChecksum || undefined
    };
  }

  let jsonString;
  if (trimmed.startsWith('{')) {
    jsonString = trimmed;
  } else {
    try {
      jsonString = base64UrlSafeToJson(trimmed);
    } catch {
      return null;
    }
  }

  let payload;
  try {
    payload = JSON.parse(jsonString);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;

  // Legacy qr-generator format: { id, version, answers } -> map to answer_key
  if (Array.isArray(payload.answers) && payload.answer_key == null) {
    payload = { ...payload, answer_key: payload.answers };
  }
  return payload;
}

export function decodeQrFromPageUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;
  const payload = parseQrPayloadString(urlString);
  if (!payload || typeof payload !== 'object') return payload;
  return { ...payload, qr_decode_source: 'page-url' };
}

/**
 * Decode a QR code from a canvas image (e.g. captured/uploaded worksheet).
 * @param {HTMLCanvasElement} canvas - Canvas with the worksheet image drawn
 * @returns {object|null} - Decoded payload (answer_key, layout_id, homography, etc.) or null if none found
 */
export function decodeQrFromCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const full = decodeQrFromRegion(
    canvas,
    { x: 0, y: 0, w: canvas.width, h: canvas.height },
    'full-frame'
  );
  if (full) return full;

  const w = canvas.width;
  const h = canvas.height;
  const regions = [
    { name: 'bottom-center', x: w * 0.18, y: h * 0.58, w: w * 0.64, h: h * 0.40 },
    { name: 'bottom-band', x: w * 0.05, y: h * 0.54, w: w * 0.90, h: h * 0.45 },
    { name: 'lower-tight', x: w * 0.30, y: h * 0.66, w: w * 0.40, h: h * 0.28 },
    { name: 'lower-wide', x: w * 0.20, y: h * 0.64, w: w * 0.60, h: h * 0.30 }
  ];
  for (const region of regions) {
    const decoded = decodeQrFromRegion(canvas, region, region.name);
    if (decoded) return decoded;
  }
  return null;
}
