import { createFieldLabel, createHelpToggle, createTextAreaField, createTextInputField, createMediaField, setHidden, updateFormData, FieldValidationError } from './ui.js';

function createPillToggle({ label, id, options, defaultValue, required = false, help }) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'pillToggle';
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

  // Sync to global form data
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

export async function render({ agent, container, remix }) {
  container.innerHTML = '';

  const faceUrl = createMediaField({
    label: agent?.id === 'talking-avatar' ? 'Portrait' : 'Face image',
    id: 'faceUrl',
    required: true,
    kind: 'image',
    help: 'Upload an image with a clear, front-facing face.',
  });

  const audioMode = createPillToggle({
    label: 'Audio source',
    id: 'audioMode',
    options: [
      { value: 'upload', label: 'Upload audio' },
      { value: 'tts', label: 'Text to speech' },
    ],
    defaultValue: agent?.id === 'talking-avatar' ? 'tts' : 'upload',
    help: 'Upload an audio file or generate speech from text.',
  });

  const audioUrl = createMediaField({
    label: 'Audio',
    id: 'audioUrl',
    required: false,
    kind: 'audio',
    help: 'Upload an audio file or paste a URL.',
  });

  const text = createTextAreaField({
    label: 'Text to speak',
    id: 'text',
    required: false,
    rows: 4,
    placeholder: 'Type what you want the avatar to say…',
  });

  const language = createTextInputField({
    label: 'Language',
    id: 'language',
    required: false,
    placeholder: 'en',
    defaultValue: 'en',
    help: 'Language code (e.g., en, tr, es, fr).',
  });

  const voice = createTextInputField({
    label: 'Voice preset',
    id: 'voice',
    required: false,
    placeholder: 'female-professional',
    defaultValue: 'female-professional',
    help: 'Voice style hint for the TTS engine.',
  });

  const ttsWrap = document.createElement('div');
  ttsWrap.className = 'space-y-4';
  ttsWrap.appendChild(text.wrap);

  // More options for TTS
  const ttsAdvanced = document.createElement('details');
  ttsAdvanced.className = '';
  ttsAdvanced.open = false;
  const ttsSummary = document.createElement('summary');
  ttsSummary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  ttsSummary.textContent = 'More options';
  ttsAdvanced.appendChild(ttsSummary);
  const ttsBody = document.createElement('div');
  ttsBody.className = 'space-y-4';
  ttsBody.appendChild(language.wrap);
  ttsBody.appendChild(voice.wrap);
  ttsAdvanced.appendChild(ttsBody);
  ttsWrap.appendChild(ttsAdvanced);

  const uploadWrap = document.createElement('div');
  uploadWrap.className = 'space-y-4';
  uploadWrap.appendChild(audioUrl.wrap);

  function syncAudioMode() {
    const m = audioMode.getValue();
    setHidden(uploadWrap, m !== 'upload');
    setHidden(ttsWrap, m !== 'tts');
  }
  audioMode.wrap.querySelectorAll('button').forEach(btn => btn.addEventListener('click', syncAudioMode));

  // Remix: auto-detect audio mode from defaults
  const remixDefaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  if (remixDefaults) {
    if (typeof remixDefaults.audioUrl === 'string' && remixDefaults.audioUrl.trim()) {
      audioMode.setValue('upload');
    } else if (typeof remixDefaults.text === 'string' && remixDefaults.text.trim()) {
      audioMode.setValue('tts');
    }
  }
  syncAudioMode();

  container.appendChild(faceUrl.wrap);
  container.appendChild(audioMode.wrap);
  container.appendChild(uploadWrap);
  container.appendChild(ttsWrap);

  const fieldRefs = { faceUrl, audioMode, audioUrl, text, language, voice };

  return {
    getValues: async () => {
      faceUrl.clearError();
      audioUrl.clearError();
      text.clearError();

      const mode = audioMode.getValue();
      let hasError = false;

      let face;
      try {
        face = await faceUrl.getValue();
      } catch (err) {
        face = null;
      }
      if (!face) {
        faceUrl.setError('Please upload a face image');
        hasError = true;
      }

      if (mode === 'upload') {
        let a;
        try {
          a = await audioUrl.getValue();
        } catch (err) {
          a = null;
        }
        if (!a) {
          audioUrl.setError('Please upload an audio file');
          hasError = true;
        }

        if (hasError) {
          throw new FieldValidationError('validation', 'Please fix the errors above');
        }

        return { faceUrl: face, audioUrl: a };
      }

      const t = text.getTrimmed();
      if (!t) {
        text.setError('Please enter text to speak');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      const out = { faceUrl: face, text: t };
      const lang = language.getTrimmed();
      if (lang) out.language = lang;
      const v = voice.getTrimmed();
      if (v) out.voice = v;

      return out;
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
