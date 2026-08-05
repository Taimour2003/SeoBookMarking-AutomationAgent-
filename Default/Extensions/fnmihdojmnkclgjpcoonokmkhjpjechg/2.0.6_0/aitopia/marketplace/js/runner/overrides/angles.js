import { createMediaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const ANGLE_PRESETS = [
  { value: '3 Angles (Front, Left 45, Right 45)', label: '3 Angles' },
  { value: '5 Angles (Front, Left, Right, Back excluded)', label: '5 Angles' },
  { value: '8 Angles (Complete Coverage)', label: '8 Angles' },
];

const RESOLUTIONS = [
  { value: '768x768', label: '768x768' },
  { value: '512x512', label: '512x512' },
  { value: '1024x1024', label: '1024x1024' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the image to generate angle views from.',
  });

  const anglePreset = createSelectField({
    label: 'Angles',
    id: 'anglePreset',
    required: false,
    options: ANGLE_PRESETS,
    defaultValue: '3 Angles (Front, Left 45, Right 45)',
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    options: RESOLUTIONS,
    defaultValue: '768x768',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(anglePreset.wrap);
  row1.appendChild(resolution.wrap);
  moreBody.appendChild(row1);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { imageUrl, anglePreset, resolution };

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

      return {
        imageUrl: img,
        anglePreset: anglePreset.getValue(),
        resolution: resolution.getValue(),
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
