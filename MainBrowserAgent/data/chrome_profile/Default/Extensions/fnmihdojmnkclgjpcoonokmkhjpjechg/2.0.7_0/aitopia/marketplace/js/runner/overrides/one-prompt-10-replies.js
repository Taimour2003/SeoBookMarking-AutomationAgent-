import { createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const TONES = [
  { value: 'Professional', label: 'Professional' },
  { value: 'Friendly', label: 'Friendly' },
  { value: 'Casual', label: 'Casual' },
  { value: 'Formal', label: 'Formal' },
  { value: 'Empathetic', label: 'Empathetic' },
  { value: 'Assertive', label: 'Assertive' },
  { value: 'Humorous', label: 'Humorous' },
];

const PLATFORMS = [
  { value: 'Email', label: 'Email' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Chat/DM', label: 'Chat/DM' },
  { value: 'Comment', label: 'Comment' },
  { value: 'Business Letter', label: 'Business Letter' },
  { value: 'General', label: 'General' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const prompt = createTextAreaField({
    label: 'Prompt',
    id: 'prompt',
    required: true,
    rows: 3,
    placeholder: 'The message or question you want to respond to...',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: true,
    options: TONES,
    defaultValue: 'Professional',
  });

  const platform = createSelectField({
    label: 'Platform',
    id: 'platform',
    required: true,
    options: PLATFORMS,
    defaultValue: 'Email',
  });

  const context = createTextAreaField({
    label: 'Context',
    id: 'context',
    required: false,
    rows: 2,
    placeholder: 'Additional context (who you are responding to, relationship, goal)...',
  });

  // Main fields
  container.appendChild(prompt.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(tone.wrap);
  row1.appendChild(platform.wrap);
  container.appendChild(row1);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(context.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { prompt, tone, platform, context };

  return {
    getValues: async () => {
      prompt.clearError();

      const p = prompt.getTrimmed();
      if (!p) {
        prompt.setError('Please enter a prompt');
        throw new FieldValidationError('prompt', 'Please enter a prompt');
      }

      const out = {
        prompt: p,
        tone: tone.getValue(),
        platform: platform.getValue(),
      };

      const ctx = context.getTrimmed();
      if (ctx) out.context = ctx;

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
