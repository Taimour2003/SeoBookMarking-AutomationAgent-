import { createTextAreaField, createTextInputField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const concept = createTextAreaField({
    label: 'Concept to illustrate',
    id: 'concept',
    required: true,
    rows: 3,
    placeholder: 'Describe the concept or idea...',
    help: 'The main idea you want to turn into an illustration.',
  });

  const style = createTextInputField({
    label: 'Art style',
    id: 'style',
    required: false,
    placeholder: 'e.g., watercolor, minimalist, vintage...',
    help: 'The artistic style for the illustration.',
  });

  container.appendChild(concept.wrap);

  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(style.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { concept, style };

  return {
    getValues: async () => {
      concept.clearError();

      const conceptVal = concept.getTrimmed();
      if (!conceptVal) {
        concept.setError('Please enter a concept to illustrate');
        throw new FieldValidationError('concept', 'Please enter a concept to illustrate');
      }

      const out = { concept: conceptVal };
      const styleVal = style.getTrimmed();
      if (styleVal) out.style = styleVal;
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
