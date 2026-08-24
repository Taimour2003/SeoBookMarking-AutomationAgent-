import { createTextInputField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextInputField({
    label: 'Topic',
    id: 'topic',
    required: true,
    placeholder: 'e.g., cats, programming, coffee',
    help: 'What do you want puns about?',
  });

  const count = createTextInputField({
    label: 'Number of puns',
    id: 'count',
    required: false,
    placeholder: 'e.g., 5, 10',
  });

  // Main fields
  container.appendChild(topic.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(count.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, count };

  return {
    getValues: async () => {
      topic.clearError();

      const t = topic.getTrimmed();
      if (!t) {
        topic.setError('Please enter a topic');
        throw new FieldValidationError('topic', 'Please enter a topic');
      }

      const out = { topic: t };

      const c = count.getTrimmed();
      if (c) out.count = c;

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
