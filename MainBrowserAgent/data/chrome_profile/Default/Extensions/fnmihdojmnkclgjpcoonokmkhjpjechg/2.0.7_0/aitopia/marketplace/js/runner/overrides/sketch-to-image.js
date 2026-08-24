import { createMediaField, createTextAreaField, createTextInputField, createSelectField, createNumberField, FieldValidationError } from './ui.js';

const STYLES = [
  { value: 'realistic', label: 'Realistic' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'anime', label: 'Anime' },
  { value: 'oil_painting', label: 'Oil Painting' },
  { value: 'watercolor', label: 'Watercolor' },
  { value: 'digital_art', label: 'Digital Art' },
  { value: '3d_render', label: '3D Render' },
  { value: 'concept_art', label: 'Concept Art' },
];

const DETAIL_LEVELS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const sketchUrl = createMediaField({
    label: 'Sketch image',
    id: 'sketchUrl',
    required: true,
    kind: 'image',
    help: 'Upload your sketch or drawing.',
  });

  const prompt = createTextAreaField({
    label: 'Description',
    id: 'prompt',
    required: true,
    rows: 3,
    placeholder: 'Describe what you want the final image to look like...',
    help: 'Describe the desired output in detail.',
  });

  const style = createSelectField({
    label: 'Art style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'realistic',
    help: 'Choose the artistic style for the output.',
  });

  const detailLevel = createSelectField({
    label: 'Detail level',
    id: 'detailLevel',
    required: false,
    options: DETAIL_LEVELS,
    defaultValue: 'medium',
  });

  const fidelity = createNumberField({
    label: 'Sketch fidelity',
    id: 'fidelity',
    required: false,
    min: 0,
    max: 1,
    step: 0.1,
    defaultValue: 0.5,
    help: 'How closely to follow your sketch (0 = creative freedom, 1 = strict).',
  });

  const negativePrompt = createTextInputField({
    label: 'Avoid',
    id: 'negativePrompt',
    required: false,
    placeholder: 'e.g., blurry, low quality, distorted',
    help: 'Things to avoid in the output.',
  });

  const colorScheme = createTextInputField({
    label: 'Color palette',
    id: 'colorScheme',
    required: false,
    placeholder: 'e.g., warm tones, blue and gold, pastel',
    help: 'Optional color scheme for the output.',
  });

  // Main fields
  container.appendChild(sketchUrl.wrap);
  container.appendChild(prompt.wrap);
  container.appendChild(style.wrap);

  // More options
  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(detailLevel.wrap);
  optionsBody.appendChild(fidelity.wrap);
  optionsBody.appendChild(negativePrompt.wrap);
  optionsBody.appendChild(colorScheme.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { sketchUrl, prompt, style, detailLevel, fidelity, negativePrompt, colorScheme };

  return {
    getValues: async () => {
      sketchUrl.clearError();
      prompt.clearError();

      let hasError = false;

      let sketch;
      try {
        sketch = await sketchUrl.getValue();
      } catch (err) {
        sketch = null;
      }
      if (!sketch) {
        sketchUrl.setError('Please upload a sketch');
        hasError = true;
      }

      const promptVal = prompt.getTrimmed();
      if (!promptVal) {
        prompt.setError('Please enter a description');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      const out = {
        sketchUrl: sketch,
        prompt: promptVal,
        style: style.getValue(),
      };

      const detailVal = detailLevel.getValue();
      if (detailVal) out.detailLevel = detailVal;

      const fidelityVal = fidelity.getNumber();
      if (fidelityVal !== undefined) out.fidelity = fidelityVal;

      const negVal = negativePrompt.getTrimmed();
      if (negVal) out.negativePrompt = negVal;

      const colorVal = colorScheme.getTrimmed();
      if (colorVal) out.colorScheme = colorVal;

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
