import { createTextInputField, createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const INDUSTRIES = [
  { value: 'Technology', label: 'Technology' },
  { value: 'E-commerce', label: 'E-commerce' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Finance', label: 'Finance' },
  { value: 'Education', label: 'Education' },
  { value: 'Food & Beverage', label: 'Food & Beverage' },
  { value: 'Fashion & Beauty', label: 'Fashion & Beauty' },
  { value: 'Travel', label: 'Travel' },
  { value: 'Real Estate', label: 'Real Estate' },
  { value: 'Fitness & Wellness', label: 'Fitness & Wellness' },
  { value: 'Entertainment', label: 'Entertainment' },
  { value: 'B2B Services', label: 'B2B Services' },
  { value: 'Other', label: 'Other' },
];

const GOALS = [
  { value: 'Brand Awareness', label: 'Brand Awareness' },
  { value: 'Lead Generation', label: 'Lead Generation' },
  { value: 'Sales & Conversions', label: 'Sales & Conversions' },
  { value: 'Customer Engagement', label: 'Customer Engagement' },
  { value: 'Thought Leadership', label: 'Thought Leadership' },
  { value: 'Community Building', label: 'Community Building' },
];

const CONTENT_TYPES = [
  { value: 'All Formats', label: 'All Formats' },
  { value: 'Blog Posts', label: 'Blog Posts' },
  { value: 'Social Media', label: 'Social Media' },
  { value: 'Video Content', label: 'Video Content' },
  { value: 'Email Marketing', label: 'Email Marketing' },
  { value: 'Podcasts', label: 'Podcasts' },
];

const TIMEFRAMES = [
  { value: '1 Month', label: '1 Month' },
  { value: '1 Week', label: '1 Week' },
  { value: '2 Weeks', label: '2 Weeks' },
  { value: '3 Months', label: '3 Months' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const brandName = createTextInputField({
    label: 'Brand name',
    id: 'brandName',
    required: true,
    placeholder: 'Your brand or business name',
  });

  const brandDescription = createTextAreaField({
    label: 'Brand description',
    id: 'brandDescription',
    required: true,
    rows: 3,
    placeholder: 'Brief description of your brand, products/services, and unique value proposition...',
  });

  const industry = createSelectField({
    label: 'Industry',
    id: 'industry',
    required: true,
    options: INDUSTRIES,
    defaultValue: 'Technology',
  });

  const goals = createSelectField({
    label: 'Goal',
    id: 'goals',
    required: true,
    options: GOALS,
    defaultValue: 'Brand Awareness',
  });

  const targetAudience = createTextAreaField({
    label: 'Target audience',
    id: 'targetAudience',
    required: false,
    rows: 2,
    placeholder: 'Describe your ideal customer (age, interests, pain points, goals)...',
  });

  const contentTypes = createSelectField({
    label: 'Content types',
    id: 'contentTypes',
    required: false,
    options: CONTENT_TYPES,
    defaultValue: 'All Formats',
  });

  const timeframe = createSelectField({
    label: 'Timeframe',
    id: 'timeframe',
    required: false,
    options: TIMEFRAMES,
    defaultValue: '1 Month',
  });

  // Main fields
  container.appendChild(brandName.wrap);
  container.appendChild(brandDescription.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(industry.wrap);
  row1.appendChild(goals.wrap);
  container.appendChild(row1);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(targetAudience.wrap);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(contentTypes.wrap);
  row2.appendChild(timeframe.wrap);
  moreBody.appendChild(row2);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { brandName, brandDescription, industry, goals, targetAudience, contentTypes, timeframe };

  return {
    getValues: async () => {
      brandName.clearError();
      brandDescription.clearError();

      const name = brandName.getTrimmed();
      if (!name) {
        brandName.setError('Please enter a brand name');
        throw new FieldValidationError('brandName', 'Please enter a brand name');
      }

      const desc = brandDescription.getTrimmed();
      if (!desc) {
        brandDescription.setError('Please enter a brand description');
        throw new FieldValidationError('brandDescription', 'Please enter a brand description');
      }

      const out = {
        brandName: name,
        brandDescription: desc,
        industry: industry.getValue(),
        goals: goals.getValue(),
        contentTypes: contentTypes.getValue(),
        timeframe: timeframe.getValue(),
      };

      const audience = targetAudience.getTrimmed();
      if (audience) out.targetAudience = audience;

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
