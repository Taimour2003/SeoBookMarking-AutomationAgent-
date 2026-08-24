import { createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const STYLES = [
  { value: 'Classic/Traditional', label: 'Classic/Traditional' },
  { value: 'Sarcastic', label: 'Sarcastic' },
  { value: 'Wholesome', label: 'Wholesome' },
  { value: 'Dark Humor', label: 'Dark Humor' },
  { value: 'Surreal/Absurd', label: 'Surreal/Absurd' },
  { value: 'Relatable', label: 'Relatable' },
  { value: 'Meta/Self-aware', label: 'Meta/Self-aware' },
];

const FORMATS = [
  { value: 'Any Format', label: 'Any Format' },
  { value: 'Top/Bottom Text', label: 'Top/Bottom Text' },
  { value: 'Single Caption', label: 'Single Caption' },
  { value: 'Multi-panel', label: 'Multi-panel' },
  { value: 'Reaction Image', label: 'Reaction Image' },
];

const AUDIENCES = [
  { value: 'General', label: 'General' },
  { value: 'Tech/Programming', label: 'Tech/Programming' },
  { value: 'Gaming', label: 'Gaming' },
  { value: 'Work/Office', label: 'Work/Office' },
  { value: 'Students', label: 'Students' },
  { value: 'Parents', label: 'Parents' },
  { value: 'Millennials/Gen Z', label: 'Millennials/Gen Z' },
];

const MEME_COUNTS = [
  { value: '3', label: '3' },
  { value: '5', label: '5' },
  { value: '8', label: '8' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextAreaField({
    label: 'Topic',
    id: 'topic',
    required: true,
    rows: 3,
    placeholder: 'Describe your meme idea, situation, or theme...',
  });

  const style = createSelectField({
    label: 'Style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'Classic/Traditional',
  });

  const format = createSelectField({
    label: 'Format',
    id: 'format',
    required: false,
    options: FORMATS,
    defaultValue: 'Any Format',
  });

  const audience = createSelectField({
    label: 'Audience',
    id: 'audience',
    required: false,
    options: AUDIENCES,
    defaultValue: 'General',
  });

  const memeCount = createSelectField({
    label: 'Count',
    id: 'memeCount',
    required: false,
    options: MEME_COUNTS,
    defaultValue: '3',
  });

  // Main fields
  container.appendChild(topic.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(style.wrap);
  moreBody.appendChild(format.wrap);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(audience.wrap);
  row2.appendChild(memeCount.wrap);
  moreBody.appendChild(row2);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, style, format, audience, memeCount };

  return {
    getValues: async () => {
      topic.clearError();

      const t = topic.getTrimmed();
      if (!t) {
        topic.setError('Please enter a topic');
        throw new FieldValidationError('topic', 'Please enter a topic');
      }

      return {
        topic: t,
        style: style.getValue(),
        format: format.getValue(),
        audience: audience.getValue(),
        memeCount: memeCount.getValue(),
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
