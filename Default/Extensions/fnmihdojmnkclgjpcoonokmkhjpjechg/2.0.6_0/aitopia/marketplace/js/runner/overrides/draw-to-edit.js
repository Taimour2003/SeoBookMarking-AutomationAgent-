import { createMediaField, createTextAreaField, createSelectField, FieldValidationError } from './ui.js';

const STYLES = [
  { value: 'realistic', label: 'Realistic' },
  { value: 'anime', label: 'Anime' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'oil painting', label: 'Oil Painting' },
  { value: 'digital art', label: 'Digital Art' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Sketch',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload your sketch or drawing.',
  });

  const prompt = createTextAreaField({
    label: 'Description',
    id: 'prompt',
    required: false,
    rows: 3,
    placeholder: 'Describe what you want the result to look like...',
    help: 'Describe the desired output in detail.',
  });

  const style = createSelectField({
    label: 'Style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'realistic',
    help: 'Choose the artistic style for the output.',
  });

  container.appendChild(imageUrl.wrap);
  container.appendChild(prompt.wrap);
  // container.appendChild(style.wrap);

  const fieldRefs = { imageUrl, prompt, style };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let img;
      try {
        img = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload a sketch');
        throw new FieldValidationError('imageUrl', 'Please upload a sketch');
      }
      if (!img) {
        imageUrl.setError('Please upload a sketch');
        throw new FieldValidationError('imageUrl', 'Please upload a sketch');
      }

      return {
        imageUrl: img,
        prompt: prompt.getTrimmed(),
        style: style.getValue(),
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
