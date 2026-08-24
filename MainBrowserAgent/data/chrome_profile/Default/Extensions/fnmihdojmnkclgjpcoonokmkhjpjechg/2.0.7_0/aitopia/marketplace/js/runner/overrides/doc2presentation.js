import { createTextAreaField, createTextInputField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const documentContent = createTextAreaField({
    label: 'Document content',
    id: 'document',
    required: true,
    rows: 8,
    placeholder: 'Paste your document content here...',
    help: 'The content will be transformed into presentation slides.',
  });

  const slideCount = createTextInputField({
    label: 'Number of slides',
    id: 'slideCount',
    required: false,
    placeholder: 'e.g., 5, 10',
    help: 'Target number of slides to generate.',
  });

  // Main fields
  container.appendChild(documentContent.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(slideCount.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { document: documentContent, slideCount };

  return {
    getValues: async () => {
      documentContent.clearError();

      const doc = documentContent.getTrimmed();
      if (!doc) {
        documentContent.setError('Please enter document content');
        throw new FieldValidationError('document', 'Please enter document content');
      }

      const out = { document: doc };

      const count = slideCount.getTrimmed();
      if (count) out.slideCount = count;

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
