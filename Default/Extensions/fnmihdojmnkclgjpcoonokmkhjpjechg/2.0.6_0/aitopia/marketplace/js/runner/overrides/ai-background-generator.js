import { createMediaField, createSelectField, createTextAreaField, setHidden, FieldValidationError } from './ui.js';

const PRESET_OPTIONS = [
  { value: 'white_studio', label: 'White Studio (clean)' },
  { value: 'gray_studio', label: 'Gray Studio' },
  { value: 'black_studio', label: 'Black Studio (luxury)' },
  { value: 'product_pedestal', label: 'Product Pedestal' },
  { value: 'modern_desk', label: 'Modern Desk (lifestyle)' },
  { value: 'kitchen_counter', label: 'Kitchen Counter (food)' },
  { value: 'outdoor_nature', label: 'Outdoor Nature' },
  { value: 'luxury_marble', label: 'Luxury Marble' },
  { value: 'amazon_white', label: 'Amazon White (e-commerce)' },
  { value: 'lifestyle_warm', label: 'Lifestyle Warm (wood)' },
  { value: 'minimalist_clean', label: 'Minimalist Clean' },
  { value: 'soft_pink', label: 'Soft Pink' },
  { value: 'ocean_blue', label: 'Ocean Blue' },
  { value: 'sunset_warm', label: 'Sunset Warm' },
  { value: 'mint_fresh', label: 'Mint Fresh' },
];

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'jewelry', label: 'Jewelry' },
  { value: 'food', label: 'Food' },
  { value: 'furniture', label: 'Furniture' },
  { value: 'cosmetics', label: 'Cosmetics' },
  { value: 'automotive', label: 'Automotive' },
];

export async function render({ agent, container, remix }) {
  container.innerHTML = '';

  const image = createMediaField({
    label: 'Image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: '',
  });

  const mode = createSelectField({
    label: 'Background mode',
    id: 'mode',
    required: true,
    options: [
      { value: 'prompt', label: 'Replace background (custom prompt)' },
      { value: 'preset', label: 'Replace background (preset)' },
      { value: 'transparent', label: 'Remove background only (transparent PNG)' },
    ],
    defaultValue: 'prompt',
  });

  const prompt = createTextAreaField({
    label: 'Background prompt',
    id: 'prompt',
    required: false,
    rows: 3,
    placeholder: 'Example: misty pine forest at sunrise, soft depth of field, cinematic lighting',
    help: 'Describe the background only. The product should stay the same.',
  });

  const preset = createSelectField({
    label: 'Preset background',
    id: 'preset',
    required: false,
    help: 'Use a preset instead of writing a prompt (no conflicts).',
    options: PRESET_OPTIONS,
    defaultValue: 'white_studio',
  });

  const aspectRatio = createSelectField({
    label: 'Aspect ratio',
    id: 'aspectRatio',
    required: false,
    options: [
      { value: '1:1', label: '1:1 (Square)' },
      { value: '4:3', label: '4:3' },
      { value: '3:4', label: '3:4' },
      { value: '16:9', label: '16:9 (Landscape)' },
      { value: '9:16', label: '9:16 (Portrait)' },
    ],
    defaultValue: '1:1',
  });

  const outputSize = createSelectField({
    label: 'Output size',
    id: 'outputSize',
    required: false,
    options: [
      { value: '512', label: '512px' },
      { value: '1024', label: '1024px' },
      { value: '2048', label: '2048px' },
    ],
    defaultValue: '1024',
  });

  const backgroundType = createSelectField({
    label: 'Background type (advanced)',
    id: 'backgroundType',
    required: false,
    help: 'Optional hint. This does not override your prompt/preset.',
    options: [
      { value: 'ai_generated', label: 'AI generated' },
      { value: 'studio', label: 'Studio' },
      { value: 'lifestyle', label: 'Lifestyle' },
      { value: 'solid_color', label: 'Solid color' },
      { value: 'gradient', label: 'Gradient' },
    ],
    defaultValue: 'ai_generated',
  });

  const category = createSelectField({
    label: 'Product category (advanced)',
    id: 'category',
    required: false,
    options: CATEGORY_OPTIONS,
    defaultValue: 'general',
  });

  const advanced = document.createElement('details');
  advanced.className = '';
  advanced.open = false;
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-medium';
  summary.textContent = 'More options';
  advanced.appendChild(summary);
  const advancedBody = document.createElement('div');
  advancedBody.className = 'mt-3 space-y-4';
  advancedBody.appendChild(aspectRatio.wrap);
  advancedBody.appendChild(outputSize.wrap);
  advancedBody.appendChild(backgroundType.wrap);
  advancedBody.appendChild(category.wrap);
  advanced.appendChild(advancedBody);

  container.appendChild(image.wrap);
  container.appendChild(mode.wrap);
  container.appendChild(prompt.wrap);
  container.appendChild(preset.wrap);
  container.appendChild(advanced);

  function applyMode() {
    const v = mode.getValue();
    setHidden(prompt.wrap, v !== 'prompt');
    setHidden(preset.wrap, v !== 'preset');
    setHidden(advanced, v === 'transparent');
  }

  mode.select.addEventListener('change', applyMode);

  // Remix: auto-detect mode from defaults (getValues doesn't output 'mode' key)
  const remixDefaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  if (remixDefaults) {
    if (remixDefaults.backgroundType === 'transparent') {
      mode.setValue('transparent');
    } else if (typeof remixDefaults.preset === 'string' && remixDefaults.preset.trim()) {
      mode.setValue('preset');
    }
  }
  applyMode();

  const fieldRefs = { imageUrl: image, mode, prompt, preset, aspectRatio, outputSize, backgroundType, category };

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

      const out = {
        imageUrl,
        aspectRatio: aspectRatio.getValue(),
        outputSize: outputSize.getValue(),
      };

      const v = mode.getValue();
      if (v === 'transparent') {
        out.backgroundType = 'transparent';
        return out;
      }

      out.backgroundType = backgroundType.getValue();
      out.category = category.getValue();

      if (v === 'preset') {
        out.preset = preset.getValue();
      } else {
        const p = prompt.getTrimmed();
        if (p) out.prompt = p;
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
