import {
  fileToDataUrl,
  fileToBase64,
  guessMediaKind,
  maxBytesForKind,
  maxInlineBytesForKind,
  formatBytes,
  uploadFileToServer,
  acceptForKind,
} from '../shared/media.js';
import { buildTemplateForProperty, formatJsonText } from '../shared/schema-templates.js';
import {
  createMediaField,
  createTextAreaField,
  createTextInputField,
  createNumberField,
  createSliderField,
  createColorPickerField,
  createSelectField,
  createCheckboxField,
  createJsonField,
  createChipGroup,
  createImagePairField,
  createHelpToggle,
  setupHelpSystemOnce,
  createMoreOptionsDisclosure,
  FieldValidationError,
  updateFormData,
} from './overrides/ui.js';

// Initialize global form data object immediately when module loads
if (typeof window !== 'undefined') {
  window.agent_form_data = window.agent_form_data || {};
}

function readXuap(propSchema) {
  const direct = propSchema && typeof propSchema === 'object' ? propSchema : {};
  const nested = direct['x-uap'] && typeof direct['x-uap'] === 'object' ? direct['x-uap'] : {};

  function read(name) {
    if (nested && Object.prototype.hasOwnProperty.call(nested, name)) return nested[name];
    const dottedKey = `x-uap.${name}`;
    if (Object.prototype.hasOwnProperty.call(direct, dottedKey)) return direct[dottedKey];
    return undefined;
  }

  const orderRaw = read('order');
  const order = typeof orderRaw === 'number' && Number.isFinite(orderRaw) ? orderRaw : undefined;

  const groupRaw = read('group');
  const group = typeof groupRaw === 'string' ? groupRaw : undefined;

  const widgetRaw = read('widget');
  const widget = typeof widgetRaw === 'string' ? widgetRaw : undefined;

  const mediaKindRaw = read('mediaKind');
  const mediaKind = typeof mediaKindRaw === 'string' ? mediaKindRaw : undefined;

  const hiddenRaw = read('hidden');
  const hidden = hiddenRaw === true;

  const readOnlyRaw = read('readOnly');
  const readOnly = readOnlyRaw === true;

  const presetsRaw = read('presets');
  const presets = presetsRaw && typeof presetsRaw === 'object' && !Array.isArray(presetsRaw)
    ? presetsRaw : undefined;

  return { hidden, group, order, widget, mediaKind, readOnly, presets };
}

function normalizeMediaKind(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'image') return 'image';
  if (v === 'video') return 'video';
  if (v === 'audio') return 'audio';
  if (v === 'imageorvideo' || v === 'image_or_video' || v === 'image-video') return 'imageOrVideo';
  if (v === 'audioorvideo' || v === 'audio_or_video' || v === 'audio-video') return 'audioOrVideo';
  return null;
}

function isProbablyVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const s = url.trim().toLowerCase();
  if (s.startsWith('data:video/')) return true;
  return /\.(mp4|mov|webm)(\?|#|$)/.test(s) || s.includes('/video/');
}

function isProbablyAudioUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const s = url.trim().toLowerCase();
  if (s.startsWith('data:audio/')) return true;
  return /\.(mp3|wav|m4a|aac|ogg)(\?|#|$)/.test(s) || s.includes('/audio/');
}

function isTextArea(propSchema, key) {
  const format = String(propSchema?.format || '').toLowerCase();
  if (format === 'textarea') return true;
  if (typeof propSchema?.maxLength === 'number' && propSchema.maxLength > 200) return true;
  const description = String(propSchema?.description || '');
  if (description.length > 120) return true;
  const k = String(key || '').toLowerCase();
  return /prompt|instruction|system|negative/.test(k);
}

function normalizeKeyTitleText(key, title) {
  return `${String(key || '')} ${String(title || '')}`.toLowerCase();
}

const MEDIA_PAIR_TOKEN_SETS = [
  ['start', 'end'],
  ['source', 'target'],
  ['before', 'after'],
  ['person', 'garment'],
];

function isPairedMediaRow(aText, bText) {
  if (!aText || !bText) return false;
  for (const [aToken, bToken] of MEDIA_PAIR_TOKEN_SETS) {
    if (aText.includes(aToken) && bText.includes(bToken)) return true;
    if (aText.includes(bToken) && bText.includes(aToken)) return true;
  }
  return false;
}

function shouldPreferSelectForKey(key, title) {
  const t = normalizeKeyTitleText(key, title);
  return /duration|seconds|resolution|quality|aspect|ratio|width|height/.test(t);
}

function classifySettingsKey(text) {
  const t = String(text || '').toLowerCase();
  if (/duration|seconds|\bsecs?\b|\btime\b/.test(t)) return 'duration';
  if (/aspect|ratio/.test(t)) return 'aspect';
  if (/resolution|quality|\bsize\b|\b720p\b|\b1080p\b|\b4k\b/.test(t)) return 'resolution';
  if (/\bwidth\b/.test(t)) return 'width';
  if (/\bheight\b/.test(t)) return 'height';
  return null;
}

