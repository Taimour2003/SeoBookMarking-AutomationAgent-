import {
  createTextAreaField,
  createMediaField,
  createSelectField,
  createNumberField,
  createFieldLabel,
  createHelpToggle,
  setHidden,
  updateFormData,
  FieldValidationError,
} from './ui.js';

function createChipGroup({ label, id, options, defaultValue, required = false, help, layout = 'row' }) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'chipGroup';
  if (id) wrap.setAttribute('data-id', id);

  const header = document.createElement('div');
  header.className = 'mb-3';
  const row = document.createElement('div');
  row.className = 'flex items-center';

  const labelEl = createFieldLabel(label, { required });
  labelEl.className = 'block text-sm font-semibold';
  row.appendChild(labelEl);

  const { trigger, panel } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger && panel) {
    wrap.setAttribute('data-help-scope', '');
    row.appendChild(trigger);
    header.appendChild(row);
    header.appendChild(panel);
  } else {
    header.appendChild(row);
  }

  wrap.appendChild(header);

  const group = document.createElement('div');
  group.className = 'inline-flex p-1 rounded-full bg-gray-100 dark:bg-[#1a1a1a] border border-gray-200 dark:border-[#333]';
  wrap.appendChild(group);

  let selected = defaultValue;
  const buttons = [];

  // Sync to global form data (keep actual value, don't convert to undefined)
  const syncToGlobal = () => updateFormData(fieldKey, selected);

  function apply() {
    for (const { btn, value } of buttons) {
      const active = value === selected;
      btn.className =
        'px-5 py-2 rounded-full text-sm font-medium transition-all ' +
        (active
          ? 'bg-primary/90 text-primary-foreground shadow-md'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white');
    }
  }

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
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
    setValue: (v) => { selected = v; apply(); syncToGlobal(); },
  };
}

