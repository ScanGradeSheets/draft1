import LAYOUT from './layout-10-box.json' assert { type: 'json' };

// Expected number of answer boxes based on the layout
const EXPECTED_BOX_COUNT = LAYOUT.boxes.length;

// Utility for safe Base64 encoding (handles UTF-8)
function utf8ToBase64(str) {
  const encoder = new TextEncoder();
  const utf8Bytes = encoder.encode(str);
  // Convert Uint8Array to a binary string for btoa (browser API)
  // This assumes a browser-like environment where btoa is available.
  // For Node.js or other environments, a Buffer-based approach would be needed.
  let binaryString = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binaryString += String.fromCharCode(utf8Bytes[i]);
  }
  return btoa(binaryString);
}

// Utility for safe Base64 decoding (handles UTF-8)
function base64ToUtf8(base64) {
  // Decode Base64
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}

/**
 * Encodes a ScanGrade QR payload into a Base64 string.
 *
 * @param {object} payload - The payload object {id: string, version: number, answers: number[]}
 * @returns {string} The Base64 encoded string.
 * @throws {Error} If validation fails.
 */
export function encodeQrPayload(payload) {
  if (typeof payload !== 'object' || payload === null) {
    throw new Error('Invalid payload: must be an object.');
  }
  const { id, version, answers } = payload;

  // Basic validation for required fields
  if (typeof id !== 'string' || !id) {
    throw new Error('Invalid payload: "id" (string) is required.');
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new Error('Invalid payload: "version" (non-negative integer) is required.');
  }
  if (!Array.isArray(answers)) {
    throw new Error('Invalid payload: "answers" (array) is required.');
  }

  // Validate answers array length
  if (answers.length !== EXPECTED_BOX_COUNT) {
    throw new Error(`Invalid payload: "answers" array must contain exactly ${EXPECTED_BOX_COUNT} elements. Found ${answers.length}.`);
  }

  // Validate answers values
  for (const ans of answers) {
    if (!Number.isInteger(ans) || ans < 0 || ans > 9) {
      throw new Error('Invalid payload: each element in "answers" must be an integer between 0 and 9.');
    }
  }

  // Ensure valid JSON before encoding
  const jsonString = JSON.stringify(payload);
  return utf8ToBase64(jsonString);
}

/**
 * Decodes a Base64 string into a ScanGrade QR payload.
 *
 * @param {string} base64String - The Base64 encoded string.
 * @returns {object} The decoded payload {id, version, answers}.
 * @throws {Error} If decoding or validation fails.
 */
export function decodeQrPayload(base64String) {
  if (typeof base64String !== 'string' || !base64String) {
    throw new Error('Invalid input: base64String must be a non-empty string.');
  }

  let jsonString;
  try {
    jsonString = base64ToUtf8(base64String);
  } catch (e) {
    throw new Error(`Failed to decode Base64 string: ${e.message}`);
  }

  let payload;
  try {
    payload = JSON.parse(jsonString);
  } catch (e) {
    throw new Error(`Failed to parse JSON payload: ${e.message}`);
  }

  const { id, version, answers } = payload;

  // Basic validation for required fields
  if (typeof id !== 'string' || !id) {
    throw new Error('Invalid payload: "id" (string) is required.');
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 0) {
    throw new Error('Invalid payload: "version" (non-negative integer) is required.');
  }
  if (!Array.isArray(answers)) {
    throw new Error('Invalid payload: "answers" (array) is required.');
  }

  // Validate answers array length
  if (answers.length !== EXPECTED_BOX_COUNT) {
    throw new Error(`Invalid payload: "answers" array must contain exactly ${EXPECTED_BOX_COUNT} elements. Found ${answers.length}.`);
  }

  // Validate answers values
  for (const ans of answers) {
    if (!Number.isInteger(ans) || ans < 0 || ans > 9) {
      throw new Error('Invalid payload: each element in "answers" must be an integer between 0 and 9.');
    }
  }

  return payload;
}

/*
// Usage Example:

const myPayload = {
  id: 'worksheet-123',
  version: 1,
  answers: [3, 0, 9, 5, 1, 6, 2, 8, 7, 4] // For a 10-box layout
};

try {
  const encoded = encodeQrPayload(myPayload);
  console.log('Encoded:', encoded); // e.g., "eyJpZCI6Indvcmsz..."
*/
