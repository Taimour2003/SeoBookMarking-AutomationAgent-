import { createTextInputField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const TRICK_TYPES = [
  { value: 'Card Tricks', label: 'Card Tricks' },
  { value: 'Coin Tricks', label: 'Coin Tricks' },
  { value: 'Rope Tricks', label: 'Rope Tricks' },
  { value: 'Mentalism', label: 'Mentalism' },
  { value: 'Close-up Magic', label: 'Close-up Magic' },
  { value: 'Stage Illusions', label: 'Stage Illusions' },
  { value: 'Kids Magic', label: 'Kids Magic' },
  { value: 'Street Magic', label: 'Street Magic' },
];

const SKILL_LEVELS = [
  { value: 'Beginner', label: 'Beginner' },
  { value: 'Intermediate', label: 'Intermediate' },
  { value: 'Advanced', label: 'Advanced' },
  { value: 'Professional', label: 'Professional' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const trickType = createSelectField({
    label: 'Trick type',
    id: 'trickType',
    required: true,
    options: TRICK_TYPES,
    defaultValue: 'Card Tricks',
  });

  const skillLevel = createSelectField({
    label: 'Skill level',
    id: 'skillLevel',
    required: false,
    options: SKILL_LEVELS,
    defaultValue: 'Beginner',
  });

  const description = createTextInputField({
    label: 'Trick idea or theme',
    id: 'description',
    required: false,
    placeholder: 'e.g., disappearing coin, mind reading',
  });

  // Main fields
  container.appendChild(trickType.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(skillLevel.wrap);
  moreBody.appendChild(description.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { trickType, skillLevel, description };

  return {
    getValues: async () => {
      const out = {
        trickType: trickType.getValue(),
        skillLevel: skillLevel.getValue(),
      };

      const desc = description.getTrimmed();
      if (desc) out.description = desc;

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
