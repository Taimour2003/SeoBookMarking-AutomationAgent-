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

const OPTIMIZATION_TYPES = [
  { value: 'Full Listing Optimization', label: 'Full Listing Optimization' },
  { value: 'Title Optimization', label: 'Title Optimization' },
  { value: 'Bullet Points', label: 'Bullet Points' },
  { value: 'Backend Keywords', label: 'Backend Keywords' },
  { value: 'A+ Content', label: 'A+ Content' },
  { value: 'Keyword Research Only', label: 'Keyword Research Only' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const product = createTextAreaField({
    label: 'Product',
    id: 'product',
    required: true,
    placeholder: 'Product name and description...',
    rows: 3,
  });

  const category = createSelectField({
    label: 'Category',
    id: 'category',
    required: false,
    options: CATEGORIES,
    defaultValue: 'Electronics',
  });

  const targetKeywords = createTextAreaField({
    label: 'Target keywords',
    id: 'targetKeywords',
    required: false,
    placeholder: 'Target keywords (comma-separated)...',
    rows: 2,
  });

  const optimizationType = createSelectField({
    label: 'Optimization type',
    id: 'optimizationType',
    required: false,
    options: OPTIMIZATION_TYPES,
    defaultValue: 'Full Listing Optimization',
  });

  // Main fields
  container.appendChild(product.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(category.wrap);
  row1.appendChild(optimizationType.wrap);
  moreBody.appendChild(row1);

  moreBody.appendChild(targetKeywords.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { product, category, targetKeywords, optimizationType };

  return {
    getValues: async () => {
      product.clearError();

      const p = product.getTrimmed();
      if (!p) {
        product.setError('Please enter a product');
        throw new FieldValidationError('product', 'Please enter a product');
      }

      const values = {
        product: p,
        category: category.getValue(),
        optimizationType: optimizationType.getValue(),
      };

      const kw = targetKeywords.getTrimmed();
      if (kw) values.targetKeywords = kw;

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
