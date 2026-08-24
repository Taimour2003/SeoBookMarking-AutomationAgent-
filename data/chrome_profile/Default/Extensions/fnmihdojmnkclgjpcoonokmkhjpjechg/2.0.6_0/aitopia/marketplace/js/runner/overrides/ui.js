import { fileToDataUrl, acceptForKind, maxBytesForKind, maxInlineBytesForKind, formatBytes, uploadFileToServer } from '../../shared/media.js';

export class FieldValidationError extends Error {
  /**
   * @param {string} fieldId - The field identifier (id or label) that has the error
   * @param {string} message - The error message to display
   */
  constructor(fieldId, message) {
    super(message);
    this.name = 'FieldValidationError';
    this.fieldId = fieldId;
  }
}

// ============================================
// Global Form Data Management (Proxy-based)
// ============================================

// Change listeners set — every subscriber gets called on any mutation
const _formDataListeners = new Set();
let _formDataNotifyTimeout = null;
const FORM_DATA_DEBOUNCE_MS = 50;

/**
 * Emit a change notification (debounced for batched field updates, immediate for resets)
 */
function _notifyFormDataChange(key, value, oldValue, immediate) {
  const emit = () => {
    const detail = { key, value, oldValue, formData: { ...window.agent_form_data } };
    // 1. Notify registered listeners
    for (const cb of _formDataListeners) {
      try { cb(detail); } catch { /* silent */ }
    }
    // 2. Dispatch DOM event for existing consumers (dynamic pricing etc.)
    try {
      window.dispatchEvent(new CustomEvent('aitopia:form:data-changed', { detail }));
    } catch { /* silent */ }
  };

  if (immediate) {
    if (_formDataNotifyTimeout) { clearTimeout(_formDataNotifyTimeout); _formDataNotifyTimeout = null; }
    emit();
  } else {
    if (_formDataNotifyTimeout) clearTimeout(_formDataNotifyTimeout);
    _formDataNotifyTimeout = setTimeout(emit, FORM_DATA_DEBOUNCE_MS);
  }
}

/**
 * Create a Proxy wrapper that intercepts every property set/delete on agent_form_data.
 * This catches writes from schema-form.js, ui.js, embed-runner.js — everywhere.
 */
function _createFormDataProxy(target) {
  return new Proxy(target, {
    set(obj, prop, value) {
      // Skip internal/symbol props
      if (typeof prop === 'symbol') { obj[prop] = value; return true; }
      const oldValue = obj[prop];
      obj[prop] = value;
      if (oldValue !== value) {
        _notifyFormDataChange(String(prop), value, oldValue, false);
      }
      return true;
    },
    deleteProperty(obj, prop) {
      if (typeof prop === 'symbol') { delete obj[prop]; return true; }
      const oldValue = obj[prop];
      delete obj[prop];
      if (oldValue !== undefined) {
        _notifyFormDataChange(String(prop), undefined, oldValue, false);
      }
      return true;
    },
  });
}

// Bootstrap: intercept `window.agent_form_data = ...` assignments via defineProperty
// so that even full replacements (e.g. `= {}`) are wrapped with a fresh Proxy.
if (typeof window !== 'undefined') {
  let _backing = _createFormDataProxy(
    window.agent_form_data && typeof window.agent_form_data === 'object' ? { ...window.agent_form_data } : {}
  );

  Object.defineProperty(window, 'agent_form_data', {
    get() { return _backing; },
    set(newVal) {
      const raw = newVal && typeof newVal === 'object' ? newVal : {};
      // If the incoming value is already our proxy, keep it as-is to avoid double-wrapping
      if (raw === _backing) return;
      _backing = _createFormDataProxy(raw);
      // Full reset — notify with key '*'
      _notifyFormDataChange('*', _backing, null, true);
    },
    configurable: true,
    enumerable: true,
  });
}

/**
 * Subscribe to any agent_form_data change (property set, delete, or full reset).
 *
 * Callback receives: { key, value, oldValue, formData }
 *   - key === '*' means the entire object was replaced/reset
 *
 * @param {function} callback
 * @returns {function} unsubscribe
 *
 * @example
 *   const unsub = onAgentFormDataChange(({ key, value, formData }) => {
 *     sessionStorage.setItem('agent_form_snapshot', JSON.stringify(formData));
 *   });
 */
export function onAgentFormDataChange(callback) {
  if (typeof callback !== 'function') return () => {};
  _formDataListeners.add(callback);
  return () => _formDataListeners.delete(callback);
}

// Also expose on window for non-module consumers
if (typeof window !== 'undefined') {
  window.onAgentFormDataChange = onAgentFormDataChange;
}

/**
 * Read a File/Blob as a base64 data URL string.
 * Returns a promise that resolves to the data URL (e.g. "data:image/png;base64,…").
 * @param {File|Blob} file
 * @returns {Promise<string>}
 */
function fileToBase64DataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(/** @type {string} */ (reader.result));
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * Update a field value in the global agent_form_data object
 * @param {string} fieldId - The field identifier (label or id)
 * @param {any} value - The value to store
 */
export function updateFormData(fieldId, value) {
  if (typeof window === 'undefined' || !fieldId) return;
  window.agent_form_data = window.agent_form_data || {};
  const key = String(fieldId).trim();
  if (!key) return;

  const oldValue = window.agent_form_data[key];
  window.agent_form_data[key] = value;

  // Always emit directly — don't rely solely on Proxy (belt-and-suspenders)
  if (oldValue !== value) {
    _notifyFormDataChange(key, value, oldValue, false);
  }
}

/**
 * Get all form data
 * @returns {object} The current form data
 */
export function getFormData() {
  if (typeof window === 'undefined') return {};
  return window.agent_form_data || {};
}

/**
 * Clear all form data
 */
export function clearFormData() {
  if (typeof window === 'undefined') return;
  window.agent_form_data = {};
}

const IMAGE_UPLOAD_ICON_LIGHT = `
<svg width="32" height="32" viewBox="49.5 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="49.5" width="32" height="32" rx="16" fill="#e5e5e5"/>
  <rect x="49.8" y="0.3" width="31.4" height="31.4" rx="15.7" stroke="#d4d4d4" stroke-opacity="0.8" stroke-width="0.6"/>
  <path d="M65.4996 16.6662V21.9995M60.1663 17.9322C59.671 17.4261 59.2973 16.814 59.0736 16.1421C58.8499 15.4703 58.7821 14.7563 58.8752 14.0544C58.9683 13.3524 59.2199 12.6808 59.611 12.0905C60.0021 11.5002 60.5224 11.0066 61.1325 10.6472C61.7426 10.2878 62.4265 10.0719 63.1324 10.0159C63.8383 9.95991 64.5476 10.0653 65.2068 10.3241C65.8659 10.5829 66.4575 10.9882 66.9368 11.5095C67.416 12.0308 67.7703 12.6543 67.9729 13.3328H69.1663C69.8099 13.3328 70.4366 13.5397 70.9536 13.9231C71.4706 14.3065 71.8506 14.8461 72.0374 15.462C72.2243 16.078 72.208 16.7377 71.9911 17.3438C71.7742 17.9498 71.3682 18.47 70.8329 18.8275" stroke="#737373" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M62.8333 19.3334L65.5 16.6667L68.1666 19.3334" stroke="#737373" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`.trim();
const IMAGE_UPLOAD_ICON_DARK = `
<svg width="32" height="32" viewBox="49.5 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <rect x="49.5" width="32" height="32" rx="16" fill="#272727"/>
  <rect x="49.8" y="0.3" width="31.4" height="31.4" rx="15.7" stroke="#B6B6B6" stroke-opacity="0.3" stroke-width="0.6"/>
  <path d="M65.4996 16.6662V21.9995M60.1663 17.9322C59.671 17.4261 59.2973 16.814 59.0736 16.1421C58.8499 15.4703 58.7821 14.7563 58.8752 14.0544C58.9683 13.3524 59.2199 12.6808 59.611 12.0905C60.0021 11.5002 60.5224 11.0066 61.1325 10.6472C61.7426 10.2878 62.4265 10.0719 63.1324 10.0159C63.8383 9.95991 64.5476 10.0653 65.2068 10.3241C65.8659 10.5829 66.4575 10.9882 66.9368 11.5095C67.416 12.0308 67.7703 12.6543 67.9729 13.3328H69.1663C69.8099 13.3328 70.4366 13.5397 70.9536 13.9231C71.4706 14.3065 71.8506 14.8461 72.0374 15.462C72.2243 16.078 72.208 16.7377 71.9911 17.3438C71.7742 17.9498 71.3682 18.47 70.8329 18.8275" stroke="#B6B6B6" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M62.8333 19.3334L65.5 16.6667L68.1666 19.3334" stroke="#B6B6B6" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`.trim();

export function setHidden(el, hidden) {
  if (!el) return;
  el.classList.toggle('hidden', Boolean(hidden));
}

let helpSystemInitialized = false;
let helpIdCounter = 0;

function sanitizeIdSeed(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_-]+/g, '-')
    .replaceAll(/^-+|-+$/g, '') || 'field';
}

function generateHelpId(seed) {
  helpIdCounter += 1;
  return `aifnmjmchg-help-${sanitizeIdSeed(seed)}-${helpIdCounter}`;
}

