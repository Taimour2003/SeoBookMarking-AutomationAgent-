import { createMediaField, createNumberField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const CONTENT_TYPES = [
  { value: 'portrait', label: 'Portrait' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'travel', label: 'Travel' },
  { value: 'fitness', label: 'Fitness' },
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'artistic', label: 'Artistic' },
];

const STYLE_PRESETS = [
  { value: 'natural', label: 'Natural' },
  { value: 'studio', label: 'Studio' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'urban', label: 'Urban' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'vibrant', label: 'Vibrant' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'editorial', label: 'Editorial' },
];

const QUALITY_OPTIONS = [
  { value: 'Standard (Fast)', label: 'Standard (Fast)' },
  { value: 'High (Recommended)', label: 'High (Recommended)' },
  { value: 'Ultra (Best Quality)', label: 'Ultra (Best Quality)' },
];

const INTENDED_USE = [
  { value: 'Personal (Social Media)', label: 'Personal (Social Media)' },
  { value: 'Business/Commercial', label: 'Business/Commercial' },
  { value: 'Entertainment/Fun', label: 'Entertainment/Fun' },
  { value: 'Educational', label: 'Educational' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const selfieUrl = createMediaField({
    label: 'Your selfie',
    id: 'selfieUrl',
    required: true,
    kind: 'image',
    help: 'Upload a clear photo with your face visible.',
  });

  const consentConfirmed = createCheckboxField({
    label: 'I confirm this is my own photo and I am 18+ years old',
    id: 'consentConfirmed',
    help: 'Required for biometric consent.',
    defaultChecked: false,
  });

  const contentCount = createNumberField({
    label: 'Number of images',
    id: 'contentCount',
    required: false,
    min: 3,
    max: 50,
    defaultValue: 12,
  });

  const contentTypes = createSelectField({
    label: 'Content type',
    id: 'contentTypes',
    required: false,
    options: CONTENT_TYPES,
    defaultValue: 'portrait',
  });

  const stylePresets = createSelectField({
    label: 'Style',
    id: 'stylePresets',
    required: false,
    options: STYLE_PRESETS,
    defaultValue: 'natural',
  });

  const quality = createSelectField({
    label: 'Quality',
    id: 'quality',
    required: false,
    options: QUALITY_OPTIONS,
    defaultValue: 'High (Recommended)',
  });

  const intendedUse = createSelectField({
    label: 'Intended use',
    id: 'intendedUse',
    required: false,
    options: INTENDED_USE,
    defaultValue: 'Personal (Social Media)',
  });

  const varyOutfits = createCheckboxField({
    label: 'Vary outfits',
    id: 'varyOutfits',
    defaultChecked: true,
  });

  const varyBackgrounds = createCheckboxField({
    label: 'Vary backgrounds',
    id: 'varyBackgrounds',
    defaultChecked: true,
  });

  const varyPoses = createCheckboxField({
    label: 'Vary poses',
    id: 'varyPoses',
    defaultChecked: true,
  });

  // Main fields
  container.appendChild(selfieUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(contentCount.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(contentTypes.wrap);
  row1.appendChild(stylePresets.wrap);
  moreBody.appendChild(row1);

  moreBody.appendChild(quality.wrap);
  moreBody.appendChild(intendedUse.wrap);

  moreBody.appendChild(varyOutfits.wrap);
  moreBody.appendChild(varyBackgrounds.wrap);
  moreBody.appendChild(varyPoses.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  container.appendChild(consentConfirmed.wrap);

  const fieldRefs = { selfieUrl, consentConfirmed, contentCount, contentTypes, stylePresets, quality, intendedUse, varyOutfits, varyBackgrounds, varyPoses };

  return {
    getValues: async () => {
      selfieUrl.clearError();
      consentConfirmed.clearError();

      let hasError = false;

      let selfie;
      try {
        selfie = await selfieUrl.getValue();
      } catch (err) {
        selfie = null;
      }
      if (!selfie) {
        selfieUrl.setError('Please upload a selfie');
        hasError = true;
      }

      if (!consentConfirmed.getValue()) {
        consentConfirmed.setError('You must confirm consent to use this agent');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      return {
        selfieUrl: selfie,
        consentConfirmed: true,
        contentCount: contentCount.getNumber() ?? 12,
        contentTypes: contentTypes.getValue(),
        stylePresets: stylePresets.getValue(),
        quality: quality.getValue(),
        intendedUse: intendedUse.getValue(),
        varyOutfits: varyOutfits.getValue(),
        varyBackgrounds: varyBackgrounds.getValue(),
        varyPoses: varyPoses.getValue(),
      };
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
