import { createTextInputField, createTextAreaField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const goal = createTextAreaField({
    label: 'Automation goal',
    id: 'goal',
    required: true,
    placeholder: 'Describe what you want to automate...',
    rows: 4,
  });

  const integrations = createTextInputField({
    label: 'Integrations',
    id: 'integrations',
    required: false,
    placeholder: 'e.g., Slack, Google Sheets, GitHub (comma-separated)',
  });

  // Main fields
  container.appendChild(goal.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(integrations.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { goal, integrations };

  return {
    getValues: async () => {
      goal.clearError();

      const g = goal.getTrimmed();
      if (!g) {
        goal.setError('Please enter an automation goal');
        throw new FieldValidationError('goal', 'Please enter an automation goal');
      }

      const values = {
        goal: g,
      };

      const int = integrations.getTrimmed();
      if (int) {
        values.integrations = int.split(',').map(s => s.trim()).filter(Boolean);
      }

      return values;
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
