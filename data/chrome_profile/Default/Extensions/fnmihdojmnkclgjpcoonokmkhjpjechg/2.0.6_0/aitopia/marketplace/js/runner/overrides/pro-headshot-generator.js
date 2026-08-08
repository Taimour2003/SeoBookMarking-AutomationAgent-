import { createMediaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const BACKGROUND_STYLES = [
  { value: 'soft gray gradient studio background', label: 'Soft Gray Gradient' },
  { value: 'white studio background', label: 'White Studio' },
  { value: 'dark blue professional background', label: 'Dark Blue Professional' },
  { value: 'office bokeh background', label: 'Office Bokeh' },
  { value: 'neutral beige background', label: 'Neutral Beige' },
];

const MODES = [
  { value: 'generate', label: 'Generate (best for non-portraits)' },
  { value: 'edit', label: 'Edit (preserves framing)' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Photo',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload your photo to transform into a professional headshot.',
  });

  const backgroundStyle = createSelectField({
    label: 'Background style',
    id: 'backgroundStyle',
    required: false,
    options: BACKGROUND_STYLES,
    defaultValue: 'soft gray gradient studio background',
  });

  const mode = createSelectField({
    label: 'Mode',
    id: 'mode',
    required: false,
    options: MODES,
    defaultValue: 'generate',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(backgroundStyle.wrap);
  moreBody.appendChild(mode.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { imageUrl, backgroundStyle, mode };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let img;
      try {
        img = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload a photo');
        throw new FieldValidationError('imageUrl', 'Please upload a photo');
      }

      if (!img) {
        imageUrl.setError('Please upload a photo');
        throw new FieldValidationError('imageUrl', 'Please upload a photo');
      }

      return {
        imageUrl: img,
        backgroundStyle: backgroundStyle.getValue(),
        mode: mode.getValue(),
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