export function formatFieldName(key) {
  return String(key ?? '')
    .trim()
    .replaceAll(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll(/_/g, ' ')
    .replaceAll(/\b\w/g, (c) => c.toUpperCase())
    .replaceAll(/\bUrl\b/g, 'URL')
    .replaceAll(/\bApi\b/g, 'API')
    .replaceAll(/\bId\b/g, 'ID')
    .replaceAll(/\bCfg\b/g, 'CFG')
    .replaceAll(/\bSeo\b/g, 'SEO');
}

export function closeAllHelpPanels() {
  document.querySelectorAll('[data-help-panel]:not([hidden])').forEach((panel) => {
    panel.hidden = true;
  });
  document.querySelectorAll('[data-help-trigger][aria-expanded="true"]').forEach((trigger) => {
    trigger.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('[data-help-open]').forEach((scope) => {
    scope.removeAttribute('data-help-open');
  });
}

export function setupHelpSystemOnce() {
  if (helpSystemInitialized) return;
  helpSystemInitialized = true;

  document.addEventListener('click', (e) => {
    const trigger = e.target?.closest?.('[data-help-trigger]');
    if (trigger) {
      e.preventDefault();
      e.stopPropagation();

      const panelId = trigger.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;
      if (!panel) return;

      const wasOpen = !panel.hidden;
      closeAllHelpPanels();
      if (!wasOpen) {
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        const scope = trigger.closest?.('[data-help-scope]');
        if (scope) scope.setAttribute('data-help-open', '');
        const rect = trigger.getBoundingClientRect();
        const panelWidth = 260;
        let left = rect.left;
        if (left + panelWidth > window.innerWidth - 8) {
          left = Math.max(8, window.innerWidth - panelWidth - 8);
        }
        panel.style.left = `${left}px`;
        panel.style.top = `${rect.bottom + 8}px`;
      }
      return;
    }

    const clickedPanel = e.target?.closest?.('[data-help-panel]');
    if (clickedPanel) return;
    const openScope = document.querySelector('[data-help-open]');
    if (openScope && !e.target?.closest?.('[data-help-open]')) closeAllHelpPanels();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllHelpPanels();
  });
}

export function createHelpToggle({ idSeed, labelText, helpText } = {}) {
  const text = String(helpText ?? '').trim();
  if (!text) return { trigger: null, panel: null };

  setupHelpSystemOnce();

  const panelId = generateHelpId(idSeed || labelText || 'help');

  const wrapper = document.createElement('div');
  wrapper.className = 'relative inline-flex ml-2';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className =
    'inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#D9D9D9]/40 dark:border-[#D9D9D9]/20 ' +
    'text-[#898A8B] hover:text-[#0D0D0D] dark:hover:text-white hover:border-[#D9D9D9]/60 dark:hover:border-[#D9D9D9]/40 ' +
    'focus:outline-none text-[11px] font-semibold leading-none transition-colors';
  trigger.setAttribute('aria-label', `Help for ${String(labelText || idSeed || 'field')}`);
  trigger.setAttribute('aria-controls', panelId);
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('data-help-trigger', '');
  trigger.textContent = '?';

  const panel = document.createElement('div');
  panel.id = panelId;
  panel.hidden = true;
  panel.setAttribute('data-help-panel', '');
  panel.className =
    'fixed z-[9999] w-[260px] max-w-[80vw] rounded-xl ' +
    'border border-[#D9D9D9]/30 dark:border-[#D9D9D9]/20 bg-white dark:bg-[#111213] ' +
    'px-3 py-2 text-xs leading-relaxed text-[#232323] dark:text-[#e8e8e8] shadow-xl';
  panel.textContent = text;

  wrapper.appendChild(trigger);
  document.body.appendChild(panel);

  return { trigger: wrapper, panel };
}

export function createFieldLabel(text, { required = false } = {}) {
  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-2 mt-2 mx-2';
  label.textContent = text;
  if (required) {
    const star = document.createElement('span');
    star.className = 'ml-1';
    star.textContent = '*';
    label.appendChild(star);
  }
  return label;
}

export function createHelpText(text) {
  if (!text) return null;
  const help = document.createElement('p');
  help.className = 'agent-form-hint mb-2';
  help.textContent = text;
  return help;
}

export function createMoreOptionsDisclosure({
  label = 'More options',
  count,
  defaultOpen = false,
  body,
} = {}) {
  const details = document.createElement('details');
  details.open = Boolean(defaultOpen);
  details.className = '';

  const summary = document.createElement('summary');
  summary.className =
    'flex items-center justify-between cursor-pointer select-none agent-form-value focus:outline-none';
  summary.style.listStyle = 'none';
  summary.classList.add('list-none');

  const left = document.createElement('span');
  left.className = 'agent-form-value';
  left.textContent = label;

  const chevron = document.createElement('span');
  chevron.className = 'inline-flex items-center justify-center text-muted-foreground';
  chevron.style.transition = 'transform 150ms ease';
  chevron.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
    </svg>
  `.trim();

  summary.appendChild(left);
  summary.appendChild(chevron);
  details.appendChild(summary);

  const bodyWrap = document.createElement('div');
  bodyWrap.className = 'space-y-3';
  if (body) bodyWrap.appendChild(body);
  details.appendChild(bodyWrap);

  function syncState() {
    const open = Boolean(details.open);
    chevron.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
  }

  details.addEventListener('toggle', syncState);
  syncState();

  return details;
}

export function createTextAreaField({
  label,
  id,
  required = false,
  placeholder = '',
  rows = 6,
  help,
  defaultValue = '',
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'textarea';
  if (id) wrap.setAttribute('data-id', id);

  const header = document.createElement('div');
  header.className = 'mb-2';
  const row = document.createElement('div');
  row.className = 'flex items-center';
  const labelEl = createFieldLabel(label, { required });
  labelEl.className = 'block text-sm font-medium mx-2';
  row.appendChild(labelEl);
  const { trigger } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger) {
    wrap.setAttribute('data-help-scope', '');
    row.appendChild(trigger);
  }
  header.appendChild(row);
  wrap.appendChild(header);

  const card = document.createElement('div');
  card.className = 'rounded-2xl bg-[#EAEFF6] dark:bg-[#1C1E20] p-4 transition-colors';

  const textarea = document.createElement('textarea');
  textarea.rows = rows;
  textarea.placeholder = placeholder || 'Type your prompt here...';
  textarea.className =
    'block w-full text-[13px] bg-transparent border-0 p-0 resize-none focus:ring-0 focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500';
  if (required) textarea.required = true;
  if (defaultValue) textarea.value = String(defaultValue);

  // Sync to global form data (keep empty string as-is for consistency)
  const syncToGlobal = () => updateFormData(fieldKey, textarea.value.trim());
  textarea.addEventListener('input', syncToGlobal);
  textarea.addEventListener('change', syncToGlobal);
  syncToGlobal(); // Initial sync

  card.appendChild(textarea);
  wrap.appendChild(card);

  const errorEl = document.createElement('p');
  errorEl.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  errorEl.setAttribute('role', 'alert');
  wrap.appendChild(errorEl);

  function setError(message) {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      card.style.outline = '';
      return;
    }
    errorEl.textContent = String(message);
    errorEl.classList.remove('hidden');
    card.style.outline = '1.5px solid #f87171';
    card.style.outlineOffset = '-1px';
  }

  function clearError() {
    setError('');
  }

  textarea.addEventListener('input', clearError);

  return {
    wrap,
    textarea,
    getValue: () => textarea.value,
    getTrimmed: () => textarea.value.trim(),
    setValue: (v) => { textarea.value = v == null ? '' : String(v); syncToGlobal(); },
    setError,
    clearError,
  };
}

export function createTextInputField({
  label,
  id,
  required = false,
  type = 'text',
  placeholder = '',
  help,
  defaultValue = '',
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'textInput';
  if (id) wrap.setAttribute('data-id', id);

  const header = document.createElement('div');
  header.className = 'mb-2';
  const row = document.createElement('div');
  row.className = 'flex items-center';
  const labelEl = createFieldLabel(label, { required });
  labelEl.className = 'block text-sm font-medium mx-2';
  row.appendChild(labelEl);
  const { trigger } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger) {
    wrap.setAttribute('data-help-scope', '');
    row.appendChild(trigger);
  }
  header.appendChild(row);
  wrap.appendChild(header);

  const input = document.createElement('input');
  input.type = type;
  input.placeholder = placeholder || 'Type anything...';
  input.className =
    'block w-full text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-4 py-3 ' +
    'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ' +
    'focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors';
  if (required) input.required = true;
  if (defaultValue != null && defaultValue !== '') input.value = String(defaultValue);

  // Sync to global form data (keep empty string as-is for consistency)
  const syncToGlobal = () => updateFormData(fieldKey, input.value.trim());
  input.addEventListener('input', syncToGlobal);
  input.addEventListener('change', syncToGlobal);
  syncToGlobal(); // Initial sync

  wrap.appendChild(input);

  const errorEl = document.createElement('p');
  errorEl.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  errorEl.setAttribute('role', 'alert');
  wrap.appendChild(errorEl);

  function setError(message) {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      input.style.outline = '';
      return;
    }
    errorEl.textContent = String(message);
    errorEl.classList.remove('hidden');
    input.style.outline = '1.5px solid #f87171';
  }

  function clearError() {
    setError('');
  }

  input.addEventListener('input', clearError);

  return {
    wrap,
    input,
    getValue: () => input.value,
    getTrimmed: () => input.value.trim(),
    setValue: (v) => { input.value = v == null ? '' : String(v); syncToGlobal(); },
    setError,
    clearError,
  };
}

export function createNumberField({
  label,
  id,
  required = false,
  min,
  max,
  step = 'any',
  help,
  defaultValue,
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'number';
  if (id) wrap.setAttribute('data-id', id);

  const header = document.createElement('div');
  header.className = 'mb-2';
  const row = document.createElement('div');
  row.className = 'flex items-center';
  const labelEl = createFieldLabel(label, { required });
  labelEl.className = 'block text-sm font-medium mx-2';
  row.appendChild(labelEl);
  const { trigger } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger) {
    wrap.setAttribute('data-help-scope', '');
    row.appendChild(trigger);
  }
  header.appendChild(row);
  wrap.appendChild(header);

  const input = document.createElement('input');
  input.type = 'number';
  input.step = String(step);
  input.className =
    'block w-full text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-4 py-3 ' +
    'text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 ' +
    'focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors';
  if (required) input.required = true;
  if (min != null) input.min = String(min);
  if (max != null) input.max = String(max);
  if (defaultValue != null) input.value = String(defaultValue);

  // Sync to global form data
  const syncToGlobal = () => {
    if (!input.value) {
      updateFormData(fieldKey, undefined);
    } else {
      const n = Number(input.value);
      updateFormData(fieldKey, Number.isFinite(n) ? n : undefined);
    }
  };
  input.addEventListener('input', syncToGlobal);
  input.addEventListener('change', syncToGlobal);
  syncToGlobal(); // Initial sync

  wrap.appendChild(input);

  const errorEl = document.createElement('p');
  errorEl.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  errorEl.setAttribute('role', 'alert');
  wrap.appendChild(errorEl);

  function setError(message) {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      input.style.outline = '';
      return;
    }
    errorEl.textContent = String(message);
    errorEl.classList.remove('hidden');
    input.style.outline = '1.5px solid #f87171';
  }

  function clearError() {
    setError('');
  }

  input.addEventListener('input', clearError);

  return {
    wrap,
    input,
    getNumber: () => {
      if (!input.value) return undefined;
      const n = Number(input.value);
      return Number.isFinite(n) ? n : undefined;
    },
    setNumber: (n) => { input.value = n == null ? '' : String(n); syncToGlobal(); },
    setError,
    clearError,
  };
}

export function createSliderField({
  label,
  id,
  required = false,
  min = 0,
  max = 100,
  step = 1,
  help,
  defaultValue,
  unit = '%',
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'slider';
  if (id) wrap.setAttribute('data-id', id);

  // Header: label + value
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-2.5';

  const leftRow = document.createElement('div');
  leftRow.className = 'flex items-center gap-1';
  const labelEl = createFieldLabel(label, { required });
  labelEl.className = 'block text-sm font-medium mx-2';
  leftRow.appendChild(labelEl);
  const { trigger } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger) {
    wrap.setAttribute('data-help-scope', '');
    leftRow.appendChild(trigger);
  }
  header.appendChild(leftRow);

  const initVal = defaultValue != null ? defaultValue : min;

  const valueText = document.createElement('span');
  valueText.className = 'text-sm text-gray-400 tabular-nums mr-2';
  valueText.textContent = `${initVal}${unit}`;
  header.appendChild(valueText);
  wrap.appendChild(header);

  // Inject scoped style for the slider (one-time)
  if (!document.getElementById('aifnmjmchg-slider-style')) {
    const style = document.createElement('style');
    style.id = 'aifnmjmchg-slider-style';
    style.textContent = `
      .aifnmjmchg-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 999px; outline: none; cursor: pointer; background: transparent; }
      .aifnmjmchg-slider::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.08); }
      .aifnmjmchg-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #fff; margin-top: -6px; cursor: pointer; box-shadow: 0 0 0 4px rgba(255,255,255,0.06); transition: box-shadow 0.15s, transform 0.15s; }
      .aifnmjmchg-slider:hover::-webkit-slider-thumb { box-shadow: 0 0 0 6px rgba(255,255,255,0.1); }
      .aifnmjmchg-slider:active::-webkit-slider-thumb { transform: scale(0.92); box-shadow: 0 0 0 4px rgba(255,255,255,0.15); }
      .aifnmjmchg-slider::-moz-range-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.08); border: none; }
      .aifnmjmchg-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #fff; border: none; cursor: pointer; box-shadow: 0 0 0 4px rgba(255,255,255,0.06); }
      .aifnmjmchg-slider::-moz-range-progress { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.3); }
    `;
    document.head.appendChild(style);
  }

  const input = document.createElement('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(initVal);
  input.className = 'aifnmjmchg-slider';

  // Webkit doesn't support ::-webkit-slider-runnable-track fill, so we use a gradient trick
  const updateTrackGradient = (value) => {
    const pct = ((value - min) / (max - min)) * 100;
    input.style.background = `linear-gradient(to right, rgba(255,255,255,0.3) ${pct}%, rgba(255,255,255,0.08) ${pct}%)`;
    input.style.borderRadius = '999px';
  };
  updateTrackGradient(initVal);

  const syncToGlobal = () => {
    const n = Number(input.value);
    valueText.textContent = `${n}${unit}`;
    updateTrackGradient(n);
    updateFormData(fieldKey, Number.isFinite(n) ? n : undefined);
  };
  input.addEventListener('input', syncToGlobal);
  input.addEventListener('change', syncToGlobal);
  syncToGlobal();

  wrap.appendChild(input);

  const errorEl = document.createElement('p');
  errorEl.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  errorEl.setAttribute('role', 'alert');
  wrap.appendChild(errorEl);

  function setError(message) {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      return;
    }
    errorEl.textContent = String(message);
    errorEl.classList.remove('hidden');
  }

  function clearError() {
    setError('');
  }

  input.addEventListener('input', clearError);

  return {
    wrap,
    input,
    getNumber: () => {
      const n = Number(input.value);
      return Number.isFinite(n) ? n : undefined;
    },
    setNumber: (n) => { input.value = n == null ? String(min) : String(n); syncToGlobal(); },
    setError,
    clearError,
  };
}

export function createColorPickerField({
  label,
  id,
  required = false,
  help,
  defaultValue = '#FFFFFF',
  presets = {},
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'colorPicker';
  if (id) wrap.setAttribute('data-id', id);

  // --- HSV ↔ RGB ↔ Hex ---
  function hsvToRgb(h, s, v) {
    const i = Math.floor(h / 60) % 6, f = h / 60 - Math.floor(h / 60);
    const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
    let r, g, b;
    switch (i) {
      case 0: r = v; g = t; b = p; break; case 1: r = q; g = v; b = p; break;
      case 2: r = p; g = v; b = t; break; case 3: r = p; g = q; b = v; break;
      case 4: r = t; g = p; b = v; break; default: r = v; g = p; b = q; break;
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase(); }
  function hexToRgb(hex) { const m = hex.match(/^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/); return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [255, 255, 255]; }
  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0; const s = max === 0 ? 0 : d / max, v = max;
    if (d !== 0) { if (max === r) h = ((g - b) / d + 6) % 6 * 60; else if (max === g) h = ((b - r) / d + 2) * 60; else h = ((r - g) / d + 4) * 60; }
    return [h, s, v];
  }
  function hexToHsv(hex) { return rgbToHsv(...hexToRgb(hex)); }
  function hsvToHex(h, s, v) { return rgbToHex(...hsvToRgb(h, s, v)); }

  // --- State ---
  const initHsv = hexToHsv(defaultValue || '#FFFFFF');
  let hue = initHsv[0], sat = initHsv[1], val = initHsv[2];
  let selected = (defaultValue || '#FFFFFF').toUpperCase();
  const SV_W = 280, SV_H = 160, HUE_H = 12;
  const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
  const presetEntries = Object.entries(presets).filter(([, hex]) => /^#[0-9A-Fa-f]{6}$/.test(hex));
  const hasPresets = presetEntries.length > 0;
  let pickerOpen = !hasPresets;

  // --- Scoped CSS (one-time) ---
  if (!document.getElementById('aifnmjmchg-color-picker-style')) {
    const style = document.createElement('style');
    style.id = 'aifnmjmchg-color-picker-style';
    style.textContent = `
      .acp-swatch{width:32px;height:32px;border-radius:50%;border:2px solid transparent;cursor:pointer;transition:transform .15s,border-color .15s,box-shadow .15s;padding:0;flex-shrink:0;outline:none;position:relative}
      .acp-swatch:hover{transform:scale(1.1);box-shadow:0 2px 8px rgba(0,0,0,.25)}
      .acp-swatch:focus-visible{box-shadow:0 0 0 2px #9335EC}
      .acp-swatch[aria-checked="true"]{border-color:#fff;box-shadow:0 0 0 2px #9335EC}
      .acp-swatch[aria-checked="true"]::after{content:'';position:absolute;inset:0;border-radius:50%;border:2px solid rgba(0,0,0,.15)}
      .acp-sv{border-radius:8px;cursor:crosshair;display:block;width:100%;touch-action:none}
      .acp-hue{border-radius:6px;cursor:crosshair;display:block;width:100%;touch-action:none}
      .acp-toggle{display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.06);background:rgba(255,255,255,.03);cursor:pointer;transition:background .15s,border-color .15s;width:100%}
      .acp-toggle:hover{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.1)}
      .acp-picker{overflow:hidden;transition:max-height .3s cubic-bezier(.4,0,.2,1),opacity .2s ease,margin .3s ease}
      .acp-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 8px 2px 3px;border-radius:999px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08)}
    `;
    document.head.appendChild(style);
  }

  // --- Header ---
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-2';
  const leftRow = document.createElement('div');
  leftRow.className = 'flex items-center gap-1';
  const labelEl = createFieldLabel(label, { required });
  labelEl.className = 'block text-sm font-medium mx-2';
  leftRow.appendChild(labelEl);
  const { trigger } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger) { wrap.setAttribute('data-help-scope', ''); leftRow.appendChild(trigger); }
  header.appendChild(leftRow);

  // Hex pill: [swatch dot] #FFFFFF
  const pill = document.createElement('span');
  pill.className = 'acp-pill mr-1';
  const previewDot = document.createElement('span');
  previewDot.style.cssText = `display:inline-block;width:14px;height:14px;border-radius:50%;border:1px solid rgba(128,128,128,.25);flex-shrink:0;transition:background-color .15s`;
  previewDot.style.backgroundColor = selected;
  pill.appendChild(previewDot);
  const hexDisplay = document.createElement('span');
  hexDisplay.className = 'text-[11px] tabular-nums font-mono text-gray-400';
  hexDisplay.textContent = selected;
  pill.appendChild(hexDisplay);
  header.appendChild(pill);
  wrap.appendChild(header);

  // --- Preset swatches ---
  const swatchButtons = [];

  if (hasPresets) {
    const swatchRow = document.createElement('div');
    swatchRow.className = 'flex flex-wrap gap-2 mb-2 px-0.5';
    swatchRow.setAttribute('role', 'radiogroup');
    swatchRow.setAttribute('aria-label', 'Color presets');

    for (const [name, hex] of presetEntries) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', hex.toUpperCase() === selected ? 'true' : 'false');
      btn.setAttribute('aria-label', name);
      btn.title = name;
      btn.className = 'acp-swatch';
      btn.style.backgroundColor = hex;
      swatchRow.appendChild(btn);
      swatchButtons.push({ btn, hex: hex.toUpperCase() });
    }
    wrap.appendChild(swatchRow);
  }

  // --- Canvas: SV panel ---
  const svCanvas = document.createElement('canvas');
  svCanvas.className = 'acp-sv';
  svCanvas.width = SV_W;
  svCanvas.height = SV_H;
  const svCtx = svCanvas.getContext('2d');

  function drawSV() {
    const w = svCanvas.width, h = svCanvas.height;
    const [hr, hg, hb] = hsvToRgb(hue, 1, 1);
    const gH = svCtx.createLinearGradient(0, 0, w, 0);
    gH.addColorStop(0, '#fff'); gH.addColorStop(1, `rgb(${hr},${hg},${hb})`);
    svCtx.fillStyle = gH; svCtx.fillRect(0, 0, w, h);
    const gV = svCtx.createLinearGradient(0, 0, 0, h);
    gV.addColorStop(0, 'rgba(0,0,0,0)'); gV.addColorStop(1, '#000');
    svCtx.fillStyle = gV; svCtx.fillRect(0, 0, w, h);
    // Cursor: outer dark ring + inner white ring + color fill
    const cx = sat * w, cy = (1 - val) * h;
    svCtx.beginPath(); svCtx.arc(cx, cy, 8, 0, Math.PI * 2);
    svCtx.strokeStyle = 'rgba(0,0,0,.35)'; svCtx.lineWidth = 1.5; svCtx.stroke();
    svCtx.beginPath(); svCtx.arc(cx, cy, 6.5, 0, Math.PI * 2);
    svCtx.strokeStyle = '#fff'; svCtx.lineWidth = 2; svCtx.stroke();
  }

  // --- Canvas: Hue bar ---
  const hueCanvas = document.createElement('canvas');
  hueCanvas.className = 'acp-hue';
  hueCanvas.width = SV_W;
  hueCanvas.height = HUE_H;
  const hueCtx = hueCanvas.getContext('2d');

  function drawHue() {
    const w = hueCanvas.width, h = hueCanvas.height;
    const grad = hueCtx.createLinearGradient(0, 0, w, 0);
    for (let i = 0; i <= 6; i++) { const [r, g, b] = hsvToRgb(i * 60, 1, 1); grad.addColorStop(i / 6, `rgb(${r},${g},${b})`); }
    hueCtx.fillStyle = grad;
    hueCtx.save();
    hueCtx.beginPath(); hueCtx.roundRect(0, 0, w, h, 6); hueCtx.clip();
    hueCtx.fillRect(0, 0, w, h);
    hueCtx.restore();
    const mx = (hue / 360) * w;
    hueCtx.beginPath(); hueCtx.roundRect(mx - 5, -0.5, 10, h + 1, 5);
    hueCtx.strokeStyle = '#fff'; hueCtx.lineWidth = 2; hueCtx.stroke();
    hueCtx.beginPath(); hueCtx.roundRect(mx - 6, -1, 12, h + 2, 6);
    hueCtx.strokeStyle = 'rgba(0,0,0,.2)'; hueCtx.lineWidth = 1; hueCtx.stroke();
  }

  // --- Collapsible picker ---
  const pickerWrap = document.createElement('div');
  pickerWrap.className = 'acp-picker flex flex-col gap-2';
  pickerWrap.style.maxHeight = pickerOpen ? '200px' : '0';
  pickerWrap.style.opacity = pickerOpen ? '1' : '0';
  pickerWrap.style.marginTop = pickerOpen ? '8px' : '0';
  pickerWrap.appendChild(svCanvas);
  pickerWrap.appendChild(hueCanvas);

  // Toggle: rainbow-gradient bar as the button
  const toggleBtn = document.createElement('button');
  toggleBtn.type = 'button';
  toggleBtn.className = 'acp-toggle';
  // Mini rainbow indicator
  const rainbowBar = document.createElement('span');
  rainbowBar.style.cssText = 'width:16px;height:16px;border-radius:50%;background:conic-gradient(#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);flex-shrink:0;opacity:.7;transition:opacity .15s';
  toggleBtn.appendChild(rainbowBar);
  const toggleText = document.createElement('span');
  toggleText.className = 'text-[12px] text-gray-500 dark:text-gray-400';
  toggleText.textContent = 'Custom color';
  toggleBtn.appendChild(toggleText);
  const chevron = document.createElement('span');
  chevron.style.cssText = 'margin-left:auto;transition:transform .25s;font-size:10px;color:rgba(255,255,255,.3)';
  chevron.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2.5 3.75L5 6.25L7.5 3.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if (pickerOpen) chevron.style.transform = 'rotate(180deg)';
  toggleBtn.appendChild(chevron);
  wrap.appendChild(toggleBtn);
  wrap.appendChild(pickerWrap);

  toggleBtn.addEventListener('click', () => {
    pickerOpen = !pickerOpen;
    pickerWrap.style.maxHeight = pickerOpen ? '200px' : '0';
    pickerWrap.style.opacity = pickerOpen ? '1' : '0';
    pickerWrap.style.marginTop = pickerOpen ? '8px' : '0';
    chevron.style.transform = pickerOpen ? 'rotate(180deg)' : 'rotate(0)';
    rainbowBar.style.opacity = pickerOpen ? '1' : '.7';
    if (pickerOpen) requestAnimationFrame(redraw);
  });

  // --- Error ---
  const errorEl = document.createElement('p');
  errorEl.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  errorEl.setAttribute('role', 'alert');
  wrap.appendChild(errorEl);

  // --- Helpers ---
  function applySwatches() {
    for (const { btn, hex } of swatchButtons) btn.setAttribute('aria-checked', hex === selected ? 'true' : 'false');
  }
  function redraw() {
    svCanvas.width = svCanvas.width; hueCanvas.width = hueCanvas.width;
    drawSV(); drawHue();
  }
  function commitColor() {
    selected = hsvToHex(hue, sat, val);
    hexDisplay.textContent = selected;
    previewDot.style.backgroundColor = selected;
    applySwatches();
    updateFormData(fieldKey, selected);
  }
  function syncAll(hex) {
    [hue, sat, val] = hexToHsv(hex);
    selected = hex.toUpperCase();
    hexDisplay.textContent = selected;
    previewDot.style.backgroundColor = selected;
    applySwatches();
    redraw();
    updateFormData(fieldKey, selected);
  }
  function setError(msg) {
    if (!msg) { errorEl.textContent = ''; errorEl.classList.add('hidden'); return; }
    errorEl.textContent = String(msg); errorEl.classList.remove('hidden');
  }
  function clearError() { setError(''); }

  // --- Canvas events ---
  function handleSV(e) {
    const r = svCanvas.getBoundingClientRect();
    sat = Math.max(0, Math.min(1, ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width));
    val = Math.max(0, Math.min(1, 1 - ((e.touches ? e.touches[0].clientY : e.clientY) - r.top) / r.height));
    redraw(); commitColor();
  }
  let svDrag = false;
  svCanvas.addEventListener('pointerdown', (e) => { svDrag = true; svCanvas.setPointerCapture(e.pointerId); handleSV(e); });
  svCanvas.addEventListener('pointermove', (e) => { if (svDrag) handleSV(e); });
  svCanvas.addEventListener('pointerup', (e) => { svDrag = false; svCanvas.releasePointerCapture(e.pointerId); });

  function handleHue(e) {
    const r = hueCanvas.getBoundingClientRect();
    hue = Math.max(0, Math.min(359.99, (((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width) * 360));
    redraw(); commitColor();
  }
  let hueDrag = false;
  hueCanvas.addEventListener('pointerdown', (e) => { hueDrag = true; hueCanvas.setPointerCapture(e.pointerId); handleHue(e); });
  hueCanvas.addEventListener('pointermove', (e) => { if (hueDrag) handleHue(e); });
  hueCanvas.addEventListener('pointerup', (e) => { hueDrag = false; hueCanvas.releasePointerCapture(e.pointerId); });

  for (const { btn, hex } of swatchButtons) {
    btn.addEventListener('click', () => { clearError(); syncAll(hex); });
  }

  // --- Responsive resize ---
  const ro = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const w = Math.round(entry.contentRect.width);
      if (w > 0 && w !== svCanvas.width) { svCanvas.width = w; hueCanvas.width = w; redraw(); }
    }
  });
  ro.observe(pickerWrap);

  if (pickerOpen) redraw();
  updateFormData(fieldKey, selected);

  return {
    wrap,
    getValue: () => selected,
    setValue: (v) => { if (v && HEX_RE.test(v)) syncAll(v); },
    setError,
    clearError,
  };
}

export function createSelectField({
  label,
  id,
  required = false,
  help,
  options = [],
  defaultValue,
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'select';
  if (id) wrap.setAttribute('data-id', id);

  const header = document.createElement('div');
  header.className = 'mb-2';
  const headerRow = document.createElement('div');
  headerRow.className = 'flex items-center';
  const labelEl = createFieldLabel(label, { required });
  labelEl.className = 'block text-[13px] font-medium mx-2';
  headerRow.appendChild(labelEl);
  const { trigger } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger) {
    wrap.setAttribute('data-help-scope', '');
    headerRow.appendChild(trigger);
  }
  header.appendChild(headerRow);
  wrap.appendChild(header);

  const select = document.createElement('select');
  const selectId = `select-${Math.random().toString(16).slice(2)}`;
  select.id = selectId;
  select.className = 'sr-only';
  if (label) select.setAttribute('aria-label', String(label));
  if (required) select.required = true;

  const normalizedOptions = (Array.isArray(options) ? options : []).map(opt => ({
    value: String(opt?.value ?? ''),
    label: String(opt?.label ?? opt?.value ?? ''),
  }));

  for (const opt of normalizedOptions) {
    const optionEl = document.createElement('option');
    optionEl.value = opt.value;
    optionEl.textContent = opt.label;
    select.appendChild(optionEl);
  }

  const desiredDefault = defaultValue != null ? String(defaultValue) : null;
  if (desiredDefault != null && normalizedOptions.some((opt) => opt.value === desiredDefault)) {
    select.value = desiredDefault;
  } else if (normalizedOptions.length > 0) {
    select.value = normalizedOptions[0].value;
  }

  const dropdownBtn = document.createElement('button');
  dropdownBtn.type = 'button';
  dropdownBtn.className =
    'w-full flex items-center justify-between rounded-xl bg-[#EAEFF6] dark:bg-[#1C1E20] ' +
    'border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] ' +
    'px-2.5 py-3 cursor-pointer hover:bg-[#dde4ed] dark:hover:bg-[#252729] transition-colors ' +
    'focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20';

  const btnContent = document.createElement('div');
  btnContent.className = 'text-left min-w-0 flex-1';

  const btnValue = document.createElement('div');
  btnValue.className = 'text-[13px] font-semibold text-gray-900 dark:text-white truncate';
  const selectedOpt = normalizedOptions.find(o => o.value === select.value);
  btnValue.textContent = selectedOpt?.label || 'Select...';

  btnContent.appendChild(btnValue);

  const chevron = document.createElement('div');
  chevron.className = 'text-gray-500 dark:text-gray-400 shrink-0 ml-2';
  chevron.innerHTML = `
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
    </svg>
  `;

  dropdownBtn.appendChild(btnContent);
  dropdownBtn.appendChild(chevron);

  const dropdownMenu = document.createElement('div');
  dropdownMenu.className =
    'hidden fixed z-[9999] rounded-2xl bg-[#EAEFF6] dark:bg-[#1C1E20] ' +
    'border border-[#D9D9D9]/20 dark:border-[#333] shadow-2xl overflow-y-auto max-h-[280px]';

  function positionDropdown() {
    const btnRect = dropdownBtn.getBoundingClientRect();
    const spaceBelow = window.innerHeight - btnRect.bottom;
    const spaceAbove = btnRect.top;
    const menuHeight = Math.min(280, normalizedOptions.length * 48);

    // Set width to match button
    const minWidth = 200;
    const dropdownWidth = Math.max(minWidth, btnRect.width);
    dropdownMenu.style.width = `${dropdownWidth}px`;
    let leftPos = btnRect.left;
    leftPos = Math.min(leftPos, window.innerWidth - dropdownWidth - 8);
    leftPos = Math.max(8, leftPos);
    dropdownMenu.style.left = `${leftPos}px`;

    if (spaceBelow < menuHeight && spaceAbove > spaceBelow) {
      // Open upward
      dropdownMenu.style.bottom = `${window.innerHeight - btnRect.top + 4}px`;
      dropdownMenu.style.top = 'auto';
    } else {
      // Open downward
      dropdownMenu.style.top = `${btnRect.bottom + 4}px`;
      dropdownMenu.style.bottom = 'auto';
    }
  }

  normalizedOptions.forEach((opt) => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className =
      'w-full flex items-center justify-between px-4 py-3 text-left text-[13px] ' +
      'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#252525] transition-colors';
    item.dataset.value = opt.value;

    const itemLabel = document.createElement('span');
    itemLabel.textContent = opt.label;

    const itemCheck = document.createElement('span');
    itemCheck.className = opt.value === select.value ? 'text-primary/90' : 'invisible';
    itemCheck.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;

    item.appendChild(itemLabel);
    item.appendChild(itemCheck);
    dropdownMenu.appendChild(item);

    item.addEventListener('click', () => {
      select.value = opt.value;
      btnValue.textContent = opt.label;
      dropdownMenu.classList.add('hidden');
      dropdownMenu.querySelectorAll('button').forEach(btn => {
        const check = btn.querySelector('span:last-child');
        if (check) check.className = btn.dataset.value === opt.value ? 'text-primary/90' : 'invisible';
      });
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  dropdownBtn.addEventListener('click', () => {
    const wasHidden = dropdownMenu.classList.contains('hidden');
    if (wasHidden) {
      positionDropdown();
    }
    dropdownMenu.classList.toggle('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target) && !dropdownMenu.contains(e.target)) {
      dropdownMenu.classList.add('hidden');
    }
  });

  window.addEventListener('scroll', () => {
    if (!dropdownMenu.classList.contains('hidden')) positionDropdown();
  }, true);

  const row = document.createElement('div');
  row.className = 'relative';
  row.appendChild(select);
  row.appendChild(dropdownBtn);
  document.body.appendChild(dropdownMenu);
  wrap.appendChild(row);

  // Sync to global form data (keep empty strings as-is, don't convert to undefined)
  const syncToGlobal = () => updateFormData(fieldKey, select.value);
  select.addEventListener('change', syncToGlobal);
  syncToGlobal(); // Initial sync

  const errorEl = document.createElement('p');
  errorEl.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  errorEl.setAttribute('role', 'alert');
  wrap.appendChild(errorEl);

  function setError(message) {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      dropdownBtn.style.outline = '';
      return;
    }
    errorEl.textContent = String(message);
    errorEl.classList.remove('hidden');
    dropdownBtn.style.outline = '1.5px solid #f87171';
  }

  function clearError() {
    setError('');
  }

  select.addEventListener('change', clearError);

  return {
    wrap,
    select,
    getValue: () => select.value,
    setValue: (v) => {
      const oldValue = select.value;
      const nextValue = v == null ? '' : String(v);
      select.value = nextValue;
      if (oldValue !== select.value) {
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      syncToGlobal();
    },
    setError,
    clearError,
  };
}

export function createCheckboxField({
  label,
  id,
  help,
  defaultChecked = false,
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'checkbox';
  if (id) wrap.setAttribute('data-id', id);
  const row = document.createElement('label');
  row.className =
    'flex items-center justify-between gap-4 select-none cursor-pointer ' +
    'rounded-2xl bg-[#EAEFF6] dark:bg-[#1C1E20] ' +
    'hover:bg-[#dde4ed] dark:hover:bg-[#252729] transition-colors px-4 py-3 ' +
    'focus-within:ring-2 focus-within:ring-primary/90/30';

  const textWrap = document.createElement('div');
  textWrap.className = 'min-w-0 flex-1';
  const titleRow = document.createElement('div');
  titleRow.className = 'flex items-center gap-1';
  const title = document.createElement('div');
  title.className = 'agent-form-value text-sm leading-snug';
  title.textContent = String(label || '');
  titleRow.appendChild(title);
  const { trigger } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger) {
    wrap.setAttribute('data-help-scope', '');
    titleRow.appendChild(trigger);
  }
  textWrap.appendChild(titleRow);

  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'shrink-0 relative';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'sr-only';
  checkbox.checked = Boolean(defaultChecked);
  checkbox.setAttribute('role', 'switch');
  checkbox.setAttribute('aria-checked', checkbox.checked ? 'true' : 'false');

  const track = document.createElement('div');
  track.className =
    'w-9 h-5 rounded-full transition-colors cursor-pointer ' +
    'bg-neutral-300 dark:bg-neutral-700';

  const knob = document.createElement('div');
  knob.className =
    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md transition-transform';

  function syncVisual() {
    checkbox.setAttribute('aria-checked', checkbox.checked ? 'true' : 'false');
    track.classList.toggle('bg-primary/90', checkbox.checked);
    track.classList.toggle('bg-neutral-300', !checkbox.checked);
    track.classList.toggle('dark:bg-neutral-700', !checkbox.checked);
    knob.style.transform = checkbox.checked ? 'translateX(16px)' : 'translateX(0px)';
  }

  checkbox.addEventListener('change', syncVisual);
  syncVisual();

  function handleToggleClick(e) {
    e.preventDefault();
    e.stopPropagation();
    checkbox.checked = !checkbox.checked;
    syncVisual();
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  }
  track.addEventListener('click', handleToggleClick);
  knob.addEventListener('click', handleToggleClick);

  toggleWrap.appendChild(checkbox);
  toggleWrap.appendChild(track);
  toggleWrap.appendChild(knob);

  row.appendChild(textWrap);
  row.appendChild(toggleWrap);
  wrap.appendChild(row);

  // Sync to global form data
  const syncToGlobal = () => updateFormData(fieldKey, Boolean(checkbox.checked));
  checkbox.addEventListener('change', syncToGlobal);
  syncToGlobal(); // Initial sync

  const errorEl = document.createElement('p');
  errorEl.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  errorEl.setAttribute('role', 'alert');
  wrap.appendChild(errorEl);

  function setError(message) {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      row.style.outline = '';
      return;
    }
    errorEl.textContent = String(message);
    errorEl.classList.remove('hidden');
    row.style.outline = '1.5px solid #f87171';
    row.style.borderRadius = '12px';
  }

  function clearError() {
    setError('');
  }

  checkbox.addEventListener('change', clearError);

  return {
    wrap,
    checkbox,
    getValue: () => Boolean(checkbox.checked),
    setValue: (v) => {
      checkbox.checked = Boolean(v);
      syncVisual();
      syncToGlobal();
      checkbox.dispatchEvent(new Event('input', { bubbles: true }));
      checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    },
    setError,
    clearError,
  };
}

export function createMediaField({
  label,
  id,
  required = false,
  kind = 'image', // 'image' | 'video' | 'audio' | 'imageOrVideo' | 'audioOrVideo'
  help,
  defaultValue,
  recording,
  dropzoneTitle,
  multiple = false,
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'media';
  if (id) wrap.setAttribute('data-id', id);

  const hintId = `hint-${Math.random().toString(16).slice(2)}`;
  const errorId = `error-${Math.random().toString(16).slice(2)}`;
  const statusId = `status-${Math.random().toString(16).slice(2)}`;
  const fileInputId = `file-${Math.random().toString(16).slice(2)}`;

  const header = document.createElement('div');
  header.className = 'mb-3 media-field-header';
  const headerRow = document.createElement('div');
  headerRow.className = 'flex items-center';
  const titleText = String(label || 'Upload');
  const labelEl = createFieldLabel(titleText, { required });
  labelEl.className = 'agent-form-upload-title block mb-2 mt-2 mx-2';
  headerRow.appendChild(labelEl);
  const { trigger } = createHelpToggle({ idSeed: titleText, labelText: titleText, helpText: help });
  if (trigger) {
    wrap.setAttribute('data-help-scope', '');
    headerRow.appendChild(trigger);
  }
  header.appendChild(headerRow);
  wrap.appendChild(header);

  const isVideo = kind === 'video' || kind === 'imageOrVideo' || kind === 'audioOrVideo';
  const isAudio = kind === 'audio' || kind === 'audioOrVideo';

  let emptyIcon, emptyTitle, emptySubtitle;
  if (isVideo && !isAudio) {
    emptyIcon = `<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z"/>
    </svg>`;
    emptyTitle = 'Upload Video';
    emptySubtitle = 'Video duration: 3-30 seconds';
  } else if (isAudio) {
    emptyIcon = `<svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"/>
    </svg>`;
    emptyTitle = 'Upload Audio';
    emptySubtitle = 'MP3, WAV, OGG up to 20MB';
  } else {
    emptyIcon =
      '<span class="dark:hidden inline-block w-8 h-8">' + IMAGE_UPLOAD_ICON_LIGHT + '</span>' +
      '<span class="hidden dark:inline-block w-8 h-8">' + IMAGE_UPLOAD_ICON_DARK + '</span>';
    emptyTitle = dropzoneTitle || 'Upload Image';
    emptySubtitle = 'PNG, JPG, WEBP up to 10MB';
  }

  const card = document.createElement('div');
  card.className = 'rounded-2xl overflow-hidden';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = acceptForKind(kind);
  if (multiple) fileInput.multiple = true;
  fileInput.className = 'hidden';
  fileInput.id = fileInputId;

  const dropzone = document.createElement('button');
  dropzone.type = 'button';
  dropzone.className =
    'dropzone-empty relative w-full h-[115px] rounded-[16px] border border-dashed border-white dark:border-[#3a3a3a] ' +
    'bg-[#EAEFF6] dark:bg-[#1C1E20] ' +
    'hover:border-[#ddd] dark:hover:border-[#555] hover:bg-[#dde4ed] dark:hover:bg-[#252729] transition-colors ' +
    'focus:outline-none focus:border-[#ccc] dark:focus:border-[#555] ' +
    'px-4 py-5 flex flex-col items-center justify-center text-center gap-2';
  dropzone.setAttribute('aria-label', `Upload ${String(kind || 'media')} for ${String(label || 'field')}`);
  dropzone.setAttribute('aria-describedby', [hintId, errorId, statusId].filter(Boolean).join(' '));
  dropzone.setAttribute('aria-controls', fileInputId);
  dropzone.setAttribute('aria-roledescription', 'file dropzone');

  const dzInner = document.createElement('div');
  dzInner.className = 'flex flex-col items-center gap-2';

  const dzIcon = document.createElement('div');
  dzIcon.className = 'w-8 h-8 flex items-center justify-center';
  dzIcon.innerHTML = emptyIcon;

  const dzText = document.createElement('div');
  dzText.className = 'min-w-0 space-y-1';
  const dzTitle = document.createElement('div');
  dzTitle.className = 'agent-form-upload-title';
  dzTitle.textContent = emptyTitle;
  const dzSubtitle = document.createElement('div');
  dzSubtitle.className = 'agent-form-hint';
  dzSubtitle.textContent = emptySubtitle;
  dzText.appendChild(dzTitle);
  dzText.appendChild(dzSubtitle);

  dzInner.appendChild(dzIcon);
  dzInner.appendChild(dzText);
  dropzone.appendChild(dzInner);

  const urlInput = document.createElement('input');
  urlInput.type = 'url';
  urlInput.placeholder = 'Paste URL';
  urlInput.className =
    'mt-1.5 block w-full h-11 text-[13px] bg-[#EAEFF6] dark:bg-[#1C1E20] ' +
    'border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] rounded-2xl px-5 ' +
    'text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-500 ' +
    'focus:outline-none focus:border-[#D9D9D9]/40 dark:focus:border-[#D9D9D9]/20 transition-colors hidden';
  urlInput.setAttribute('data-media-url', '');

  const hint = document.createElement('p');
  hint.id = hintId;
  hint.className = 'mt-2 px-1 text-xs text-gray-500 dark:text-gray-400 hidden';

  const errorEl = document.createElement('p');
  errorEl.id = errorId;
  errorEl.className = 'mt-1 px-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  errorEl.setAttribute('role', 'alert');
  errorEl.setAttribute('aria-live', 'polite');

  const busyEl = document.createElement('div');
  busyEl.className = 'mt-3 hidden items-center justify-center gap-2 text-xs text-gray-600 dark:text-gray-300';
  busyEl.innerHTML = `
    <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
    </svg>
    <span>Uploading…</span>
  `;

  const live = document.createElement('p');
  live.id = statusId;
  live.className = 'sr-only';
  live.setAttribute('aria-live', 'polite');

  const canRecordAudio = kind === 'audio' || kind === 'audioOrVideo';
  const recordingCfg = recording && typeof recording === 'object' ? recording : {};
  const recordingNoteText = String(
    recordingCfg.note ??
    'Tip: Recording uses your microphone. For best results, use a quiet environment. Mobile recording is best-effort in v1.'
  ).trim();
  const recordingAudioConstraints = recordingCfg.audioConstraints ?? { echoCancellation: true, noiseSuppression: true };
  const recordingMediaRecorderOptions = recordingCfg.mediaRecorderOptions ?? {};
  const recordingTimeSliceMs = Number.isFinite(recordingCfg.timeSliceMs)
    ? Math.max(0, Number(recordingCfg.timeSliceMs))
    : 500;

  const recordDetails = document.createElement('details');
  recordDetails.className = 'mt-2 rounded-[16px] border border-white dark:border-[#3a3a3a]';
  const recordSummary = document.createElement('summary');
  recordSummary.className = 'cursor-pointer select-none text-xs font-semibold text-gray-700 dark:text-gray-200 px-4 py-3';
  recordSummary.textContent = 'Record';
  recordDetails.appendChild(recordSummary);

  const recordPanel = document.createElement('div');
  recordPanel.className = 'px-4 pb-3';

  const recordRow = document.createElement('div');
  recordRow.className = 'flex items-center gap-2 flex-nowrap';

  const recordBtn = document.createElement('button');
  recordBtn.type = 'button';
  recordBtn.className = 'px-3 py-2 rounded-full bg-primary/90 hover:bg-primary/90/90 text-white text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  recordBtn.textContent = 'Record';

  const stopBtn = document.createElement('button');
  stopBtn.type = 'button';
  stopBtn.className = 'px-3 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  stopBtn.textContent = 'Stop';
  stopBtn.disabled = true;

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'px-3 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors disabled:opacity-60 disabled:cursor-not-allowed';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.disabled = true;

  const timerEl = document.createElement('span');
  timerEl.className = 'ml-auto text-xs text-gray-600 dark:text-gray-300 tabular-nums';
  timerEl.textContent = '00:00';

  recordRow.appendChild(recordBtn);
  recordRow.appendChild(stopBtn);
  recordRow.appendChild(cancelBtn);
  recordRow.appendChild(timerEl);

  const recordNote = document.createElement('p');
  recordNote.className = 'mt-2 text-[11px] text-gray-500 dark:text-gray-400 leading-snug';
  recordNote.textContent = recordingNoteText;

  const recordError = document.createElement('p');
  recordError.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  recordError.setAttribute('role', 'alert');
  recordError.setAttribute('aria-live', 'polite');

  recordPanel.appendChild(recordRow);
  recordPanel.appendChild(recordNote);
  recordPanel.appendChild(recordError);
  recordDetails.appendChild(recordPanel);

  const previewWrap = document.createElement('div');
  previewWrap.className =
    'hidden w-full h-[115px] rounded-[16px] border border-dashed border-white dark:border-[#3a3a3a] ' +
    'bg-[#EAEFF6] dark:bg-[#1C1E20] flex items-center justify-center px-4 py-5';

  const previewContainer = document.createElement('div');
  previewContainer.className = 'relative inline-block';

  const img = document.createElement('img');
  img.alt = 'Preview';
  img.className = 'hidden w-[180px] h-[100px] rounded-2xl object-cover bg-neutral-200 dark:bg-neutral-800';

  const video = document.createElement('video');
  video.controls = false;
  video.muted = true;
  video.loop = true;
  video.autoplay = true;
  video.playsInline = true;
  video.className = 'hidden w-[180px] h-[100px] rounded-2xl object-cover bg-neutral-200 dark:bg-neutral-800';

  const audio = document.createElement('audio');
  audio.controls = true;
  audio.className = 'hidden flex-1 min-w-0';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className =
    'absolute top-2 right-2 w-7 h-7 rounded-full bg-neutral-800/70 hover:bg-neutral-800/90 ' +
    'backdrop-blur flex items-center justify-center transition-colors z-10';
  removeBtn.innerHTML = `<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
  removeBtn.setAttribute('aria-label', 'Remove file');

  const typeLabel = document.createElement('div');
  typeLabel.className =
    'absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full ' +
    'bg-neutral-800/70 text-xs font-medium text-white backdrop-blur';
  typeLabel.textContent = isVideo ? 'Video' : isAudio ? 'Audio' : 'Image';

  previewContainer.appendChild(img);
  previewContainer.appendChild(video);
  previewContainer.appendChild(audio);
  previewContainer.appendChild(removeBtn);
  previewContainer.appendChild(typeLabel);
  previewWrap.appendChild(previewContainer);

  const changeBtn = document.createElement('button');
  changeBtn.type = 'button';
  changeBtn.className = 'hidden';

  card.appendChild(fileInput);
  card.appendChild(dropzone);
  card.appendChild(previewWrap);
  card.appendChild(urlInput);
  if (canRecordAudio) {
    card.appendChild(recordDetails);
  }

  card.appendChild(hint);
  card.appendChild(busyEl);
  card.appendChild(live);
  wrap.appendChild(card);
  wrap.appendChild(errorEl);

  let objectUrl = null;
  let stagedFile = null;
  let stagedFiles = [];   // for multiple mode
  let inFlight = null;

  let recordStream = null;
  let recordRecorder = null;
  let recordChunks = [];
  let recordTimer = null;
  let recordStart = 0;

  function isProbablyVideoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const s = url.trim().toLowerCase();
    if (s.startsWith('data:video/')) return true;
    return /\.(mp4|mov|webm|m4v)(\?|#|$)/.test(s) || s.includes('/video/');
  }

  function isProbablyAudioUrl(url) {
    if (!url || typeof url !== 'string') return false;
    const s = url.trim().toLowerCase();
    if (s.startsWith('data:audio/')) return true;
    return /\.(mp3|wav|ogg|m4a|aac)(\?|#|$)/.test(s) || s.includes('/audio/');
  }

  function inferPreviewKind({ url, file }) {
    if (file?.type?.startsWith?.('video/')) return 'video';
    if (file?.type?.startsWith?.('audio/')) return 'audio';
    if (file?.type?.startsWith?.('image/')) return 'image';
    if (typeof url === 'string') {
      if (isProbablyVideoUrl(url)) return 'video';
      if (isProbablyAudioUrl(url)) return 'audio';
      return 'image';
    }
    return 'image';
  }

  function setError(message) {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      dropzone.removeAttribute('aria-invalid');
      dropzone.style.borderColor = '';
      dropzone.style.borderStyle = '';
      return;
    }
    errorEl.textContent = String(message);
    errorEl.classList.remove('hidden');
    dropzone.setAttribute('aria-invalid', 'true');
    dropzone.style.borderColor = '#f87171';
    dropzone.style.borderStyle = 'solid';
  }

  function setRecordError(message) {
    if (!recordError) return;
    if (!message) {
      recordError.textContent = '';
      recordError.classList.add('hidden');
      return;
    }
    recordError.textContent = String(message);
    recordError.classList.remove('hidden');
  }

  function formatMmSs(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const mins = Math.floor(total / 60).toString().padStart(2, '0');
    const secs = (total % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }

  function updateTimer() {
    timerEl.textContent = formatMmSs(Date.now() - recordStart);
  }

  function stopRecordTimer() {
    if (recordTimer) {
      clearInterval(recordTimer);
      recordTimer = null;
    }
  }

  function cleanupRecordStream() {
    if (recordStream) {
      try {
        recordStream.getTracks().forEach((t) => t.stop());
      } catch { /* ignore */ }
      recordStream = null;
    }
  }

  function resetRecordUi() {
    stopRecordTimer();
    recordStart = 0;
    timerEl.textContent = '00:00';
    recordBtn.disabled = false;
    stopBtn.disabled = true;
    cancelBtn.disabled = true;
    recordBtn.textContent = 'Record';
  }

  function isRecordingSupported() {
    return Boolean(
      canRecordAudio &&
      typeof navigator !== 'undefined' &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof MediaRecorder !== 'undefined' &&
      typeof File !== 'undefined'
    );
  }

  function pickRecordingMimeType() {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg;codecs=opus',
      'audio/ogg',
    ];
    try {
      if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
        for (const c of candidates) {
          if (MediaRecorder.isTypeSupported(c)) return c;
        }
      }
    } catch { /* ignore */ }
    return '';
  }

  function extensionForMimeType(mimeType) {
    const mt = String(mimeType || '').toLowerCase();
    if (mt.includes('webm')) return 'webm';
    if (mt.includes('ogg')) return 'ogg';
    if (mt.includes('mp4') || mt.includes('m4a')) return 'm4a';
    if (mt.includes('mpeg') || mt.includes('mp3')) return 'mp3';
    if (mt.includes('wav')) return 'wav';
    return 'webm';
  }

  async function startRecording() {
    if (!isRecordingSupported()) {
      setRecordError('Recording is not supported in this browser.');
      return;
    }
    if (recordRecorder) return;

    setRecordError('');
    try {
      const tryGetUserMedia = async (audio) => await navigator.mediaDevices.getUserMedia({ audio });
      try {
        recordStream = await tryGetUserMedia(recordingAudioConstraints);
      } catch (err) {
        const name = err && typeof err === 'object' ? err.name : '';
        if (name === 'OverconstrainedError') {
          // Best-effort fallback when the requested constraints can't be satisfied.
          recordStream = await tryGetUserMedia(true);
        } else {
          throw err;
        }
      }
      const mimeType = pickRecordingMimeType();
      recordChunks = [];
      const baseOptions =
        recordingMediaRecorderOptions && typeof recordingMediaRecorderOptions === 'object'
          ? recordingMediaRecorderOptions
          : {};

      const tryCreateRecorder = (opts) => {
        if (!opts) return new MediaRecorder(recordStream);
        return new MediaRecorder(recordStream, opts);
      };

      const hasBaseOptions = Object.keys(baseOptions).length > 0;
      const candidates = [];
      if (mimeType && hasBaseOptions) candidates.push({ ...baseOptions, mimeType });
      if (mimeType) candidates.push({ mimeType });
      if (hasBaseOptions) candidates.push(baseOptions);
      candidates.push(null);

      let lastCreateErr = null;
      for (const opts of candidates) {
        try {
          recordRecorder = tryCreateRecorder(opts);
          lastCreateErr = null;
          break;
        } catch (e) {
          lastCreateErr = e;
          recordRecorder = null;
        }
      }
      if (!recordRecorder) throw lastCreateErr || new Error('Failed to initialize MediaRecorder.');

      recordRecorder.ondataavailable = (e) => {
        if (e?.data && e.data.size > 0) recordChunks.push(e.data);
      };

      recordRecorder.onerror = (e) => {
        const msg = e?.error?.message || 'Recording failed.';
        setRecordError(msg);
      };

      recordRecorder.onstop = () => {
        try {
          const blobType = recordRecorder?.mimeType || mimeType || 'audio/webm';
          const blob = new Blob(recordChunks, { type: blobType });
          if (!blob.size) {
            setRecordError('No audio was captured. Try recording for a few seconds and ensure your microphone is working.');
            live.textContent = 'Recording captured no data.';
            return;
          }
          const ext = extensionForMimeType(blob.type || blobType);
          const filename = `recording-${Date.now()}.${ext}`;
          const file = new File([blob], filename, { type: blob.type || blobType });
          setFromFile(file);
          live.textContent = 'Recording captured.';
        } finally {
          recordChunks = [];
          recordRecorder = null;
          cleanupRecordStream();
          resetRecordUi();
        }
      };

      if (recordingTimeSliceMs > 0) recordRecorder.start(recordingTimeSliceMs);
      else recordRecorder.start();

      recordStart = Date.now();
      timerEl.textContent = '00:00';
      recordTimer = setInterval(updateTimer, 250);
      recordBtn.disabled = true;
      stopBtn.disabled = false;
      cancelBtn.disabled = false;
      recordBtn.textContent = 'Recording…';
      live.textContent = 'Recording started.';
    } catch (err) {
      const name = err && typeof err === 'object' ? err.name : '';
      if (name === 'NotAllowedError') setRecordError('Microphone access denied. Please allow microphone access to record.');
      else if (name === 'NotFoundError') setRecordError('No microphone found.');
      else setRecordError(err instanceof Error ? err.message : String(err || 'Failed to start recording.'));
      cleanupRecordStream();
      recordRecorder = null;
      resetRecordUi();
    }
  }

  function stopRecording() {
    if (!recordRecorder) return;
    try {
      stopBtn.disabled = true;
      cancelBtn.disabled = true;
      recordRecorder.stop();
      live.textContent = 'Stopping recording…';
    } catch (err) {
      setRecordError(err instanceof Error ? err.message : String(err || 'Failed to stop recording.'));
      recordRecorder = null;
      cleanupRecordStream();
      resetRecordUi();
    }
  }

  function cancelRecording() {
    if (!recordRecorder) {
      resetRecordUi();
      cleanupRecordStream();
      return;
    }
    try {
      recordChunks = [];
      recordRecorder.onstop = null;
      recordRecorder.stop();
    } catch { /* ignore */ }
    recordRecorder = null;
    cleanupRecordStream();
    resetRecordUi();
    live.textContent = 'Recording cancelled.';
  }

  function revokeObjectUrl() {
    if (objectUrl) {
      try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
      objectUrl = null;
    }
  }

  function clearPreview() {
    img.src = '';
    video.src = '';
    audio.src = '';
    img.classList.add('hidden');
    video.classList.add('hidden');
    audio.classList.add('hidden');
    previewWrap.classList.add('hidden');
    dropzone.classList.remove('hidden');
    // Reset audio-specific inline styles
    previewContainer.style.display = '';
    previewContainer.style.alignItems = '';
    previewContainer.style.gap = '';
    previewContainer.style.width = '';
    removeBtn.style.position = '';
    removeBtn.style.flexShrink = '';
    typeLabel.style.position = '';
    typeLabel.style.transform = '';
    typeLabel.style.flexShrink = '';
  }

  function setPreview(src, { file } = {}) {
    if (!src) {
      clearPreview();
      return;
    }

    const kindToShow = kind === 'imageOrVideo' || kind === 'audioOrVideo'
      ? inferPreviewKind({ url: src, file })
      : kind;

    // Hide dropzone, show preview
    dropzone.classList.add('hidden');
    previewWrap.classList.remove('hidden');
    img.classList.add('hidden');
    video.classList.add('hidden');
    audio.classList.add('hidden');

    // Reset audio-specific layout adjustments
    previewContainer.style.width = '';
    removeBtn.style.position = '';
    removeBtn.style.top = '';
    removeBtn.style.right = '';
    removeBtn.style.marginLeft = '';
    removeBtn.style.flexShrink = '';
    typeLabel.style.position = '';
    typeLabel.style.bottom = '';
    typeLabel.style.left = '';
    typeLabel.style.transform = '';
    typeLabel.style.marginLeft = '';
    typeLabel.style.flexShrink = '';
    previewContainer.style.display = '';
    previewContainer.style.alignItems = '';
    previewContainer.style.gap = '';

    // Update type label
    if (kindToShow === 'video') {
      typeLabel.textContent = 'Video';
      video.classList.remove('hidden');
      video.src = src;
      return;
    }
    if (kindToShow === 'audio') {
      typeLabel.textContent = 'Audio';
      audio.classList.remove('hidden');
      audio.src = src;
      // Audio is a thin bar
      previewContainer.style.display = 'flex';
      previewContainer.style.alignItems = 'center';
      previewContainer.style.gap = '8px';
      previewContainer.style.width = '100%';
      removeBtn.style.position = 'static';
      removeBtn.style.flexShrink = '0';
      typeLabel.style.position = 'static';
      typeLabel.style.transform = 'none';
      typeLabel.style.flexShrink = '0';
      return;
    }
    typeLabel.textContent = 'Image';
    img.classList.remove('hidden');
    img.src = src;
  }

  function setBusy(isBusy) {
    dropzone.disabled = Boolean(isBusy);
    urlInput.disabled = Boolean(isBusy);
    changeBtn.disabled = Boolean(isBusy);
    removeBtn.disabled = Boolean(isBusy);
    if (canRecordAudio) {
      recordBtn.disabled = Boolean(isBusy) || Boolean(recordRecorder);
      stopBtn.disabled = Boolean(isBusy) || !recordRecorder;
      cancelBtn.disabled = Boolean(isBusy) || !recordRecorder;
    }
    dropzone.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  }

  function setFromFile(file) {
    if (!file) return;
    if (recordRecorder && recordRecorder.state === 'recording') cancelRecording();
    stagedFile = file;
    urlInput.value = '';
    fileInput.value = '';
    revokeObjectUrl();
    objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl, { file });
  }

  function setFromUrl(url) {
    const next = String(url || '').trim();
    urlInput.value = next;
    stagedFile = null;
    stagedFiles = [];
    fileInput.value = '';
    if (recordRecorder && recordRecorder.state === 'recording') cancelRecording();
    revokeObjectUrl();
    setPreview(next);
  }

  function canInteract() {
    return !(fileInput.disabled || urlInput.readOnly || urlInput.disabled || dropzone.disabled);
  }

  function openFilePicker() {
    if (!canInteract()) return;
    fileInput.click();
  }

  function normalizeDroppedText(text) {
    const t = String(text || '').trim();
    if (!t) return '';
    if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('data:') || t.startsWith('blob:') || t.startsWith('/')) return t;
    return '';
  }

  function maybeUpdateHint() {
    const kindForHint = kind || 'image';
    const maxUpload = maxBytesForKind(kindForHint);
    const maxInline = maxInlineBytesForKind(kindForHint);
    hint.textContent = `Max upload: ${formatBytes(maxUpload)}. Files over ${formatBytes(maxInline)} are uploaded automatically.`;
  }

  maybeUpdateHint();

  if (canRecordAudio) {
    if (!isRecordingSupported()) {
      recordBtn.disabled = true;
      recordSummary.textContent = 'Record (unsupported)';
      setRecordError('Recording is not supported in this browser. You can still upload an audio/video file or paste a URL.');
    } else {
      recordBtn.disabled = false;
    }

    recordBtn.addEventListener('click', startRecording);
    stopBtn.addEventListener('click', stopRecording);
    cancelBtn.addEventListener('click', cancelRecording);
  }

  dropzone.addEventListener('click', openFilePicker);
  dropzone.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openFilePicker();
  });

  dropzone.addEventListener('dragenter', (e) => {
    if (!canInteract()) return;
    e.preventDefault();
    dropzone.classList.add('border-primary/90/40', 'bg-primary/90/5');
  });
  dropzone.addEventListener('dragover', (e) => {
    if (!canInteract()) return;
    e.preventDefault();
  });
  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-primary/90/40', 'bg-primary/90/5');
  });
  dropzone.addEventListener('drop', (e) => {
    if (!canInteract()) return;
    e.preventDefault();
    dropzone.classList.remove('border-primary/90/40', 'bg-primary/90/5');
    const dt = e.dataTransfer;
    const droppedFile = dt?.files && dt.files.length > 0 ? dt.files[0] : null;
    if (droppedFile) {
      setError('');
      setFromFile(droppedFile);
      return;
    }
    const text = normalizeDroppedText(dt?.getData?.('text/plain') || '');
    if (text) {
      setError('');
      setFromUrl(text);
    }
  });

  dropzone.addEventListener('paste', (e) => {
    if (!canInteract()) return;
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          setError('');
          setFromFile(file);
          return;
        }
      }
    }
    const text = normalizeDroppedText(e.clipboardData?.getData?.('text/plain') || '');
    if (text) {
      e.preventDefault();
      setError('');
      setFromUrl(text);
    }
  });

  fileInput.addEventListener('change', () => {
    if (!fileInput.files || fileInput.files.length === 0) return;
    setError('');
    if (multiple) {
      stagedFiles = Array.from(fileInput.files);
      stagedFile = stagedFiles[0];
      urlInput.value = '';
      revokeObjectUrl();
      objectUrl = URL.createObjectURL(stagedFiles[0]);
      setPreview(objectUrl, { file: stagedFiles[0] });
      live.textContent = stagedFiles.length > 1
        ? `${stagedFiles.length} files selected` : '';
    } else {
      stagedFiles = [];
      setFromFile(fileInput.files[0]);
    }
  });

  urlInput.addEventListener('input', () => {
    const url = urlInput.value.trim();
    setError('');
    if (url.length > 0) {
      stagedFile = null;
      stagedFiles = [];
      fileInput.value = '';
      revokeObjectUrl();
      setPreview(url);
    } else {
      clearPreview();
    }
  });

  changeBtn.addEventListener('click', openFilePicker);

  img.addEventListener('click', openFilePicker);
  video.addEventListener('click', openFilePicker);
  img.style.cursor = 'pointer';
  video.style.cursor = 'pointer';

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setError('');
    stagedFile = null;
    stagedFiles = [];
    fileInput.value = '';
    urlInput.value = '';
    if (recordRecorder && recordRecorder.state === 'recording') cancelRecording();
    revokeObjectUrl();
    clearPreview();
  });

  if (typeof defaultValue === 'string' && defaultValue.trim()) {
    setFromUrl(defaultValue);
  }

  // Sync to global form data (reads file as base64 data URL for recall/persistence)
  const syncToGlobal = () => {
    const url = urlInput.value.trim();

    if (multiple) {
      if (url) {
        updateFormData(fieldKey, [url]);
      } else if (stagedFiles.length > 0) {
        Promise.all(stagedFiles.map(f => fileToBase64DataUrl(f)))
          .then(dataUrls => updateFormData(fieldKey, dataUrls))
          .catch(() => { updateFormData(fieldKey, undefined); });
      } else {
        const singleFile = stagedFile || (fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null);
        if (singleFile) {
          fileToBase64DataUrl(singleFile)
            .then(dataUrl => { updateFormData(fieldKey, [dataUrl]); })
            .catch(() => { updateFormData(fieldKey, undefined); });
        } else {
          updateFormData(fieldKey, undefined);
        }
      }
      return;
    }

    const file = stagedFile || (fileInput.files && fileInput.files.length > 0 ? fileInput.files[0] : null);
    if (url) {
      updateFormData(fieldKey, url);
    } else if (file) {
      // Convert to base64 data URL so the value is restorable
      fileToBase64DataUrl(file)
        .then(dataUrl => { updateFormData(fieldKey, dataUrl); })
        .catch(() => { updateFormData(fieldKey, undefined); });
    } else {
      updateFormData(fieldKey, undefined);
    }
  };
  urlInput.addEventListener('input', syncToGlobal);
  urlInput.addEventListener('change', syncToGlobal);
  fileInput.addEventListener('change', syncToGlobal);
  syncToGlobal(); // Initial sync

  function clearError() {
    setError('');
  }

  // Listen for programmatic remix value injection via custom event
  wrap.addEventListener('remix-set-value', (e) => {
    const url = e.detail?.value;
    if (typeof url === 'string' && url.trim()) {
      setFromUrl(url.trim());
      syncToGlobal();
    }
  });

  return {
    wrap,
    fileInput,
    urlInput,
    setValue: (v) => { setFromUrl(v); syncToGlobal(); },
    setError,
    clearError,
    getValue: async () => {
      // --- Multiple files path ---
      if (multiple) {
        const url = urlInput.value.trim();
        if (url) {
          const normalized = normalizeDroppedText(url);
          if (normalized) return [normalized];
          const msg = 'Invalid URL. Use https://… / data:… / blob:… / or a /uploads path.';
          setError(msg);
          throw new Error(msg);
        }

        const files = stagedFiles.length > 0
          ? stagedFiles
          : (fileInput.files && fileInput.files.length > 0 ? Array.from(fileInput.files) : []);

        if (files.length === 0) {
          if (required) {
            const msg = `Please upload ${label ? label.toLowerCase() : 'file(s)'}`;
            setError(msg);
            throw new Error(msg);
          }
          return undefined;
        }

        for (const f of files) {
          const kindForLimits = f.type?.startsWith?.('video/') ? 'video'
            : f.type?.startsWith?.('audio/') ? 'audio'
              : f.type?.startsWith?.('image/') ? 'image' : kind;
          const maxUploadBytes = maxBytesForKind(kindForLimits);
          if (f.size > maxUploadBytes) {
            const msg = `${f.name} is too large (${formatBytes(f.size)}). Max is ${formatBytes(maxUploadBytes)}.`;
            setError(msg);
            throw new Error(msg);
          }
        }

        setBusy(true);
        setError('');
        try {
          const urls = [];
          for (const f of files) {
            const uploadedUrl = await uploadFileToServer(f, { filename: f.name });
            urls.push(uploadedUrl);
          }
          live.textContent = `${urls.length} file(s) uploaded.`;
          return urls;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err || 'Upload failed');
          setError(msg);
          live.textContent = `Upload failed: ${msg}`;
          throw new Error(msg);
        } finally {
          setBusy(false);
        }
      }

      // --- Single file path ---
      const url = urlInput.value.trim();
      if (url) {
        const normalized = normalizeDroppedText(url);
        if (normalized) return normalized;
        const msg = 'Invalid URL. Use https://… / data:… / blob:… / or a /uploads path.';
        setError(msg);
        throw new Error(msg);
      }

      const file = stagedFile || (fileInput.files && fileInput.files[0] ? fileInput.files[0] : null);
      if (!file) {
        if (required) {
          const msg = `Please upload ${label ? label.toLowerCase() : 'a file'}`;
          setError(msg);
          throw new Error(msg);
        }
        return undefined;
      }

      if (inFlight) return await inFlight;

      const kindForLimits =
        file.type?.startsWith?.('video/') ? 'video'
          : file.type?.startsWith?.('audio/') ? 'audio'
            : file.type?.startsWith?.('image/') ? 'image'
              : kind;

      const maxUploadBytes = maxBytesForKind(kindForLimits);
      if (file.size > maxUploadBytes) {
        const msg = `${label} is too large (${formatBytes(file.size)}). Max upload is ${formatBytes(maxUploadBytes)}.`;
        setError(msg);
        throw new Error(msg);
      }

      setBusy(true);
      setError('');
      inFlight = (async () => {
        try {
          const uploadedUrl = await uploadFileToServer(file, { filename: file.name });
          setFromUrl(uploadedUrl);
          live.textContent = 'Upload complete.';
          return uploadedUrl;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err || 'Upload failed');
          setError(msg);
          live.textContent = `Upload failed: ${msg}`;
          throw new Error(msg);
        }
      })();

      try {
        return await inFlight;
      } finally {
        inFlight = null;
        setBusy(false);
      }
    },
  };
}

