import { createMediaField, createTextInputField, createSelectField, createNumberField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const PRESETS = [
  { value: 'white-studio', label: 'White Studio' },
  { value: 'gray-studio', label: 'Gray Studio' },
  { value: 'black-studio', label: 'Black Studio' },
  { value: 'lifestyle-home', label: 'Lifestyle Home' },
  { value: 'lifestyle-cafe', label: 'Lifestyle Cafe' },
  { value: 'lifestyle-office', label: 'Lifestyle Office' },
  { value: 'outdoor-park', label: 'Outdoor Park' },
  { value: 'outdoor-beach', label: 'Outdoor Beach' },
  { value: 'outdoor-city', label: 'Outdoor City' },
  { value: 'abstract-gradient', label: 'Abstract Gradient' },
  { value: 'abstract-bokeh', label: 'Abstract Bokeh' },
  { value: 'festive-holiday', label: 'Festive Holiday' },
  { value: 'luxury-minimal', label: 'Luxury Minimal' },
  { value: 'custom', label: 'Custom' },
];

const LIGHTING = [
  { value: 'studio', label: 'Studio' },
  { value: 'natural', label: 'Natural' },
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'soft', label: 'Soft' },
  { value: 'golden-hour', label: 'Golden Hour' },
  { value: 'neon', label: 'Neon' },
];

const MOODS = [
  { value: 'neutral', label: 'Neutral' },
  { value: 'bright', label: 'Bright' },
  { value: 'moody', label: 'Moody' },
  { value: 'warm', label: 'Warm' },
  { value: 'cool', label: 'Cool' },
  { value: 'vibrant', label: 'Vibrant' },
];

const RESOLUTIONS = [
  { value: '1920x1080', label: '1920x1080' },
  { value: '1024x1024', label: '1024x1024' },
  { value: '1280x720', label: '1280x720' },
  { value: '2048x2048', label: '2048x2048' },
];

const ASPECT_RATIOS = [
  { value: '16:9', label: '16:9' },
  { value: '1:1', label: '1:1' },
  { value: '9:16', label: '9:16' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
];

const DEPTHS = [
  { value: 'medium', label: 'Medium' },
  { value: 'shallow', label: 'Shallow' },
  { value: 'deep', label: 'Deep' },
  { value: 'infinite', label: 'Infinite' },
];

const SCENE_TYPES = [
  { value: 'studio', label: 'Studio' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'urban', label: 'Urban' },
  { value: 'nature', label: 'Nature' },
  { value: 'abstract', label: 'Abstract' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'custom', label: 'Custom' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const preset = createSelectField({
    label: 'Background preset',
    id: 'preset',
    required: false,
    options: PRESETS,
    defaultValue: 'white-studio',
  });

  const subjectImageUrl = createMediaField({
    label: 'Subject image',
    id: 'subjectImageUrl',
    required: false,
    kind: 'image',
    help: 'Optional image to place on the background.',
  });

  const sceneDescription = createTextInputField({
    label: 'Custom description',
    id: 'sceneDescription',
    required: false,
    placeholder: 'Describe your custom scene...',
    help: 'Used when preset is "Custom".',
  });

  const sceneType = createSelectField({
    label: 'Scene type',
    id: 'sceneType',
    required: false,
    options: SCENE_TYPES,
    defaultValue: 'studio',
  });

  const lighting = createSelectField({
    label: 'Lighting',
    id: 'lighting',
    required: false,
    options: LIGHTING,
    defaultValue: 'studio',
  });

  const mood = createSelectField({
    label: 'Mood',
    id: 'mood',
    required: false,
    options: MOODS,
    defaultValue: 'neutral',
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    options: RESOLUTIONS,
    defaultValue: '1920x1080',
  });

  const aspectRatio = createSelectField({
    label: 'Aspect ratio',
    id: 'aspectRatio',
    required: false,
    options: ASPECT_RATIOS,
    defaultValue: '16:9',
  });

  const depth = createSelectField({
    label: 'Depth',
    id: 'depth',
    required: false,
    options: DEPTHS,
    defaultValue: 'medium',
  });

  const variations = createNumberField({
    label: 'Variations',
    id: 'variations',
    required: false,
    min: 1,
    max: 10,
    defaultValue: 1,
  });

  const preserveSubject = createCheckboxField({
    label: 'Preserve subject',
    id: 'preserveSubject',
    defaultChecked: true,
  });

  // Main fields
  container.appendChild(preset.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(subjectImageUrl.wrap);
  moreBody.appendChild(sceneDescription.wrap);
  moreBody.appendChild(sceneType.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(lighting.wrap);
  row1.appendChild(mood.wrap);
  moreBody.appendChild(row1);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(resolution.wrap);
  row2.appendChild(aspectRatio.wrap);
  moreBody.appendChild(row2);

  const row3 = window.document.createElement('div');
  row3.className = 'grid grid-cols-2 gap-4';
  row3.appendChild(depth.wrap);
  row3.appendChild(variations.wrap);
  moreBody.appendChild(row3);

  moreBody.appendChild(preserveSubject.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { preset, subjectImageUrl, sceneDescription, sceneType, lighting, mood, resolution, aspectRatio, depth, variations, preserveSubject };

  return {
    getValues: async () => {
      const out = {
        preset: preset.getValue(),
        sceneType: sceneType.getValue(),
        lighting: lighting.getValue(),
        mood: mood.getValue(),
        depth: depth.getValue(),
        resolution: resolution.getValue(),
        aspectRatio: aspectRatio.getValue(),
        variations: variations.getNumber() ?? 1,
        preserveSubject: preserveSubject.getValue(),
      };

      try {
        const subject = await subjectImageUrl.getValue();
        if (subject) out.subjectImageUrl = subject;
      } catch (err) {
        // Optional field, ignore errors
      }

      const desc = sceneDescription.getTrimmed();
      if (desc) out.sceneDescription = desc;

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
