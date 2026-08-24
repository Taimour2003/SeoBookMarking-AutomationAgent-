import { createTextAreaField, createSelectField, createFieldLabel, createHelpToggle, setHidden, updateFormData, FieldValidationError } from './ui.js';

// Legacy getModelIcon removed - model selection now handled by global Model Selector

function createChipGroup({ label, id, options, defaultValue, help, required = false, layout = 'wrap' }) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'chipGroup';

  const header = document.createElement('div');
  header.className = 'mb-3';
  const row = document.createElement('div');
  row.className = 'flex items-center';

  const labelEl = createFieldLabel(label, { required });
  labelEl.className = 'block text-sm font-semibold';
  row.appendChild(labelEl);

  const { trigger, panel } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger && panel) {
    wrap.setAttribute('data-help-scope', '');
    row.appendChild(trigger);
    header.appendChild(row);
    header.appendChild(panel);
  } else {
    header.appendChild(row);
  }

  wrap.appendChild(header);

  const group = document.createElement('div');
  group.className = layout === 'grid-3'
    ? 'grid grid-cols-3 gap-2'
    : layout === 'row'
      ? 'flex gap-2'
      : 'flex flex-wrap gap-2';

  let selected = defaultValue;
  const buttons = [];

  // Sync to global form data
  const syncToGlobal = () => updateFormData(fieldKey, selected);

  function apply() {
    for (const { btn, value } of buttons) {
      const active = value === selected;
      btn.className =
        (layout === 'row' ? 'flex-1 ' : '') +
        'px-4 py-2 rounded-full text-sm font-medium transition-colors ' +
        (active ? 'bg-primary/90 text-primary-foreground shadow-lg shadow-primary/90/25' : 'bg-white/30 dark:bg-primary-foreground/10 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-primary-foreground/20 text-gray-700 dark:text-white border border-white/40 dark:border-primary/90/20');
    }
  }

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      selected = opt.value;
      apply();
      syncToGlobal();
    });
    group.appendChild(btn);
    buttons.push({ btn, value: opt.value });
  }
  wrap.appendChild(group);
  apply();
  syncToGlobal(); // Initial sync

  return {
    wrap,
    getValue: () => selected,
    setValue: (v) => {
      selected = v;
      apply();
      syncToGlobal();
    },
  };
}

