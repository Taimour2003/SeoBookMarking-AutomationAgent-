import { createMediaField, createSelectField, createTextInputField, createNumberField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const MOCKUP_TYPES = [
  { value: 't-shirt', label: 'T-Shirt' },
  { value: 'hoodie', label: 'Hoodie' },
  { value: 'mug', label: 'Mug' },
  { value: 'phone-case', label: 'Phone Case' },
  { value: 'tote-bag', label: 'Tote Bag' },
  { value: 'poster', label: 'Poster' },
  { value: 'frame', label: 'Frame' },
  { value: 'book-cover', label: 'Book Cover' },
  { value: 'packaging', label: 'Packaging' },
  { value: 'business-card', label: 'Business Card' },
  { value: 'laptop', label: 'Laptop' },
  { value: 'device-screen', label: 'Device Screen' },
];

const ANGLES = [
  { value: 'front', label: 'Front' },
  { value: 'back', label: 'Back' },
  { value: 'side', label: 'Side' },
  { value: 'angled', label: 'Angled' },
  { value: 'flat', label: 'Flat' },
];

const ENVIRONMENTS = [
  { value: 'studio', label: 'Studio' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'minimal', label: 'Minimal' },
  { value: 'outdoor', label: 'Outdoor' },
];

const MODEL_GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'neutral', label: 'Neutral' },
];

const QUALITIES = [
  { value: 'high', label: 'High' },
  { value: 'standard', label: 'Standard' },
  { value: 'ultra', label: 'Ultra' },
];

const RESOLUTIONS = [
  { value: '1500x1500', label: '1500x1500' },
  { value: '1024x1024', label: '1024x1024' },
  { value: '2048x2048', label: '2048x2048' },
];

const OUTPUT_FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const designImageUrl = createMediaField({
    label: 'Design image',
    id: 'designImageUrl',
    required: true,
    kind: 'image',
    help: 'Upload your design to place on mockup products.',
  });

  const mockupType = createSelectField({
    label: 'Mockup type',
    id: 'mockupType',
    required: false,
    options: MOCKUP_TYPES,
    defaultValue: 't-shirt',
  });

  const color = createTextInputField({
    label: 'Color',
    id: 'color',
    required: false,
    placeholder: 'white, black, navy...',
    defaultValue: 'white',
  });

  const angle = createSelectField({
    label: 'Angle',
    id: 'angle',
    required: false,
    options: ANGLES,
    defaultValue: 'front',
  });

  const environment = createSelectField({
    label: 'Environment',
    id: 'environment',
    required: false,
    options: ENVIRONMENTS,
    defaultValue: 'studio',
  });

  const includeModel = createCheckboxField({
    label: 'Include human model (apparel)',
    id: 'includeModel',
    defaultChecked: false,
  });

  const modelGender = createSelectField({
    label: 'Model gender',
    id: 'modelGender',
    required: false,
    options: MODEL_GENDERS,
    defaultValue: 'female',
  });

  const variations = createNumberField({
    label: 'Variations',
    id: 'variations',
    required: false,
    min: 1,
    max: 10,
    defaultValue: 1,
  });

  const quality = createSelectField({
    label: 'Quality',
    id: 'quality',
    required: false,
    options: QUALITIES,
    defaultValue: 'high',
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    options: RESOLUTIONS,
    defaultValue: '1500x1500',
  });

  const outputFormat = createSelectField({
    label: 'Output format',
    id: 'outputFormat',
    required: false,
    options: OUTPUT_FORMATS,
    defaultValue: 'png',
  });

  // Main fields
  container.appendChild(designImageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(color.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(mockupType.wrap);
  row1.appendChild(angle.wrap);
  moreBody.appendChild(row1);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(environment.wrap);
  row2.appendChild(variations.wrap);
  moreBody.appendChild(row2);

  const row3 = window.document.createElement('div');
  row3.className = 'grid grid-cols-2 gap-4';
  row3.appendChild(quality.wrap);
  row3.appendChild(resolution.wrap);
  moreBody.appendChild(row3);

  const row4 = window.document.createElement('div');
  row4.className = 'grid grid-cols-2 gap-4';
  row4.appendChild(outputFormat.wrap);
  row4.appendChild(modelGender.wrap);
  moreBody.appendChild(row4);

  moreBody.appendChild(includeModel.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { designImageUrl, mockupType, color, angle, environment, includeModel, modelGender, variations, quality, resolution, outputFormat };

  return {
    getValues: async () => {
      designImageUrl.clearError();

      let img;
      try {
        img = await designImageUrl.getValue();
      } catch (err) {
        img = null;
      }
      if (!img) {
        designImageUrl.setError('Please upload a design image');
        throw new FieldValidationError('designImageUrl', 'Please upload a design image');
      }

      return {
        designImageUrl: img,
        mockupType: mockupType.getValue(),
        color: color.getTrimmed() || 'white',
        angle: angle.getValue(),
        environment: environment.getValue(),
        includeModel: includeModel.getValue(),
        modelGender: modelGender.getValue(),
        variations: variations.getNumber() ?? 1,
        quality: quality.getValue(),
        resolution: resolution.getValue(),
        outputFormat: outputFormat.getValue(),
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
