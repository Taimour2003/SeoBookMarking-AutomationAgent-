import { createTextInputField, createTextAreaField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const youtubeUrl = createTextInputField({
    label: 'YouTube URL',
    id: 'youtubeUrl',
    required: false,
    placeholder: 'https://youtube.com/watch?v=...',
    help: 'Paste a YouTube video link to analyze.',
  });

  const topic = createTextAreaField({
    label: 'Topic',
    id: 'topic',
    required: false,
    rows: 3,
    placeholder: 'Describe your video topic or paste your script summary...',
    help: 'Required if no YouTube URL is provided.',
  });

  const keywords = createTextInputField({
    label: 'Keywords',
    id: 'keywords',
    required: false,
    placeholder: 'e.g., tutorial, beginner, tips',
    help: 'Target keywords (comma-separated).',
  });

  // Main fields
  container.appendChild(youtubeUrl.wrap);
  container.appendChild(topic.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(keywords.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { youtubeUrl, topic, keywords };

  return {
    getValues: async () => {
      youtubeUrl.clearError();
      topic.clearError();

      const url = youtubeUrl.getTrimmed();
      const t = topic.getTrimmed();

      if (!url && !t) {
        topic.setError('Please provide either a YouTube URL or a topic');
        throw new FieldValidationError('topic', 'Please provide either a YouTube URL or a topic');
      }

      const out = {};

      if (url) out.youtubeUrl = url;
      if (t) out.topic = t;

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
