import { createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const PURPOSES = [
  { value: 'Market Research', label: 'Market Research' },
  { value: 'Content Ideas', label: 'Content Ideas' },
  { value: 'Competitor Analysis', label: 'Competitor Analysis' },
  { value: 'Customer Feedback', label: 'Customer Feedback' },
  { value: 'Trend Discovery', label: 'Trend Discovery' },
  { value: 'Community Building', label: 'Community Building' },
];

const INDUSTRIES = [
  { value: 'Technology', label: 'Technology' },
  { value: 'Gaming', label: 'Gaming' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Health & Fitness', label: 'Health & Fitness' },
  { value: 'E-commerce', label: 'E-commerce' },
  { value: 'SaaS', label: 'SaaS' },
  { value: 'Marketing', label: 'Marketing' },
  { value: 'Education', label: 'Education' },
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'Other', label: 'Other' },
];

const RESULT_COUNTS = [
  { value: '10', label: '10' },
  { value: '5', label: '5' },
  { value: '15', label: '15' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextAreaField({
    label: 'Topic',
    id: 'topic',
    required: true,
    rows: 3,
    placeholder: 'Topic, product, or brand to research on Reddit...',
  });

  const purpose = createSelectField({
    label: 'Purpose',
    id: 'purpose',
    required: true,
    options: PURPOSES,
    defaultValue: 'Market Research',
  });

  const industry = createSelectField({
    label: 'Industry',
    id: 'industry',
    required: false,
    options: INDUSTRIES,
    defaultValue: 'Technology',
  });

  const resultCount = createSelectField({
    label: 'Results',
    id: 'resultCount',
    required: false,
    options: RESULT_COUNTS,
    defaultValue: '10',
  });

  // Main fields
  container.appendChild(topic.wrap);
  container.appendChild(purpose.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(industry.wrap);
  row1.appendChild(resultCount.wrap);
  moreBody.appendChild(row1);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, purpose, industry, resultCount };

  return {
    getValues: async () => {
      topic.clearError();

      const t = topic.getTrimmed();
      if (!t) {
        topic.setError('Please enter a topic');
        throw new FieldValidationError('topic', 'Please enter a topic');
      }

      return {
        topic: t,
        purpose: purpose.getValue(),
        industry: industry.getValue(),
        resultCount: resultCount.getValue(),
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
