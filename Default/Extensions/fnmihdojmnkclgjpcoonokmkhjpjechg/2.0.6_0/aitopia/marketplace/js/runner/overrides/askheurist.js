import { createTextAreaField, createTextInputField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const query = createTextAreaField({
    label: 'Question',
    id: 'query',
    required: true,
    placeholder: 'Ask your analytical question...',
    rows: 4,
  });

  const domain = createTextInputField({
    label: 'Domain',
    id: 'domain',
    required: false,
    placeholder: 'e.g., Finance, Marketing, Technology...',
  });

  // Main fields
  container.appendChild(query.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(domain.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { query, domain };

  return {
    getValues: async () => {
      query.clearError();

      const q = query.getTrimmed();
      if (!q) {
        query.setError('Please enter a question');
        throw new FieldValidationError('query', 'Please enter a question');
      }

      const values = {
        query: q,
      };

      const d = domain.getTrimmed();
      if (d) values.domain = d;

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
