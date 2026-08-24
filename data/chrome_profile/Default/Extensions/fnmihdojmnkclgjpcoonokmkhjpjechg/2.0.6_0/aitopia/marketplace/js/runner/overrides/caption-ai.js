import { createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const PLATFORMS = [
  { value: 'All Platforms', label: 'All Platforms' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Twitter/X', label: 'Twitter/X' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'YouTube', label: 'YouTube' },
];

const TONES = [
  { value: 'Casual & Fun', label: 'Casual & Fun' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Inspirational', label: 'Inspirational' },
  { value: 'Humorous', label: 'Humorous' },
  { value: 'Educational', label: 'Educational' },
  { value: 'Promotional', label: 'Promotional' },
];

const CAPTION_COUNTS = [
  { value: '3', label: '3' },
  { value: '5', label: '5' },
  { value: '8', label: '8' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const content = createTextAreaField({
    label: 'Content',
    id: 'content',
    required: true,
    rows: 4,
    placeholder: 'Describe your content, product, or what you want to post about...',
  });

  const platform = createSelectField({
    label: 'Platform',
    id: 'platform',
    required: false,
    options: PLATFORMS,
    defaultValue: 'All Platforms',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: TONES,
    defaultValue: 'Casual & Fun',
  });

  const captionCount = createSelectField({
    label: 'Variations',
    id: 'captionCount',
    required: false,
    options: CAPTION_COUNTS,
    defaultValue: '3',
  });

  // Main fields
  container.appendChild(content.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(platform.wrap);
  row1.appendChild(tone.wrap);
  moreBody.appendChild(row1);

  moreBody.appendChild(captionCount.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { content, platform, tone, captionCount };

  return {
    getValues: async () => {
      content.clearError();

      const c = content.getTrimmed();
      if (!c) {
        content.setError('Please enter your content');
        throw new FieldValidationError('content', 'Please enter your content');
      }

      return {
        content: c,
        platform: platform.getValue(),
        tone: tone.getValue(),
        captionCount: captionCount.getValue(),
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
