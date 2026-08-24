import { createTextAreaField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const CATEGORIES = [
  { value: 'Electronics', label: 'Electronics' },
  { value: 'Home & Kitchen', label: 'Home & Kitchen' },
  { value: 'Clothing & Fashion', label: 'Clothing & Fashion' },
  { value: 'Beauty & Personal Care', label: 'Beauty & Personal Care' },
  { value: 'Sports & Outdoors', label: 'Sports & Outdoors' },
  { value: 'Toys & Games', label: 'Toys & Games' },
  { value: 'Books', label: 'Books' },
  { value: 'Health & Wellness', label: 'Health & Wellness' },
  { value: 'Automotive', label: 'Automotive' },
  { value: 'Pet Supplies', label: 'Pet Supplies' },
  { value: 'Office Products', label: 'Office Products' },
  { value: 'Garden & Outdoor', label: 'Garden & Outdoor' },
  { value: 'Baby Products', label: 'Baby Products' },
  { value: 'Grocery', label: 'Grocery' },
  { value: 'Other', label: 'Other' },
];

const ANALYSIS_TYPES = [
  { value: 'Product Research', label: 'Product Research' },
  { value: 'Competitor Analysis', label: 'Competitor Analysis' },
  { value: 'Price Comparison', label: 'Price Comparison' },
  { value: 'Review Analysis', label: 'Review Analysis' },
  { value: 'Market Opportunity', label: 'Market Opportunity' },
];

const REGIONS = [
  { value: 'North America (US, CA, MX)', label: 'North America (US, CA, MX)' },
  { value: 'Europe (UK, DE, FR, IT, ES)', label: 'Europe (UK, DE, FR, IT, ES)' },
  { value: 'Asia Pacific (JP, AU, IN, SG)', label: 'Asia Pacific (JP, AU, IN, SG)' },
  { value: 'Middle East (AE, SA, TR)', label: 'Middle East (AE, SA, TR)' },
  { value: 'Global (All regions)', label: 'Global (All regions)' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const query = createTextAreaField({
    label: 'Search query',
    id: 'query',
    required: true,
    placeholder: 'Product name, keywords, or ASIN to search...',
    rows: 3,
  });

  const category = createSelectField({
    label: 'Category',
    id: 'category',
    required: false,
    options: CATEGORIES,
    defaultValue: 'Electronics',
  });

  const analysisType = createSelectField({
    label: 'Analysis type',
    id: 'analysisType',
    required: false,
    options: ANALYSIS_TYPES,
    defaultValue: 'Product Research',
  });

  const region = createSelectField({
    label: 'Region',
    id: 'region',
    required: false,
    options: REGIONS,
    defaultValue: 'North America (US, CA, MX)',
  });

  // Main fields
  container.appendChild(query.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(category.wrap);

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(analysisType.wrap);
  row1.appendChild(region.wrap);
  moreBody.appendChild(row1);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { query, category, analysisType, region };

  return {
    getValues: async () => {
      query.clearError();

      const q = query.getTrimmed();
      if (!q) {
        query.setError('Please enter a search query');
        throw new FieldValidationError('query', 'Please enter a search query');
      }

      return {
        query: q,
        category: category.getValue(),
        analysisType: analysisType.getValue(),
        region: region.getValue(),
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