export async function render({ container }) {
  container.innerHTML = '';

  const promptSuggestions = [
    { value: '', label: 'Select an example prompt…' },
    { value: 'A cinematic portrait photo of a cyberpunk detective, neon rain, 35mm film, shallow depth of field', label: 'Cinematic portrait' },
    { value: 'A clean studio product photo of a matte black water bottle on a white background, soft shadows', label: 'Product photo' },
    { value: 'An isometric 3D render of a cozy coffee shop interior, warm lighting, high detail', label: 'Isometric 3D render' },
    { value: "A children's book illustration of a small dragon reading a book, watercolor, pastel colors", label: "Children's book illustration" },
    { value: 'A minimalist logo of a mountain with a gradient, vector style, modern branding', label: 'Minimalist logo' },
    { value: 'A seamless repeating pattern of tropical leaves, watercolor, light pastel palette', label: 'Seamless pattern' },
  ];

  const prompt = createTextAreaField({
    label: 'Describe your image',
    id: 'prompt',
    required: true,
    rows: 4,
    placeholder: 'Describe the image you want to create in detail…',
  });

  const promptSuggestionSelect = createSelectField({
    label: 'Example prompts',
    id: 'examplePrompts',
    required: false,
    options: promptSuggestions,
    defaultValue: '',
  });

  // When user selects a suggestion, fill the textarea
  promptSuggestionSelect.select.addEventListener('change', () => {
    const val = promptSuggestionSelect.getValue();
    if (val) {
      prompt.setValue(val);
      // Reset select to placeholder
      promptSuggestionSelect.setValue('');
    }
  });

  // Legacy "AI Model" dropdown removed - model selection now handled by global Model Selector
  // The global selector provides: FLUX Schnell, SDXL, DALL-E 3, Imagen 4, SANA, etc.

  const style = createSelectField({
    label: 'Style',
    id: 'style',
    required: false,
    options: [
      { value: '', label: 'No style' },
      { value: 'photorealistic', label: 'Photorealistic' },
      { value: 'digital-art', label: 'Digital art' },
      { value: 'anime', label: 'Anime' },
      { value: '3d-render', label: '3D render' },
      { value: 'cinematic', label: 'Cinematic' },
      { value: 'minimalist', label: 'Minimalist' },
      { value: 'oil-painting', label: 'Oil painting' },
      { value: 'watercolor', label: 'Watercolor' },
      { value: 'sketch', label: 'Sketch' },
      { value: 'abstract', label: 'Abstract' },
      { value: 'fantasy', label: 'Fantasy' },
      { value: 'sci-fi', label: 'Sci-fi' },
    ],
    defaultValue: '',
  });

  const aspectRatio = createSelectField({
    label: 'Aspect ratio',
    id: 'aspectRatio',
    required: true,
    options: [
      { value: '1:1', label: '1:1 (Square)' },
      { value: '16:9', label: '16:9 (Landscape)' },
      { value: '9:16', label: '9:16 (Portrait)' },
      { value: '4:3', label: '4:3' },
      { value: '3:4', label: '3:4' },
      { value: '21:9', label: '21:9 (Ultrawide)' },
      { value: '3:2', label: '3:2' },
      { value: '2:3', label: '2:3' },
    ],
    defaultValue: '1:1',
  });

  const count = createSelectField({
    label: 'Number of images',
    id: 'count',
    required: true,
    options: [
      { value: '1', label: '1' },
      { value: '2', label: '2' },
      { value: '4', label: '4' },
    ],
    defaultValue: '1',
  });

  const quality = createSelectField({
    label: 'Quality',
    id: 'quality',
    required: false,
    help: 'OpenAI models only (ignored otherwise).',
    options: [
      { value: 'standard', label: 'Standard' },
      { value: 'hd', label: 'HD' },
    ],
    defaultValue: 'standard',
  });

  const negativePrompt = createTextAreaField({
    label: 'Negative prompt',
    id: 'negativePrompt',
    required: false,
    rows: 2,
    placeholder: 'What to avoid (mainly used by SDXL)…',
  });

  const advanced = document.createElement('details');
  advanced.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  advanced.appendChild(summary);

  const advancedBody = document.createElement('div');
  advancedBody.className = 'space-y-3';
  advanced.appendChild(advancedBody);

  advancedBody.appendChild(style.wrap);
  advancedBody.appendChild(aspectRatio.wrap);
  advancedBody.appendChild(quality.wrap);
  advancedBody.appendChild(negativePrompt.wrap);

  function syncModelSpecificFields(modelChoice) {
    const modelIdRaw =
      (modelChoice && typeof modelChoice === 'object' && typeof modelChoice.id === 'string' ? modelChoice.id : '') ||
      (() => {
        const el = document.querySelector('#modelSelect-image-generator');
        if (!el || !(el instanceof HTMLSelectElement)) return '';
        return el.value || '';
      })();

    const modelId = String(modelIdRaw || '').toLowerCase();
    const isOpenAi = modelId.startsWith('openai/');
    setHidden(quality.wrap, !isOpenAi);
  }

  syncModelSpecificFields();

  container.appendChild(prompt.wrap);
  container.appendChild(promptSuggestionSelect.wrap);
  container.appendChild(count.wrap);
  container.appendChild(advanced);
  // Model selection now handled by global Model Selector UI

  // Map of field IDs to field objects for setFieldError
  const fieldRefs = { prompt, style, aspectRatio, count, quality, negativePrompt };

  return {
    getValues: async () => {
      prompt.clearError();

      const promptText = prompt.getTrimmed();
      if (!promptText) {
        prompt.setError('Please describe the image you want to create');
        throw new FieldValidationError('prompt', 'Please describe the image you want to create');
      }

      // Model is now selected via the global Model Selector, not this override
      const out = {
        prompt: promptText,
        aspectRatio: aspectRatio.getValue(),
        count: Number(count.getValue()),
        quality: quality.getValue(),
      };

      const styleValue = style.getValue();
      if (styleValue) out.style = styleValue;

      const negative = negativePrompt.getTrimmed();
      if (negative) out.negativePrompt = negative;

      return out;
    },

    onModelChange: (modelChoice) => {
      syncModelSpecificFields(modelChoice);
    },

    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
