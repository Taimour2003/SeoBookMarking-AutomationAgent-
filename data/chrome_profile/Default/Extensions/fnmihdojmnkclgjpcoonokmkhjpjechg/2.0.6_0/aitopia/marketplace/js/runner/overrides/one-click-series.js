import { createMediaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const COUNTS = [
  { value: '3', label: '3' },
  { value: '4', label: '4' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
];

const STYLES = [
  { value: 'Realistic', label: 'Realistic' },
  { value: 'Artistic', label: 'Artistic' },
  { value: 'Minimalist', label: 'Minimalist' },
  { value: 'Vibrant', label: 'Vibrant' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Creative', label: 'Creative' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const image = createMediaField({
    label: 'Source image',
    id: 'image',
    required: true,
    kind: 'image',
    help: 'Upload an image to create variations from.',
  });

  const count = createSelectField({
    label: 'Count',
    id: 'count',
    required: false,
    options: COUNTS,
    defaultValue: '3',
  });

  const style = createSelectField({
    label: 'Style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'Realistic',
  });

  // Main fields
  container.appendChild(image.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(count.wrap);
  row1.appendChild(style.wrap);
  moreBody.appendChild(row1);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { image, count, style };

  return {
    getValues: async () => {
      image.clearError();

      let img;
      try {
        img = await image.getValue();
      } catch (err) {
        img = null;
      }
      if (!img) {
        image.setError('Please upload a source image');
        throw new FieldValidationError('image', 'Please upload a source image');
      }

      return {
        image: img,
        count: count.getValue(),
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
