export { formatJsonText, buildTemplateFromSchema } from '../shared/schema-templates.js';

export function parseRawJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'JSON is required.' };
  }

  try {
    const parsed = JSON.parse(trimmed);
    return { ok: true, value: parsed };
  } catch (err) {
    return { ok: false, error: err?.message || 'Invalid JSON.' };
  }
}

function coerceInputObject(value) {
  if (typeof value === 'string') return { task: value };
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Top-level JSON must be an object (or a string, which is treated as { "task": "..." }).');
  }
  return value;
}

export function normalizeRunBodyFromRawJson(rawValue) {
  if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue) && rawValue.input !== undefined) {
    const inputObj = coerceInputObject(rawValue.input);
    return { ...rawValue, input: inputObj };
  }

  return { input: coerceInputObject(rawValue) };
}

