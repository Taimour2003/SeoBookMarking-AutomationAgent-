import { createMediaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const image = createMediaField({
    label: 'Image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: '',
  });

  const format = createSelectField({
    label: 'Output format',
    id: 'format',
    required: false,
    help: 'Choose transparent PNG or JPG with a white background.',
    options: [
      { value: 'PNG (Transparent)', label: 'PNG (Transparent)' },
      { value: 'JPG (White BG)', label: 'JPG (White BG)' },
    ],
    defaultValue: 'PNG (Transparent)',
  });

  container.appendChild(image.wrap);

  const body = document.createElement('div');
  body.className = 'space-y-4';
  body.appendChild(format.wrap);
  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    count: 1,
    defaultOpen: false,
    body,
  }));

  const fieldRefs = { imageUrl: image, format };

  return {
    getValues: async () => {
      image.clearError();

      let imageUrl;
      try {
        imageUrl = await image.getValue();
      } catch (err) {
        image.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }

      return {
        imageUrl,
        format: format.getValue(),
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
