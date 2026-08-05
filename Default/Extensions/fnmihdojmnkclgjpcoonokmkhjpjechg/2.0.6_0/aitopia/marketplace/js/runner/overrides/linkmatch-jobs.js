import { createTextAreaField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const profile = createTextAreaField({
    label: 'Professional profile',
    id: 'profile',
    required: true,
    rows: 6,
    placeholder: 'Describe your skills, experience, and career background...',
    help: 'Include your current role, skills, and what you\'re looking for.',
  });

  const preferences = createTextAreaField({
    label: 'Job preferences',
    id: 'preferences',
    required: false,
    rows: 4,
    placeholder: 'e.g., Remote work, salary range, industry, location...',
    help: 'Describe your ideal job criteria.',
  });

  // Main fields
  container.appendChild(profile.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(preferences.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { profile, preferences };

  return {
    getValues: async () => {
      profile.clearError();

      const prof = profile.getTrimmed();
      if (!prof) {
        profile.setError('Please enter your professional profile');
        throw new FieldValidationError('profile', 'Please enter your professional profile');
      }

      const out = { profile: prof };

      const prefs = preferences.getTrimmed();
      if (prefs) out.preferences = prefs;

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
