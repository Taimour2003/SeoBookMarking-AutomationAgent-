import { createTextAreaField, createSelectField, FieldValidationError } from './ui.js';

const LANGUAGES = [
  { value: 'English', label: 'English' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Dutch', label: 'Dutch' },
  { value: 'Russian', label: 'Russian' },
  { value: 'Chinese', label: 'Chinese' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Arabic', label: 'Arabic' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Turkish', label: 'Turkish' },
  { value: 'Polish', label: 'Polish' },
  { value: 'Swedish', label: 'Swedish' },
  { value: 'Danish', label: 'Danish' },
  { value: 'Norwegian', label: 'Norwegian' },
  { value: 'Finnish', label: 'Finnish' },
  { value: 'Greek', label: 'Greek' },
  { value: 'Hebrew', label: 'Hebrew' },
  { value: 'Thai', label: 'Thai' },
  { value: 'Vietnamese', label: 'Vietnamese' },
  { value: 'Indonesian', label: 'Indonesian' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const subtitles = createTextAreaField({
    label: 'Subtitles',
    id: 'subtitles',
    required: true,
    rows: 10,
    placeholder: '1\n00:00:01,000 --> 00:00:03,000\nHello, welcome to the show!\n\n2\n00:00:04,000 --> 00:00:06,500\nToday we will talk about...',
    help: 'Paste your subtitles in SRT, VTT, or plain text format. Timing will be preserved.',
  });

  const targetLanguage = createSelectField({
    label: 'Translate to',
    id: 'targetLanguage',
    required: true,
    options: LANGUAGES,
    defaultValue: 'English',
  });

  // Main fields
  container.appendChild(subtitles.wrap);
  container.appendChild(targetLanguage.wrap);

  const fieldRefs = { subtitles, targetLanguage };

  return {
    getValues: async () => {
      subtitles.clearError();

      const subs = subtitles.getTrimmed();
      if (!subs) {
        subtitles.setError('Please enter subtitles');
        throw new FieldValidationError('subtitles', 'Please enter subtitles');
      }

      return {
        subtitles: subs,
        targetLanguage: targetLanguage.getValue(),
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
