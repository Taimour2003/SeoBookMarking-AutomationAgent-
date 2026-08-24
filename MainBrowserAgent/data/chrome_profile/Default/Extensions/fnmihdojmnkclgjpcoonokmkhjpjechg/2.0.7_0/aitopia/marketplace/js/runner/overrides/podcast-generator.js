import { createTextAreaField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const DURATIONS = [
  { value: '5min', label: '5 minutes' },
  { value: '10min', label: '10 minutes' },
  { value: '20min', label: '20 minutes' },
  { value: '30min', label: '30 minutes' },
  { value: '60min', label: '60 minutes' },
];

const STYLES = [
  { value: 'conversational', label: 'Conversational' },
  { value: 'interview', label: 'Interview' },
  { value: 'debate', label: 'Debate' },
  { value: 'educational', label: 'Educational' },
  { value: 'storytelling', label: 'Storytelling' },
];

const TONES = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'serious', label: 'Serious' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextAreaField({
    label: 'Topic',
    id: 'topic',
    required: true,
    rows: 3,
    placeholder: 'e.g., "The future of AI in healthcare" or paste an article...',
    help: 'Describe the topic or paste content to turn into a podcast.',
  });

  const duration = createSelectField({
    label: 'Duration',
    id: 'duration',
    required: false,
    options: DURATIONS,
    defaultValue: '10min',
  });

  const style = createSelectField({
    label: 'Style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'conversational',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: TONES,
    defaultValue: 'casual',
  });

  // NOTE: The following options are currently hidden because:
  // - music mixing is not implemented (no audible effect)
  // - transcript/chapters are not reliably displayed in the current UI
  //
  // const addIntroMusic = createCheckboxField({
  //   label: 'Add intro music',
  //   id: 'addIntroMusic',
  //   defaultChecked: false,
  // });
  //
  // const addOutroMusic = createCheckboxField({
  //   label: 'Add outro music',
  //   id: 'addOutroMusic',
  //   defaultChecked: false,
  // });
  //
  // const addBackgroundMusic = createCheckboxField({
  //   label: 'Add background music',
  //   id: 'addBackgroundMusic',
  //   defaultChecked: false,
  // });
  //
  // const includeTranscript = createCheckboxField({
  //   label: 'Include transcript',
  //   id: 'includeTranscript',
  //   defaultChecked: false,
  // });
  //
  // const includeChapters = createCheckboxField({
  //   label: 'Include chapters',
  //   id: 'includeChapters',
  //   defaultChecked: false,
  // });

  // Main fields
  container.appendChild(topic.wrap);

  // More options
  const settingsRow = document.createElement('div');
  settingsRow.className = 'grid grid-cols-2 gap-4';
  settingsRow.appendChild(duration.wrap);
  settingsRow.appendChild(style.wrap);

  const moreBody = document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(settingsRow);
  moreBody.appendChild(tone.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, duration, style, tone };

  return {
    getValues: async () => {
      topic.clearError();

      const topicVal = topic.getTrimmed();
      if (!topicVal) {
        topic.setError('Please enter a topic');
        throw new FieldValidationError('topic', 'Please enter a topic');
      }

      return {
        topic: topicVal,
        duration: duration.getValue(),
        style: style.getValue(),
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
