import { createTextInputField, createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const PLATFORMS = [
  { value: 'All Platforms', label: 'All Platforms' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Twitter/X', label: 'Twitter/X' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Facebook', label: 'Facebook' },
];

const TONES = [
  { value: 'Casual & Engaging', label: 'Casual & Engaging' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Educational', label: 'Educational' },
  { value: 'Entertaining', label: 'Entertaining' },
  { value: 'Inspirational', label: 'Inspirational' },
];

const POST_COUNTS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const youtubeUrl = createTextInputField({
    label: 'YouTube URL',
    id: 'youtubeUrl',
    required: false,
    placeholder: 'https://youtube.com/watch?v=...',
    help: 'Paste a YouTube video link to analyze.',
  });

  const transcript = createTextAreaField({
    label: 'Transcript',
    id: 'transcript',
    required: false,
    rows: 4,
    placeholder: 'Paste transcript or key points from the video...',
    help: 'Required if no YouTube URL provided.',
  });

  const platform = createSelectField({
    label: 'Platform',
    id: 'platform',
    required: true,
    options: PLATFORMS,
    defaultValue: 'All Platforms',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: TONES,
    defaultValue: 'Casual & Engaging',
  });

  const postCount = createSelectField({
    label: 'Variations',
    id: 'postCount',
    required: false,
    options: POST_COUNTS,
    defaultValue: '1',
  });

  // Main fields
  container.appendChild(transcript.wrap);
  container.appendChild(platform.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(youtubeUrl.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(tone.wrap);
  row1.appendChild(postCount.wrap);
  moreBody.appendChild(row1);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { youtubeUrl, transcript, platform, tone, postCount };

  return {
    getValues: async () => {
      youtubeUrl.clearError();
      transcript.clearError();

      const url = youtubeUrl.getTrimmed();
      const text = transcript.getTrimmed();

      if (!url && !text) {
        transcript.setError('Please provide either a YouTube URL or transcript');
        throw new FieldValidationError('transcript', 'Please provide either a YouTube URL or transcript');
      }

      const out = {
        platform: platform.getValue(),
        tone: tone.getValue(),
        postCount: postCount.getValue(),
      };

      if (url) out.youtubeUrl = url;
      if (text) out.transcript = text;

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
