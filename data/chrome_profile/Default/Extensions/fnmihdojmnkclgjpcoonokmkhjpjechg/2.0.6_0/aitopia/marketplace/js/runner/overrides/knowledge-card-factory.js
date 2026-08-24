import { createTextInputField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const AUDIENCES = [
  { value: '', label: 'Auto' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
  { value: 'kids', label: 'Kids' },
  { value: 'professionals', label: 'Professionals' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextInputField({
    label: 'Topic',
    id: 'topic',
    required: true,
    placeholder: 'e.g., Photosynthesis, Machine Learning, World War II...',
  });

  const audience = createSelectField({
    label: 'Target audience',
    id: 'audience',
    required: false,
    options: AUDIENCES,
    defaultValue: '',
  });

  // Main fields
  container.appendChild(topic.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(audience.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, audience };

  return {
    getValues: async () => {
      topic.clearError();

      const t = topic.getTrimmed();
      if (!t) {
        topic.setError('Please enter a topic');
        throw new FieldValidationError('topic', 'Please enter a topic');
      }

      const values = {
        topic: t,
      };

      const a = audience.getValue();
      if (a) values.audience = a;

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
