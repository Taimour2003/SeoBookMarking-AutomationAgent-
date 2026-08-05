import { createTextAreaField, createSelectField, createNumberField, createTextInputField, createFieldLabel, createHelpToggle, createMoreOptionsDisclosure, setHidden, updateFormData, FieldValidationError } from './ui.js';

const GENRES = [
  { value: '', label: 'None' },
  { value: 'ambient', label: 'Ambient' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'cinematic', label: 'Cinematic' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'classical', label: 'Classical' },
  { value: 'hip_hop', label: 'Hip Hop' },
  { value: 'lofi', label: 'Lo-Fi' },
  { value: 'edm', label: 'EDM' },
  { value: 'acoustic', label: 'Acoustic' },
];

const MOODS = [
  { value: '', label: 'None' },
  { value: 'happy', label: 'Happy' },
  { value: 'sad', label: 'Sad' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'calm', label: 'Calm' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'epic', label: 'Epic' },
  { value: 'playful', label: 'Playful' },
  { value: 'dark', label: 'Dark' },
  { value: 'uplifting', label: 'Uplifting' },
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

function splitCommaList(value) {
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}

export async function render({ container, remix }) {
  container.innerHTML = '';

  const type = createPillToggle({
    label: 'Type',
    id: 'type',
    options: [
      { value: 'music', label: 'Music' },
      { value: 'sfx', label: 'SFX' },
      { value: 'ambient', label: 'Ambient' },
    ],
    defaultValue: 'music',
    help: 'Choose what you want to generate.',
  });

  const prompt = createTextAreaField({
    label: 'Prompt',
    id: 'prompt',
    required: true,
    rows: 4,
    placeholder: 'e.g., "Upbeat electronic track with synths and a driving beat"',
    help: 'Describe what you want to hear. Include instruments, tempo, and mood.',
  });

  const duration = createNumberField({
    label: 'Duration (seconds)',
    id: 'duration',
    required: false,
    min: 5,
    max: 300,
    step: 1,
    defaultValue: 30,
  });

  const genre = createSelectField({
    label: 'Genre',
    id: 'genre',
    required: false,
    options: GENRES,
    defaultValue: '',
  });

  const mood = createSelectField({
    label: 'Mood',
    id: 'mood',
    required: false,
    options: MOODS,
    defaultValue: '',
  });

  const bpm = createNumberField({
    label: 'BPM',
    id: 'bpm',
    required: false,
    min: 60,
    max: 200,
    step: 1,
    placeholder: '120',
  });

  const musicalKey = createTextInputField({
    label: 'Key',
    id: 'key',
    required: false,
    placeholder: 'e.g., C major',
  });

  const instruments = createTextInputField({
    label: 'Instruments',
    id: 'instruments',
    required: false,
    placeholder: 'e.g., piano, strings, synth',
    help: 'Comma-separated list.',
  });

  // Main fields
  container.appendChild(type.wrap);
  container.appendChild(prompt.wrap);

  // Genre & Mood row
  const genreMoodRow = document.createElement('div');
  genreMoodRow.className = 'grid grid-cols-2 gap-4';
  genreMoodRow.appendChild(genre.wrap);
  genreMoodRow.appendChild(mood.wrap);

  // More options
  const moreBody = document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(duration.wrap);
  moreBody.appendChild(genreMoodRow);
  moreBody.appendChild(bpm.wrap);
  moreBody.appendChild(musicalKey.wrap);
  moreBody.appendChild(instruments.wrap);

  const moreOptions = createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  });

  function syncType() {
    const t = type.getValue();
    const showMusicOptions = t === 'music';
    setHidden(genreMoodRow, !showMusicOptions);
    setHidden(bpm.wrap, !showMusicOptions);
    setHidden(musicalKey.wrap, !showMusicOptions);
    setHidden(instruments.wrap, !showMusicOptions);
  }

  type.wrap.querySelectorAll('button').forEach(btn => btn.addEventListener('click', syncType));

  // Remix: auto-detect type from defaults
  const remixDefaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  if (remixDefaults) {
    const explicitType = remixDefaults.type;
    if (explicitType === 'sfx' || explicitType === 'ambient') {
      type.setValue(explicitType);
    }
  }
  syncType();

  container.appendChild(moreOptions);

  const fieldRefs = { prompt, duration, genre, mood, bpm, musicalKey, instruments };

  return {
    getValues: async () => {
      prompt.clearError();

      const t = type.getValue();
      const p = prompt.getTrimmed();
      if (!p) {
        prompt.setError('Please enter a prompt');
        throw new FieldValidationError('prompt', 'Please enter a prompt');
      }

      const durationVal = duration.getNumber();
      const d = Number.isFinite(durationVal) ? Math.max(5, Math.min(300, Math.floor(durationVal))) : 30;

      const out = {
        type: t,
        prompt: p,
        duration: d,
      };

      const genreVal = genre.getValue();
      if (genreVal) out.genre = genreVal;

      const moodVal = mood.getValue();
      if (moodVal) out.mood = moodVal;

      const bpmVal = bpm.getNumber();
      if (Number.isFinite(bpmVal)) out.bpm = Math.max(60, Math.min(200, Math.floor(bpmVal)));

      const keyVal = musicalKey.getTrimmed();
      if (keyVal) out.key = keyVal;

      const inst = splitCommaList(instruments.getTrimmed());
      if (inst.length > 0) out.instruments = inst;

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
