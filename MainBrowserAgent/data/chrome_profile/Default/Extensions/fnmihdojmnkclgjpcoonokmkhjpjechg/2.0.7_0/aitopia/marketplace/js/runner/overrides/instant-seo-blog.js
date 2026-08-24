import { createTextAreaField, createTextInputField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const TONES = [
  { value: 'Professional', label: 'Professional' },
  { value: 'Conversational', label: 'Conversational' },
  { value: 'Educational', label: 'Educational' },
  { value: 'Persuasive', label: 'Persuasive' },
  { value: 'Entertaining', label: 'Entertaining' },
];

const WORD_COUNTS = [
  { value: '800-1200 (Medium)', label: 'Medium (800-1200)' },
  { value: '500-800 (Short)', label: 'Short (500-800)' },
  { value: '1200-1800 (Long)', label: 'Long (1200-1800)' },
  { value: '1800+ (Comprehensive)', label: 'Comprehensive (1800+)' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextAreaField({
    label: 'Topic',
    id: 'topic',
    required: true,
    rows: 3,
    placeholder: 'Blog topic or title idea - be specific about what you want to cover...',
  });

  const keywords = createTextInputField({
    label: 'Keywords',
    id: 'keywords',
    required: false,
    placeholder: 'Target keywords (comma-separated)',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: TONES,
    defaultValue: 'Professional',
  });

  const wordCount = createSelectField({
    label: 'Word count',
    id: 'wordCount',
    required: false,
    options: WORD_COUNTS,
    defaultValue: '800-1200 (Medium)',
  });

  // Main fields
  container.appendChild(topic.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(keywords.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(tone.wrap);
  row1.appendChild(wordCount.wrap);
  moreBody.appendChild(row1);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, keywords, tone, wordCount };

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
        tone: tone.getValue(),
        wordCount: wordCount.getValue(),
      };

      const kw = keywords.getTrimmed();
      if (kw) out.keywords = kw;

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
