import { createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const PLATFORMS = [
  { value: 'All Platforms', label: 'All Platforms' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Twitter/X', label: 'Twitter/X' },
  { value: 'Facebook', label: 'Facebook' },
];

const DURATIONS = [
  { value: '1 Week', label: '1 Week' },
  { value: '2 Weeks', label: '2 Weeks' },
  { value: '1 Month', label: '1 Month' },
];

const POST_FREQUENCIES = [
  { value: 'Daily', label: 'Daily' },
  { value: '5x per week', label: '5x per week' },
  { value: '3x per week', label: '3x per week' },
  { value: '2x per week', label: '2x per week' },
];

const TONES = [
  { value: 'Casual & Fun', label: 'Casual & Fun' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Educational', label: 'Educational' },
  { value: 'Inspirational', label: 'Inspirational' },
  { value: 'Witty & Humorous', label: 'Witty & Humorous' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const brand = createTextAreaField({
    label: 'Brand',
    id: 'brand',
    required: true,
    rows: 3,
    placeholder: 'Describe your brand, products/services, and target audience...',
  });

  const platforms = createSelectField({
    label: 'Platforms',
    id: 'platforms',
    required: true,
    options: PLATFORMS,
    defaultValue: 'All Platforms',
  });

  const duration = createSelectField({
    label: 'Duration',
    id: 'duration',
    required: false,
    options: DURATIONS,
    defaultValue: '1 Week',
  });

  const postFrequency = createSelectField({
    label: 'Frequency',
    id: 'postFrequency',
    required: false,
    options: POST_FREQUENCIES,
    defaultValue: 'Daily',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: TONES,
    defaultValue: 'Casual & Fun',
  });

  // Main fields
  container.appendChild(brand.wrap);
  container.appendChild(platforms.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(duration.wrap);
  row1.appendChild(postFrequency.wrap);
  moreBody.appendChild(row1);

  moreBody.appendChild(tone.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { brand, platforms, duration, postFrequency, tone };

  return {
    getValues: async () => {
      brand.clearError();

      const b = brand.getTrimmed();
      if (!b) {
        brand.setError('Please enter brand information');
        throw new FieldValidationError('brand', 'Please enter brand information');
      }

      return {
        brand: b,
        platforms: platforms.getValue(),
        duration: duration.getValue(),
        postFrequency: postFrequency.getValue(),
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
