import { createMediaField, createTextAreaField, createNumberField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Product image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload a product image for core burst effect.',
  });

  const prompt = createTextAreaField({
    label: 'Additional details',
    id: 'prompt',
    required: false,
    rows: 2,
    placeholder: 'Describe additional style details...',
    help: 'Optional prompt to customize the burst effect.',
  });

  const strength = createNumberField({
    label: 'Effect strength',
    id: 'strength',
    required: false,
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.45,
    help: '0 = subtle, 1 = intense effect.',
  });

  container.appendChild(imageUrl.wrap);

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

  const fieldRefs = { imageUrl, prompt, strength };

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
