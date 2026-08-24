import { createMediaField, createSelectField, createCheckboxField, FieldValidationError } from './ui.js';

function getUrlParam(key) {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(key) || null;
  } catch {
    return null;
  }
}

export async function render({ container, remix }) {
  container.innerHTML = '';

  const urlImageUrl = getUrlParam('imageUrl');
  const remixDefaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  const defaultImageUrl = urlImageUrl || remixDefaults?.imageUrl || null;

  const image = createMediaField({
    label: 'Image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: '',
    defaultValue: defaultImageUrl,
  });

  const scale = createSelectField({
    label: 'Upscale factor',
    id: 'scale',
    required: false,
    help: '4× gives the biggest improvement (slower).',
    options: [
      { value: '2', label: '2×' },
      { value: '4', label: '4×' },
    ],
    defaultValue: '4',
  });

  const faceEnhance = createCheckboxField({
    label: 'Face enhance',
    id: 'faceEnhance',
    help: 'Improves faces in portraits (recommended).',
    defaultChecked: true,
  });

  container.appendChild(image.wrap);
  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  moreOptions.open = false;
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'mt-4 space-y-4';
  body.appendChild(scale.wrap);
  body.appendChild(faceEnhance.wrap);
  moreOptions.appendChild(body);
  container.appendChild(moreOptions);

  const fieldRefs = { imageUrl: image, scale, faceEnhance };

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
      if (!imageUrl) {
        image.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }

      const scaleNum = Number(scale.getValue());
      return {
        imageUrl,
        scale: Number.isFinite(scaleNum) ? scaleNum : 4,
        faceEnhance: faceEnhance.getValue(),
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
