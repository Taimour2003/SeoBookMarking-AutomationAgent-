import { createTextInputField, createTextAreaField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const question = createTextInputField({
    label: 'Question',
    id: 'question',
    required: true,
    placeholder: 'Ask a question about your data...',
  });

  const context = createTextAreaField({
    label: 'Data context',
    id: 'context',
    required: false,
    placeholder: 'Paste your data or provide context here...',
    rows: 6,
  });

  // Main fields
  container.appendChild(question.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(context.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { question, context };

  return {
    getValues: async () => {
      question.clearError();

      const q = question.getTrimmed();
      if (!q) {
        question.setError('Please enter a question');
        throw new FieldValidationError('question', 'Please enter a question');
      }

      const values = {
        question: q,
      };

      const ctx = context.getTrimmed();
      if (ctx) values.context = ctx;

      return values;
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
