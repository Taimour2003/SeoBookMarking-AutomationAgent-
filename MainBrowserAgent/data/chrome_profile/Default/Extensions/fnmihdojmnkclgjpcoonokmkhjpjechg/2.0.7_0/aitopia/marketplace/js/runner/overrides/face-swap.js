import { createMediaField, createCheckboxField, FieldValidationError } from './ui.js';

function readDefaults(remix) {
  const raw = remix?.defaults;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw;
}

function coerceMediaUrl(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const url = value.url ?? value.href ?? value.uri;
    if (typeof url === 'string') return url;
  }
  return null;
}

function createConsentSection() {
  const wrap = document.createElement('div');
  wrap.className = 'rounded-ios-xl border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%] bg-[#EAEFF6] dark:bg-[#141414] p-4 mt-4 space-y-3';

  const title = document.createElement('div');
  title.className = 'text-sm font-semibold';
  title.textContent = 'Consent';
  wrap.appendChild(title);

  const note = document.createElement('p');
  note.className = 'text-xs text-gray-500 dark:text-gray-400';
  note.textContent = 'Face swap uses biometric processing. Please confirm the following to proceed.';
  wrap.appendChild(note);

  const subjectConsent = createCheckboxField({
    label: 'I have consent from the person whose face is being used.',
    id: 'subjectConsent',
    defaultChecked: false,
  });
  const targetConsent = createCheckboxField({
    label: 'I have consent from the person in the target photo.',
    id: 'targetConsent',
    defaultChecked: false,
  });
  const ageVerified = createCheckboxField({
    label: 'All persons are 18+ years old.',
    id: 'ageVerified',
    defaultChecked: false,
  });

  wrap.appendChild(subjectConsent.wrap);
  wrap.appendChild(targetConsent.wrap);
  wrap.appendChild(ageVerified.wrap);

  const setError = () => { wrap.style.borderColor = '#ef4444'; };
  const clearError = () => { wrap.style.borderColor = ''; };
  [subjectConsent, targetConsent, ageVerified].forEach(f => {
    f.checkbox.addEventListener('change', clearError);
  });

  return {
    wrap,
    getConsent: () => {
      if (!subjectConsent.getValue() || !targetConsent.getValue() || !ageVerified.getValue()) {
        setError();
        if (!subjectConsent.getValue()) throw new Error('Please confirm consent from the source person.');
        if (!targetConsent.getValue()) throw new Error('Please confirm consent from the target person.');
        throw new Error('Please confirm age verification (18+).');
      }
      clearError();

      return {
        subjectConsent: true,
        targetConsent: true,
        samePersonSwap: false,
        ageVerified: true,
        intendedUse: 'personal',
        timestamp: new Date().toISOString(),
        method: 'checkbox',
      };
    },
  };
}

export async function render({ schema, remix, container }) {
  container.innerHTML = '';

  const defaults = readDefaults(remix);

  const source = createMediaField({
    label: 'Face image',
    id: 'sourceImage',
    required: true,
    kind: 'image',
    help: 'The face you want to swap in.',
  });

  const target = createMediaField({
    label: 'Target image',
    id: 'targetImage',
    required: true,
    kind: 'image',
    help: 'The photo where you want the new face to appear.',
  });

  const consentSection = createConsentSection();

  if (defaults) {
    const sourceUrl = coerceMediaUrl(defaults.sourceImage ?? defaults.sourceImageUrl);
    if (sourceUrl) {
      source.urlInput.value = sourceUrl;
      source.urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const targetUrl = coerceMediaUrl(defaults.targetImage ?? defaults.targetImageUrl);
    if (targetUrl) {
      target.urlInput.value = targetUrl;
      target.urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  const readOnly = schema?.properties && typeof schema.properties === 'object' ? schema.properties : null;
  const sourceReadOnly = Boolean(readOnly?.sourceImage?.['x-uap']?.readOnly ?? readOnly?.sourceImageUrl?.['x-uap']?.readOnly);
  const targetReadOnly = Boolean(readOnly?.targetImage?.['x-uap']?.readOnly ?? readOnly?.targetImageUrl?.['x-uap']?.readOnly);
  if (sourceReadOnly) {
    source.fileInput.disabled = true;
    source.urlInput.disabled = true;
  }
  if (targetReadOnly) {
    target.fileInput.disabled = true;
    target.urlInput.disabled = true;
  }

  const pairRow = document.createElement('div');
  pairRow.className = 'grid grid-cols-2 gap-2';
  pairRow.appendChild(source.wrap);
  pairRow.appendChild(target.wrap);
  container.appendChild(pairRow);
  container.appendChild(consentSection.wrap);

  const fieldRefs = { sourceImage: source, targetImage: target };

  return {
    getValues: async () => {
      source.clearError();
      target.clearError();

      let hasError = false;

      let sourceImage;
      try {
        sourceImage = await source.getValue();
      } catch (err) {
        sourceImage = null;
      }
      if (!sourceImage) {
        source.setError('Please upload a face image');
        hasError = true;
      }

      let targetImage;
      try {
        targetImage = await target.getValue();
      } catch (err) {
        targetImage = null;
      }
      if (!targetImage) {
        target.setError('Please upload a target image');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      const consent = consentSection.getConsent();

      return {
        sourceImage,
        targetImage,
        samePersonSwap: false,
        hasConsent: true,
        consent,
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
