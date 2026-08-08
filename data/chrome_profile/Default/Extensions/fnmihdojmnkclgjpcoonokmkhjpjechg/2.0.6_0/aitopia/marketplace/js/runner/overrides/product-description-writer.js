import { createTextInputField, createTextAreaField, createSelectField, createNumberField, createCheckboxField, FieldValidationError } from './ui.js';

function splitCommaList(value) {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

export async function render({ container }) {
  container.innerHTML = '';

  const productName = createTextInputField({
    label: 'Product name',
    id: 'productName',
    required: true,
    placeholder: 'e.g., Waterproof Hiking Backpack',
  });

  const productCategory = createTextInputField({
    label: 'Category',
    id: 'productCategory',
    required: false,
    placeholder: 'e.g., Outdoor gear',
  });

  const productBrand = createTextInputField({
    label: 'Brand',
    id: 'productBrand',
    required: false,
    placeholder: 'e.g., TrailPro',
  });

  const productPrice = createNumberField({
    label: 'Price',
    id: 'productPrice',
    required: false,
    min: 0,
    step: 0.01,
    help: 'Optional: helps the writer position value.',
  });

  const productCurrency = createTextInputField({
    label: 'Currency',
    id: 'productCurrency',
    required: false,
    placeholder: 'USD',
    defaultValue: 'USD',
  });

  const productFeatures = createTextAreaField({
    label: 'Key features',
    id: 'productFeatures',
    required: false,
    rows: 3,
    placeholder: 'Comma-separated. e.g., waterproof, lightweight, eco-friendly materials',
  });

  const platform = createSelectField({
    label: 'Platform',
    id: 'platform',
    required: false,
    options: [
      { value: 'generic', label: 'General' },
      { value: 'amazon', label: 'Amazon' },
      { value: 'shopify', label: 'Shopify' },
      { value: 'ebay', label: 'eBay' },
      { value: 'etsy', label: 'Etsy' },
      { value: 'woocommerce', label: 'WooCommerce' },
    ],
    defaultValue: 'generic',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: [
      { value: 'professional', label: 'Professional' },
      { value: 'casual', label: 'Casual' },
      { value: 'luxury', label: 'Luxury' },
      { value: 'playful', label: 'Playful' },
      { value: 'technical', label: 'Technical' },
      { value: 'persuasive', label: 'Persuasive' },
    ],
    defaultValue: 'professional',
  });

  const length = createSelectField({
    label: 'Length',
    id: 'length',
    required: false,
    options: [
      { value: 'short', label: 'Short' },
      { value: 'medium', label: 'Medium' },
      { value: 'long', label: 'Long' },
    ],
    defaultValue: 'medium',
  });

  const includeEmoji = createCheckboxField({
    label: 'Include emoji',
    id: 'includeEmoji',
    help: 'Optional: best for casual/social listings.',
    defaultChecked: false,
  });

  const targetKeywords = createTextAreaField({
    label: 'Target keywords',
    id: 'targetKeywords',
    required: false,
    rows: 2,
    placeholder: 'Comma-separated. e.g., hiking backpack, carry-on, waterproof backpack',
  });

  const language = createTextInputField({
    label: 'Language',
    id: 'language',
    required: false,
    placeholder: 'en',
    defaultValue: 'en',
    help: 'BCP-47 language code (e.g., en, en-US, tr).',
  });

  const advanced = document.createElement('details');
  advanced.className = '';
  const summary = document.createElement('summary');
  summary.className = 'cursor-pointer select-none text-sm font-semibold mb-3';
  summary.textContent = 'More options';
  advanced.appendChild(summary);
  const advancedBody = document.createElement('div');
  advancedBody.className = 'space-y-3';
  advancedBody.appendChild(productFeatures.wrap);
  advancedBody.appendChild(platform.wrap);
  advancedBody.appendChild(tone.wrap);
  advancedBody.appendChild(length.wrap);
  advancedBody.appendChild(includeEmoji.wrap);
  advancedBody.appendChild(productCategory.wrap);
  advancedBody.appendChild(productBrand.wrap);
  advancedBody.appendChild(productPrice.wrap);
  advancedBody.appendChild(productCurrency.wrap);
  advancedBody.appendChild(targetKeywords.wrap);
  advancedBody.appendChild(language.wrap);
  advanced.appendChild(advancedBody);

  container.appendChild(productName.wrap);
  container.appendChild(advanced);

  const fieldRefs = { productName, productCategory, productBrand, productPrice, productCurrency, productFeatures, platform, tone, length, includeEmoji, targetKeywords, language };

  return {
    getValues: async () => {
      productName.clearError();

      const name = productName.getTrimmed();
      if (!name) {
        productName.setError('Please enter a product name');
        throw new FieldValidationError('productName', 'Please enter a product name');
      }

      const features = splitCommaList(productFeatures.getTrimmed());
      const price = productPrice.getNumber();
      const currency = productCurrency.getTrimmed();

      const product = { name };
      const category = productCategory.getTrimmed();
      const brand = productBrand.getTrimmed();
      if (category) product.category = category;
      if (brand) product.brand = brand;
      if (Number.isFinite(price)) product.price = price;
      if (currency) product.currency = currency;
      if (features.length > 0) product.features = features;

      const keywords = splitCommaList(targetKeywords.getTrimmed());

      const out = {
        product,
        platform: platform.getValue(),
        tone: tone.getValue(),
        length: length.getValue(),
        includeEmoji: includeEmoji.getValue(),
      };

      if (keywords.length > 0) out.targetKeywords = keywords;
      const lang = language.getTrimmed();
      if (lang) out.language = lang;

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
