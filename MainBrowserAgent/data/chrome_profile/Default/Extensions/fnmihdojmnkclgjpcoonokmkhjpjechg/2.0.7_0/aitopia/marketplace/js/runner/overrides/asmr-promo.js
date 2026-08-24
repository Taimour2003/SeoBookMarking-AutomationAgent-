import { createMediaField, createTextAreaField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const VOICE_STYLES = [
  { value: 'Whisper', label: 'Whisper' },
  { value: 'Soft', label: 'Soft' },
  { value: 'Gentle', label: 'Gentle' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Product image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the product image for ASMR promo.',
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
    rows: 4,
    placeholder: 'Optional narration script for the video...',
    help: 'If provided, can be used for TTS narration.',
  });

  const voiceStyle = createSelectField({
    label: 'Voice style',
    id: 'voiceStyle',
    required: false,
    options: VOICE_STYLES,
    defaultValue: 'Whisper',
  });

  const generateAudio = createCheckboxField({
    label: 'Generate narration',
    id: 'generateAudio',
    help: 'Create TTS audio from the script.',
    defaultChecked: false,
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(prompt.wrap);
  moreBody.appendChild(script.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(voiceStyle.wrap);
  row1.appendChild(window.document.createElement('div')); // spacer
  moreBody.appendChild(row1);

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

      let image;
      try {
        image = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }
      if (!image) {
        imageUrl.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }

      const out = {
        imageUrl: image,
        voiceStyle: voiceStyle.getValue(),
        generateAudio: generateAudio.getValue(),
      };

      const promptVal = prompt.getTrimmed();
      if (promptVal) out.prompt = promptVal;

      const s = script.getTrimmed();
      if (s) out.text = s;

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
