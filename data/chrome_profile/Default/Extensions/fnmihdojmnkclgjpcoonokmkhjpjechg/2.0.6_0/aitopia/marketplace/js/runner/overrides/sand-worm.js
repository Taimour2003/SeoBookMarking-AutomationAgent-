import { createMediaField, createTextAreaField, createSelectField, createNumberField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Photo',
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
    placeholder: 'Describe what should happen…',
    help: 'Tip: include an action (emerging / chasing / riding) for stronger motion.',
  });

  // Legacy "Model" dropdown removed - model selection now handled by global Model Selector
  // The global selector provides: Kling 2.5 Turbo, Hailuo, Wan, etc.

  const duration = createSelectField({
    label: 'Duration',
    id: 'duration',
    required: false,
    options: [
      { value: '5', label: '5 seconds' },
      { value: '10', label: '10 seconds' },
    ],
    defaultValue: '5',
  });

  const strength = createNumberField({
    label: 'Strength',
    id: 'strength',
    required: false,
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.8,
    help: '0 = subtle, 1 = intense.',
  });

  const advanced = document.createElement('details');
  advanced.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  advanced.appendChild(summary);
  const advancedBody = document.createElement('div');
  advancedBody.className = 'space-y-3';
  advancedBody.appendChild(prompt.wrap);
  advancedBody.appendChild(duration.wrap);
  advancedBody.appendChild(strength.wrap);
  advanced.appendChild(advancedBody);

  container.appendChild(imageUrl.wrap);
  container.appendChild(advanced);

  const fieldRefs = { imageUrl, prompt, duration, strength };

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

      const promptText = prompt.getTrimmed();
      const strengthVal = strength.getNumber();
      const durationNum = Number(duration.getValue());

      // Model is now selected via the global Model Selector, not this override
      const out = {
        imageUrl: img,
        duration: Number.isFinite(durationNum) ? durationNum : 5,
      };

      if (promptText) out.prompt = promptText;
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
