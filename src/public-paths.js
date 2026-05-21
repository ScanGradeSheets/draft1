const BASE_URL = import.meta.env.BASE_URL || '/';

export function publicUrl(path) {
  const raw = String(path || '');
  if (/^(https?:|data:|blob:)/.test(raw)) return raw;
  const base = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`;
  const cleanPath = raw.replace(/^\/+/, '');
  return `${base}${cleanPath}`;
}

export function modelUrlFromQuery(value, fallback) {
  if (!value) return fallback;
  const clean = String(value).replace(/^\/+/, '');
  if (!clean.startsWith('models/') || !clean.endsWith('.onnx')) return fallback;
  return publicUrl(clean);
}
