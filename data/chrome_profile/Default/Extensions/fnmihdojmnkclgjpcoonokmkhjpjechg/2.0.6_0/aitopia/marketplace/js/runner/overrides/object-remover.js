import { createMediaField, createTextAreaField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const image = createMediaField({
    label: 'Image',
    id: 'image',
    required: true,
    kind: 'image',
  });

  const prompt = createTextAreaField({
    label: 'What should we remove?',
    id: 'prompt',
    required: true,
    rows: 4,
    placeholder: 'e.g., "remove the person in the background"',
  });

  container.appendChild(image.wrap);
  container.appendChild(prompt.wrap);

  const fieldRefs = { image, prompt };

  return {
    getValues: async () => {
      image.clearError();
      prompt.clearError();

      let imageValue;
      try {
        imageValue = await image.getValue();
      } catch (err) {
        image.setError('Please upload an image');
        throw new FieldValidationError('image', 'Please upload an image');
      }

      const promptValue = prompt.getTrimmed();
      if (!promptValue) {
        prompt.setError('Please describe what should be removed');
        throw new FieldValidationError('prompt', 'Please describe what should be removed');
      }

      return {
        image: imageValue,
        prompt: promptValue,
      };
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
