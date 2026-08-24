import { createMediaField, createTextAreaField, createTextInputField, createNumberField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: '',
  });

  const title = createTextInputField({
    label: 'Card text',
    id: 'title',
    required: false,
    placeholder: 'e.g. Champion, Winner, #1',
    help: 'Text displayed on the victory card (e.g. Champion, Winner).',
  });

  const prompt = createTextAreaField({
    label: 'Additional details',
    id: 'prompt',
    required: false,
    rows: 2,
    placeholder: 'Describe additional style details...',
    help: 'Optional prompt to customize the victory effect.',
  });

  const strength = createNumberField({
    label: 'Effect strength',
    id: 'strength',
    required: false,
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.52,
    help: '0 = subtle, 1 = intense effect.',
  });

  container.appendChild(imageUrl.wrap);
  container.appendChild(title.wrap);

  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(prompt.wrap);
  optionsBody.appendChild(strength.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { imageUrl, title, prompt, strength };

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
      const titleVal = title.getTrimmed();
      if (titleVal) out.title = titleVal;
      const promptVal = prompt.getTrimmed();
      if (promptVal) out.prompt = promptVal;
      const strengthVal = strength.getNumber();
      if (Number.isFinite(strengthVal)) out.strength = Math.max(0, Math.min(1, strengthVal));
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
