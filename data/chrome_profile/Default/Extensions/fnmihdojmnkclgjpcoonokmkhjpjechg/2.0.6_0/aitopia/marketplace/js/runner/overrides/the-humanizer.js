import { createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const TONES = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'academic', label: 'Academic' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const text = createTextAreaField({
    label: 'Text to humanize',
    id: 'text',
    required: true,
    rows: 6,
    placeholder: 'Paste AI-generated text here...',
    help: 'The text will be rewritten to sound more natural and human.',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: TONES,
    defaultValue: 'conversational',
  });

  // Main fields
  container.appendChild(text.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(tone.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { text, tone };

  return {
    getValues: async () => {
      text.clearError();

      const t = text.getTrimmed();
      if (!t) {
        text.setError('Please enter text to humanize');
        throw new FieldValidationError('text', 'Please enter text to humanize');
      }

      return {
        text: t,
        tone: tone.getValue(),
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
