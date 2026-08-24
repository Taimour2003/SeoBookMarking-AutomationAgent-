import { createTextAreaField, createTextInputField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const experience = createTextAreaField({
    label: 'Experience & skills',
    id: 'experience',
    required: true,
    rows: 8,
    placeholder: 'Describe your work experience, skills, education, and achievements...',
    help: 'Include job titles, companies, dates, and key accomplishments.',
  });

  const targetJob = createTextInputField({
    label: 'Target job title',
    id: 'targetJob',
    required: false,
    placeholder: 'e.g., Senior Software Engineer',
    help: 'Optimize your resume for a specific role.',
  });

  // Main fields
  container.appendChild(experience.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(targetJob.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { experience, targetJob };

  return {
    getValues: async () => {
      experience.clearError();

      const exp = experience.getTrimmed();
      if (!exp) {
        experience.setError('Please enter your experience');
        throw new FieldValidationError('experience', 'Please enter your experience');
      }

      const out = { experience: exp };

      const job = targetJob.getTrimmed();
      if (job) out.targetJob = job;

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
