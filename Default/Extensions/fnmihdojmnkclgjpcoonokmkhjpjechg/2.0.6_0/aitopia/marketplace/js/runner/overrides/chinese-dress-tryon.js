import { createMediaField, createTextInputField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const DRESS_STYLES = [
  { value: 'Qipao (Traditional Cheongsam)', label: 'Qipao (Traditional Cheongsam)' },
  { value: 'Hanfu (Ancient Chinese Robes)', label: 'Hanfu (Ancient Chinese Robes)' },
  { value: 'Modern Chinese Fusion', label: 'Modern Chinese Fusion' },
  { value: 'Tang Suit', label: 'Tang Suit' },
  { value: 'Ethnic Minority Style', label: 'Ethnic Minority Style' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Person image',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload a photo of the person to apply the dress to.',
  });

  const dressStyle = createSelectField({
    label: 'Dress style',
    id: 'dressStyle',
    required: false,
    options: DRESS_STYLES,
    defaultValue: 'Qipao (Traditional Cheongsam)',
  });

  const dressColor = createTextInputField({
    label: 'Dress color',
    id: 'dressColor',
    required: false,
    placeholder: 'e.g., red and gold, emerald green...',
  });

  const details = createTextInputField({
    label: 'Details',
    id: 'details',
    required: false,
    placeholder: 'e.g., floral pattern, high slit, long sleeves...',
  });

  const negativePrompt = createTextInputField({
    label: 'Negative prompt',
    id: 'negativePrompt',
    required: false,
    placeholder: 'Things to exclude from generation...',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(dressStyle.wrap);
  moreBody.appendChild(dressColor.wrap);
  moreBody.appendChild(details.wrap);
  moreBody.appendChild(negativePrompt.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { imageUrl, dressStyle, dressColor, details, negativePrompt };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let img;
      try {
        img = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload a person image');
        throw new FieldValidationError('imageUrl', 'Please upload a person image');
      }

      if (!img) {
        imageUrl.setError('Please upload a person image');
        throw new FieldValidationError('imageUrl', 'Please upload a person image');
      }

      const values = {
        imageUrl: img,
        dressStyle: dressStyle.getValue(),
      };

      const color = dressColor.getTrimmed();
      if (color) values.dressColor = color;

      const det = details.getTrimmed();
      if (det) values.details = det;

      const neg = negativePrompt.getTrimmed();
      if (neg) values.negativePrompt = neg;

      return values;
    },
    setFieldError: (fieldId, message) => {
      const field = fieldRefs[fieldId];
      if (field && typeof field.setError === 'function') {
        field.setError(message);
      }
    },
  };
}
