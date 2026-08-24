import { createMediaField, createSelectField, updateFormData, FieldValidationError } from './ui.js';

function createFeatureChecklist() {
  const wrap = document.createElement('div');
  const fieldKey = 'features';
  const label = document.createElement('label');
  label.className = 'block text-sm font-medium mb-2';
  label.textContent = 'Enhancement features';
  const optional = document.createElement('span');
  optional.className = 'text-xs text-gray-500 dark:text-gray-400 ml-2 font-normal';
  optional.textContent = '(optional)';
  label.appendChild(optional);
  wrap.appendChild(label);

  const options = [
    { key: 'skin_smoothing', label: 'Skin smoothing' },
    { key: 'eye_enhancement', label: 'Eye enhancement' },
    { key: 'teeth_whitening', label: 'Teeth whitening' },
    { key: 'background_blur', label: 'Background blur' },
  ];

  const checks = new Map();

  // Sync to global form data
  const syncToGlobal = () => {
    const out = [];
    for (const [key, cb] of checks.entries()) {
      if (cb.checked) out.push(key);
    }
    updateFormData(fieldKey, out.length > 0 ? out : undefined);
  };

  const grid = document.createElement('div');
  grid.className = 'grid grid-cols-2 gap-x-4 gap-y-2 mt-2';

  for (const opt of options) {
    const row = document.createElement('label');
    row.className = 'flex items-center gap-2 select-none cursor-pointer py-1.5';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'sr-only';
    // Defaults: enable the two known-supported ones.
    cb.checked = opt.key === 'skin_smoothing' || opt.key === 'eye_enhancement';

    const visual = document.createElement('div');
    visual.className =
      'w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0';

    const checkIcon = document.createElement('span');
    checkIcon.innerHTML = `<svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;

    function syncVisual() {
      if (cb.checked) {
        visual.className = 'w-4 h-4 rounded border-2 border-primary/90 bg-primary/90 flex items-center justify-center transition-colors shrink-0';
        checkIcon.style.display = '';
      } else {
        visual.className = 'w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1C1E20] flex items-center justify-center transition-colors shrink-0';
        checkIcon.style.display = 'none';
      }
    }

    visual.appendChild(checkIcon);
    syncVisual();

    cb.addEventListener('change', () => {
      syncVisual();
      syncToGlobal();
    });

    row.appendChild(cb);
    row.appendChild(visual);

    const span = document.createElement('span');
    span.className = 'text-[13px] text-gray-700 dark:text-gray-300';
    span.textContent = opt.label;
    row.appendChild(span);

    grid.appendChild(row);
    checks.set(opt.key, cb);
  }

  wrap.appendChild(grid);
  syncToGlobal(); // Initial sync

  return {
    wrap,
    getValues: () => {
      const out = [];
      for (const [key, cb] of checks.entries()) {
        if (cb.checked) out.push(key);
      }
      return out;
    },
  };
}

export async function render({ container }) {
  container.innerHTML = '';

  const image = createMediaField({
    label: 'Portrait image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload a portrait/headshot or paste a URL.',
  });

  const enhancement = createSelectField({
    label: 'Enhancement strength',
    id: 'enhancement',
    required: false,
    options: [
      { value: 'Subtle', label: 'Subtle' },
      { value: 'Moderate', label: 'Moderate' },
      { value: 'Strong', label: 'Strong' },
    ],
    defaultValue: 'Moderate',
  });

  const features = createFeatureChecklist();

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
  body.appendChild(enhancement.wrap);
  body.appendChild(features.wrap);
  moreOptions.appendChild(body);
  container.appendChild(moreOptions);

  const fieldRefs = { imageUrl: image, enhancement };

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

      return {
        imageUrl,
        enhancement: enhancement.getValue(),
        features: features.getValues(),
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
