import { createMediaField, createSelectField, createCheckboxField, FieldValidationError } from './ui.js';

function getUrlParam(key) {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get(key) || null;
  } catch {
    return null;
  }
}

export async function render({ container, remix }) {
  container.innerHTML = '';

  const urlVideoUrl = getUrlParam('videoUrl');
  const remixDefaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  const defaultVideoUrl = urlVideoUrl || remixDefaults?.videoUrl || null;

  const videoUrl = createMediaField({
    label: 'Video',
    id: 'videoUrl',
    required: true,
    kind: 'video',
    help: '',
    defaultValue: defaultVideoUrl,
  });

  const scale = createSelectField({
    label: 'Upscale factor',
    id: 'scale',
    required: false,
    options: [
      { value: '2', label: '2× (faster)' },
      { value: '4', label: '4× (higher detail)' },
    ],
    defaultValue: '2',
  });

  const outputFormat = createSelectField({
    label: 'Output format',
    id: 'outputFormat',
    required: false,
    options: [
      { value: 'mp4', label: 'MP4 (recommended)' },
      { value: 'webm', label: 'WebM' },
      { value: 'mov', label: 'MOV' },
    ],
    defaultValue: 'mp4',
  });

  const denoise = createSelectField({
    label: 'Denoise',
    id: 'denoise',
    required: false,
    options: [
      { value: 'none', label: 'None' },
      { value: 'light', label: 'Light (recommended)' },
      { value: 'medium', label: 'Medium' },
      { value: 'strong', label: 'Strong' },
    ],
    defaultValue: 'light',
  });

  const interpolateFps = createCheckboxField({
    label: 'Interpolate FPS',
    id: 'interpolateFps',
    help: 'Create smoother motion by interpolating frame rate.',
    defaultChecked: false,
  });

  const targetFps = createSelectField({
    label: 'Target FPS',
    id: 'targetFps',
    required: false,
    options: [
      { value: '24', label: '24' },
      { value: '30', label: '30 (recommended)' },
      { value: '48', label: '48' },
      { value: '60', label: '60' },
      { value: '120', label: '120' },
    ],
    defaultValue: '30',
  });

  const enhanceFaces = createCheckboxField({
    label: 'Enhance faces',
    id: 'enhanceFaces',
    help: 'Improves facial details (can increase runtime).',
    defaultChecked: true,
  });

  const advanced = document.createElement('details');
  advanced.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  advanced.appendChild(summary);
  const advancedBody = document.createElement('div');
  advancedBody.className = 'space-y-3';
  advancedBody.appendChild(scale.wrap);
  advancedBody.appendChild(outputFormat.wrap);
  advancedBody.appendChild(denoise.wrap);
  advancedBody.appendChild(interpolateFps.wrap);
  advancedBody.appendChild(targetFps.wrap);
  advancedBody.appendChild(enhanceFaces.wrap);
  advanced.appendChild(advancedBody);

  container.appendChild(videoUrl.wrap);
  container.appendChild(advanced);

  const fieldRefs = { videoUrl, scale, outputFormat, denoise, interpolateFps, targetFps, enhanceFaces };

  return {
    getValues: async () => {
      videoUrl.clearError();

      let video;
      try {
        video = await videoUrl.getValue();
      } catch (err) {
        videoUrl.setError('Please upload a video');
        throw new FieldValidationError('videoUrl', 'Please upload a video');
      }
      if (!video) {
        videoUrl.setError('Please upload a video');
        throw new FieldValidationError('videoUrl', 'Please upload a video');
      }

      return {
        videoUrl: video,
        scale: scale.getValue(),
        outputFormat: outputFormat.getValue(),
        denoise: denoise.getValue(),
        interpolateFps: interpolateFps.getValue(),
        targetFps: targetFps.getValue(),
        enhanceFaces: enhanceFaces.getValue(),
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
