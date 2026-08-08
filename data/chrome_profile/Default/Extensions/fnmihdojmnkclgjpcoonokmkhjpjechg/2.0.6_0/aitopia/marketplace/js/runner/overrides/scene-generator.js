import { createTextAreaField, createTextInputField, createSelectField, FieldValidationError } from './ui.js';

const MOODS = [
  { value: '', label: 'None' },
  { value: 'peaceful', label: 'Peaceful' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'dark', label: 'Dark' },
  { value: 'cheerful', label: 'Cheerful' },
  { value: 'melancholic', label: 'Melancholic' },
  { value: 'epic', label: 'Epic' },
  { value: 'serene', label: 'Serene' },
];

const TIMES_OF_DAY = [
  { value: '', label: 'None' },
  { value: 'sunrise', label: 'Sunrise' },
  { value: 'morning', label: 'Morning' },
  { value: 'midday', label: 'Midday' },
  { value: 'golden hour', label: 'Golden Hour' },
  { value: 'sunset', label: 'Sunset' },
  { value: 'dusk', label: 'Dusk' },
  { value: 'night', label: 'Night' },
  { value: 'midnight', label: 'Midnight' },
];

const ASPECT_RATIOS = [
  { value: '1024x768', label: 'Landscape (4:3)' },
  { value: '1024x1024', label: 'Square (1:1)' },
  { value: '768x1024', label: 'Portrait (3:4)' },
  { value: '1280x720', label: 'Widescreen (16:9)' },
  { value: '720x1280', label: 'Vertical (9:16)' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const prompt = createTextAreaField({
    label: 'Scene description',
    id: 'prompt',
    required: true,
    rows: 3,
    placeholder: 'Describe the scene you want to generate...',
    help: 'Detailed description of the scene.',
  });

  const mood = createSelectField({
    label: 'Mood',
    id: 'mood',
    required: false,
    options: MOODS,
    defaultValue: '',
    help: 'Emotional atmosphere of the scene.',
  });

  const timeOfDay = createSelectField({
    label: 'Time of day',
    id: 'timeOfDay',
    required: false,
    options: TIMES_OF_DAY,
    defaultValue: '',
    help: 'Lighting based on time of day.',
  });

  const aspectRatio = createSelectField({
    label: 'Aspect ratio',
    id: 'aspectRatio',
    required: false,
    options: ASPECT_RATIOS,
    defaultValue: '1024x768',
  });

  const negativePrompt = createTextInputField({
    label: 'Avoid',
    id: 'negativePrompt',
    required: false,
    placeholder: 'e.g., blurry, low quality, text',
    help: 'Things to avoid in the generated scene.',
  });

  // Main fields
  container.appendChild(prompt.wrap);
  container.appendChild(mood.wrap);
  container.appendChild(timeOfDay.wrap);

  // More options
  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(aspectRatio.wrap);
  optionsBody.appendChild(negativePrompt.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { prompt, mood, timeOfDay, aspectRatio, negativePrompt };

  return {
    getValues: async () => {
      prompt.clearError();

      const promptVal = prompt.getTrimmed();
      if (!promptVal) {
        prompt.setError('Please enter a scene description');
        throw new FieldValidationError('prompt', 'Please enter a scene description');
      }

      const [width, height] = aspectRatio.getValue().split('x').map(Number);

      const out = {
        prompt: promptVal,
        width,
        height,
      };

      const moodVal = mood.getValue();
      if (moodVal) out.mood = moodVal;

      const timeVal = timeOfDay.getValue();
      if (timeVal) out.timeOfDay = timeVal;

      const negVal = negativePrompt.getTrimmed();
      if (negVal) out.negativePrompt = negVal;

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
