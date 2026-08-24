import { createTextAreaField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
];

const ANALYSIS_DEPTHS = [
  { value: 'standard', label: 'Standard' },
  { value: 'quick', label: 'Quick' },
  { value: 'deep', label: 'Deep' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const data = createTextAreaField({
    label: 'Data',
    id: 'data',
    required: true,
    placeholder: 'Paste your CSV or JSON data here...',
    rows: 8,
  });

  const format = createSelectField({
    label: 'Format',
    id: 'format',
    required: false,
    options: FORMATS,
    defaultValue: 'csv',
  });

  const analysisDepth = createSelectField({
    label: 'Analysis depth',
    id: 'analysisDepth',
    required: false,
    options: ANALYSIS_DEPTHS,
    defaultValue: 'standard',
  });

  const hasHeaders = createCheckboxField({
    label: 'Data has headers',
    id: 'hasHeaders',
    defaultChecked: true,
  });

  // Main fields
  container.appendChild(data.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(format.wrap);
  moreBody.appendChild(analysisDepth.wrap);
  moreBody.appendChild(hasHeaders.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { data, format, analysisDepth, hasHeaders };

  return {
    getValues: async () => {
      data.clearError();

      const d = data.getTrimmed();
      if (!d) {
        data.setError('Please enter your data');
        throw new FieldValidationError('data', 'Please enter your data');
      }

      return {
        data: d,
        format: format.getValue(),
        analysisDepth: analysisDepth.getValue(),
        hasHeaders: hasHeaders.getValue(),
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