export function createChipGroup({
  label,
  id,
  options = [],
  defaultValue,
  required = false,
  help,
  layout = 'row', // 'row' | 'wrap'
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'chipGroup';
  if (id) wrap.setAttribute('data-id', id);

  if (label) {
    const header = document.createElement('div');
    header.className = 'mb-3';
    const row = document.createElement('div');
    row.className = 'flex items-center';
    const labelEl = createFieldLabel(String(label), { required });
    labelEl.className = 'block text-sm font-semibold mx-2';
    row.appendChild(labelEl);
    const { trigger } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
    if (trigger) {
      wrap.setAttribute('data-help-scope', '');
      row.appendChild(trigger);
    }
    header.appendChild(row);
    wrap.appendChild(header);
  }

  const group = document.createElement('div');
  group.className = layout === 'wrap'
    ? 'flex flex-wrap gap-1.5'
    : 'flex flex-wrap gap-1.5 p-1 rounded-2xl bg-neutral-100 dark:bg-neutral-900';
  group.setAttribute('role', 'radiogroup');
  wrap.appendChild(group);

  const normalizedOptions = (Array.isArray(options) ? options : [])
    .map((opt) => {
      if (opt && typeof opt === 'object') {
        return { value: String(opt.value), label: String(opt.label ?? opt.value) };
      }
      return { value: String(opt), label: String(opt) };
    });

  let selected = defaultValue != null ? String(defaultValue) : (normalizedOptions[0]?.value ?? '');
  const buttons = [];

  function apply() {
    for (const { btn, value } of buttons) {
      const active = value === selected;
      btn.setAttribute('aria-checked', active ? 'true' : 'false');
      btn.className =
        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all ' +
        (active
          ? 'bg-primary/90 text-white shadow-md'
          : 'bg-neutral-100 dark:bg-neutral-800 text-gray-700 dark:text-gray-300 hover:bg-neutral-200 dark:hover:bg-neutral-700');
    }
  }

  // Sync to global form data
  const syncToGlobal = () => updateFormData(fieldKey, selected);

  for (const opt of normalizedOptions) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('role', 'radio');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      selected = opt.value;
      apply();
      syncToGlobal();
    });
    group.appendChild(btn);
    buttons.push({ btn, value: opt.value });
  }

  apply();
  syncToGlobal(); // Initial sync

  return {
    wrap,
    getValue: () => selected,
    setValue: (v) => {
      selected = v == null ? '' : String(v);
      apply();
      syncToGlobal();
    },
  };
}

