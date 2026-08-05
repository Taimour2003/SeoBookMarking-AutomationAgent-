import { createMediaField, createSelectField, setHidden, FieldValidationError } from './ui.js';

function shouldUseGlobalModelSelector(agent) {
  const enabled = window.__AITOPIA_AGENT_RUN__?.useModelSelector === true;
  const hasChoices = Array.isArray(agent?.modelChoices) && agent.modelChoices.length > 0;
  const selectorEnabledForAgent = agent?.modelSelectorEnabled === true;
  return enabled && selectorEnabledForAgent && hasChoices;
}

export async function render({ agent, container }) {
  container.innerHTML = '';

  const person = createMediaField({
    label: 'Person photo',
    id: 'personImageUrl',
    required: true,
    kind: 'image',
    help: 'Front-facing, full-body photo on a plain background.',
  });

  const garment = createMediaField({
    label: 'Garment photo',
    id: 'garmentImageUrl',
    required: true,
    kind: 'image',
    help: 'Flat-lay or mannequin shot, front view, plain background.',
  });

  const category = createSelectField({
    label: 'Garment category',
    id: 'category',
    required: false,
    options: [
      { value: 'upper_body', label: 'Top (upper body)' },
      { value: 'lower_body', label: 'Bottom (lower body)' },
      { value: 'dresses', label: 'Dress' },
    ],
    defaultValue: 'upper_body',
  });

  const modelVariant = createSelectField({
    label: 'Try-on model',
    id: 'aiModel',
    required: false,
    help: 'IDM-VTON is the highest quality; OOTDiffusion is faster/cheaper.',
    options: [
      { value: 'idm-vton', label: 'IDM-VTON (quality)' },
      { value: 'oot-diffusion', label: 'OOTDiffusion (fast)' },
    ],
    defaultValue: 'idm-vton',
  });

  const showInternalModel = !shouldUseGlobalModelSelector(agent);
  setHidden(modelVariant.wrap, !showInternalModel);

  const pairRow = document.createElement('div');
  pairRow.className = 'grid grid-cols-2 gap-3';
  pairRow.appendChild(person.wrap);
  pairRow.appendChild(garment.wrap);
  container.appendChild(pairRow);

  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  moreOptions.open = false;
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'mt-4 space-y-4';
  body.appendChild(category.wrap);
  body.appendChild(modelVariant.wrap);
  moreOptions.appendChild(body);
  container.appendChild(moreOptions);

  const fieldRefs = { personImageUrl: person, garmentImageUrl: garment, category, aiModel: modelVariant };

  return {
    getValues: async () => {
      person.clearError();
      garment.clearError();

      let hasError = false;

      let personImageUrl;
      try {
        personImageUrl = await person.getValue();
      } catch (err) {
        personImageUrl = null;
      }
      if (!personImageUrl) {
        person.setError('Please upload a person photo');
        hasError = true;
      }

      let garmentImageUrl;
      try {
        garmentImageUrl = await garment.getValue();
      } catch (err) {
        garmentImageUrl = null;
      }
      if (!garmentImageUrl) {
        garment.setError('Please upload a garment photo');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      const out = {
        personImageUrl,
        garmentImageUrl,
        category: category.getValue(),
      };
      if (showInternalModel) out.aiModel = modelVariant.getValue();
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
