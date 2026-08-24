import { createMediaField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const STYLES = [
  { value: 'Clean (White Background)', label: 'Clean (White Background)' },
  { value: 'Dramatic (Dark with Spotlight)', label: 'Dramatic (Dark with Spotlight)' },
  { value: 'Floating (No Ground Contact)', label: 'Floating (No Ground Contact)' },
  { value: 'Reflection (Mirror Surface)', label: 'Reflection (Mirror Surface)' },
  { value: 'Gradient (Smooth Color Transition)', label: 'Gradient (Smooth Color Transition)' },
  { value: 'Spotlight (Focused Light)', label: 'Spotlight (Focused Light)' },
  { value: 'Minimal (Light Gray)', label: 'Minimal (Light Gray)' },
  { value: 'Premium (Luxury Dark/Gold)', label: 'Premium (Luxury Dark/Gold)' },
];

const RESOLUTIONS = [
  { value: '1920x1080', label: '1920x1080' },
  { value: '1080x1080', label: '1080x1080' },
  { value: '1080x1920', label: '1080x1920' },
];

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '1:1', label: '1:1' },
  { value: '9:16', label: '9:16' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Product image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the product image to generate a packshot.',
  });

  const style = createSelectField({
    label: 'Style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'Clean (White Background)',
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    options: RESOLUTIONS,
    defaultValue: '1920x1080',
  });

  const aspectRatio = createSelectField({
    label: 'Aspect ratio',
    id: 'aspectRatio',
    required: false,
    options: ASPECT_RATIOS,
    defaultValue: '16:9',
  });

  const useReflection = createCheckboxField({
    label: 'Use reflection',
    id: 'useReflection',
    defaultChecked: false,
  });

  const useShadow = createCheckboxField({
    label: 'Use shadow',
    id: 'useShadow',
    defaultChecked: true,
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(style.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(resolution.wrap);
  row1.appendChild(aspectRatio.wrap);
  moreBody.appendChild(row1);

  moreBody.appendChild(useReflection.wrap);
  moreBody.appendChild(useShadow.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { imageUrl, style, resolution, aspectRatio, useReflection, useShadow };

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
        style: style.getValue(),
        resolution: resolution.getValue(),
        aspectRatio: aspectRatio.getValue(),
        useReflection: useReflection.getValue(),
        useShadow: useShadow.getValue(),
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
