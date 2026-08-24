import { createTextInputField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const SPREADS = [
  { value: 'Single Card', label: 'Single Card' },
  { value: 'Three Card', label: 'Three Card' },
  { value: 'Five Card', label: 'Five Card' },
  { value: 'Seven Card', label: 'Seven Card' },
  { value: 'Celtic Cross', label: 'Celtic Cross' },
  { value: 'Horseshoe', label: 'Horseshoe' },
  { value: 'Relationship', label: 'Relationship' },
  { value: 'Career Path', label: 'Career Path' },
  { value: 'Past Life', label: 'Past Life' },
  { value: 'Year Ahead', label: 'Year Ahead' },
  { value: 'Mind Body Spirit', label: 'Mind Body Spirit' },
  { value: 'Chakra', label: 'Chakra' },
  { value: 'Decision Making', label: 'Decision Making' },
  { value: 'Full Moon', label: 'Full Moon' },
  { value: 'New Beginnings', label: 'New Beginnings' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const question = createTextInputField({
    label: 'Your question',
    id: 'question',
    required: true,
    placeholder: 'What would you like guidance on?',
  });

  const spread = createSelectField({
    label: 'Spread type',
    id: 'spread',
    required: false,
    options: SPREADS,
    defaultValue: 'Three Card',
  });

  // Main fields
  container.appendChild(question.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(spread.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { question, spread };

  return {
    getValues: async () => {
      question.clearError();

      const q = question.getTrimmed();
      if (!q) {
        question.setError('Please enter your question');
        throw new FieldValidationError('question', 'Please enter your question');
      }

      return {
        question: q,
        spread: spread.getValue(),
      };
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
