import { createMediaField, createSelectField, createNumberField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const ETHNICITIES = [
  { value: 'Diverse (Multiple Ethnicities)', label: 'Diverse' },
  { value: 'African', label: 'African' },
  { value: 'African American', label: 'African American' },
  { value: 'East Asian (Chinese, Japanese, Korean)', label: 'East Asian' },
  { value: 'South Asian (Indian Subcontinent)', label: 'South Asian' },
  { value: 'Southeast Asian (Thai, Vietnamese, Filipino)', label: 'Southeast Asian' },
  { value: 'Western European', label: 'Western European' },
  { value: 'Eastern European', label: 'Eastern European' },
  { value: 'Hispanic / Latino', label: 'Hispanic / Latino' },
  { value: 'Middle Eastern', label: 'Middle Eastern' },
  { value: 'Native American', label: 'Native American' },
  { value: 'Pacific Islander', label: 'Pacific Islander' },
  { value: 'Mixed Heritage', label: 'Mixed Heritage' },
];

const GENDERS = [
  { value: 'Diverse (Female & Male)', label: 'Diverse' },
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
];

const AGE_RANGES = [
  { value: 'Adult (26-40)', label: 'Adult (26-40)' },
  { value: 'Young Adult (18-25)', label: 'Young Adult (18-25)' },
  { value: 'Middle Aged (41-55)', label: 'Middle Aged (41-55)' },
  { value: 'Senior (56+)', label: 'Senior (56+)' },
];

const RESOLUTIONS = [
  { value: '1024x1024', label: '1024x1024' },
  { value: '768x1024', label: '768x1024' },
  { value: '1024x1536', label: '1024x1536' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Product image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload the product/clothing image with a model.',
  });

  const ethnicity = createSelectField({
    label: 'Ethnicity',
    id: 'ethnicity',
    required: false,
    options: ETHNICITIES,
    defaultValue: 'Diverse (Multiple Ethnicities)',
  });

  const gender = createSelectField({
    label: 'Gender',
    id: 'gender',
    required: false,
    options: GENDERS,
    defaultValue: 'Diverse (Female & Male)',
  });

  const ageRange = createSelectField({
    label: 'Age range',
    id: 'ageRange',
    required: false,
    options: AGE_RANGES,
    defaultValue: 'Adult (26-40)',
  });

  const modelCount = createNumberField({
    label: 'Model count',
    id: 'modelCount',
    required: false,
    min: 1,
    max: 10,
    defaultValue: 4,
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    options: RESOLUTIONS,
    defaultValue: '1024x1024',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(ethnicity.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(gender.wrap);
  row1.appendChild(ageRange.wrap);
  moreBody.appendChild(row1);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(modelCount.wrap);
  row2.appendChild(resolution.wrap);
  moreBody.appendChild(row2);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { imageUrl, ethnicity, gender, ageRange, modelCount, resolution };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let img;
      try {
        img = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload a product image');
        throw new FieldValidationError('imageUrl', 'Please upload a product image');
      }

      if (!img) {
        imageUrl.setError('Please upload a product image');
        throw new FieldValidationError('imageUrl', 'Please upload a product image');
      }

      return {
        imageUrl: img,
        ethnicity: ethnicity.getValue(),
        gender: gender.getValue(),
        ageRange: ageRange.getValue(),
        modelCount: modelCount.getNumber() ?? 4,
        resolution: resolution.getValue(),
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
