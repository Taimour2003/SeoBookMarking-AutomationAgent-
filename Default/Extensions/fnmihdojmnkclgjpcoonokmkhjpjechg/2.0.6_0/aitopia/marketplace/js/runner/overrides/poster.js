import { createMediaField, createTextAreaField, createSelectField, FieldValidationError } from './ui.js';

const POSTER_STYLES = [
  { value: 'movie', label: 'Movie' },
  { value: 'product', label: 'Product' },
  { value: 'concert', label: 'Concert' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the image for the poster.',
  });

  const title = createTextAreaField({
    label: 'Poster title',
    id: 'title',
    required: false,
    rows: 2,
    placeholder: 'Enter the title text for the poster...',
    help: 'The title text that will appear on the poster.',
  });

  const style = createSelectField({
    label: 'Poster style',
    id: 'style',
    required: false,
    options: POSTER_STYLES,
    defaultValue: 'movie',
    help: 'Choose the poster style.',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(title.wrap);
  optionsBody.appendChild(style.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { imageUrl, title, style };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let img;
      try {
        img = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }
      if (!img) {
        imageUrl.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }

      const out = { imageUrl: img };

      const titleVal = title.getTrimmed();
      if (titleVal) out.title = titleVal;

      out.style = style.getValue();

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
