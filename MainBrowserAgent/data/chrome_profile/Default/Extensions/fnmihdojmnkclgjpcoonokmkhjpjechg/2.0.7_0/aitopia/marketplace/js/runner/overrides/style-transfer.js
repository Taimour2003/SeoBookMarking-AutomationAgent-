import { createMediaField, createSelectField, createNumberField, createCheckboxField, createChipGroup, setHidden, FieldValidationError } from './ui.js';

const PRESET_STYLES = [
  'van_gogh',
  'monet',
  'picasso',
  'kandinsky',
  'hokusai',
  'pop_art',
  'watercolor',
  'oil_painting',
  'pencil_sketch',
  'comic_book',
  'anime',
  'pixel_art',
  'neon',
  'vintage',
  'noir',
];

function humanizePreset(value) {
  const s = String(value || '').replace(/_/g, ' ').trim();
  if (!s) return '';
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

export async function render({ container, remix }) {
  container.innerHTML = '';

  const contentImageUrl = createMediaField({
    label: 'Content image',
    id: 'contentImageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the image you want to transform.',
  });

  const mode = createChipGroup({
    label: 'Style source',
    id: 'mode',
    options: [
      { value: 'preset', label: 'Preset style' },
      { value: 'reference', label: 'Reference image' },
    ],
    defaultValue: 'preset',
    help: 'Use a preset, or provide a style reference image.',
  });

  const presetStyle = createSelectField({
    label: 'Preset',
    id: 'presetStyle',
    required: false,
    options: PRESET_STYLES.map(v => ({ value: v, label: humanizePreset(v) })),
    defaultValue: 'van_gogh',
  });

  const styleImageUrl = createMediaField({
    label: 'Style reference image',
    id: 'styleImageUrl',
    required: true,
    kind: 'image',
    help: 'Upload a style image (palette/brushstrokes you want to match).',
  });

  const styleStrength = createNumberField({
    label: 'Style strength',
    id: 'styleStrength',
    required: false,
    min: 0,
    max: 1,
    step: 0.05,
    defaultValue: 0.55,
    help: '0 = subtle, 1 = very strong.',
  });

  const preserveColors = createCheckboxField({
    label: 'Preserve original colors',
    id: 'preserveColors',
    help: 'Keeps the original color palette more intact.',
    defaultChecked: false,
  });

  const preserveText = createCheckboxField({
    label: 'Keep text exactly',
    id: 'preserveText',
    help: 'Prevents gibberish letters by keeping any existing text/logos unchanged.',
    defaultChecked: true,
  });

  const outputSize = createSelectField({
    label: 'Output size',
    id: 'outputSize',
    required: false,
    options: [
      { value: '512', label: '512' },
      { value: '768', label: '768 (recommended)' },
      { value: '1024', label: '1024' },
    ],
    defaultValue: '768',
  });

  const presetWrap = document.createElement('div');
  presetWrap.className = 'space-y-4';
  presetWrap.appendChild(presetStyle.wrap);

  const referenceWrap = document.createElement('div');
  referenceWrap.className = 'space-y-4';
  referenceWrap.appendChild(styleImageUrl.wrap);

  function syncMode() {
    const m = mode.getValue();
    setHidden(presetWrap, m !== 'preset');
    setHidden(referenceWrap, m !== 'reference');
  }
  mode.wrap.querySelectorAll('button').forEach(btn => btn.addEventListener('click', syncMode));

  // Remix: auto-detect mode from defaults
  const remixDefaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  if (remixDefaults) {
    if (typeof remixDefaults.styleImageUrl === 'string' && remixDefaults.styleImageUrl.trim()) {
      mode.setValue('reference');
    }
  }
  syncMode();

  const advanced = document.createElement('details');
  advanced.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  advanced.appendChild(summary);
  const advancedBody = document.createElement('div');
  advancedBody.className = 'space-y-3';
  advancedBody.appendChild(styleStrength.wrap);
  advancedBody.appendChild(preserveColors.wrap);
  advancedBody.appendChild(preserveText.wrap);
  advancedBody.appendChild(outputSize.wrap);
  advanced.appendChild(advancedBody);

  container.appendChild(contentImageUrl.wrap);
  container.appendChild(mode.wrap);
  container.appendChild(presetWrap);
  container.appendChild(referenceWrap);
  container.appendChild(advanced);

  const fieldRefs = { contentImageUrl, styleImageUrl, presetStyle, styleStrength, preserveColors, preserveText, outputSize };

  return {
    getValues: async () => {
      contentImageUrl.clearError();
      styleImageUrl.clearError();

      let content;
      try {
        content = await contentImageUrl.getValue();
      } catch (err) {
        contentImageUrl.setError('Please upload a content image');
        throw new FieldValidationError('contentImageUrl', 'Please upload a content image');
      }
      if (!content) {
        contentImageUrl.setError('Please upload a content image');
        throw new FieldValidationError('contentImageUrl', 'Please upload a content image');
      }

      const m = mode.getValue();
      const strengthVal = styleStrength.getNumber();

      const out = {
        contentImageUrl: content,
        preserveColors: preserveColors.getValue(),
        preserveText: preserveText.getValue(),
        outputSize: outputSize.getValue(),
      };

      if (Number.isFinite(strengthVal)) out.styleStrength = Math.max(0, Math.min(1, strengthVal));

      if (m === 'reference') {
        let styleImg;
        try {
          styleImg = await styleImageUrl.getValue();
        } catch (err) {
          styleImageUrl.setError('Please upload a style reference image');
          throw new FieldValidationError('styleImageUrl', 'Please upload a style reference image');
        }
        if (!styleImg) {
          styleImageUrl.setError('Please upload a style reference image');
          throw new FieldValidationError('styleImageUrl', 'Please upload a style reference image');
        }
        out.styleImageUrl = styleImg;
      } else {
        out.presetStyle = presetStyle.getValue();
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
