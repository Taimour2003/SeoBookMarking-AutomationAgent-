import { createMediaField, createTextAreaField, createTextInputField, createSelectField, createFieldLabel, createHelpToggle, createMoreOptionsDisclosure, setHidden, updateFormData, FieldValidationError } from './ui.js';

const VOICES = [
  { value: 'female-professional', label: 'Female Professional' },
  { value: 'female-warm', label: 'Female Warm' },
  { value: 'female-narrator', label: 'Female Narrator' },
  { value: 'male-professional', label: 'Male Professional' },
  { value: 'male-narrator', label: 'Male Narrator' },
  { value: 'male-young', label: 'Male Young' },
];

const SYNC_MODES = [
  { value: 'smooth', label: 'Smooth' },
  { value: 'precise', label: 'Precise' },
  { value: 'fast', label: 'Fast' },
];

function createPillToggle({ label, id, options, defaultValue, help }) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'pillToggle';
  if (id) wrap.setAttribute('data-id', id);

  const header = document.createElement('div');
  header.className = 'mb-3';
  const row = document.createElement('div');
  row.className = 'flex items-center';

  const labelEl = createFieldLabel(label, { required: true });
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

export async function render({ container, remix }) {
  container.innerHTML = '';

  const videoUrl = createMediaField({
    label: 'Portrait',
    id: 'videoUrl',
    required: true,
    kind: 'image',
    help: 'Upload an image with a clear, front-facing face.',
  });

  const audioMode = createPillToggle({
    label: 'Audio source',
    id: 'audioMode',
    options: [
      { value: 'tts', label: 'Text to speech' },
      { value: 'upload', label: 'Upload audio' },
    ],
    defaultValue: 'tts',
    help: 'Generate speech from text or upload an audio file.',
  });

  const text = createTextAreaField({
    label: 'Text to speak',
    id: 'text',
    required: false,
    rows: 4,
    placeholder: 'Type what you want the avatar to say...',
  });

  const voice = createSelectField({
    label: 'Voice',
    id: 'voice',
    required: false,
    options: VOICES,
    defaultValue: 'female-professional',
  });

  const language = createTextInputField({
    label: 'Language',
    id: 'language',
    required: false,
    placeholder: 'en',
    defaultValue: 'en',
    help: 'Language code (e.g., en, tr, es, fr).',
  });

  const audioUrl = createMediaField({
    label: 'Audio',
    id: 'audioUrl',
    required: false,
    kind: 'audio',
    help: 'Upload an audio file.',
  });

  const syncMode = createSelectField({
    label: 'Sync quality',
    id: 'syncMode',
    required: false,
    options: SYNC_MODES,
    defaultValue: 'smooth',
  });

  // TTS wrap
  const ttsWrap = document.createElement('div');
  ttsWrap.className = 'space-y-4';
  ttsWrap.appendChild(text.wrap);

  // Upload wrap
  const uploadWrap = document.createElement('div');
  uploadWrap.className = 'space-y-4';
  uploadWrap.appendChild(audioUrl.wrap);

  function syncAudioMode() {
    const mode = audioMode.getValue();
    setHidden(ttsWrap, mode !== 'tts');
    setHidden(uploadWrap, mode !== 'upload');
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

  // Main fields
  container.appendChild(videoUrl.wrap);
  container.appendChild(audioMode.wrap);
  container.appendChild(ttsWrap);
  container.appendChild(uploadWrap);

  // More options
  const moreBody = document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(voice.wrap);
  moreBody.appendChild(language.wrap);
  moreBody.appendChild(syncMode.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { videoUrl, audioMode, audioUrl, text, voice, language, syncMode };

  return {
    getValues: async () => {
      videoUrl.clearError();
      audioUrl.clearError();
      text.clearError();

      const mode = audioMode.getValue();
      let hasError = false;

      let video;
      try {
        video = await videoUrl.getValue();
      } catch (err) {
        video = null;
      }
      if (!video) {
        videoUrl.setError('Please upload a portrait image');
        hasError = true;
      }

      let audio;
      let textVal;

      if (mode === 'upload') {
        try {
          audio = await audioUrl.getValue();
        } catch (err) {
          audio = null;
        }
        if (!audio) {
          audioUrl.setError('Please upload an audio file');
          hasError = true;
        }
      } else {
        textVal = text.getTrimmed();
        if (!textVal) {
          text.setError('Please enter text to speak');
          hasError = true;
        }
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      const out = { videoUrl: video };

      if (mode === 'upload') {
        out.audioUrl = audio;
      } else {
        out.text = textVal;
      }

      out.voice = voice.getValue();

      const lang = language.getTrimmed();
      if (lang) out.language = lang;

      out.syncMode = syncMode.getValue();

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