export async function render({ agent, modelSelector, remix, container }) {
  container.innerHTML = '';

  const modeTabs = createChipGroup({
    label: 'Mode',
    id: 'mode',
    required: true,
    help: 'Choose text-to-video or image-to-video.',
    options: [
      { value: 'text', label: 'Text → Video' },
      { value: 'image', label: 'Image → Video' },
    ],
    defaultValue: 'text',
  });

  const textPrompt = createTextAreaField({
    label: 'Prompt',
    id: 'prompt',
    required: true,
    rows: 4,
    placeholder: 'Describe the video you want…',
    help: 'Tip: include subject, camera motion, environment, lighting, and style.',
  });

  const imageUrl = createMediaField({
    label: 'Input image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the image you want to animate.',
  });

  const imagePrompt = createTextAreaField({
    label: 'Motion description',
    id: 'imagePrompt',
    required: false,
    rows: 2,
    placeholder: 'e.g., "slow camera pan, gentle motion"',
    help: 'Optional: describe how the image should move.',
  });

  const durationText = createSelectField({
    label: 'Duration',
    id: 'duration',
    required: false,
    options: [
      { value: '5', label: '5 seconds' },
      { value: '10', label: '10 seconds' },
    ],
    defaultValue: '5',
  });

  const durationImage = createSelectField({
    label: 'Duration',
    id: 'durationImage',
    required: false,
    help: 'Available durations depend on the selected model.',
    options: [
      { value: '5', label: '5 seconds' },
      { value: '10', label: '10 seconds' },
    ],
    defaultValue: '5',
  });

  const aspectRatio = createSelectField({
    label: 'Aspect ratio',
    id: 'aspectRatio',
    required: false,
    options: [
      { value: '16:9', label: '16:9' },
      { value: '9:16', label: '9:16' },
      { value: '1:1', label: '1:1' },
    ],
    defaultValue: '16:9',
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    help: 'Only available for models that support selectable output resolutions.',
    options: [{ value: '', label: 'Auto (model default)' }],
    defaultValue: '',
  });
  setHidden(resolution.wrap, true);

  const seed = createNumberField({
    label: 'Seed',
    id: 'seed',
    required: false,
    step: 1,
    help: 'For reproducible results.',
  });

  // Primary settings row (Duration + Aspect ratio)
  const settingsRow = document.createElement('div');
  settingsRow.className = 'grid grid-cols-2 gap-3';
  settingsRow.appendChild(durationText.wrap);
  settingsRow.appendChild(aspectRatio.wrap);

  // Image mode settings row
  const imageSettingsRow = document.createElement('div');
  imageSettingsRow.className = 'grid grid-cols-2 gap-3';
  imageSettingsRow.appendChild(durationImage.wrap);

  // More options (only Seed)
  const advanced = document.createElement('details');
  advanced.className = '';
  advanced.open = false;
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  advanced.appendChild(summary);
  const advancedBody = document.createElement('div');
  advancedBody.className = 'space-y-3';
  advanced.appendChild(advancedBody);
  advancedBody.appendChild(resolution.wrap);
  advancedBody.appendChild(seed.wrap);

  const textModeWrap = document.createElement('div');
  textModeWrap.className = 'space-y-4';
  textModeWrap.appendChild(textPrompt.wrap);
  textModeWrap.appendChild(settingsRow);

  const imageModeWrap = document.createElement('div');
  imageModeWrap.className = 'space-y-4';
  imageModeWrap.appendChild(imageUrl.wrap);
  imageModeWrap.appendChild(imagePrompt.wrap);
  imageModeWrap.appendChild(imageSettingsRow);

  function syncMode() {
    const mode = modeTabs.getValue();
    setHidden(textModeWrap, mode !== 'text');
    setHidden(imageModeWrap, mode !== 'image');
  }

  let lastMenuCapability = 'video-generation';
  function maybeSyncModelMenuForMode() {
    const mode = modeTabs.getValue();
    const desiredCapability = mode === 'image' ? 'image-to-video' : 'video-generation';
    if (desiredCapability === lastMenuCapability) return;
    lastMenuCapability = desiredCapability;

    const byCap = agent?.modelChoicesByCapability;
    const nextChoices = byCap?.[desiredCapability];
    if (modelSelector?.setChoices && Array.isArray(nextChoices) && nextChoices.length > 0) {
      modelSelector.setChoices(nextChoices);
    }
  }

  // Re-render on tab clicks by hooking into the chip buttons container.
  modeTabs.wrap.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncMode();
      maybeSyncModelMenuForMode();
    });
  });

  // Apply remix defaults: detect image mode from presence of imageUrl key
  const remixDefaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  if (remixDefaults) {
    const hasImageUrl = typeof remixDefaults.imageUrl === 'string' && remixDefaults.imageUrl.trim();
    const explicitMode = remixDefaults.mode;
    if (explicitMode === 'image' || (!explicitMode && hasImageUrl)) {
      modeTabs.setValue('image');
    } else if (explicitMode === 'text') {
      modeTabs.setValue('text');
    }
  }

  syncMode();
  maybeSyncModelMenuForMode();

  container.appendChild(modeTabs.wrap);
  container.appendChild(textModeWrap);
  container.appendChild(imageModeWrap);
  container.appendChild(advanced);
  // Model selection now handled by the main Model Selector UI

  let lastModelChangeToken = 0;

  const fieldRefs = { modeTabs, textPrompt, imageUrl, imagePrompt, durationText, durationImage, aspectRatio, resolution, seed, prompt: textPrompt };

  return {
    getValues: async () => {
      const mode = modeTabs.getValue();
      const seedVal = seed.getNumber();
      const resVal = String(resolution.getValue() || '').trim();
      const input = {
        aspectRatio: aspectRatio.getValue(),
      };

      if (Number.isFinite(seedVal)) input.seed = Math.floor(seedVal);
      if (resVal) input.resolution = resVal;

      if (mode === 'image') {
        imageUrl.clearError();

        let url;
        try {
          url = await imageUrl.getValue();
        } catch (err) {
          imageUrl.setError('Please upload an image');
          throw new FieldValidationError('imageUrl', 'Please upload an image');
        }

        if (!url) {
          imageUrl.setError('Please upload an image');
          throw new FieldValidationError('imageUrl', 'Please upload an image');
        }

        const dur = Number(durationImage.getValue());
        input.imageUrl = url;
        input.duration = Number.isFinite(dur) ? dur : 5;
        const promptVal = imagePrompt.getTrimmed();
        if (promptVal) input.prompt = promptVal;
        return input;
      }

      textPrompt.clearError();

      const promptVal = textPrompt.getTrimmed();
      if (!promptVal) {
        textPrompt.setError('Please enter a prompt');
        throw new FieldValidationError('prompt', 'Please enter a prompt');
      }

      const dur = Number(durationText.getValue());
      input.prompt = promptVal;
      input.duration = Number.isFinite(dur) ? dur : 5;
      return input;
    },

    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },

    onModelChange: async (modelChoice, hintsPromise, token) => {
      const myToken = Number.isFinite(token) ? token : (lastModelChangeToken + 1);
      lastModelChangeToken = myToken;

      const choice = modelChoice && typeof modelChoice === 'object' ? modelChoice : null;
      const cost = choice?.cost;

      function parseDurationTagSeconds(tags) {
        const list = Array.isArray(tags) ? tags.map(t => String(t)) : [];
        for (const tag of list) {
          const m = tag.match(/^(durations?|duration)\s*[:=]\s*([\d,\s]+)$/i);
          if (!m) continue;
          const nums = m[2]
            .split(',')
            .map(s => Number.parseInt(s.trim(), 10))
            .filter(n => Number.isFinite(n) && n > 0);
          const uniq = Array.from(new Set(nums));
          uniq.sort((a, b) => a - b);
          if (uniq.length > 0) return uniq;
        }
        return null;
      }

      const safeFallbackDurations = (() => {
        const durationsFromTags = parseDurationTagSeconds(choice?.tags);
        if (durationsFromTags && durationsFromTags.length > 0) return durationsFromTags;
        if (cost && typeof cost === 'object' && typeof cost.perSecond === 'number') return [10];
        return [5, 10];
      })();

      function updateSelect(field, options) {
        const select = field?.select;
        if (!select) return;

        const current = Number.parseInt(String(select.value || ''), 10);
        const html = options
          .map((v) => `<option value="${String(v)}">${v} seconds</option>`)
          .join('');
        select.innerHTML = html;

        const next =
          Number.isFinite(current) && options.includes(current)
            ? current
            : (options[0] ?? 5);
        select.value = String(next);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Apply a safe immediate fallback so users can't submit obviously-invalid durations
      // (prevents "silent upward clamp" in per-second billing models).
      updateSelect(durationText, safeFallbackDurations);
      updateSelect(durationImage, safeFallbackDurations);

      // Reset aspect ratios immediately so restrictions don't "stick" across model changes.
      const defaultAspectRatios = ['16:9', '9:16', '1:1'];
      const aspectSelect = aspectRatio?.select;
      if (aspectSelect) {
        const current = String(aspectSelect.value || '');
        aspectSelect.innerHTML = defaultAspectRatios.map((v) => `<option value="${v}">${v}</option>`).join('');
        aspectSelect.value = defaultAspectRatios.includes(current) ? current : defaultAspectRatios[0];
        aspectSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // Reset resolution immediately to avoid leaking unsupported values into the payload.
      setHidden(resolution.wrap, true);
      const resolutionSelect = resolution?.select;
      if (resolutionSelect) {
        resolutionSelect.innerHTML = `<option value="">Auto (model default)</option>`;
        resolutionSelect.value = '';
        resolutionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const hints = await Promise.resolve(hintsPromise).catch(() => null);
      if (myToken !== lastModelChangeToken) return;
      const durationOptionsRaw = hints?.durationOptions;
      const durationOptions =
        Array.isArray(durationOptionsRaw) && durationOptionsRaw.length > 0
          ? durationOptionsRaw
            .slice()
            .map(n => Number(n))
            .filter(n => Number.isFinite(n) && n > 0 && n <= 60)
          : null;

      if (durationOptions && durationOptions.length > 0) {
        durationOptions.sort((a, b) => a - b);
        updateSelect(durationText, durationOptions);
        updateSelect(durationImage, durationOptions);
      }

      const aspectRatiosRaw = hints?.aspectRatios;
      if (Array.isArray(aspectRatiosRaw) && aspectRatiosRaw.length > 0) {
        const allowed = aspectRatiosRaw
          .map(String)
          .filter((v) => ['16:9', '9:16', '1:1'].includes(v));
        if (allowed.length === 0) return;
        const select = aspectRatio?.select;
        if (select) {
          const current = String(select.value || '');
          select.innerHTML = allowed.map((v) => `<option value="${v}">${v}</option>`).join('');
          select.value = allowed.includes(current) ? current : allowed[0];
          select.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }

      const resolutionOptionsRaw = hints?.resolutionOptions;
      const resolutionOptions =
        Array.isArray(resolutionOptionsRaw) && resolutionOptionsRaw.length > 0
          ? resolutionOptionsRaw
            .map(String)
            .map((v) => v.trim().toLowerCase())
            .filter((v) => /^\d{3,4}p$/.test(v))
          : null;

      if (resolutionOptions && resolutionOptions.length > 0 && resolutionSelect) {
        resolutionOptions.sort((a, b) => Number.parseInt(a, 10) - Number.parseInt(b, 10));
        const current = String(resolutionSelect.value || '');
        resolutionSelect.innerHTML = [
          `<option value="">Auto (model default)</option>`,
          ...resolutionOptions.map((v) => `<option value="${v}">${v}</option>`),
        ].join('');
        resolutionSelect.value = resolutionOptions.includes(current) ? current : '';
        resolutionSelect.dispatchEvent(new Event('change', { bubbles: true }));
        setHidden(resolution.wrap, false);
      }
    },
  };
}
