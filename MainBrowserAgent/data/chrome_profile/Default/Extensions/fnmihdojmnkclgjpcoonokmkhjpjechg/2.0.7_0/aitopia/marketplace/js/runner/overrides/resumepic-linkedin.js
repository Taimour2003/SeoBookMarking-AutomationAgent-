import { createMediaField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Photo',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload your photo to transform into a LinkedIn-ready professional headshot.',
  });

  const enhanceFace = createCheckboxField({
    label: 'Enhance face',
    id: 'enhanceFace',
    required: false,
    defaultChecked: true,
    help: 'Apply face enhancement for a polished look.',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(enhanceFace.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { imageUrl, enhanceFace };

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
        enhanceFace: enhanceFace.getValue(),
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
