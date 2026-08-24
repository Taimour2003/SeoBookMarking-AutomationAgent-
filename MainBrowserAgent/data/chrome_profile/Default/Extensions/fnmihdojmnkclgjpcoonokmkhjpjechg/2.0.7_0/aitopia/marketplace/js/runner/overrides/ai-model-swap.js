import { createMediaField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const targetImage = createMediaField({
    label: 'Image',
    id: 'targetImage',
    required: true,
    kind: 'image',
    help: '',
  });

  const sourceImage = createMediaField({
    label: 'New reference',
    id: 'sourceImage',
    required: true,
    kind: 'image',
    help: '',
  });

  const pairRow = document.createElement('div');
  pairRow.className = 'grid grid-cols-2 gap-3';
  pairRow.appendChild(targetImage.wrap);
  pairRow.appendChild(sourceImage.wrap);
  container.appendChild(pairRow);

  const fieldRefs = { targetImage, sourceImage };

  return {
    getValues: async () => {
      targetImage.clearError();
      sourceImage.clearError();

      let hasError = false;

      let target;
      try {
        target = await targetImage.getValue();
      } catch (err) {
        target = null;
      }
      if (!target) {
        targetImage.setError('Please upload a product photo');
        hasError = true;
      }

      let source;
      try {
        source = await sourceImage.getValue();
      } catch (err) {
        source = null;
      }
      if (!source) {
        sourceImage.setError('Please upload a reference photo');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      return { targetImage: target, sourceImage: source };
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
