import { createMediaField, createTextAreaField, FieldValidationError } from './ui.js';

export async function render({ container, remix }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Source image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the image to transform.',
  });

  const styleImageUrl = createMediaField({
    label: 'Style reference image (optional)',
    id: 'styleImageUrl',
    required: false,
    kind: 'image',
    help: 'Upload a second image to clone its style.',
  });

  const targetStyle = createTextAreaField({
    label: 'Target style (fallback)',
    id: 'targetStyle',
    required: false,
    rows: 2,
    placeholder: 'e.g., minimalist luxury editorial',
    help: 'Used when no style reference image is provided.',
  });

  container.appendChild(imageUrl.wrap);
  container.appendChild(styleImageUrl.wrap);

  const moreOptions = document.createElement('details');
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'space-y-4';
  body.appendChild(targetStyle.wrap);
  moreOptions.appendChild(body);
  container.appendChild(moreOptions);

  const rd = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  if (rd) {
    if (typeof rd.imageUrl === 'string' && imageUrl.setValue) imageUrl.setValue(rd.imageUrl);
    if (typeof rd.styleImageUrl === 'string' && styleImageUrl.setValue) styleImageUrl.setValue(rd.styleImageUrl);
    if (typeof rd.targetStyle === 'string' && targetStyle.setValue) targetStyle.setValue(rd.targetStyle);
  }

  const fieldRefs = { imageUrl, styleImageUrl, targetStyle };

  return {
    getValues: async () => {
      imageUrl.clearError();
      styleImageUrl.clearError();
      targetStyle.clearError();

      let source;
      try {
        source = await imageUrl.getValue();
      } catch {
        source = null;
      }

      if (!source) {
        imageUrl.setError('Please upload a source image');
        throw new FieldValidationError('imageUrl', 'Please upload a source image');
      }

      let styleRef = null;
      try {
        styleRef = await styleImageUrl.getValue();
      } catch {
        styleRef = null;
      }

      const out = { imageUrl: source };
      if (styleRef) out.styleImageUrl = styleRef;

      const textStyle = targetStyle.getTrimmed();
      if (textStyle) {
        out.targetStyle = textStyle;
      } else if (!styleRef) {
        out.targetStyle = 'professional';
      }

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
