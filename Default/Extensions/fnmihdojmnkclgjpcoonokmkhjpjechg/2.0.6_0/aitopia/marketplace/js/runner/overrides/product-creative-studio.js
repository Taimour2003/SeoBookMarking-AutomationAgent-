import { createMediaField, createSelectField, createNumberField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const SCENE_TYPES = [
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'flat-lay', label: 'Flat Lay' },
  { value: 'hero-shot', label: 'Hero Shot' },
  { value: 'in-use', label: 'In Use' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'social-media', label: 'Social Media' },
  { value: 'editorial', label: 'Editorial' },
  { value: 'minimalist', label: 'Minimalist' },
];

const CAMPAIGNS = [
  { value: 'brand', label: 'Brand' },
  { value: 'launch', label: 'Launch' },
  { value: 'sale', label: 'Sale' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'social', label: 'Social' },
  { value: 'email', label: 'Email' },
  { value: 'ad', label: 'Ad' },
];

const STYLES = [
  { value: 'modern', label: 'Modern' },
  { value: 'classic', label: 'Classic' },
  { value: 'playful', label: 'Playful' },
  { value: 'luxury', label: 'Luxury' },
  { value: 'natural', label: 'Natural' },
  { value: 'bold', label: 'Bold' },
  { value: 'minimalist', label: 'Minimalist' },
];

const RESOLUTIONS = [
  { value: '1080x1080', label: '1080x1080 (Square)' },
  { value: '1200x628', label: '1200x628 (Facebook)' },
  { value: '1080x1920', label: '1080x1920 (Story)' },
  { value: '1920x1080', label: '1920x1080 (Landscape)' },
];

const QUALITIES = [
  { value: 'high', label: 'High' },
  { value: 'standard', label: 'Standard' },
  { value: 'ultra', label: 'Ultra' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const productImageUrl = createMediaField({
    label: 'Product image',
    id: 'productImageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the product image to create marketing scenes.',
  });

  const sceneType = createSelectField({
    label: 'Scene type',
    id: 'sceneType',
    required: false,
    options: SCENE_TYPES,
    defaultValue: 'lifestyle',
  });

  const campaign = createSelectField({
    label: 'Campaign',
    id: 'campaign',
    required: false,
    options: CAMPAIGNS,
    defaultValue: 'brand',
  });

  const style = createSelectField({
    label: 'Style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'modern',
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    options: RESOLUTIONS,
    defaultValue: '1080x1080',
  });

  const variations = createNumberField({
    label: 'Variations',
    id: 'variations',
    required: false,
    min: 1,
    max: 10,
    defaultValue: 3,
  });

  const quality = createSelectField({
    label: 'Quality',
    id: 'quality',
    required: false,
    options: QUALITIES,
    defaultValue: 'high',
  });

  const props = createCheckboxField({
    label: 'Include props',
    id: 'props',
    defaultChecked: true,
  });

  const humanElements = createCheckboxField({
    label: 'Human elements',
    id: 'humanElements',
    defaultChecked: false,
  });

  const textOverlay = createCheckboxField({
    label: 'Text overlay',
    id: 'textOverlay',
    defaultChecked: false,
  });

  // Main fields
  container.appendChild(productImageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(sceneType.wrap);
  row1.appendChild(campaign.wrap);
  moreBody.appendChild(row1);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(style.wrap);
  row2.appendChild(resolution.wrap);
  moreBody.appendChild(row2);

  const row3 = window.document.createElement('div');
  row3.className = 'grid grid-cols-2 gap-4';
  row3.appendChild(variations.wrap);
  row3.appendChild(quality.wrap);
  moreBody.appendChild(row3);

  moreBody.appendChild(props.wrap);
  moreBody.appendChild(humanElements.wrap);
  moreBody.appendChild(textOverlay.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { productImageUrl, sceneType, campaign, style, resolution, variations, quality, props, humanElements, textOverlay };

  return {
    getValues: async () => {
      productImageUrl.clearError();

      let img;
      try {
        img = await productImageUrl.getValue();
      } catch (err) {
        productImageUrl.setError('Please upload an image');
        throw new FieldValidationError('productImageUrl', 'Please upload an image');
      }
      if (!img) {
        productImageUrl.setError('Please upload an image');
        throw new FieldValidationError('productImageUrl', 'Please upload an image');
      }

      return {
        productImageUrl: img,
        sceneType: sceneType.getValue(),
        campaign: campaign.getValue(),
        style: style.getValue(),
        resolution: resolution.getValue(),
        variations: variations.getNumber() ?? 3,
        quality: quality.getValue(),
        props: props.getValue(),
        humanElements: humanElements.getValue(),
        textOverlay: textOverlay.getValue(),
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
