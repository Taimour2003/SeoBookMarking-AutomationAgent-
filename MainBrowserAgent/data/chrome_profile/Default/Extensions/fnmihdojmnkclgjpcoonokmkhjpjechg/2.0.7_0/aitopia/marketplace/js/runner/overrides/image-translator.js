import { createMediaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const LANGUAGES = [
  { value: 'English', label: 'English' },
  { value: 'Spanish', label: 'Spanish' },
  { value: 'French', label: 'French' },
  { value: 'German', label: 'German' },
  { value: 'Italian', label: 'Italian' },
  { value: 'Portuguese', label: 'Portuguese' },
  { value: 'Dutch', label: 'Dutch' },
  { value: 'Russian', label: 'Russian' },
  { value: 'Chinese (Simplified)', label: 'Chinese (Simplified)' },
  { value: 'Chinese (Traditional)', label: 'Chinese (Traditional)' },
  { value: 'Japanese', label: 'Japanese' },
  { value: 'Korean', label: 'Korean' },
  { value: 'Arabic', label: 'Arabic' },
  { value: 'Hindi', label: 'Hindi' },
  { value: 'Turkish', label: 'Turkish' },
  { value: 'Polish', label: 'Polish' },
  { value: 'Swedish', label: 'Swedish' },
  { value: 'Danish', label: 'Danish' },
  { value: 'Norwegian', label: 'Norwegian' },
  { value: 'Finnish', label: 'Finnish' },
  { value: 'Greek', label: 'Greek' },
  { value: 'Hebrew', label: 'Hebrew' },
  { value: 'Thai', label: 'Thai' },
  { value: 'Vietnamese', label: 'Vietnamese' },
  { value: 'Indonesian', label: 'Indonesian' },
  { value: 'Malay', label: 'Malay' },
  { value: 'Czech', label: 'Czech' },
  { value: 'Hungarian', label: 'Hungarian' },
  { value: 'Romanian', label: 'Romanian' },
  { value: 'Ukrainian', label: 'Ukrainian' },
  { value: 'Bulgarian', label: 'Bulgarian' },
  { value: 'Croatian', label: 'Croatian' },
  { value: 'Serbian', label: 'Serbian' },
  { value: 'Slovak', label: 'Slovak' },
  { value: 'Slovenian', label: 'Slovenian' },
  { value: 'Estonian', label: 'Estonian' },
  { value: 'Latvian', label: 'Latvian' },
  { value: 'Lithuanian', label: 'Lithuanian' },
  { value: 'Bengali', label: 'Bengali' },
  { value: 'Tamil', label: 'Tamil' },
  { value: 'Telugu', label: 'Telugu' },
  { value: 'Urdu', label: 'Urdu' },
  { value: 'Persian', label: 'Persian' },
];

const FORMALITY = [
  { value: 'default', label: 'Default' },
  { value: 'formal', label: 'Formal' },
  { value: 'informal', label: 'Informal' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload an image with text to translate.',
  });

  const targetLanguage = createSelectField({
    label: 'Translate to',
    id: 'targetLanguage',
    required: true,
    options: LANGUAGES,
    defaultValue: 'English',
  });

  const sourceLanguage = createSelectField({
    label: 'Source language',
    id: 'sourceLanguage',
    required: false,
    options: [{ value: '', label: 'Auto-detect' }, ...LANGUAGES],
    defaultValue: '',
    help: 'Leave empty to auto-detect.',
  });

  const formality = createSelectField({
    label: 'Formality',
    id: 'formality',
    required: false,
    options: FORMALITY,
    defaultValue: 'default',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);
  container.appendChild(targetLanguage.wrap);

  // More options
  const moreBody = document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(sourceLanguage.wrap);
  moreBody.appendChild(formality.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { imageUrl, targetLanguage, sourceLanguage, formality };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let image;
      try {
        image = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }

      if (!image) {
        imageUrl.setError('Please upload an image');
        throw new FieldValidationError('imageUrl', 'Please upload an image');
      }

      const out = {
        imageUrl: image,
        targetLanguage: targetLanguage.getValue(),
      };

      const source = sourceLanguage.getValue();
      if (source) out.sourceLanguage = source;

      const formal = formality.getValue();
      if (formal && formal !== 'default') out.formality = formal;

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
