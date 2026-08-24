import { createTextAreaField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const script = createTextAreaField({
    label: 'Topic or script',
    id: 'script',
    required: true,
    rows: 4,
    placeholder: 'e.g., "5 morning habits that will change your life" or "Satisfying cake decorating process"',
    help: 'Describe the theme or script for your short video.',
  });

  container.appendChild(script.wrap);

  const fieldRefs = { script };

  return {
    getValues: async () => {
      script.clearError();

      const scriptVal = script.getTrimmed();
      if (!scriptVal) {
        script.setError('Please enter a topic or script');
        throw new FieldValidationError('script', 'Please enter a topic or script');
      }
      return { script: scriptVal };
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
