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
    help: 'Upload an image to transform into relaxing ASMR content.',
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
    placeholder: 'e.g., "Feel the calming textures and soothing visuals..."',
    help: 'Optional narration script for ASMR voice-over.',
  });

  const voiceStyle = createSelectField({
    label: 'Voice style',
    id: 'voiceStyle',
    required: false,
    options: VOICE_STYLES,
    defaultValue: 'Whisper',
  });

  const generateAudio = createCheckboxField({
    label: 'Generate audio narration',
    id: 'generateAudio',
    help: 'Create ASMR-style voice narration from your script.',
    defaultChecked: false,
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
        imageUrl.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }
      if (!img) {
        imageUrl.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }

      const out = { imageUrl: img };

      const promptVal = prompt.getTrimmed();
      if (promptVal) out.prompt = promptVal;

      const scriptVal = script.getTrimmed();
      if (scriptVal) out.text = scriptVal; // Backend expects `text` now instead of `script` (or we can send both)

      out.voiceStyle = voiceStyle.getValue();
      out.generateAudio = generateAudio.getValue();

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
