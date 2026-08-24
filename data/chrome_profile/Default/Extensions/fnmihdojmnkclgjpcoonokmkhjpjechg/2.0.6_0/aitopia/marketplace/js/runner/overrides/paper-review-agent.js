import { createTextAreaField, createTextInputField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const abstract = createTextAreaField({
    label: 'Paper content',
    id: 'abstract',
    required: true,
    placeholder: 'Paste the paper abstract or full content here...',
    rows: 10,
  });

  const field = createTextInputField({
    label: 'Academic field',
    id: 'field',
    required: false,
    placeholder: 'e.g., Computer Science, Biology, Economics...',
  });

  // Main fields
  container.appendChild(abstract.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(field.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { abstract, field };

  return {
    getValues: async () => {
      abstract.clearError();

      const content = abstract.getTrimmed();
      if (!content) {
        abstract.setError('Please enter paper content');
        throw new FieldValidationError('abstract', 'Please enter paper content');
      }

      const values = {
        abstract: content,
      };

      const f = field.getTrimmed();
      if (f) values.field = f;

      return values;
    },
    setFieldError: (fieldId, message) => {
      const fld = fieldRefs[fieldId];
      if (fld && typeof fld.setError === 'function') {
        fld.setError(message);
      }
    },
  };
}