export function createImagePairField({
  label,
  id,
  required = false,
  help,
  defaultValue,
  aLabel = 'Start image',
  bLabel = 'End image',
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'imagePair';
  if (id) wrap.setAttribute('data-id', id);
  const header = document.createElement('div');
  header.className = 'mb-3';
  const row = document.createElement('div');
  row.className = 'flex items-center';
  const title = label ? String(label) : 'Images';
  const labelEl = createFieldLabel(title, { required });
  labelEl.className = 'block text-sm font-medium mx-2';
  row.appendChild(labelEl);
  const { trigger } = createHelpToggle({ idSeed: label || 'image_pair', labelText: title, helpText: help });
  if (trigger) {
    wrap.setAttribute('data-help-scope', '');
    row.appendChild(trigger);
  }
  header.appendChild(row);
  wrap.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 gap-3';

  const aFieldId = fieldKey ? `${fieldKey}[0]` : undefined;
  const bFieldId = fieldKey ? `${fieldKey}[1]` : undefined;
  const aField = createMediaField({ label: aLabel, id: aFieldId, required, kind: 'image' });
  const bField = createMediaField({ label: bLabel, id: bFieldId, required, kind: 'image' });

  grid.appendChild(aField.wrap);
  grid.appendChild(bField.wrap);
  wrap.appendChild(grid);

  // Sync the pair as an array to global form data (base64 for files)
  const syncToGlobal = async () => {
    const aUrl = aField.urlInput.value.trim();
    const bUrl = bField.urlInput.value.trim();
    const aFile = aField.fileInput.files && aField.fileInput.files.length > 0 ? aField.fileInput.files[0] : null;
    const bFile = bField.fileInput.files && bField.fileInput.files.length > 0 ? bField.fileInput.files[0] : null;

    let aVal = aUrl || undefined;
    let bVal = bUrl || undefined;
    try { if (!aVal && aFile) aVal = await fileToBase64DataUrl(aFile); } catch { /* skip */ }
    try { if (!bVal && bFile) bVal = await fileToBase64DataUrl(bFile); } catch { /* skip */ }

    if (aVal || bVal) {
      updateFormData(fieldKey, [aVal, bVal]);
    } else {
      updateFormData(fieldKey, undefined);
    }
  };

  // Listen for changes on both child fields
  aField.urlInput.addEventListener('input', syncToGlobal);
  aField.urlInput.addEventListener('change', syncToGlobal);
  aField.fileInput.addEventListener('change', syncToGlobal);
  bField.urlInput.addEventListener('input', syncToGlobal);
  bField.urlInput.addEventListener('change', syncToGlobal);
  bField.fileInput.addEventListener('change', syncToGlobal);

  function setValue(v) {
    const arr = Array.isArray(v) ? v : [];
    aField.setValue?.(arr[0]);
    bField.setValue?.(arr[1]);
    syncToGlobal();
  }

  if (Array.isArray(defaultValue)) setValue(defaultValue);
  syncToGlobal(); // Initial sync

  return {
    wrap,
    getValue: async () => {
      const a = await aField.getValue();
      const b = await bField.getValue();
      if (a === undefined && b === undefined) return undefined;
      if (required && (!a || !b)) {
        const msg = `Please upload both images for ${label ? label.toLowerCase() : 'this field'}`;
        throw new Error(msg);
      }
      return [a ?? '', b ?? ''];
    },
    setValue: (v) => { setValue(v); syncToGlobal(); },
    setReadOnly: (readOnly) => {
      aField.fileInput.disabled = Boolean(readOnly);
      aField.urlInput.readOnly = Boolean(readOnly);
      bField.fileInput.disabled = Boolean(readOnly);
      bField.urlInput.readOnly = Boolean(readOnly);
      wrap.classList.toggle('opacity-75', Boolean(readOnly));
      wrap.querySelectorAll('button, input, textarea, select').forEach((el) => {
        if (el.tagName.toLowerCase() === 'button') (el).disabled = Boolean(readOnly);
      });
    },
  };
}

export function createJsonField({
  label,
  id,
  required = false,
  help,
  jsonType = 'object', // 'object' | 'array'
  defaultValue,
  computeTemplate, // () => object/array - function to generate template
  formatJson, // (text) => string - function to format JSON
} = {}) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'json';
  if (id) wrap.setAttribute('data-id', id);
  const header = document.createElement('div');
  header.className = 'mb-2 mt-2';
  const row = document.createElement('div');
  row.className = 'flex items-center';
  const labelEl = createFieldLabel(label, { required });
  labelEl.className = 'block text-sm font-medium mx-2';
  row.appendChild(labelEl);
  const { trigger } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger) {
    wrap.setAttribute('data-help-scope', '');
    row.appendChild(trigger);
  }
  header.appendChild(row);
  wrap.appendChild(header);

  const toolbar = document.createElement('div');
  toolbar.className = 'flex items-center gap-2 mb-2';

  const templateBtn = document.createElement('button');
  templateBtn.type = 'button';
  templateBtn.textContent = 'Template';
  templateBtn.className =
    'px-2 py-1 rounded-ios-lg text-xs bg-neutral-100 text-gray-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700';

  const formatBtn = document.createElement('button');
  formatBtn.type = 'button';
  formatBtn.textContent = 'Format';
  formatBtn.className =
    'px-2 py-1 rounded-ios-lg text-xs bg-neutral-100 text-gray-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-gray-200 dark:hover:bg-neutral-700';

  toolbar.appendChild(templateBtn);
  toolbar.appendChild(formatBtn);
  wrap.appendChild(toolbar);

  const textarea = document.createElement('textarea');
  textarea.rows = 6;
  textarea.placeholder = jsonType === 'array' ? 'JSON array (e.g. ["a","b"])' : 'JSON object (e.g. {"key":"value"})';
  textarea.className =
    'block w-full text-sm bg-white dark:bg-neutral-950 border border-black/10 dark:border-white/10 rounded-ios-lg px-3 py-2 font-mono';
  if (required) textarea.required = true;

  if (defaultValue != null) {
    textarea.value = typeof defaultValue === 'string' ? defaultValue : JSON.stringify(defaultValue, null, 2);
  }

  const errorEl = document.createElement('p');
  errorEl.className = 'text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';

  function setError(message) {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      return;
    }
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function getTemplate() {
    if (typeof computeTemplate === 'function') {
      return computeTemplate();
    }
    return jsonType === 'array' ? [] : {};
  }

  templateBtn.addEventListener('click', () => {
    try {
      textarea.value = JSON.stringify(getTemplate(), null, 2);
      setError('');
    } catch (err) {
      setError(err?.message || String(err));
    }
  });

  formatBtn.addEventListener('click', () => {
    try {
      if (typeof formatJson === 'function') {
        textarea.value = formatJson(textarea.value);
      } else {
        // Default formatting
        textarea.value = JSON.stringify(JSON.parse(textarea.value), null, 2);
      }
      setError('');
    } catch (err) {
      setError(err?.message || String(err));
    }
  });

  textarea.addEventListener('input', () => setError(''));

  // If required and no default, pre-fill with template
  if (required && !textarea.value.trim()) {
    textarea.value = JSON.stringify(getTemplate(), null, 2);
  }

  wrap.appendChild(textarea);
  wrap.appendChild(errorEl);

  // Sync to global form data
  const syncToGlobal = () => {
    const raw = textarea.value.trim();
    if (!raw) {
      updateFormData(fieldKey, undefined);
    } else {
      try {
        updateFormData(fieldKey, JSON.parse(raw));
      } catch {
        updateFormData(fieldKey, raw); // Store raw string if invalid JSON
      }
    }
  };
  textarea.addEventListener('input', syncToGlobal);
  textarea.addEventListener('change', syncToGlobal);
  syncToGlobal(); // Initial sync

  return {
    wrap,
    textarea,
    getValue: () => {
      const raw = textarea.value.trim();
      if (!raw) return undefined;
      return JSON.parse(raw); // Will throw if invalid JSON
    },
    getRaw: () => textarea.value.trim(),
    setValue: (v) => {
      textarea.value = v == null ? '' : (typeof v === 'string' ? v : JSON.stringify(v, null, 2));
      syncToGlobal();
    },
    setError,
  };
}
