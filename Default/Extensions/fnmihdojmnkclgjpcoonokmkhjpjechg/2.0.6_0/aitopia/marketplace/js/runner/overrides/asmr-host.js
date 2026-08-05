import { createMediaField, createTextAreaField, createSelectField, createCheckboxField, FieldValidationError } from './ui.js';

const VOICE_STYLES = [
  { value: 'Whisper', label: 'Whisper' },
  { value: 'Soft', label: 'Soft' },
  { value: 'Gentle', label: 'Gentle' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Photo',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload a portrait photo for ASMR host style.',
  });

  const prompt = createTextAreaField({
    label: 'Prompt',
    id: 'prompt',
    required: false,
    rows: 3,
    placeholder: 'e.g., "A relaxing sunset with soft lighting..."',
    help: 'Describe how the ASMR video should look.',
  });

  const script = createTextAreaField({
    label: 'Script (Text)',
    id: 'text',
    required: false,
    rows: 3,
    placeholder: 'Enter narration script...',
    help: 'Optional script for TTS narration.',
  });

  const generateAudio = createCheckboxField({
    label: 'Generate audio narration',
    id: 'generateAudio',
    help: 'Generate TTS audio from the script.',
    defaultChecked: false,
  });

  const voiceStyle = createSelectField({
    label: 'Voice style',
    id: 'voiceStyle',
    required: false,
    options: VOICE_STYLES,
    defaultValue: 'Whisper',
    help: 'Style of the ASMR voice narration.',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(prompt.wrap);
  optionsBody.appendChild(script.wrap);
  optionsBody.appendChild(generateAudio.wrap);
  optionsBody.appendChild(voiceStyle.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { imageUrl, prompt, script, voiceStyle, generateAudio };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let img;
      try {
        img = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload a photo');
        throw new FieldValidationError('imageUrl', 'Please upload a photo');
      }
      if (!img) {
        imageUrl.setError('Please upload a photo');
        throw new FieldValidationError('imageUrl', 'Please upload a photo');
      }

      const out = { imageUrl: img };

      const promptVal = prompt.getTrimmed();
      if (promptVal) out.prompt = promptVal;

      const scriptVal = script.getTrimmed();
      if (scriptVal) out.text = scriptVal;

      out.generateAudio = generateAudio.getValue();
      out.voiceStyle = voiceStyle.getValue();

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
