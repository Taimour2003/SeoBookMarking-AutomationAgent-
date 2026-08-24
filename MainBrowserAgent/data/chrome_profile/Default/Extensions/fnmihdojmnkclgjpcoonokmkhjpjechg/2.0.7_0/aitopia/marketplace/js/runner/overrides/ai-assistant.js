import { createTextAreaField, createMediaField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const PERSONALITIES = [
  { value: 'professional', label: 'Professional' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'concise', label: 'Concise' },
  { value: 'detailed', label: 'Detailed' },
  { value: 'creative', label: 'Creative' },
  { value: 'analytical', label: 'Analytical' },
];

const DOMAINS = [
  { value: 'general', label: 'General' },
  { value: 'coding', label: 'Coding' },
  { value: 'writing', label: 'Writing' },
  { value: 'research', label: 'Research' },
  { value: 'creative', label: 'Creative' },
  { value: 'business', label: 'Business' },
  { value: 'education', label: 'Education' },
  { value: 'support', label: 'Support' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const message = createTextAreaField({
    label: 'Message',
    id: 'message',
    required: true,
    rows: 4,
    placeholder: 'Ask me anything...',
  });

  const imageUrl = createMediaField({
    label: 'Image',
    id: 'imageUrl',
    required: false,
    kind: 'image',
    help: 'Upload an image to ask questions about it.',
  });

  const personality = createSelectField({
    label: 'Personality',
    id: 'personality',
    required: false,
    options: PERSONALITIES,
    defaultValue: 'professional',
  });

  const domain = createSelectField({
    label: 'Domain',
    id: 'domain',
    required: false,
    options: DOMAINS,
    defaultValue: 'general',
  });

  const enableMemory = createCheckboxField({
    label: 'Enable conversation memory',
    id: 'enableMemory',
    help: 'Remember conversation history for context.',
    defaultChecked: true,
  });

  // Main fields
  container.appendChild(message.wrap);

  // More options
  const moreBody = document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(imageUrl.wrap);

  const settingsRow = document.createElement('div');
  settingsRow.className = 'grid grid-cols-2 gap-4';
  settingsRow.appendChild(personality.wrap);
  settingsRow.appendChild(domain.wrap);
  moreBody.appendChild(settingsRow);

  moreBody.appendChild(enableMemory.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { message, imageUrl, personality, domain, enableMemory };

  return {
    getValues: async () => {
      message.clearError();

      const msg = message.getTrimmed();
      if (!msg) {
        message.setError('Please enter a message');
        throw new FieldValidationError('message', 'Please enter a message');
      }

      const out = {
        message: msg,
        personality: personality.getValue(),
        domain: domain.getValue(),
        enableMemory: enableMemory.getValue(),
      };

      try {
        const image = await imageUrl.getValue();
        if (image) out.imageUrl = image;
      } catch (err) {
        // Optional field, ignore errors
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
