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
  return new TextDecoder().decode(bytes);
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

/**
 * Decode a QR code from a canvas image (e.g. captured/uploaded worksheet).
 * @param {HTMLCanvasElement} canvas - Canvas with the worksheet image drawn
 * @returns {object|null} - Decoded payload (answer_key, layout_id, homography, etc.) or null if none found
 */
export function decodeQrFromCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
  if (!code || !code.data) return null;
  return parseQrPayloadString(code.data);
}
