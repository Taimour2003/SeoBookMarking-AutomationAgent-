import { createMediaField, createSelectField, createTextInputField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const PRESETS = [
  { value: 'white_studio', label: 'White Studio' },
  { value: 'gray_studio', label: 'Gray Studio' },
  { value: 'black_studio', label: 'Black Studio' },
  { value: 'marble_surface', label: 'Marble Surface' },
  { value: 'wooden_table', label: 'Wooden Table' },
  { value: 'gradient_soft', label: 'Soft Gradient' },
  { value: 'outdoor_natural', label: 'Outdoor Natural' },
  { value: 'lifestyle_modern', label: 'Modern Lifestyle' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Product image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the product image to process.',
  });

  const preset = createSelectField({
    label: 'Background preset',
    id: 'preset',
    required: false,
    options: PRESETS,
    defaultValue: 'white_studio',
  });

  const backgroundStyle = createTextInputField({
    label: 'Custom background',
    id: 'backgroundStyle',
    required: false,
    placeholder: 'e.g., tropical beach, luxury showroom',
    help: 'Overrides preset if provided.',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(preset.wrap);
  moreBody.appendChild(backgroundStyle.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { imageUrl, preset, backgroundStyle };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let img;
      try {
        img = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload a product image');
        throw new FieldValidationError('imageUrl', 'Please upload a product image');
      }

      if (!img) {
        imageUrl.setError('Please upload a product image');
        throw new FieldValidationError('imageUrl', 'Please upload a product image');
      }

      const out = {
        imageUrl: img,
        preset: preset.getValue(),
      };

      const custom = backgroundStyle.getTrimmed();
      if (custom) out.backgroundStyle = custom;

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