function isPairedSettingsRow(aKeyTitle, bKeyTitle) {
  const a = classifySettingsKey(aKeyTitle);
  const b = classifySettingsKey(bKeyTitle);
  if (!a || !b || a === b) return false;
  const allowedPairs = new Set([
    'duration:resolution',
    'duration:aspect',
    'resolution:aspect',
    'width:height',
  ]);
  const direct = `${a}:${b}`;
  const inverse = `${b}:${a}`;
  return allowedPairs.has(direct) || allowedPairs.has(inverse);
}

function coerceNumber(value, integer) {
  if (value === '' || value == null) return null;
  const n = integer ? Number.parseInt(String(value), 10) : Number.parseFloat(String(value));
  if (!Number.isFinite(n)) return null;
  return n;
}

export function renderSchemaForm({ schema, container, collapseOptional = false }) {
  setupHelpSystemOnce();
  const agentId = typeof schema?.agentId === 'string' && schema.agentId.trim() ? schema.agentId.trim() : null;

  const inputSchema = schema?.input || schema;
  const properties = inputSchema?.properties && typeof inputSchema.properties === 'object' ? inputSchema.properties : {};
  const required = Array.isArray(inputSchema?.required) ? inputSchema.required : [];

  // Initialize global form data object
  window.agent_form_data = {};

  const fields = [];
  let advancedFieldCount = 0;

  const form = document.createElement('form');
  form.className = 'space-y-3';
  form.addEventListener('submit', (e) => e.preventDefault());

  const basicWrap = document.createElement('div');
  basicWrap.className = 'space-y-3';

  const advancedWrap = document.createElement('div');
  advancedWrap.className = 'space-y-3';
  console.log(properties,inputSchema)
	  const entries = Object.entries(properties).map(([key, propSchema], index) => {
	    const xuap = readXuap(propSchema);
	    return {
	      key,
	      propSchema,
	      index,
	      order: xuap.order,
	      group: xuap.group,
        effectiveGroup: null,
	      widget: xuap.widget,
	      mediaKindHint: xuap.mediaKind,
	      hidden: xuap.hidden,
	      readOnly: xuap.readOnly,
	      presets: xuap.presets,
	    };
	  });

  entries.sort((a, b) => {
    const aType = (a.propSchema?.type ?? '').toString().toLowerCase();
    const bType = (b.propSchema?.type ?? '').toString().toLowerCase();
    const aBool = aType === 'boolean';
    const bBool = bType === 'boolean';
    if (aBool !== bBool) return aBool ? 1 : -1;
    const ao = a.order;
    const bo = b.order;
    if (ao != null || bo != null) {
      const av = ao ?? Number.POSITIVE_INFINITY;
      const bv = bo ?? Number.POSITIVE_INFINITY;
      if (av !== bv) return av - bv;
    }
    return a.index - b.index;
  });

  const requiredSet = new Set(
    required.filter((key) => Object.prototype.hasOwnProperty.call(properties, key))
  );

  function resolveEffectiveGroup(entry) {
    if (requiredSet.has(entry.key)) return 'basic';
    const groupRaw = typeof entry.group === 'string' ? entry.group : '';
    const groupName = groupRaw.trim().toLowerCase();
    if (groupName === 'advanced') return 'advanced';
    return collapseOptional ? 'advanced' : 'basic';
  }

  // When collapseOptional is enabled, only required fields are visible; optional fields go under "More options".
  for (const entry of entries) {
    entry.effectiveGroup = resolveEffectiveGroup(entry);
  }

  if (collapseOptional) {
    // Safety net: never allow the main section to be empty when there are visible fields.
    // Some agent schemas do not reliably declare required[]; in that case, keep at least one
    // sensible field visible so the runner is still usable without expanding the drawer.
    const hasBasic = entries.some((entry) => !entry.hidden && entry.effectiveGroup !== 'advanced');
    const hasAnyVisible = entries.some((entry) => !entry.hidden);
    if (!hasBasic && hasAnyVisible) {
      const firstIndex = entries.findIndex((entry) => !entry.hidden);
      if (firstIndex !== -1) {
        entries[firstIndex].effectiveGroup = 'basic';
        const secondIndex = entries.findIndex((entry, idx) => idx > firstIndex && !entry.hidden);
        if (secondIndex !== -1) {
          const a = entries[firstIndex];
          const b = entries[secondIndex];
          const aText = normalizeKeyTitleText(a.key, a.propSchema?.title || a.key);
          const bText = normalizeKeyTitleText(b.key, b.propSchema?.title || b.key);
          if (isPairedMediaRow(aText, bText)) {
            entries[secondIndex].effectiveGroup = 'basic';
          }
        }
      }
    }
  }

  function buildMediaFieldForEntry({ key, propSchema, title, description, isRequired, mediaKind, isReadOnly }) {
    const wrapper = document.createElement('div');
    const mediaField = createMediaField({
      label: title,
      id: key,
      required: isRequired,
      kind: mediaKind,
      help: description,
      multiple: propSchema?.ui?.multiple || false,
    });
    const mediaDefault = propSchema?.default;
    if (typeof mediaDefault === 'string' && mediaDefault.trim().length > 0) {
      mediaField.urlInput.value = mediaDefault;
      mediaField.urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (isReadOnly) {
      mediaField.wrap.classList.add('opacity-75');
      mediaField.fileInput.disabled = true;
      mediaField.urlInput.readOnly = true;
    }
    wrapper.appendChild(mediaField.wrap);
    return {
      wrapper,
      field: {
        key,
        kind: 'media',
        required: isRequired,
        mediaKind,
        fileInput: mediaField.fileInput,
        urlInput: mediaField.urlInput,
        _mediaFieldGetValue: mediaField.getValue,
        setError: mediaField.setError,
        clearError: mediaField.clearError,
      },
    };
  }

  function buildEnumFieldForEntry({ key, propSchema, title, description, isRequired, isReadOnly }) {
    const wrapper = document.createElement('div');
    const preferSelect = shouldPreferSelectForKey(key, title);
    const canUseChips = !preferSelect && propSchema.enum.length > 0 && propSchema.enum.length <= 6;

    const enumOptions = propSchema.enum.map(option => ({
      value: JSON.stringify(option),
      label: String(option),
    }));

    if (canUseChips) {
      const chip = createChipGroup({
        label: title,
        id: key,
        required: isRequired,
        help: description,
        options: enumOptions,
        defaultValue: propSchema?.default !== undefined ? JSON.stringify(propSchema.default) : undefined,
        layout: 'wrap',
      });
      if (isReadOnly) {
        chip.wrap.classList.add('opacity-75');
        chip.wrap.querySelectorAll('button').forEach((btn) => { btn.disabled = true; });
      }
      wrapper.appendChild(chip.wrap);
      return {
        wrapper,
        field: {
          key,
          kind: 'enum',
          required: isRequired,
          _getValue: chip.getValue,
        },
      };
    }

    const selectField = createSelectField({
      label: title,
      id: key,
      required: isRequired,
      help: description,
      options: enumOptions,
      defaultValue: propSchema?.default !== undefined ? JSON.stringify(propSchema.default) : undefined,
    });
    if (isReadOnly) {
      selectField.wrap.classList.add('opacity-75');
      selectField.select.disabled = true;
    }
    wrapper.appendChild(selectField.wrap);
    return {
      wrapper,
      field: {
        key,
        kind: 'enum',
        required: isRequired,
        select: selectField.select,
        _getValue: selectField.getValue,
      },
    };
  }

  for (let entryIndex = 0; entryIndex < entries.length; entryIndex++) {
    const entry = entries[entryIndex];
    const key = entry.key;
    const propSchema = entry.propSchema;
    if (entry.hidden) continue;
    const isReadOnly = entry.readOnly === true;

    const groupWrap = entry.effectiveGroup === 'advanced' ? advancedWrap : basicWrap;

    const isRequired = required.includes(key);
    const type = propSchema?.type;
    const raw = propSchema?.title || key;
    const spaced = raw.replace(/_/g, ' ');
    const title = (raw.includes(' ') ? spaced : spaced.replace(/([a-z])([A-Z])/g, '$1 $2')).replace(/\b\w/g, c => c.toUpperCase());
    const rawDesc = propSchema?.description || '';
    const description = /^an enumeration\.?$/i.test(rawDesc.trim()) ? '' : rawDesc;
    const widgetHint = String(entry.widget || '').toLowerCase();

    const wrapper = document.createElement('div');

    // Helper function to create label/help for fields that still use inline code
    // (imageOrVideo, audioOrVideo, json). ui.js components create their own labels.
    function appendLabelAndHelp() {
      const header = document.createElement('div');
      header.className = 'mb-1.5 mt-1.5';
      const row = document.createElement('div');
      row.className = 'flex items-center';

      const labelEl = document.createElement('label');
      labelEl.className = 'block text-sm font-medium';
      labelEl.textContent = title;
      if (isRequired) {
        const star = document.createElement('span');
        star.className = 'text-red-500 ml-1';
        star.textContent = '*';
        labelEl.appendChild(star);
      }
      row.appendChild(labelEl);

      const { trigger } = createHelpToggle({ idSeed: key, labelText: title, helpText: description });
      if (trigger) {
        wrapper.setAttribute('data-help-scope', '');
        row.appendChild(trigger);
      }
      header.appendChild(row);
      wrapper.appendChild(header);
    }

		    const hintedMediaKind = normalizeMediaKind(entry.mediaKindHint);
		    const guessedMediaKind = guessMediaKind(key, propSchema);
		    const mediaKind = hintedMediaKind || guessedMediaKind
		      || (propSchema?.ui?.component === 'file-upload' ? (propSchema?.format || 'image') : null);
        if (widgetHint === 'image_pair') {
          const pairField = createImagePairField({
            label: title,
            id: key,
            required: isRequired,
            help: description,
            defaultValue: propSchema?.default,
          });
          if (isReadOnly) {
            pairField.setReadOnly?.(true);
          }
          wrapper.innerHTML = '';
          wrapper.appendChild(pairField.wrap);
	          fields.push({
	            key,
	            kind: 'image_pair',
	            required: isRequired,
	            _getValue: pairField.getValue,
	          });
            if (groupWrap === advancedWrap) advancedFieldCount += 1;
	          groupWrap.appendChild(wrapper);
	          continue;
	        }
		    const base64Field = String(key).toLowerCase().includes('base64') || String(description).toLowerCase().includes('base64');
		    if (base64Field && type === 'string') {
		      const kindForLimits = mediaKind || 'image';
		      const base64TextArea = createTextAreaField({
	        label: title,
	        id: key,
	        required: isRequired,
	        placeholder: 'data:...;base64,... or raw base64',
	        rows: 4,
	        help: description,
	        defaultValue: propSchema?.default != null ? String(propSchema.default) : '',
	      });

	      const fileInput = document.createElement('input');
	      fileInput.type = 'file';
	      fileInput.accept = acceptForKind(kindForLimits);
	      fileInput.className =
	        'block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary/90 file:text-white file:cursor-pointer ' +
	        'bg-white dark:bg-neutral-950 border border-black/10 dark:border-white/10 rounded-ios-lg p-2 mb-2';

        const base64InsertTarget = base64TextArea.textarea?.parentNode || base64TextArea.wrap;
	      base64InsertTarget.insertBefore(fileInput, base64TextArea.textarea);

		      wrapper.innerHTML = '';
		      wrapper.appendChild(base64TextArea.wrap);
          if (isReadOnly) {
            base64TextArea.wrap.classList.add('opacity-75');
            fileInput.disabled = true;
            base64TextArea.textarea.readOnly = true;
          }

			      fields.push({
			        key,
			        kind: 'base64',
			        required: isRequired,
			        mediaKind: kindForLimits,
			        fileInput,
			        base64Input: base64TextArea.textarea,
			      });
            if (groupWrap === advancedWrap) advancedFieldCount += 1;
			      groupWrap.appendChild(wrapper);
			      continue;
			    }
		    if (widgetHint === 'media' || mediaKind) {
	      const effectiveMediaKind = widgetHint === 'media' ? mediaKind : mediaKind;
	      if (!effectiveMediaKind) {
	        appendLabelAndHelp();
        const p = document.createElement('p');
        p.className = 'text-xs text-gray-500 dark:text-gray-400';
        p.textContent = 'This field is marked as media but has no media kind.';
        wrapper.appendChild(p);
        fields.push({ key, kind: 'string', required: isRequired, input: document.createElement('input') });
        groupWrap.appendChild(wrapper);
        continue;
      }

      const next = entries[entryIndex + 1];
      if (effectiveMediaKind === 'image' && next && !next.hidden) {
        const nextGroupWrap = next.effectiveGroup === 'advanced' ? advancedWrap : basicWrap;
        const nextWidgetHint = String(next.widget || '').toLowerCase();
        const nextText = normalizeKeyTitleText(next.key, next.propSchema?.title || next.key);
        const currentText = normalizeKeyTitleText(key, title);
        const nextMediaHint = normalizeMediaKind(next.mediaKindHint) || guessMediaKind(next.key, next.propSchema);
        const nextBase64 =
          String(next.key).toLowerCase().includes('base64') || String(next.propSchema?.description || '').toLowerCase().includes('base64');

        if (
          nextGroupWrap === groupWrap &&
          nextWidgetHint !== 'image_pair' &&
          !nextBase64 &&
          nextMediaHint === 'image' &&
          isPairedMediaRow(currentText, nextText)
        ) {
          const row = document.createElement('div');
          row.className = 'grid grid-cols-2 gap-3';

          const left = buildMediaFieldForEntry({
            key,
            propSchema,
            title,
            description,
            isRequired,
            mediaKind: effectiveMediaKind,
            isReadOnly,
          });
          const nextIsRequired = required.includes(next.key);
          const nextTitle = next.propSchema?.title || next.key;
          const nextDesc = next.propSchema?.description || '';
          const nextIsReadOnly = next.readOnly === true;
          const right = buildMediaFieldForEntry({
            key: next.key,
            propSchema: next.propSchema,
            title: nextTitle,
            description: nextDesc,
            isRequired: nextIsRequired,
            mediaKind: nextMediaHint,
            isReadOnly: nextIsReadOnly,
          });

          row.appendChild(left.wrapper);
          row.appendChild(right.wrapper);
	          groupWrap.appendChild(row);
	          fields.push(left.field, right.field);
            if (groupWrap === advancedWrap) advancedFieldCount += 2;
	          entryIndex += 1;
	          continue;
	        }
	      }

      const built = buildMediaFieldForEntry({
        key,
        propSchema,
        title,
        description,
        isRequired,
        mediaKind: effectiveMediaKind,
        isReadOnly,
      });
	      wrapper.innerHTML = '';
	      wrapper.appendChild(built.wrapper);
	      fields.push(built.field);
        if (groupWrap === advancedWrap) advancedFieldCount += 1;
	      groupWrap.appendChild(wrapper);
	      continue;
	    }

    if (widgetHint === 'select' || Array.isArray(propSchema?.enum)) {
      if (!Array.isArray(propSchema?.enum)) {
        appendLabelAndHelp();
        const p = document.createElement('p');
        p.className = 'text-xs text-gray-500 dark:text-gray-400';
        p.textContent = 'This field is marked as select but has no enum.';
        wrapper.appendChild(p);
        groupWrap.appendChild(wrapper);
        continue;
      }
      const next = entries[entryIndex + 1];
      if (next && !next.hidden && Array.isArray(next.propSchema?.enum)) {
        const nextGroupWrap = next.effectiveGroup === 'advanced' ? advancedWrap : basicWrap;
        if (nextGroupWrap === groupWrap) {
          const currentText = normalizeKeyTitleText(key, title);
          const nextTitle = next.propSchema?.title || next.key;
          const nextText = normalizeKeyTitleText(next.key, nextTitle);
          if (isPairedSettingsRow(currentText, nextText)) {
            const row = document.createElement('div');
            row.className = 'grid grid-cols-2 gap-3';

            const left = buildEnumFieldForEntry({
              key,
              propSchema,
              title,
              description,
              isRequired,
              isReadOnly,
            });
            const nextIsRequired = required.includes(next.key);
            const nextDesc = next.propSchema?.description || '';
            const nextIsReadOnly = next.readOnly === true;
            const right = buildEnumFieldForEntry({
              key: next.key,
              propSchema: next.propSchema,
              title: nextTitle,
              description: nextDesc,
              isRequired: nextIsRequired,
              isReadOnly: nextIsReadOnly,
            });

            row.appendChild(left.wrapper);
            row.appendChild(right.wrapper);
            groupWrap.appendChild(row);
            fields.push(left.field, right.field);
            if (groupWrap === advancedWrap) advancedFieldCount += 2;
            entryIndex += 1;
            continue;
          }
        }
      }

      const built = buildEnumFieldForEntry({
        key,
        propSchema,
        title,
        description,
        isRequired,
        isReadOnly,
      });
	      wrapper.innerHTML = '';
	      wrapper.appendChild(built.wrapper);
	      fields.push(built.field);
        if (groupWrap === advancedWrap) advancedFieldCount += 1;
	      groupWrap.appendChild(wrapper);
	      continue;
	    }

    if (type === 'boolean') {
      const checkboxField = createCheckboxField({
        label: title,
        id: key,
        help: description,
        defaultChecked: propSchema?.default === true,
      });
      if (isReadOnly) {
        checkboxField.wrap.classList.add('opacity-75');
        checkboxField.checkbox.disabled = true;
      }
	      wrapper.innerHTML = '';
	      wrapper.appendChild(checkboxField.wrap);
	      fields.push({
	        key,
	        kind: 'boolean',
	        required: isRequired,
	        checkbox: checkboxField.checkbox,
	        _getValue: checkboxField.getValue,
	      });
        if (groupWrap === advancedWrap) advancedFieldCount += 1;
	      groupWrap.appendChild(wrapper);
	      continue;
	    }

    if ((type === 'number' || type === 'integer') && widgetHint === 'slider') {
      const sliderField = createSliderField({
        label: title,
        id: key,
        required: isRequired,
        min: propSchema?.minimum ?? 0,
        max: propSchema?.maximum ?? 100,
        step: type === 'integer' ? 1 : (propSchema?.multipleOf || 1),
        help: description,
        defaultValue: propSchema?.default,
        unit: description?.includes('%') ? '%' : '',
      });
      if (isReadOnly) {
        sliderField.wrap.classList.add('opacity-75');
        sliderField.input.disabled = true;
      }
	      wrapper.innerHTML = '';
	      wrapper.appendChild(sliderField.wrap);
	      fields.push({
	        key,
	        kind: 'number',
	        required: isRequired,
	        integer: type === 'integer',
	        input: sliderField.input,
	        _getNumber: sliderField.getNumber,
	      });
        if (groupWrap === advancedWrap) advancedFieldCount += 1;
	      groupWrap.appendChild(wrapper);
	      continue;
	    }

    if (type === 'string' && widgetHint === 'color-picker') {
      const colorField = createColorPickerField({
        label: title,
        id: key,
        required: isRequired,
        help: description,
        defaultValue: propSchema?.default || '#FFFFFF',
        presets: entry.presets || {},
      });
      if (isReadOnly) {
        colorField.wrap.classList.add('opacity-75');
      }
	      wrapper.innerHTML = '';
	      wrapper.appendChild(colorField.wrap);
	      fields.push({
	        key,
	        kind: 'string',
	        required: isRequired,
	        _getValue: colorField.getValue,
	        setError: colorField.setError,
	      });
        if (groupWrap === advancedWrap) advancedFieldCount += 1;
	      groupWrap.appendChild(wrapper);
	      continue;
	    }

    if (type === 'number' || type === 'integer') {
      const numberField = createNumberField({
        label: title,
        id: key,
        required: isRequired,
        min: propSchema?.minimum,
        max: propSchema?.maximum,
        step: type === 'integer' ? 1 : 'any',
        help: description,
        defaultValue: propSchema?.default,
      });
      if (isReadOnly) {
        numberField.wrap.classList.add('opacity-75');
        numberField.input.disabled = true;
      }
	      wrapper.innerHTML = '';
	      wrapper.appendChild(numberField.wrap);
	      fields.push({
	        key,
	        kind: 'number',
	        required: isRequired,
	        integer: type === 'integer',
	        input: numberField.input,
	        _getNumber: numberField.getNumber,
	      });
        if (groupWrap === advancedWrap) advancedFieldCount += 1;
	      groupWrap.appendChild(wrapper);
	      continue;
	    }

    if ((widgetHint === 'json' || type === 'array' || type === 'object') && !(type === 'array' && propSchema?.ui?.component === 'file-upload')) {
      const jsonType = type === 'array' ? 'array' : 'object';
      const jsonField = createJsonField({
        label: title,
        id: key,
        required: isRequired,
        help: description,
        jsonType,
        defaultValue: propSchema?.default,
        computeTemplate: () => {
          const t = String(propSchema?.type || '').toLowerCase();
          if (t === 'object' || t === 'array') {
            return buildTemplateForProperty({ key, propSchema, required: isRequired });
          }
          return jsonType === 'array' ? [] : {};
        },
        formatJson: formatJsonText,
      });
      if (isReadOnly) {
        jsonField.wrap.classList.add('opacity-75');
        jsonField.textarea.readOnly = true;
        jsonField.wrap.querySelectorAll('button').forEach((btn) => {
          btn.disabled = true;
        });
      }
	      wrapper.innerHTML = '';
	      wrapper.appendChild(jsonField.wrap);
	      fields.push({
	        key,
	        kind: 'json',
	        required: isRequired,
	        textarea: jsonField.textarea,
	        jsonType,
	        _getValue: jsonField.getValue,
	        _getRaw: jsonField.getRaw,
	      });
        if (groupWrap === advancedWrap) advancedFieldCount += 1;
	      groupWrap.appendChild(wrapper);
	      continue;
	    }

    // Default: string
    if (widgetHint === 'textarea' || isTextArea(propSchema, key)) {
      const textareaField = createTextAreaField({
        label: title,
        id: key,
        required: isRequired,
        placeholder: propSchema?.examples?.[0] || '',
        rows: 5,
        help: description,
        defaultValue: propSchema?.default != null ? String(propSchema.default) : '',
      });
      if (isReadOnly) {
        textareaField.wrap.classList.add('opacity-75');
        textareaField.textarea.readOnly = true;
      }
	      wrapper.innerHTML = '';
	      wrapper.appendChild(textareaField.wrap);
	      fields.push({
	        key,
	        kind: 'string',
	        required: isRequired,
	        input: textareaField.textarea,
	        _getValue: textareaField.getTrimmed,
	        setError: textareaField.setError,
	      });
        if (groupWrap === advancedWrap) advancedFieldCount += 1;
	      groupWrap.appendChild(wrapper);
	      continue;
	    }

    const format = String(propSchema?.format || '').toLowerCase();
    const textField = createTextInputField({
      label: title,
      id: key,
      required: isRequired,
      type: format === 'uri' ? 'url' : 'text',
      placeholder: propSchema?.examples?.[0] || '',
      help: description,
      defaultValue: propSchema?.default != null ? String(propSchema.default) : '',
    });
    if (isReadOnly) {
      textField.wrap.classList.add('opacity-75');
      textField.input.readOnly = true;
    }
	    wrapper.innerHTML = '';
	    wrapper.appendChild(textField.wrap);
	    fields.push({
	      key,
	      kind: 'string',
	      required: isRequired,
	      input: textField.input,
	      _getValue: textField.getTrimmed,
	    });
      if (groupWrap === advancedWrap) advancedFieldCount += 1;
	    groupWrap.appendChild(wrapper);
	  }

  if (basicWrap.childNodes.length > 0) form.appendChild(basicWrap);

	  if (advancedWrap.childNodes.length > 0) {
      const body = document.createElement('div');
      body.appendChild(advancedWrap);
      const details = createMoreOptionsDisclosure({
        label: 'More options',
        count: advancedFieldCount,
        defaultOpen: false,
        body,
      });
      form.appendChild(details);
	  }

  if (Object.keys(properties).length === 0 || (basicWrap.childNodes.length === 0 && advancedWrap.childNodes.length === 0)) {
    const empty = document.createElement('p');
    empty.className = 'text-sm text-gray-500 dark:text-gray-400';
    empty.textContent = 'This agent has no documented inputs.';
    form.appendChild(empty);
  }

  container.innerHTML = '';
  container.appendChild(form);

  // Helper to sync a field's value to global agent_form_data via updateFormData
  // (ensures DOM event 'aitopia:form:data-changed' is always dispatched)
  function syncFieldToGlobal(field) {
    const key = field.key;
    let value;
    try {
      if (field.kind === 'media') {
        const urlValue = field.urlInput?.value?.trim() || '';
        if (urlValue) {
          value = urlValue;
        } else {
          // When urlInput is empty a file may be staged (uploaded via file picker /
          // drag-drop). createMediaField's own syncToGlobal handles the async
          // file→base64 conversion and writes to agent_form_data correctly.
          // Don't overwrite that value with undefined.
          return;
        }
      } else if (field.kind === 'base64') {
        const raw = String(field.base64Input?.value || '').trim();
        value = raw || undefined;
      } else if (field.kind === 'enum') {
        const raw = typeof field._getValue === 'function'
          ? field._getValue()
          : (field.select?.value ?? '');
        if (raw) {
          try { value = JSON.parse(raw); } catch { value = raw; }
        } else {
          value = undefined;
        }
      } else if (field.kind === 'boolean') {
        value = typeof field._getValue === 'function'
          ? field._getValue()
          : !!field.checkbox?.checked;
      } else if (field.kind === 'number') {
        if (typeof field._getNumber === 'function') {
          value = field._getNumber();
        } else {
          const raw = field.input?.value;
          value = coerceNumber(raw, field.integer) ?? undefined;
        }
      } else if (field.kind === 'json') {
        if (typeof field._getValue === 'function') {
          try { value = field._getValue(); } catch { value = undefined; }
        } else {
          const raw = field.textarea?.value?.trim();
          if (raw) {
            try { value = JSON.parse(raw); } catch { value = undefined; }
          } else {
            value = undefined;
          }
        }
      } else if (field.kind === 'image_pair') {
        value = undefined;
      } else {
        const raw = typeof field._getValue === 'function'
          ? field._getValue()
          : String(field.input?.value ?? '').trim();
        value = raw || undefined;
      }
    } catch {
      value = undefined;
    }
    updateFormData(key, value);
  }

  // Sync all fields to global on initial load
  function syncAllFieldsToGlobal() {
    for (const field of fields) {
      syncFieldToGlobal(field);
    }
  }

  // Use event delegation for robust change detection
  function setupFormChangeDetection() {
    // Event delegation on form for all input/change events
    form.addEventListener('input', () => {
      syncAllFieldsToGlobal();
    });

    form.addEventListener('change', () => {
      syncAllFieldsToGlobal();
    });

    // Also listen for clicks on chip/button-based selectors
    form.addEventListener('click', () => {
      // Small delay to let the click handler update internal state
      setTimeout(() => {
        syncAllFieldsToGlobal();
      }, 10);
    });
  }

  // Initialize
  setupFormChangeDetection();
  syncAllFieldsToGlobal();

  async function getValues(opts) {
    const onUploadProgress = opts?.onUploadProgress;
    const input = {};

    // Count upload fields for progress reporting
    const uploadKinds = new Set(['media', 'image_pair', 'base64']);
    const totalUploads = fields.filter(f => uploadKinds.has(f.kind)).length;
    let completedUploads = 0;
    if (totalUploads > 0) onUploadProgress?.(0, totalUploads);

    for (const field of fields) {
      if (field.kind === 'image_pair') {
        if (typeof field._getValue !== 'function') continue;
        const value = await field._getValue();
        if (value === undefined) {
          if (field.required) throw new FieldValidationError(field.key, 'Please fill out this field');
          continue;
        }
        input[field.key] = value;
        completedUploads++;
        onUploadProgress?.(completedUploads, totalUploads);
        continue;
      }
      if (field.kind === 'media') {
        // If we have the createMediaField getValue function, use it directly
        if (typeof field._mediaFieldGetValue === 'function') {
          try {
            const value = await field._mediaFieldGetValue();
            if (value !== undefined) {
              input[field.key] = value;
            } else if (field.required) {
              throw new FieldValidationError(field.key, 'Please fill out this field');
            }
          } catch (err) {
            if (err.name === 'FieldValidationError') throw err;
            throw new FieldValidationError(field.key, err.message || 'Invalid input');
          }
          completedUploads++;
          onUploadProgress?.(completedUploads, totalUploads);
          continue;
        }

        // Fallback for legacy inline media fields (imageOrVideo, audioOrVideo)
        const hasFile = field.fileInput.files && field.fileInput.files.length > 0;
        const urlValue = field.urlInput.value.trim();
        if (!hasFile && !urlValue) {
          if (field.required) throw new FieldValidationError(field.key, 'Please fill out this field');
          completedUploads++;
          onUploadProgress?.(completedUploads, totalUploads);
          continue;
        }
        if (urlValue) {
          // Use centralized media handler to upload Base64 or re-upload URLs via CDN
          input[field.key] = await fileToDataUrl(urlValue);
          completedUploads++;
          onUploadProgress?.(completedUploads, totalUploads);
          continue;
        }
        const file = field.fileInput.files[0];
        const kindFromMime =
          file?.type?.startsWith('video/') ? 'video'
            : file?.type?.startsWith('audio/') ? 'audio'
              : file?.type?.startsWith('image/') ? 'image'
                : null;
        const kindForLimits = kindFromMime || field.maxBytesKind || field.mediaKind;
        const maxUploadBytes = maxBytesForKind(kindForLimits);
        if (file.size > maxUploadBytes) {
          throw new FieldValidationError(
            field.key,
            `File too large (${formatBytes(file.size)}). Max is ${formatBytes(maxUploadBytes)}.`
          );
        }

        const maxInlineBytes = maxInlineBytesForKind(kindForLimits);
        if (file.size > maxInlineBytes) {
          input[field.key] = await uploadFileToServer(file, { filename: file.name });
        } else {
          input[field.key] = await fileToDataUrl(file);
        }
        completedUploads++;
        onUploadProgress?.(completedUploads, totalUploads);
        continue;
      }

      if (field.kind === 'base64') {
        const hasFile = field.fileInput.files && field.fileInput.files.length > 0;
        const raw = String(field.base64Input.value || '').trim();
        if (!hasFile && !raw) {
          if (field.required) throw new FieldValidationError(field.key, 'Please fill out this field');
          completedUploads++;
          onUploadProgress?.(completedUploads, totalUploads);
          continue;
        }
        if (raw) {
          const match = raw.match(/^data:[^;]+;base64,(.+)$/);
          input[field.key] = match ? match[1] : raw;
          completedUploads++;
          onUploadProgress?.(completedUploads, totalUploads);
          continue;
        }
        const file = field.fileInput.files[0];
        const maxBytes = maxInlineBytesForKind(field.mediaKind);
        if (file.size > maxBytes) {
          throw new FieldValidationError(
            field.key,
            `File too large (${formatBytes(file.size)}). Max is ${formatBytes(maxBytes)}.`
          );
        }
        input[field.key] = await fileToBase64(file);
        completedUploads++;
        onUploadProgress?.(completedUploads, totalUploads);
        continue;
      }

      if (field.kind === 'enum') {
        const raw = typeof field._getValue === 'function'
          ? field._getValue()
          : (field.select?.value ?? field.select?.dataset?.value);
        if (!raw && field.required) throw new FieldValidationError(field.key, 'Please fill out this field');
        if (!raw) continue;
        try {
          input[field.key] = JSON.parse(raw);
        } catch {
          // Backward-compatible fallback (older pages may have stored raw strings).
          input[field.key] = raw;
        }
        continue;
      }

      if (field.kind === 'boolean') {
        const boolVal = typeof field._getValue === 'function' ? field._getValue() : !!field.checkbox.checked;
        if (field.required && !boolVal && /consent/i.test(field.key)) {
          throw new FieldValidationError(field.key, 'Please confirm consent to proceed');
        }
        input[field.key] = boolVal;
        continue;
      }

      if (field.kind === 'number') {
        if (typeof field._getNumber === 'function') {
          let n = field._getNumber();
          if (n === undefined && field.required) throw new FieldValidationError(field.key, 'Please fill out this field');
          if (n !== undefined) {
            if (!Number.isFinite(n)) throw new FieldValidationError(field.key, 'Please enter a valid number');
            if (field.integer) n = Math.trunc(n);
            input[field.key] = n;
          }
        } else {
          const raw = field.input.value;
          if (raw === '' && !field.required) continue;
          const n = coerceNumber(raw, field.integer);
          if (n == null) throw new FieldValidationError(field.key, 'Please enter a valid number');
          input[field.key] = n;
        }
        continue;
      }

      if (field.kind === 'json') {
        // Use _getValue if available (from createJsonField), otherwise fallback to manual parsing
        if (typeof field._getValue === 'function') {
          try {
            const value = field._getValue();
            if (value === undefined) {
              if (field.required) throw new FieldValidationError(field.key, 'Please fill out this field');
              continue;
            }
            input[field.key] = value;
          } catch (err) {
            if (err.name === 'FieldValidationError') throw err;
            throw new FieldValidationError(field.key, 'Invalid JSON format');
          }
        } else {
          const raw = field.textarea.value.trim();
          if (!raw) {
            if (field.required) throw new FieldValidationError(field.key, 'Please fill out this field');
            continue;
          }
          try {
            input[field.key] = JSON.parse(raw);
          } catch {
            throw new FieldValidationError(field.key, 'Invalid JSON format');
          }
        }
        continue;
      }

      if (field.kind === 'string') {
        const raw = typeof field._getValue === 'function' ? field._getValue() : String(field.input.value ?? '').trim();
        if (!raw) {
          if (field.required) throw new FieldValidationError(field.key, 'Please fill out this field');
          continue;
        }
        input[field.key] = raw;
      }
    }

    for (const k of required) {
      if (input[k] !== undefined) continue;
      const prop = properties[k];
      if (prop && typeof prop === 'object' && Object.prototype.hasOwnProperty.call(prop, 'default') && prop.default !== undefined) {
        input[k] = prop.default;
      } else {
        throw new FieldValidationError(k, 'Please fill out this field');
      }
    }

    return input;
  }

  const fieldMap = new Map();
  for (const field of fields) {
    fieldMap.set(field.key, field);
    fieldMap.set(field.key.toLowerCase(), field);
  }

  function setFieldError(fieldId, message) {
    const field = fieldMap.get(fieldId) || fieldMap.get(fieldId.toLowerCase());

    if (!field) {
      console.warn(`[schema-form] setFieldError: field "${fieldId}" not found`);
      return;
    }

    if (typeof field.setError === 'function') {
      field.setError(message);
      return;
    }

    let inputEl = null;
    if (field.input) {
      inputEl = field.input;
    } else if (field.textarea) {
      inputEl = field.textarea.closest('.rounded-2xl') || field.textarea;
    } else if (field.select) {
      inputEl = field.select.closest('button') || field.select;
    } else if (field.checkbox) {
      inputEl = field.checkbox.closest('.flex');
    }

    if (!inputEl) {
      console.warn(`[schema-form] setFieldError: input element for "${fieldId}" not found`);
      return;
    }

    const wrapper = inputEl.closest('[data-help-scope]') || inputEl.parentElement?.parentElement || inputEl.parentElement;

    let errorEl = wrapper?.querySelector('[role="alert"]');
    if (!errorEl && wrapper) {
      errorEl = document.createElement('p');
      errorEl.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400';
      errorEl.setAttribute('role', 'alert');
      wrapper.appendChild(errorEl);
    }

    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }

    inputEl.style.outline = '1.5px solid #f87171';

    const clearError = () => {
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
      inputEl.style.outline = '';
      inputEl.removeEventListener('input', clearError);
      inputEl.removeEventListener('change', clearError);
    };
    inputEl.addEventListener('input', clearError);
    inputEl.addEventListener('change', clearError);
  }

  return { getValues, setFieldError };
}
