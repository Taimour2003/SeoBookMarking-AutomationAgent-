import { createTextAreaField, createTextInputField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const SECTIONS = [
  { value: 'Simple (Hero Only)', label: 'Simple (Hero Only)' },
  { value: 'Standard (With Features)', label: 'Standard (With Features)' },
  { value: 'Business (With Pricing)', label: 'Business (With Pricing)' },
  { value: 'Trust (With Testimonials)', label: 'Trust (With Testimonials)' },
  { value: 'Complete (All Sections)', label: 'Complete (All Sections)' },
];

const STYLES = [
  { value: 'Modern Minimal', label: 'Modern Minimal' },
  { value: 'Bold & Colorful', label: 'Bold & Colorful' },
  { value: 'Corporate Professional', label: 'Corporate Professional' },
  { value: 'Creative & Playful', label: 'Creative & Playful' },
  { value: 'Dark Mode', label: 'Dark Mode' },
];

const PRIMARY_COLORS = [
  { value: 'Blue', label: 'Blue' },
  { value: 'Purple', label: 'Purple' },
  { value: 'Green', label: 'Green' },
  { value: 'Orange', label: 'Orange' },
  { value: 'Red', label: 'Red' },
  { value: 'Neutral', label: 'Neutral' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const description = createTextAreaField({
    label: 'Description',
    id: 'description',
    required: true,
    placeholder: 'Describe your product/service and landing page goal...',
    rows: 4,
  });

  const sections = createSelectField({
    label: 'Page complexity',
    id: 'sections',
    required: false,
    options: SECTIONS,
    defaultValue: 'Standard (With Features)',
  });

  const style = createSelectField({
    label: 'Design style',
    id: 'style',
    required: false,
    options: STYLES,
    defaultValue: 'Modern Minimal',
  });

  const primaryColor = createSelectField({
    label: 'Primary color',
    id: 'primaryColor',
    required: false,
    options: PRIMARY_COLORS,
    defaultValue: 'Blue',
  });

  const ctaText = createTextInputField({
    label: 'CTA button text',
    id: 'ctaText',
    required: false,
    placeholder: 'Get Started',
  });

  // Main fields
  container.appendChild(description.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(ctaText.wrap);
  moreBody.appendChild(sections.wrap);
  moreBody.appendChild(style.wrap);
  moreBody.appendChild(primaryColor.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { description, sections, style, primaryColor, ctaText };

  return {
    getValues: async () => {
      description.clearError();

      const desc = description.getTrimmed();
      if (!desc) {
        description.setError('Please enter a description');
        throw new FieldValidationError('description', 'Please enter a description');
      }

      const values = {
        description: desc,
        sections: sections.getValue(),
        style: style.getValue(),
        primaryColor: primaryColor.getValue(),
      };

      const cta = ctaText.getTrimmed();
      if (cta) values.ctaText = cta;

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
