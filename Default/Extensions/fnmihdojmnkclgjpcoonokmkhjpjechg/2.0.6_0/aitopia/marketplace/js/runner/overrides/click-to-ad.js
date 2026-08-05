import { createTextInputField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const AD_LENGTHS = [
  { value: '15 Seconds', label: '15 Seconds' },
  { value: '30 Seconds', label: '30 Seconds' },
  { value: '60 Seconds', label: '60 Seconds' },
];

const AD_STYLES = [
  { value: 'UGC Style', label: 'UGC Style' },
  { value: 'Product Demo', label: 'Product Demo' },
  { value: 'Testimonial', label: 'Testimonial' },
  { value: 'Comparison', label: 'Comparison' },
  { value: 'Lifestyle', label: 'Lifestyle' },
];

const TONES = [
  { value: 'Casual', label: 'Casual' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Energetic', label: 'Energetic' },
  { value: 'Emotional', label: 'Emotional' },
];

const PLATFORMS = [
  { value: 'All Platforms', label: 'All Platforms' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'YouTube', label: 'YouTube' },
  { value: 'Facebook', label: 'Facebook' },
];

const SPEAKER_GENDERS = [
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Neutral', label: 'Neutral' },
];

const NARRATION_STYLES = [
  { value: 'Conversational', label: 'Conversational' },
  { value: 'Upbeat', label: 'Upbeat' },
  { value: 'Calm', label: 'Calm' },
  { value: 'Authoritative', label: 'Authoritative' },
];

const CAPTION_STYLES = [
  { value: 'Bold', label: 'Bold' },
  { value: 'Minimal', label: 'Minimal' },
  { value: 'Animated', label: 'Animated' },
];

const RESOLUTIONS = [
  { value: '1080p (Full HD)', label: '1080p (Full HD)' },
  { value: '720p (HD)', label: '720p (HD)' },
  { value: '4K (Ultra HD)', label: '4K (Ultra HD)' },
];

const ASPECT_RATIOS = [
  { value: '9:16 (Vertical)', label: '9:16 (Vertical)' },
  { value: '16:9 (Horizontal)', label: '16:9 (Horizontal)' },
  { value: '1:1 (Square)', label: '1:1 (Square)' },
  { value: '4:5 (Portrait)', label: '4:5 (Portrait)' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const url = createTextInputField({
    label: 'Product URL',
    id: 'url',
    required: true,
    placeholder: 'https://example.com/product',
    help: 'Enter the product page URL or image URL.',
  });

  const adLength = createSelectField({
    label: 'Ad length',
    id: 'adLength',
    required: false,
    options: AD_LENGTHS,
    defaultValue: '30 Seconds',
  });

  const adStyle = createSelectField({
    label: 'Ad style',
    id: 'adStyle',
    required: false,
    options: AD_STYLES,
    defaultValue: 'UGC Style',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: TONES,
    defaultValue: 'Casual',
  });

  const targetPlatform = createSelectField({
    label: 'Platform',
    id: 'targetPlatform',
    required: false,
    options: PLATFORMS,
    defaultValue: 'All Platforms',
  });

  const speakerGender = createSelectField({
    label: 'Speaker gender',
    id: 'speakerGender',
    required: false,
    options: SPEAKER_GENDERS,
    defaultValue: 'Female',
  });

  const narrationStyle = createSelectField({
    label: 'Narration style',
    id: 'narrationStyle',
    required: false,
    options: NARRATION_STYLES,
    defaultValue: 'Conversational',
  });

  const captionStyle = createSelectField({
    label: 'Caption style',
    id: 'captionStyle',
    required: false,
    options: CAPTION_STYLES,
    defaultValue: 'Bold',
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    options: RESOLUTIONS,
    defaultValue: '1080p (Full HD)',
  });

  const aspectRatio = createSelectField({
    label: 'Aspect ratio',
    id: 'aspectRatio',
    required: false,
    options: ASPECT_RATIOS,
    defaultValue: '9:16 (Vertical)',
  });

  const ctaText = createTextInputField({
    label: 'Call to action',
    id: 'ctaText',
    required: false,
    placeholder: 'Shop Now, Learn More, etc.',
  });

  const includeProductShots = createCheckboxField({
    label: 'Include product shots',
    id: 'includeProductShots',
    defaultChecked: true,
  });

  const includeBRoll = createCheckboxField({
    label: 'Include B-Roll',
    id: 'includeBRoll',
    defaultChecked: true,
  });

  const addCaptions = createCheckboxField({
    label: 'Add captions',
    id: 'addCaptions',
    defaultChecked: true,
  });

  // Main fields
  container.appendChild(url.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(adLength.wrap);
  row1.appendChild(adStyle.wrap);
  moreBody.appendChild(row1);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(tone.wrap);
  row2.appendChild(targetPlatform.wrap);
  moreBody.appendChild(row2);

  const row3 = window.document.createElement('div');
  row3.className = 'grid grid-cols-2 gap-4';
  row3.appendChild(speakerGender.wrap);
  row3.appendChild(narrationStyle.wrap);
  moreBody.appendChild(row3);

  const row4 = window.document.createElement('div');
  row4.className = 'grid grid-cols-2 gap-4';
  row4.appendChild(captionStyle.wrap);
  row4.appendChild(resolution.wrap);
  moreBody.appendChild(row4);

  moreBody.appendChild(aspectRatio.wrap);
  moreBody.appendChild(ctaText.wrap);

  moreBody.appendChild(includeProductShots.wrap);
  moreBody.appendChild(includeBRoll.wrap);
  moreBody.appendChild(addCaptions.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { url, adLength, adStyle, tone, targetPlatform, speakerGender, narrationStyle, captionStyle, resolution, aspectRatio, ctaText, includeProductShots, includeBRoll, addCaptions };

  return {
    getValues: async () => {
      url.clearError();

      const u = url.getTrimmed();
      if (!u) {
        url.setError('Please enter a product URL');
        throw new FieldValidationError('url', 'Please enter a product URL');
      }

      const out = {
        url: u,
        adLength: adLength.getValue(),
        adStyle: adStyle.getValue(),
        tone: tone.getValue(),
        targetPlatform: targetPlatform.getValue(),
        speakerGender: speakerGender.getValue(),
        narrationStyle: narrationStyle.getValue(),
        captionStyle: captionStyle.getValue(),
        resolution: resolution.getValue(),
        aspectRatio: aspectRatio.getValue(),
        includeProductShots: includeProductShots.getValue(),
        includeBRoll: includeBRoll.getValue(),
        addCaptions: addCaptions.getValue(),
      };

      const cta = ctaText.getTrimmed();
      if (cta) out.ctaText = cta;

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
