import { createMediaField, createTextAreaField, createTextInputField, createSelectField, createCheckboxField, createFieldLabel, createHelpToggle, createMoreOptionsDisclosure, setHidden, updateFormData, FieldValidationError } from './ui.js';

const VOICE_STYLES = [
  { value: 'natural', label: 'Natural' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'whisper', label: 'Whisper' },
  { value: 'energetic', label: 'Energetic' },
  { value: 'calm', label: 'Calm' },
  { value: 'authoritative', label: 'Authoritative' },
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

  const operation = createPillToggle({
    label: 'Mode',
    id: 'operation',
    options: [
      { value: 'synthesize', label: 'Synthesize speech' },
      { value: 'clone', label: 'Clone voice' },
    ],
    defaultValue: 'synthesize',
    help: 'Synthesize speech with existing voices or clone a new voice from audio.',
  });

  // Synthesize fields
  const text = createTextAreaField({
    label: 'Text to speak',
    id: 'text',
    required: true,
    rows: 4,
    placeholder: 'Enter the text you want to convert to speech...',
  });

  const style = createSelectField({
    label: 'Voice style',
    id: 'style',
    required: false,
    options: VOICE_STYLES,
    defaultValue: 'natural',
  });

  const voiceId = createTextInputField({
    label: 'Voice ID',
    id: 'voiceId',
    required: false,
    placeholder: 'Leave empty for default voice',
    help: 'Specific voice ID if you have one.',
  });

  // Clone fields
  const audioUrl = createMediaField({
    label: 'Voice sample',
    id: 'audioUrl',
    required: true,
    kind: 'audio',
    help: 'Upload a clear audio sample (30+ seconds recommended).',
  });

  const voiceName = createTextInputField({
    label: 'Voice name',
    id: 'voiceName',
    required: false,
    placeholder: 'e.g., "My Voice"',
    help: 'Name for the cloned voice.',
  });

  const consent = createCheckboxField({
    label: 'I have permission to clone this voice',
    id: 'consent',
    help: 'Voice cloning requires consent from the voice owner.',
    defaultChecked: false,
  });

  // Wrappers
  const synthesizeWrap = document.createElement('div');
  synthesizeWrap.className = 'space-y-4';
  synthesizeWrap.appendChild(text.wrap);

  const cloneWrap = document.createElement('div');
  cloneWrap.className = 'space-y-4';
  cloneWrap.appendChild(audioUrl.wrap);

  // More options for synthesize
  const synthMoreBody = document.createElement('div');
  synthMoreBody.className = 'space-y-4';
  synthMoreBody.appendChild(style.wrap);
  synthMoreBody.appendChild(voiceId.wrap);

  const synthMoreOptions = createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: synthMoreBody,
  });

  // More options for clone
  const cloneMoreBody = document.createElement('div');
  cloneMoreBody.className = 'space-y-4';
  cloneMoreBody.appendChild(voiceName.wrap);

  const cloneMoreOptions = createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: cloneMoreBody,
  });

  function syncMode() {
    const op = operation.getValue();
    setHidden(synthesizeWrap, op !== 'synthesize');
    setHidden(cloneWrap, op !== 'clone');
    setHidden(synthMoreOptions, op !== 'synthesize');
    setHidden(cloneMoreOptions, op !== 'clone');
    setHidden(consent.wrap, op !== 'clone');
  }

  operation.wrap.querySelectorAll('button').forEach(btn => btn.addEventListener('click', syncMode));

  // Remix: auto-detect operation from defaults
  const remixDefaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  if (remixDefaults) {
    const explicitOp = remixDefaults.operation;
    if (explicitOp === 'clone' || (!explicitOp && typeof remixDefaults.audioUrl === 'string' && remixDefaults.audioUrl.trim())) {
      operation.setValue('clone');
    } else if (explicitOp === 'synthesize') {
      operation.setValue('synthesize');
    }
  }
  syncMode();

  container.appendChild(operation.wrap);
  container.appendChild(synthesizeWrap);
  container.appendChild(cloneWrap);
  container.appendChild(synthMoreOptions);
  container.appendChild(cloneMoreOptions);
  container.appendChild(consent.wrap);

  const fieldRefs = { operation, text, style, voiceId, audioUrl, voiceName, consent };

  return {
    getValues: async () => {
      const op = operation.getValue();

      if (op === 'clone') {
        audioUrl.clearError();
        consent.clearError?.();

        let hasError = false;

        let audio;
        try {
          audio = await audioUrl.getValue();
        } catch (err) {
          audio = null;
        }
        if (!audio) {
          audioUrl.setError('Please upload a voice sample');
          hasError = true;
        }

        if (!consent.getValue()) {
          consent.setError?.('Please confirm you have permission to clone this voice');
          hasError = true;
        }

        if (hasError) {
          throw new FieldValidationError('validation', 'Please fix the errors above');
        }

        const out = {
          operation: 'clone',
          audioUrl: audio,
          consent: {
            subjectConsent: true,
            samePersonVoice: true,
          },
        };

        const name = voiceName.getTrimmed();
        if (name) out.voiceName = name;

        return out;
      }

      // Synthesize
      text.clearError();

      const textVal = text.getTrimmed();
      if (!textVal) {
        text.setError('Please enter text to speak');
        throw new FieldValidationError('text', 'Please enter text to speak');
      }

      const out = {
        operation: 'synthesize',
        text: textVal,
        style: style.getValue(),
      };

      const vid = voiceId.getTrimmed();
      if (vid) out.voiceId = vid;

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
