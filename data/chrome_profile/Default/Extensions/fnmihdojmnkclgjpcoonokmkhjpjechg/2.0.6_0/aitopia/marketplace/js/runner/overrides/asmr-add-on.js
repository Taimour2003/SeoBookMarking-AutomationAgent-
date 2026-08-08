import { createMediaField, createTextAreaField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const VOICE_STYLES = [
  { value: 'Whisper', label: 'Whisper' },
  { value: 'Soft', label: 'Soft' },
  { value: 'Gentle', label: 'Gentle' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: '',
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
    placeholder: 'e.g., "Watch the smooth texture of this premium product..."',
    help: 'Optional narration script for ASMR voice-over.',
  });

  const generateAudio = createCheckboxField({
    label: 'Generate audio narration',
    id: 'generateAudio',
    help: 'Create ASMR-style voice narration from your script.',
    defaultChecked: false,
  });

  const voiceStyle = createSelectField({
    label: 'Voice style',
    id: 'voiceStyle',
    required: false,
    options: VOICE_STYLES,
    defaultValue: 'Whisper',
  });

  // Main field
  container.appendChild(imageUrl.wrap);

  // More options
  const moreBody = document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(prompt.wrap);
  moreBody.appendChild(script.wrap);
  moreBody.appendChild(voiceStyle.wrap);
  moreBody.appendChild(generateAudio.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { imageUrl, prompt, script, voiceStyle, generateAudio };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let img;
      try {
        img = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload a product image');
        throw new FieldValidationError('imageUrl', 'Please upload a product image');
      }
      if (!img) {
        imageUrl.setError('Please upload a product image');
        throw new FieldValidationError('imageUrl', 'Please upload a product image');
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
