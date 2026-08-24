import { createTextInputField, createNumberField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const subject = createTextInputField({
    label: 'Subject',
    id: 'subject',
    required: true,
    placeholder: 'e.g., Spanish vocabulary, Biology terms, History dates...',
  });

  const count = createNumberField({
    label: 'Number of cards',
    id: 'count',
    required: false,
    min: 1,
    max: 50,
    defaultValue: 10,
  });

  // Main fields
  container.appendChild(subject.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(count.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { subject, count };

  return {
    getValues: async () => {
      subject.clearError();

      const s = subject.getTrimmed();
      if (!s) {
        subject.setError('Please enter a subject');
        throw new FieldValidationError('subject', 'Please enter a subject');
      }

      const values = {
        subject: s,
      };

      const c = count.getNumber();
      if (c) values.count = String(c);

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
