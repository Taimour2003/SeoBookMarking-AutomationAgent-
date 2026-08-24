import { createMediaField, createCheckboxField, createNumberField, FieldValidationError } from './ui.js';

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
    label: 'I have consent from the person in the target video.',
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
  const face = createMediaField({
    label: 'Face image',
    id: 'sourceImage',
    required: true,
    kind: 'image',
    help: 'The face you want to swap into the video.',
  });

  const video = createMediaField({
    label: 'Target video',
    id: 'targetVideo',
    required: true,
    kind: 'video',
    help: 'Paste a URL or upload a short video (large videos may fail).',
  });

  const consentSection = createConsentSection();

  const targetFaceIndex = createNumberField({
    label: 'Target face index',
    id: 'targetFaceIndex',
    required: false,
    help: 'If multiple faces are detected, choose which one to replace (0 = first).',
    min: 0,
    step: 1,
    defaultValue: 0,
  });

  const enhanceFace = createCheckboxField({
    label: 'Enhance face (recommended)',
    id: 'enhanceFace',
    help: 'Applies GFPGAN face enhancement for better quality.',
    defaultChecked: true,
  });

  if (defaults) {
    const faceUrl = coerceMediaUrl(defaults.sourceImage ?? defaults.sourceImageUrl);
    if (faceUrl) {
      face.urlInput.value = faceUrl;
      face.urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const videoUrl = coerceMediaUrl(defaults.targetVideo ?? defaults.targetVideoUrl);
    if (videoUrl) {
      video.urlInput.value = videoUrl;
      video.urlInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    const idx = typeof defaults.targetFaceIndex === 'number'
      ? defaults.targetFaceIndex
      : (typeof defaults.targetFaceIndex === 'string' ? Number(defaults.targetFaceIndex) : null);
    if (idx != null && Number.isFinite(idx)) {
      targetFaceIndex.setNumber(idx);
    }

    if (typeof defaults.enhanceFace === 'boolean') {
      enhanceFace.setValue(Boolean(defaults.enhanceFace));
    }
  }

  const readOnly = schema?.properties && typeof schema.properties === 'object' ? schema.properties : null;
  const faceReadOnly = Boolean(readOnly?.sourceImage?.['x-uap']?.readOnly ?? readOnly?.sourceImageUrl?.['x-uap']?.readOnly);
  const videoReadOnly = Boolean(readOnly?.targetVideo?.['x-uap']?.readOnly ?? readOnly?.targetVideoUrl?.['x-uap']?.readOnly);
  const indexReadOnly = Boolean(readOnly?.targetFaceIndex?.['x-uap']?.readOnly);
  const enhanceReadOnly = Boolean(readOnly?.enhanceFace?.['x-uap']?.readOnly);
  if (faceReadOnly) {
    face.fileInput.disabled = true;
    face.urlInput.disabled = true;
  }
  if (videoReadOnly) {
    video.fileInput.disabled = true;
    video.urlInput.disabled = true;
  }
  if (indexReadOnly) {
    targetFaceIndex.input.disabled = true;
  }
  if (enhanceReadOnly) {
    enhanceFace.checkbox.disabled = true;
  }

  // Side by side layout for face and video
  const mediaRow = document.createElement('div');
  mediaRow.className = 'grid grid-cols-2 gap-2';
  mediaRow.appendChild(face.wrap);
  mediaRow.appendChild(video.wrap);
  container.appendChild(mediaRow);

  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  moreOptions.open = false;
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);
  const body = document.createElement('div');
  body.className = 'mt-4 space-y-4';
  body.appendChild(targetFaceIndex.wrap);
  body.appendChild(enhanceFace.wrap);
  moreOptions.appendChild(body);
  container.appendChild(moreOptions);
  container.appendChild(consentSection.wrap);

  const fieldRefs = { sourceImage: face, targetVideo: video, targetFaceIndex, enhanceFace };

  return {
    getValues: async () => {
      face.clearError();
      video.clearError();

      let hasError = false;

      let sourceImage;
      try {
        sourceImage = await face.getValue();
      } catch (err) {
        sourceImage = null;
      }
      if (!sourceImage) {
        face.setError('Please upload a face image');
        hasError = true;
      }

      let targetVideo;
      try {
        targetVideo = await video.getValue();
      } catch (err) {
        targetVideo = null;
      }
      if (!targetVideo) {
        video.setError('Please upload a video');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      const index = targetFaceIndex.getNumber();

      const consent = consentSection.getConsent();

      return {
        sourceImage,
        targetVideo,
        targetFaceIndex: Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0,
        enhanceFace: enhanceFace.getValue(),
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
