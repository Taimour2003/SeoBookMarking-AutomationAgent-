import { createMediaField, createTextAreaField, createSelectField, createNumberField, FieldValidationError } from './ui.js';

const STICKER_STYLES = [
  { value: 'Classic Chibi', label: 'Classic Chibi' },
  { value: 'Anime', label: 'Anime' },
  { value: 'Cartoon', label: 'Cartoon' },
  { value: 'Emoji style', label: 'Emoji style' },
];

const EXPRESSIONS = [
  { value: 'Happy', label: 'Happy' },
  { value: 'Sad', label: 'Sad' },
  { value: 'Angry', label: 'Angry' },
  { value: 'Surprised', label: 'Surprised' },
  { value: 'Love', label: 'Love' },
  { value: 'Cool', label: 'Cool' },
  { value: 'Sleepy', label: 'Sleepy' },
  { value: 'Confused', label: 'Confused' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Photo',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: '',
  });

  const stickerStyle = createSelectField({
    label: 'Sticker style',
    id: 'sticker_style',
    required: false,
    options: STICKER_STYLES,
    defaultValue: 'Classic Chibi',
  });

  const packSize = createSelectField({
    label: 'Sticker count',
    id: 'pack_size',
    required: false,
    help: 'The provider currently returns up to 4 stickers per run.',
    options: [
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '3', label: '3' },
      { value: '4', label: '4 (max)' },
    ],
    defaultValue: '4',
  });

  const expressions = createSelectField({
    label: 'Expression',
    id: 'expressions',
    required: false,
    options: EXPRESSIONS,
    defaultValue: 'Happy',
    help: 'Select the expression you want for the sticker.',
  });

  const prompt = createTextAreaField({
    label: 'Extra prompt (optional)',
    id: 'prompt',
    required: false,
    rows: 2,
    placeholder: 'e.g., "studio lighting, clean sticker sheet"',
  });

  const strength = createNumberField({
    label: 'Strength',
    id: 'strength',
    required: false,
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.8,
    help: '0 = subtle, 1 = strong.',
  });

  const advanced = document.createElement('details');
  advanced.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  advanced.appendChild(summary);
  const advancedBody = document.createElement('div');
  advancedBody.className = 'space-y-3';
  advancedBody.appendChild(stickerStyle.wrap);
  advancedBody.appendChild(packSize.wrap);
  advancedBody.appendChild(expressions.wrap);
  advancedBody.appendChild(prompt.wrap);
  advancedBody.appendChild(strength.wrap);
  advanced.appendChild(advancedBody);

  container.appendChild(imageUrl.wrap);
  container.appendChild(advanced);

  const fieldRefs = { imageUrl, stickerStyle, packSize, expressions, prompt, strength };

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

      const selectedExpression = expressions.getValue();
      const promptText = prompt.getTrimmed();
      const strengthVal = strength.getNumber();

      const out = {
        imageUrl: img,
        sticker_style: stickerStyle.getValue(),
        pack_size: packSize.getValue(),
        expressions: selectedExpression || undefined,
      };

      if (promptText) out.prompt = promptText;
      if (Number.isFinite(strengthVal)) out.strength = Math.max(0, Math.min(1, strengthVal));

      // Remove undefined keys (keeps payload clean).
      for (const k of Object.keys(out)) {
        if (out[k] === undefined) delete out[k];
      }
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
