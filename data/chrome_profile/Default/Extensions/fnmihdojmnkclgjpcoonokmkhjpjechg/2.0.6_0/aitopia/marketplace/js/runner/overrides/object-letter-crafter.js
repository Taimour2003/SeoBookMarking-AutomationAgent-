import { createTextInputField, createTextAreaField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const text = createTextInputField({
    label: 'Text to create',
    id: 'text',
    required: true,
    placeholder: 'Enter the text you want to form...',
    help: 'The letters or words to create from objects.',
  });

  const objects = createTextAreaField({
    label: 'Objects to use',
    id: 'objects',
    required: false,
    rows: 2,
    placeholder: 'e.g., flowers, leaves, stones...',
    help: 'Describe the objects to arrange into letters.',
  });

  container.appendChild(text.wrap);

  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(objects.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { text, objects };

  return {
    getValues: async () => {
      text.clearError();

      const textVal = text.getTrimmed();
      if (!textVal) {
        text.setError('Please enter text to create');
        throw new FieldValidationError('text', 'Please enter text to create');
      }

      const out = { text: textVal };
      const objectsVal = objects.getTrimmed();
      if (objectsVal) out.objects = objectsVal;
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
