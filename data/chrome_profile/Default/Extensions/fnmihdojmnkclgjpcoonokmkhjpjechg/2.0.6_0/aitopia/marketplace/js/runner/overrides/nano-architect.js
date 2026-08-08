import { createTextAreaField, createTextInputField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const concept = createTextAreaField({
    label: 'Design concept',
    id: 'concept',
    required: true,
    rows: 3,
    placeholder: 'Describe the architectural concept...',
    help: 'The nano/micro-scale architecture idea.',
  });

  const scale = createTextInputField({
    label: 'Scale level',
    id: 'scale',
    required: false,
    placeholder: 'e.g., nanometer, micrometer, molecular...',
    help: 'The scale of the architectural design.',
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
  optionsBody.appendChild(scale.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { concept, scale };

  return {
    getValues: async () => {
      concept.clearError();

      const conceptVal = concept.getTrimmed();
      if (!conceptVal) {
        concept.setError('Please enter a design concept');
        throw new FieldValidationError('concept', 'Please enter a design concept');
      }

      const out = { concept: conceptVal };
      const scaleVal = scale.getTrimmed();
      if (scaleVal) out.scale = scaleVal;
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
