import { createTextAreaField, createTextInputField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const CUSTOMER_TIERS = [
  { value: 'standard', label: 'Standard' },
  { value: 'premium', label: 'Premium' },
  { value: 'enterprise', label: 'Enterprise' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const message = createTextAreaField({
    label: 'Customer message',
    id: 'message',
    required: true,
    placeholder: 'Enter the customer inquiry or message...',
    rows: 4,
  });

  const customerName = createTextInputField({
    label: 'Customer name',
    id: 'customerName',
    required: false,
    placeholder: 'Optional customer name for personalization',
  });

  const customerTier = createSelectField({
    label: 'Customer tier',
    id: 'customerTier',
    required: false,
    options: CUSTOMER_TIERS,
    defaultValue: 'standard',
  });

  const customerId = createTextInputField({
    label: 'Customer ID',
    id: 'customerId',
    required: false,
    placeholder: 'Optional customer ID',
  });

  // Main fields
  container.appendChild(message.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(customerName.wrap);
  moreBody.appendChild(customerTier.wrap);
  moreBody.appendChild(customerId.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { message, customerName, customerTier, customerId };

  return {
    getValues: async () => {
      message.clearError();

      const msg = message.getTrimmed();
      if (!msg) {
        message.setError('Please enter a customer message');
        throw new FieldValidationError('message', 'Please enter a customer message');
      }

      const values = {
        message: msg,
      };

      const name = customerName.getTrimmed();
      const tier = customerTier.getValue();
      const id = customerId.getTrimmed();

      if (name || tier !== 'standard' || id) {
        values.customerContext = {};
        if (name) values.customerContext.customerName = name;
        if (tier) values.customerContext.customerTier = tier;
        if (id) values.customerContext.customerId = id;
      }

      return values;
    },
    setFieldError: (fieldId, msg) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(msg);
      }
    },
  };
}
