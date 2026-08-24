import { createMediaField, createTextAreaField, createSelectField, createNumberField, setHidden, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const startImage = createMediaField({
    label: 'Start image',
    id: 'startImage',
    required: true,
    kind: 'image',
    help: '',
  });

  const endImage = createMediaField({
    label: 'End frame',
    id: 'endImage',
    required: false,
    kind: 'image',
    help: 'The animation will transition from the start image to this frame. Supported by Kling, Hailuo, and Seedance models.',
    dropzoneTitle: 'Upload End Frame',
  });

  const prompt = createTextAreaField({
    label: 'Motion description',
    id: 'prompt',
    required: false,
    rows: 3,
    placeholder: 'e.g., "slow camera push-in, natural blinking, subtle head movement"',
    help: 'If you provide a prompt or end frame, the agent may use a higher-quality motion model.',
  });

  const duration = createSelectField({
    label: 'Duration',
    id: 'duration',
    required: false,
    options: [
      { value: '5', label: '5 seconds' },
      { value: '10', label: '10 seconds' },
    ],
    defaultValue: '5',
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

  const mode = createSelectField({
    label: 'Quality mode',
    id: 'mode',
    required: false,
    options: [
      { value: 'standard', label: 'Standard' },
      { value: 'pro', label: 'Pro' },
    ],
    defaultValue: 'standard',
  });

  const fps = createNumberField({
    label: 'FPS (simple mode)',
    id: 'fps',
    required: false,
    min: 1,
    max: 60,
    step: 1,
    defaultValue: 7,
  });

  const motionAmount = createNumberField({
    label: 'Motion intensity (simple mode)',
    id: 'motionAmount',
    required: false,
    min: 0,
    max: 255,
    step: 1,
    defaultValue: 127,
  });

  container.appendChild(startImage.wrap);

  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  moreOptions.open = false;
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'mt-1 space-y-4';
  body.appendChild(endImage.wrap);
  body.appendChild(prompt.wrap);
  body.appendChild(duration.wrap);
  body.appendChild(resolution.wrap);
  body.appendChild(mode.wrap);
  body.appendChild(fps.wrap);
  body.appendChild(motionAmount.wrap);
  moreOptions.appendChild(body);
  container.appendChild(moreOptions);

  let lastModelChangeToken = 0;

  const fieldRefs = { startImage, endImage, prompt, duration, resolution, mode, fps, motionAmount };

  return {
    getValues: async () => {
      startImage.clearError();

      let start;
      try {
        start = await startImage.getValue();
      } catch (err) {
        start = null;
      }
      if (!start) {
        startImage.setError('Please upload a start image');
        throw new FieldValidationError('startImage', 'Please upload a start image');
      }

      let end;
      try {
        end = await endImage.getValue();
      } catch (err) {
        // Optional field, ignore errors
      }
      const promptText = prompt.getTrimmed();
      const durationNum = Number(duration.getValue());
      const resVal = String(resolution.getValue() || '').trim();
      const fpsNum = fps.getNumber();
      const motionNum = motionAmount.getNumber();

      const out = {
        startImage: start,
        duration: Number.isFinite(durationNum) ? durationNum : 5,
        mode: mode.getValue(),
      };

      if (resVal) out.resolution = resVal;
      if (end) out.endImage = end;
      if (promptText) out.prompt = promptText;
      if (Number.isFinite(fpsNum)) out.fps = Math.max(1, Math.min(60, Math.floor(fpsNum)));
      if (Number.isFinite(motionNum)) out.motionAmount = Math.max(0, Math.min(255, Math.floor(motionNum)));
      return out;
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

      const select = duration?.select;
      if (!select) return;

      // Reset resolution immediately to avoid leaking unsupported values into the payload.
      setHidden(resolution.wrap, true);
      const resolutionSelect = resolution?.select;
      if (resolutionSelect) {
        resolutionSelect.innerHTML = `<option value="">Auto (model default)</option>`;
        resolutionSelect.value = '';
        resolutionSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const current = Number.parseInt(String(select.value || ''), 10);
      select.innerHTML = safeFallbackDurations
        .map((v) => `<option value="${String(v)}">${v} seconds</option>`)
        .join('');

      const next =
        Number.isFinite(current) && safeFallbackDurations.includes(current)
          ? current
          : (safeFallbackDurations[0] ?? 5);
      select.value = String(next);
      select.dispatchEvent(new Event('change', { bubbles: true }));

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

      if (!durationOptions || durationOptions.length === 0) return;
      durationOptions.sort((a, b) => a - b);

      select.innerHTML = durationOptions
        .map((v) => `<option value="${String(v)}">${v} seconds</option>`)
        .join('');

      const currentAfter = Number.parseInt(String(select.value || ''), 10);
      const refined =
        Number.isFinite(currentAfter) && durationOptions.includes(currentAfter)
          ? currentAfter
          : (durationOptions[0] ?? safeFallbackDurations[0] ?? 5);
      select.value = String(refined);
      select.dispatchEvent(new Event('change', { bubbles: true }));

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
        const currentRes = String(resolutionSelect.value || '');
        resolutionSelect.innerHTML = [
          `<option value="">Auto (model default)</option>`,
          ...resolutionOptions.map((v) => `<option value="${v}">${v}</option>`),
        ].join('');
        resolutionSelect.value = resolutionOptions.includes(currentRes) ? currentRes : '';
        resolutionSelect.dispatchEvent(new Event('change', { bubbles: true }));
        setHidden(resolution.wrap, false);
      }
    },
  };
}
