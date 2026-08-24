import { createTextInputField, createTextAreaField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextInputField({
    label: 'Course topic',
    id: 'topic',
    required: true,
    placeholder: 'e.g., Introduction to Python, Basic Photography...',
  });

  const objectives = createTextAreaField({
    label: 'Learning objectives',
    id: 'objectives',
    required: false,
    placeholder: 'e.g., Understand basic concepts, Apply techniques, Build a project...',
    rows: 3,
  });

  // Main fields
  container.appendChild(topic.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(objectives.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, objectives };

  return {
    getValues: async () => {
      topic.clearError();

      const t = topic.getTrimmed();
      if (!t) {
        topic.setError('Please enter a course topic');
        throw new FieldValidationError('topic', 'Please enter a course topic');
      }

      const values = {
        topic: t,
      };

      const obj = objectives.getTrimmed();
      if (obj) {
        // Split by newline or comma
        values.objectives = obj.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
      }

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
