import { createTextAreaField, createTextInputField, createSelectField, FieldValidationError } from './ui.js';

const GENDERS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' },
];

const AGE_GROUPS = [
  { value: 'Child', label: 'Child' },
  { value: 'Teen', label: 'Teen' },
  { value: 'Young Adult', label: 'Young Adult' },
  { value: 'Adult', label: 'Adult' },
  { value: 'Middle Age', label: 'Middle Age' },
  { value: 'Senior', label: 'Senior' },
];

const STYLES = [
  { value: 'Realistic', label: 'Realistic' },
  { value: 'Anime', label: 'Anime' },
  { value: 'Fantasy', label: 'Fantasy' },
  { value: 'Cartoon', label: 'Cartoon' },
  { value: 'Comic Book', label: 'Comic Book' },
  { value: '3D Render', label: '3D Render' },
];

const POSES = [
  { value: 'Portrait', label: 'Portrait' },
  { value: 'Full Body', label: 'Full Body' },
  { value: 'Upper Body', label: 'Upper Body' },
  { value: 'Action Pose', label: 'Action Pose' },
  { value: 'Sitting', label: 'Sitting' },
];

const EXPRESSIONS = [
  { value: 'Neutral', label: 'Neutral' },
  { value: 'Happy', label: 'Happy' },
  { value: 'Sad', label: 'Sad' },
  { value: 'Angry', label: 'Angry' },
  { value: 'Surprised', label: 'Surprised' },
  { value: 'Thoughtful', label: 'Thoughtful' },
];

const BACKGROUNDS = [
  { value: 'Plain White', label: 'Plain White' },
  { value: 'Plain Black', label: 'Plain Black' },
  { value: 'Gradient', label: 'Gradient' },
  { value: 'Nature', label: 'Nature' },
  { value: 'Urban', label: 'Urban' },
  { value: 'Fantasy', label: 'Fantasy' },
  { value: 'Studio', label: 'Studio' },
];

const COUNTS = [
  { value: '1', label: '1' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const description = createTextAreaField({
    label: 'Character description',
    id: 'description',
    required: true,
    rows: 3,
    placeholder: 'Describe your character in detail...',
    help: 'Detailed description of the character you want to create.',
  });

  const name = createTextInputField({
    label: 'Character name',
    id: 'name',
    required: false,
    placeholder: 'e.g., Alex, Luna, Max',
    help: 'Optional name for your character.',
  });

  const gender = createSelectField({
    label: 'Gender',
    id: 'gender',
    required: false,
    options: GENDERS,
    defaultValue: 'Male',
  });

  const ageGroup = createSelectField({
    label: 'Age',
    id: 'ageGroup',
    required: false,
    options: AGE_GROUPS,
    defaultValue: 'Adult',
  });

  const style = createSelectField({
    label: 'Art style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'Realistic',
  });

  const pose = createSelectField({
    label: 'Pose',
    id: 'pose',
    required: false,
    options: POSES,
    defaultValue: 'Portrait',
  });

  const expression = createSelectField({
    label: 'Expression',
    id: 'expression',
    required: false,
    options: EXPRESSIONS,
    defaultValue: 'Neutral',
  });

  const background = createSelectField({
    label: 'Background',
    id: 'background',
    required: false,
    options: BACKGROUNDS,
    defaultValue: 'Studio',
  });

  const count = createSelectField({
    label: 'Number of images',
    id: 'count',
    required: false,
    options: COUNTS,
    defaultValue: '1',
  });

  // Main fields
  container.appendChild(description.wrap);

  // More options
  const moreOptions = document.createElement('details');
  moreOptions.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  moreOptions.appendChild(summary);

  const optionsBody = document.createElement('div');
  optionsBody.className = 'space-y-4';
  optionsBody.appendChild(name.wrap);
  optionsBody.appendChild(gender.wrap);
  optionsBody.appendChild(ageGroup.wrap);
  optionsBody.appendChild(style.wrap);
  optionsBody.appendChild(pose.wrap);
  optionsBody.appendChild(expression.wrap);
  optionsBody.appendChild(background.wrap);
  optionsBody.appendChild(count.wrap);
  moreOptions.appendChild(optionsBody);

  container.appendChild(moreOptions);

  const fieldRefs = { description, name, gender, ageGroup, style, pose, expression, background, count };

  return {
    getValues: async () => {
      description.clearError();

      const descVal = description.getTrimmed();
      if (!descVal) {
        description.setError('Please enter a character description');
        throw new FieldValidationError('description', 'Please enter a character description');
      }

      const out = {
        description: descVal,
      };

      const nameVal = name.getTrimmed();
      if (nameVal) out.name = nameVal;

      const genderVal = gender.getValue();
      if (genderVal) out.gender = genderVal;

      const ageVal = ageGroup.getValue();
      if (ageVal) out.ageGroup = ageVal;

      const styleVal = style.getValue();
      if (styleVal) out.style = styleVal;

      const poseVal = pose.getValue();
      if (poseVal) out.pose = poseVal;

      const exprVal = expression.getValue();
      if (exprVal) out.expression = exprVal;

      const bgVal = background.getValue();
      if (bgVal) out.background = bgVal;

      const countVal = count.getValue();
      if (countVal) out.count = parseInt(countVal, 10);

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
