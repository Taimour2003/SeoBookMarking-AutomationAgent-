import { createMediaField, createTextAreaField, createTextInputField, FieldValidationError } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const subject = createTextAreaField({
    label: 'Subject description',
    id: 'subject',
    required: true,
    rows: 3,
    placeholder: 'Describe the subject for the portrait...',
    help: 'Who or what should be in the portrait.',
  });

  const mood = createTextInputField({
    label: 'Desired mood',
    id: 'mood',
    required: false,
    placeholder: 'e.g., professional, dramatic, warm...',
    help: 'The mood or atmosphere for the portrait.',
  });

  const imageUrl = createMediaField({
    label: 'Reference image (optional)',
    id: 'imageUrl',
    required: false,
    kind: 'image',
    help: 'Optional: upload a reference image to keep subject identity.',
  });

  container.appendChild(imageUrl.wrap);
  container.appendChild(subject.wrap);

  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(mood.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { imageUrl, subject, mood };

  return {
    getValues: async () => {
      subject.clearError();
      imageUrl.clearError();

      let refImage = null;
      try {
        refImage = await imageUrl.getValue();
      } catch {
        refImage = null;
      }
      const subjectVal = subject.getTrimmed();
      if (!subjectVal && !refImage) {
        subject.setError('Please enter a subject description or upload a reference image');
        throw new FieldValidationError('subject', 'Please enter a subject description or upload a reference image');
      }

      const out = {};
      if (subjectVal) out.subject = subjectVal;
      if (refImage) out.imageUrl = refImage;
      const moodVal = mood.getTrimmed();
      if (moodVal) out.mood = moodVal;
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
