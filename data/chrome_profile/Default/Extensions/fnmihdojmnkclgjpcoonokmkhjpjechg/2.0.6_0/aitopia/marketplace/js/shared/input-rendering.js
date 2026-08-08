/**
 * Shared input-rendering helpers.
 *
 * Used by creation-history.js and outputs.js to render run input data
 * (media thumbnails, text fields) in a consistent way.
 */

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Keys to skip when rendering input fields (system/internal + already shown separately) */
const INPUT_SKIP_KEYS = new Set([
  'conversationId', 'selectedModelId',
  '_aitopia', '_meta', '_internal',
  'prompt', 'text', 'task',
]);

/** Check if a string value looks like a media URL (image/video/audio file or data URI) */
export function isMediaUrl(val) {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (s.startsWith('data:image/') || s.startsWith('data:video/') || s.startsWith('data:audio/')) return true;
  if (s.startsWith('https://aitopia.ai/uploads/')) return true;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    if (/\.(png|jpe?g|gif|webp|svg|bmp|avif|mp4|webm|mov|m4v|mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i.test(s)) return true;
    if (/replicate\.delivery|fal\.media|fal\.ai\/files|oaidalleapiprodscus/i.test(s)) return true;
    return false;
  }
  return false;
}

/** Check if URL is a video */
export function isVideoUrl(url) {
  if (!isMediaUrl(url)) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('data:video/')) return true;
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(lower);
}

/** Check if URL is an audio */
export function isAudioUrl(url) {
  if (!isMediaUrl(url)) return false;
  const lower = url.toLowerCase();
  if (lower.startsWith('data:audio/')) return true;
  return /\.(mp3|wav|ogg|m4a|aac|flac)(\?|#|$)/i.test(lower);
}

/** Pretty-print a field key: snake_case/camelCase → Title Case */
export function prettyLabel(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Flatten input object into renderable entries.
 * Unwraps nested objects like `parameters: { ... }` one level deep.
 */
export function flattenInput(input) {
  const flat = [];
  if (!input || typeof input !== 'object') return flat;

  for (const [key, val] of Object.entries(input)) {
    if (INPUT_SKIP_KEYS.has(key)) continue;
    if (key.startsWith('_')) continue;
    if (val == null || val === '') continue;

    // Unwrap nested plain objects (e.g. parameters: { prompt, image, ... })
    if (typeof val === 'object' && !Array.isArray(val)) {
      for (const [subKey, subVal] of Object.entries(val)) {
        if (INPUT_SKIP_KEYS.has(subKey)) continue;
        if (subKey.startsWith('_')) continue;
        if (subVal == null || subVal === '') continue;
        flat.push({ key: subKey, val: subVal });
      }
    } else {
      flat.push({ key, val });
    }
  }
  return flat;
}

/**
 * Build HTML for the input fields section.
 * Shows ALL input data: media URLs as thumbnails, text as label:value pairs.
 */
export function renderInputFieldsHtml(input, opts) {
  const model = opts?.model || null;
  if ((!input || typeof input !== 'object') && !model) return '';

  const entries = input ? flattenInput(input) : [];
  if (entries.length === 0 && !model) return '';

  const mediaItems = [];
  const textItems = [];

  for (const { key, val } of entries) {
    const strVal = typeof val === 'string' ? val.trim() : '';

    // Media URLs → visual thumbnails
    if (strVal && isMediaUrl(strVal)) {
      mediaItems.push({ key, url: strVal });
    }
    // Arrays → join as text
    else if (Array.isArray(val)) {
      const display = val.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(', ');
      if (display) textItems.push({ key, display: display.length > 200 ? display.slice(0, 197) + '...' : display });
    }
    // Booleans
    else if (typeof val === 'boolean') {
      textItems.push({ key, display: val ? 'Yes' : 'No' });
    }
    // Numbers
    else if (typeof val === 'number') {
      textItems.push({ key, display: String(val) });
    }
    // Strings (non-URL)
    else if (strVal) {
      textItems.push({ key, display: strVal.length > 200 ? strVal.slice(0, 197) + '...' : strVal });
    }
  }

  if (mediaItems.length === 0 && textItems.length === 0) return '';

  let html = '<div class="space-y-2 pt-2 mt-2 border-t border-gray-200/50 dark:border-[#333]/50">';
  html += '<p class="text-[10px] font-medium uppercase tracking-wider text-gray-400 dark:text-[#666]">Inputs</p>';

  // Media thumbnails
  if (mediaItems.length > 0) {
    html += '<div class="flex flex-wrap gap-2">';
    for (const { key, url } of mediaItems) {
      if (isVideoUrl(url)) {
        html += `
          <div class="relative w-20 h-20 rounded-lg overflow-hidden bg-black" title="${escapeHtml(prettyLabel(key))}">
            <video src="${escapeHtml(url)}" class="w-full h-full object-cover" muted preload="metadata"></video>
            <div class="absolute inset-0 flex items-center justify-center bg-black/20">
              <svg class="w-5 h-5 text-white/80" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>
            <span class="absolute bottom-0 left-0 right-0 text-[9px] text-center text-white/70 bg-black/50 py-0.5 truncate px-1">${escapeHtml(prettyLabel(key))}</span>
          </div>`;
      } else if (isAudioUrl(url)) {
        html += `
          <div class="flex flex-col items-center gap-1 p-2 rounded-lg bg-gradient-to-br from-primary/90/5 to-pink-50 dark:from-primary/90/10 dark:to-pink-500/10 border border-gray-200 dark:border-[#333]" title="${escapeHtml(prettyLabel(key))}">
            <svg class="w-5 h-5 text-primary/90" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"/></svg>
            <span class="text-[9px] text-gray-500 dark:text-[#888]">${escapeHtml(prettyLabel(key))}</span>
          </div>`;
      } else {
        html += `
          <div class="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-[#333] bg-gray-100 dark:bg-[#1a1a1a]" title="${escapeHtml(prettyLabel(key))}">
            <img src="${escapeHtml(url)}" alt="${escapeHtml(prettyLabel(key))}" class="w-full h-full object-cover" loading="lazy">
            <span class="absolute bottom-0 left-0 right-0 text-[9px] text-center text-white/70 bg-black/50 py-0.5 truncate px-1">${escapeHtml(prettyLabel(key))}</span>
          </div>`;
      }
    }
    html += '</div>';
  }

  // Text fields + model
  if (textItems.length > 0 || model) {
    html += '<div class="space-y-1">';
    for (const { key, display } of textItems) {
      html += `
        <div class="flex items-baseline gap-1.5 text-xs">
          <span class="text-gray-400 dark:text-[#666] flex-shrink-0">${escapeHtml(prettyLabel(key))}:</span>
          <span class="text-gray-600 dark:text-[#999] break-words line-clamp-2">${escapeHtml(display)}</span>
        </div>`;
    }
    if (model) {
      html += `
        <div class="flex items-baseline gap-1.5 text-xs">
          <span class="text-gray-400 dark:text-[#666] flex-shrink-0">Model:</span>
          <span class="text-gray-600 dark:text-[#999] break-words">${escapeHtml(model)}</span>
        </div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}
