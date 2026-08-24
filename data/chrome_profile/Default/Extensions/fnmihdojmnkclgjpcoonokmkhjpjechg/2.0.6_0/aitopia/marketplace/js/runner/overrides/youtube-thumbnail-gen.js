import { createTextInputField, createMediaField, createSelectField, createNumberField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const STYLES = [
  { value: 'Dramatic', label: 'Dramatic' },
  { value: 'Clean', label: 'Clean' },
  { value: 'Fun', label: 'Fun' },
  { value: 'Educational', label: 'Educational' },
  { value: 'Reaction', label: 'Reaction' },
  { value: 'Mystery', label: 'Mystery' },
  { value: 'Before/After', label: 'Before/After' },
  { value: 'Listicle', label: 'Listicle' },
];

const TEXT_POSITIONS = [
  { value: 'Center', label: 'Center' },
  { value: 'Top Left', label: 'Top Left' },
  { value: 'Top Center', label: 'Top Center' },
  { value: 'Top Right', label: 'Top Right' },
  { value: 'Bottom Left', label: 'Bottom Left' },
  { value: 'Bottom Center', label: 'Bottom Center' },
  { value: 'Bottom Right', label: 'Bottom Right' },
];

const FACE_POSITIONS = [
  { value: 'Right', label: 'Right' },
  { value: 'Left', label: 'Left' },
  { value: 'Center', label: 'Center' },
  { value: 'Background', label: 'Background' },
];

const BACKGROUNDS = [
  { value: 'Gradient', label: 'Gradient' },
  { value: 'Solid Color', label: 'Solid Color' },
  { value: 'AI Generated', label: 'AI Generated' },
  { value: 'Blurred', label: 'Blurred' },
];

const COLORS = [
  { value: 'Red (#FF0000)', label: 'Red' },
  { value: 'Yellow (#FFCC00)', label: 'Yellow' },
  { value: 'Blue (#007BFF)', label: 'Blue' },
  { value: 'Green (#4CAF50)', label: 'Green' },
  { value: 'Pink (#FF69B4)', label: 'Pink' },
  { value: 'Orange (#FF6B35)', label: 'Orange' },
  { value: 'Purple (#9C27B0)', label: 'Purple' },
];

const RESOLUTIONS = [
  { value: 'HD (1280x720)', label: 'HD (1280x720)' },
  { value: 'Full HD (1920x1080)', label: 'Full HD (1920x1080)' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const title = createTextInputField({
    label: 'Title',
    id: 'title',
    required: true,
    placeholder: 'Main thumbnail text (max 50 chars)',
  });

  const subtitle = createTextInputField({
    label: 'Subtitle',
    id: 'subtitle',
    required: false,
    placeholder: 'Optional subtitle (max 30 chars)',
  });

  const imageUrl = createMediaField({
    label: 'Reference image',
    id: 'imageUrl',
    required: false,
    kind: 'image',
    help: 'Optional face/subject image for the thumbnail.',
  });

  const style = createSelectField({
    label: 'Style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'Dramatic',
  });

  const textPosition = createSelectField({
    label: 'Text position',
    id: 'textPosition',
    required: false,
    options: TEXT_POSITIONS,
    defaultValue: 'Center',
  });

  const facePosition = createSelectField({
    label: 'Face position',
    id: 'facePosition',
    required: false,
    options: FACE_POSITIONS,
    defaultValue: 'Right',
  });

  const background = createSelectField({
    label: 'Background',
    id: 'background',
    required: false,
    options: BACKGROUNDS,
    defaultValue: 'Gradient',
  });

  const primaryColor = createSelectField({
    label: 'Primary color',
    id: 'primaryColor',
    required: false,
    options: COLORS,
    defaultValue: 'Red (#FF0000)',
  });

  const resolution = createSelectField({
    label: 'Resolution',
    id: 'resolution',
    required: false,
    options: RESOLUTIONS,
    defaultValue: 'HD (1280x720)',
  });

  const variations = createNumberField({
    label: 'Variations',
    id: 'variations',
    required: false,
    min: 1,
    max: 5,
    defaultValue: 3,
  });

  const enhanceFaces = createCheckboxField({
    label: 'Enhance faces',
    id: 'enhanceFaces',
    defaultChecked: true,
  });

  const addEmoji = createCheckboxField({
    label: 'Add emoji',
    id: 'addEmoji',
    defaultChecked: false,
  });

  const addArrows = createCheckboxField({
    label: 'Add arrows',
    id: 'addArrows',
    defaultChecked: false,
  });

  // Main fields
  container.appendChild(title.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(subtitle.wrap);
  moreBody.appendChild(imageUrl.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(style.wrap);
  row1.appendChild(textPosition.wrap);
  moreBody.appendChild(row1);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(facePosition.wrap);
  row2.appendChild(background.wrap);
  moreBody.appendChild(row2);

  const row3 = window.document.createElement('div');
  row3.className = 'grid grid-cols-2 gap-4';
  row3.appendChild(primaryColor.wrap);
  row3.appendChild(resolution.wrap);
  moreBody.appendChild(row3);

  moreBody.appendChild(variations.wrap);
  moreBody.appendChild(enhanceFaces.wrap);
  moreBody.appendChild(addEmoji.wrap);
  moreBody.appendChild(addArrows.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { title, subtitle, imageUrl, style, textPosition, facePosition, background, primaryColor, resolution, variations, enhanceFaces, addEmoji, addArrows };

  return {
    getValues: async () => {
      title.clearError();

      const t = title.getTrimmed();
      if (!t) {
        title.setError('Please enter a title');
        throw new FieldValidationError('title', 'Please enter a title');
      }

      const out = {
        title: t,
        style: style.getValue(),
        textPosition: textPosition.getValue(),
        facePosition: facePosition.getValue(),
        background: background.getValue(),
        primaryColor: primaryColor.getValue(),
        resolution: resolution.getValue(),
        variations: variations.getNumber() ?? 3,
        enhanceFaces: enhanceFaces.getValue(),
        addEmoji: addEmoji.getValue(),
        addArrows: addArrows.getValue(),
      };

      const sub = subtitle.getTrimmed();
      if (sub) out.subtitle = sub;

      try {
        const img = await imageUrl.getValue();
        if (img) out.imageUrl = img;
      } catch (err) {
        // Optional field, ignore errors
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
