import { createTextAreaField, createTextInputField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const EMAIL_TYPES = [
  { value: 'cold_outreach', label: 'Cold Outreach' },
  { value: 'follow_up', label: 'Follow Up' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'welcome', label: 'Welcome' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'transactional', label: 'Transactional' },
  { value: 'support_response', label: 'Support Response' },
  { value: 'internal_announcement', label: 'Internal Announcement' },
  { value: 'meeting_request', label: 'Meeting Request' },
  { value: 'thank_you', label: 'Thank You' },
  { value: 'feedback_request', label: 'Feedback Request' },
  { value: 'reengagement', label: 'Re-engagement' },
];

const TONES = [
  { value: 'professional', label: 'Professional' },
  { value: 'formal', label: 'Formal' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'casual', label: 'Casual' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'empathetic', label: 'Empathetic' },
];

const LENGTHS = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const type = createSelectField({
    label: 'Email type',
    id: 'type',
    required: true,
    options: EMAIL_TYPES,
    defaultValue: 'cold_outreach',
  });

  const purpose = createTextInputField({
    label: 'Purpose',
    id: 'purpose',
    required: true,
    placeholder: 'e.g., Introduce our new product',
  });

  const senderName = createTextInputField({
    label: 'Sender name',
    id: 'senderName',
    required: true,
    placeholder: 'e.g., John Smith',
  });

  const company = createTextInputField({
    label: 'Company',
    id: 'company',
    required: true,
    placeholder: 'e.g., Acme Inc.',
  });

  const recipientType = createTextInputField({
    label: 'Recipient',
    id: 'recipientType',
    required: true,
    placeholder: 'e.g., potential customers, team members, subscribers',
  });

  const mainMessage = createTextAreaField({
    label: 'Main message',
    id: 'mainMessage',
    required: true,
    rows: 5,
    placeholder: 'Describe what you want to communicate in this email...',
    help: 'The main content and purpose of your email.',
  });

  const callToAction = createTextInputField({
    label: 'Call to action',
    id: 'callToAction',
    required: false,
    placeholder: 'e.g., Schedule a demo, Visit our website',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: TONES,
    defaultValue: 'professional',
  });

  const maxLength = createSelectField({
    label: 'Length',
    id: 'maxLength',
    required: false,
    options: LENGTHS,
    defaultValue: 'medium',
  });

  const generateABVariants = createCheckboxField({
    label: 'Generate A/B test variants',
    id: 'generateABVariants',
    help: 'Create multiple versions for testing.',
    defaultChecked: true,
  });

  // Main fields
  container.appendChild(type.wrap);
  container.appendChild(purpose.wrap);
  container.appendChild(senderName.wrap);
  container.appendChild(company.wrap);
  container.appendChild(recipientType.wrap);
  container.appendChild(mainMessage.wrap);

  // More options
  const moreBody = document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(callToAction.wrap);

  const settingsRow = document.createElement('div');
  settingsRow.className = 'grid grid-cols-2 gap-4';
  settingsRow.appendChild(tone.wrap);
  settingsRow.appendChild(maxLength.wrap);
  moreBody.appendChild(settingsRow);

  moreBody.appendChild(generateABVariants.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { type, purpose, senderName, company, recipientType, mainMessage, callToAction, tone, maxLength, generateABVariants };

  return {
    getValues: async () => {
      mainMessage.clearError();
      purpose.clearError();
      senderName.clearError();
      company.clearError();
      recipientType.clearError();

      let hasError = false;

      const msg = mainMessage.getTrimmed();
      if (!msg) {
        mainMessage.setError('Please enter a main message');
        hasError = true;
      }

      const purposeVal = purpose.getTrimmed();
      if (!purposeVal) {
        purpose.setError('Please enter a purpose');
        hasError = true;
      }

      const sender = senderName.getTrimmed();
      if (!sender) {
        senderName.setError('Please enter sender name');
        hasError = true;
      }

      const comp = company.getTrimmed();
      if (!comp) {
        company.setError('Please enter company name');
        hasError = true;
      }

      const recipient = recipientType.getTrimmed();
      if (!recipient) {
        recipientType.setError('Please enter recipient type');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      const out = {
        type: type.getValue(),
        purpose: purposeVal,
        senderName: sender,
        company: comp,
        recipientType: recipient,
        mainMessage: msg,
        tone: tone.getValue(),
        maxLength: maxLength.getValue(),
        generateABVariants: generateABVariants.getValue(),
        variantCount: 2,
      };

      const cta = callToAction.getTrimmed();
      if (cta) out.callToAction = cta;

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
