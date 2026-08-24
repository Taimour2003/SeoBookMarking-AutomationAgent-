import { createMediaField, createSelectField, FieldValidationError } from './ui.js';

const GAME_STYLES = [
  { value: 'All Styles', label: 'All Styles' },
  { value: 'GTA', label: 'GTA' },
  { value: 'Fortnite', label: 'Fortnite' },
  { value: 'Minecraft', label: 'Minecraft' },
  { value: 'FIFA', label: 'FIFA' },
  { value: 'Call of Duty', label: 'Call of Duty' },
  { value: 'Tekken', label: 'Tekken' },
  { value: 'Street Fighter', label: 'Street Fighter' },
  { value: 'Mortal Kombat', label: 'Mortal Kombat' },
  { value: 'Assassins Creed', label: 'Assassins Creed' },
  { value: 'Cyberpunk', label: 'Cyberpunk' },
  { value: 'Elden Ring', label: 'Elden Ring' },
  { value: 'The Sims', label: 'The Sims' },
];

const COUNT_OPTIONS = [
  { value: '3', label: '3 styles' },
  { value: '6', label: '6 styles' },
  { value: '12', label: '12 styles' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const imageUrl = createMediaField({
    label: 'Face photo',
    id: 'imageUrl',
    required: true,
    kind: 'image',
    help: 'Upload a face photo to transform into game styles.',
  });

  const gameStyle = createSelectField({
    label: 'Game style',
    id: 'gameStyle',
    required: false,
    options: GAME_STYLES,
    defaultValue: 'All Styles',
    help: 'Choose a specific game or generate all styles.',
  });

  const count = createSelectField({
    label: 'Number of styles',
    id: 'count',
    required: false,
    options: COUNT_OPTIONS,
    defaultValue: '12',
    help: 'How many styles to generate.',
  });

  // Main fields
  container.appendChild(imageUrl.wrap);

  // More options
  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(gameStyle.wrap);
  optionsBody.appendChild(count.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { imageUrl, gameStyle, count };

  return {
    getValues: async () => {
      imageUrl.clearError();

      let img;
      try {
        img = await imageUrl.getValue();
      } catch (err) {
        imageUrl.setError('Please upload a face photo');
        throw new FieldValidationError('imageUrl', 'Please upload a face photo');
      }
      if (!img) {
        imageUrl.setError('Please upload a face photo');
        throw new FieldValidationError('imageUrl', 'Please upload a face photo');
      }

      const out = {
        imageUrl: img,
        gameStyle: gameStyle.getValue(),
      };

      // Only include count when "All Styles" is selected
      if (out.gameStyle === 'All Styles') {
        out.count = Number(count.getValue());
      }

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
