import { createTextInputField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const KEYWORD_COUNTS = [
  { value: '5', label: '5' },
  { value: '10', label: '10' },
  { value: '15', label: '15' },
  { value: '20', label: '20' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextInputField({
    label: 'Topic',
    id: 'topic',
    required: true,
    placeholder: 'Enter a topic or seed keyword to research',
  });

  const industry = createTextInputField({
    label: 'Industry',
    id: 'industry',
    required: false,
    placeholder: 'e.g., Technology, Healthcare, E-commerce',
  });

  const keywordCount = createSelectField({
    label: 'Keywords',
    id: 'keywordCount',
    required: false,
    options: KEYWORD_COUNTS,
    defaultValue: '10',
  });

  // Main fields
  container.appendChild(topic.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(industry.wrap);
  row1.appendChild(keywordCount.wrap);
  moreBody.appendChild(row1);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, industry, keywordCount };

  return {
    getValues: async () => {
      topic.clearError();

      const t = topic.getTrimmed();
      if (!t) {
        topic.setError('Please enter a topic');
        throw new FieldValidationError('topic', 'Please enter a topic');
      }

      const out = {
        topic: t,
        keywordCount: keywordCount.getValue(),
      };

      const ind = industry.getTrimmed();
      if (ind) out.industry = ind;

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
