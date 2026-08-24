import { guessMediaKind } from './media.js';

export const EXAMPLE_DATE_TIME = '2025-01-01T00:00:00.000Z';

export function formatJsonText(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const parsed = JSON.parse(trimmed);
  return JSON.stringify(parsed, null, 2);
}

function buildExampleUrl({ key, kind }) {
  const k = String(key || '').toLowerCase();

  if (kind === 'image') return 'https://example.com/image.png';
  if (kind === 'video') return 'https://example.com/video.mp4';
  if (kind === 'audio') return 'https://example.com/audio.mp3';
  if (kind === 'imageOrVideo') return 'https://example.com/media.mp4';
  if (kind === 'audioOrVideo') return 'https://example.com/media.mp3';

  if (k.includes('webhook')) return 'https://example.com/webhook';
  return 'https://example.com';
}

function buildTextPlaceholder({ key, minLength = 0 }) {
  const k = String(key || '').toLowerCase();
  let out = 'Example';
  if (k.includes('prompt')) out = 'Describe what you want';
  else if (k === 'task') out = 'Describe your request';
  else if (k.includes('topic')) out = 'Topic to discuss';
  else if (k.includes('title')) out = 'Example title';
  // Note: check 'description' before 'script' because 'description' contains 'script'
  else if (k.includes('description')) out = 'Describe the desired output';
  else if (k.includes('script')) out = 'Write your script here';

  if (out.length >= minLength) return out;
  return out.padEnd(minLength, '.');
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function isForbiddenKey(key) {
  return key === '__proto__' || key === 'prototype' || key === 'constructor';
}

function scoreTemplateKey({ key, propSchema, allProperties }) {
  const k = String(key || '');
  const lower = k.toLowerCase();

  // Prefer URL variants over base64 when both exist.
  if (lower.endsWith('base64')) {
    const urlKey = `${k.slice(0, -'Base64'.length)}Url`;
    if (Object.prototype.hasOwnProperty.call(allProperties, urlKey)) return -10;
  }

  const mediaKind = guessMediaKind(k, propSchema);
  if (mediaKind) {
    let score = 120;
    if (lower.endsWith('url')) score += 10;
    if (lower.includes('mask')) score += 3;
    return score;
  }

  if (['task', 'prompt', 'text', 'query', 'message', 'topic', 'description', 'instructions', 'script'].includes(lower)) {
    return 90;
  }

  if (lower === 'id' || lower.endsWith('id')) return 60;
  if (lower.includes('name') || lower.includes('title')) return 55;
  if (lower.includes('start') || lower.includes('end') || lower.includes('duration') || lower.includes('time')) return 50;

  return 10;
}

function pickOptionalObjectKeys(properties, maxKeys = 3) {
  const entries = Object.entries(properties)
    .filter(([key]) => !isForbiddenKey(key))
    .map(([key, propSchema]) => ({
      key,
      score: scoreTemplateKey({ key, propSchema, allProperties: properties }),
      propSchema,
    }))
    .filter(item => Number.isFinite(item.score) && item.score > 0);

  entries.sort((a, b) => b.score - a.score);
  return entries.slice(0, maxKeys).map(item => item.key);
}

function placeholderForSchemaNode(node, { key = '', depth = 0, preferNonEmptyString = false, forceNonEmptyArray = false } = {}) {
  if (!node || typeof node !== 'object') return '';

  if (Object.prototype.hasOwnProperty.call(node, 'default') && node.default !== undefined) return node.default;
  if (Array.isArray(node.enum) && node.enum.length > 0) return node.enum[0];

  const type = String(node.type || 'string');
  const format = String(node.format || '').toLowerCase();
  const minLength = typeof node.minLength === 'number' && Number.isFinite(node.minLength) ? node.minLength : 0;

  const mediaKind = guessMediaKind(key, node);

  if (type === 'string') {
    if (format === 'date-time' || format === 'datetime') return EXAMPLE_DATE_TIME;
    if (format === 'uri' || format === 'url') return buildExampleUrl({ key, kind: mediaKind });
    if (mediaKind) return buildExampleUrl({ key, kind: mediaKind });
    if (preferNonEmptyString || minLength > 0) return buildTextPlaceholder({ key, minLength });
    return '';
  }

  if (type === 'boolean') return false;
  if (type === 'number' || type === 'integer') return 0;

  if (type === 'array') {
    if (depth >= 3) return [];
    const items = node.items && typeof node.items === 'object' ? node.items : null;
    const minItems = typeof node.minItems === 'number' && Number.isFinite(node.minItems) ? node.minItems : 0;
    const count = minItems > 0 ? minItems : forceNonEmptyArray ? 1 : 0;
    if (!items) return [];
    const arr = [];
    for (let i = 0; i < count; i += 1) {
      arr.push(placeholderForSchemaNode(items, { key, depth: depth + 1, preferNonEmptyString, forceNonEmptyArray: true }));
    }
    return arr;
  }

  if (type === 'object') {
    if (depth >= 3) return {};
    const properties = isPlainObject(node.properties) ? node.properties : {};
    const required = Array.isArray(node.required) ? node.required : [];
    const out = {};
    for (const [childKey, childSchema] of Object.entries(properties)) {
      if (isForbiddenKey(childKey)) continue;
      const isRequired = required.includes(childKey);
      const hasDefault = childSchema && typeof childSchema === 'object'
        && Object.prototype.hasOwnProperty.call(childSchema, 'default')
        && childSchema.default !== undefined;
      if (!isRequired && !hasDefault) continue;
      out[childKey] = placeholderForSchemaNode(childSchema, {
        key: childKey,
        depth: depth + 1,
        preferNonEmptyString: isRequired,
        forceNonEmptyArray: isRequired,
      });
    }

    // If the schema has no required/default properties, include a small, high-signal skeleton
    // for required contexts (e.g. array items or required objects) so templates are runnable.
    if (
      Object.keys(out).length === 0
      && preferNonEmptyString
      && Object.keys(properties).length > 0
    ) {
      const optionalKeys = pickOptionalObjectKeys(properties, 3);
      for (const childKey of optionalKeys) {
        const childSchema = properties[childKey];
        out[childKey] = placeholderForSchemaNode(childSchema, {
          key: childKey,
          depth: depth + 1,
          preferNonEmptyString: true,
          forceNonEmptyArray: true,
        });
      }
    }

    // Best-effort for dynamic objects with additionalProperties only.
    if (Object.keys(out).length === 0 && Object.keys(properties).length === 0) {
      const additional = node.additionalProperties;
      const valueSchema = isPlainObject(additional) ? additional : null;
      if (additional === true || valueSchema) {
        out.exampleKey = placeholderForSchemaNode(valueSchema || { type: 'string' }, {
          key: `${key || 'value'}Value`,
          depth: depth + 1,
          preferNonEmptyString: true,
        });
      }
    }

    return out;
  }

  return '';
}

export function buildTemplateForProperty({ key, propSchema, required = false }) {
  const type = propSchema && typeof propSchema === 'object' ? String(propSchema.type || '') : '';
  const lowered = type.toLowerCase();
  if (lowered !== 'object' && lowered !== 'array') {
    return lowered === 'array' ? [] : {};
  }

  return placeholderForSchemaNode(propSchema, { key, preferNonEmptyString: required, forceNonEmptyArray: required });
}

export function buildTemplateFromSchema(schema) {
  const inputSchema = schema?.input || schema;
  const properties = inputSchema?.properties && typeof inputSchema.properties === 'object' ? inputSchema.properties : {};
  const required = Array.isArray(inputSchema?.required) ? inputSchema.required : [];

  const out = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    const isRequired = required.includes(key);
    const hasDefault = propSchema && typeof propSchema === 'object'
      && Object.prototype.hasOwnProperty.call(propSchema, 'default')
      && propSchema.default !== undefined;
    if (!isRequired && !hasDefault) continue;
    out[key] = placeholderForSchemaNode(propSchema, { key, forceNonEmptyArray: isRequired, preferNonEmptyString: isRequired });
  }

  // Heuristics for schemas that rely on Zod `refine()` (one-of requirements).
  // Prefer URL variants over base64 when both exist.
  for (const key of Object.keys(properties)) {
    if (!key.endsWith('Base64')) continue;
    const urlKey = `${key.slice(0, -'Base64'.length)}Url`;
    if (!Object.prototype.hasOwnProperty.call(properties, urlKey)) continue;
    if (out[urlKey] !== undefined || out[key] !== undefined) continue;
    const urlSchema = properties[urlKey];
    if (!guessMediaKind(urlKey, urlSchema)) continue;
    out[urlKey] = placeholderForSchemaNode(urlSchema, { key: urlKey, preferNonEmptyString: true });
  }

  const primaryTextKeys = [
    'task',
    'prompt',
    'text',
    'query',
    'message',
    'topic',
    'description',
    'instructions',
    'script',
    'sourceDocument',
    'sourceUrl',
  ];

  const hasPrimaryText = primaryTextKeys.some(k => out[k] !== undefined);
  if (!hasPrimaryText) {
    const pick = primaryTextKeys.find(k => Object.prototype.hasOwnProperty.call(properties, k));
    if (pick) {
      out[pick] = placeholderForSchemaNode(properties[pick], { key: pick, preferNonEmptyString: true });
    }
  }

  const hasMedia = Object.entries(properties).some(([key, propSchema]) => {
    const mk = guessMediaKind(key, propSchema);
    return mk && out[key] !== undefined;
  });
  if (!hasMedia) {
    const mediaCandidates = Object.entries(properties)
      .filter(([k, v]) => guessMediaKind(k, v))
      .map(([k]) => k);
    const candidate = mediaCandidates.find(k => k.toLowerCase().endsWith('url')) ?? mediaCandidates[0];
    if (candidate && out[candidate] === undefined) {
      out[candidate] = placeholderForSchemaNode(properties[candidate], { key: candidate, preferNonEmptyString: true });
    }
  }

  if (Object.keys(out).length === 0) {
    out.task = buildTextPlaceholder({ key: 'task' });
  }

  return out;
}
