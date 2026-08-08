import { createTextAreaField, createTextInputField, createSelectField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const CONTENT_TYPES = [
  { value: 'article', label: 'Article' },
  { value: 'blog_post', label: 'Blog Post' },
  { value: 'product_page', label: 'Product Page' },
  { value: 'landing_page', label: 'Landing Page' },
  { value: 'homepage', label: 'Homepage' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const content = createTextAreaField({
    label: 'Content',
    id: 'content',
    required: true,
    rows: 8,
    placeholder: 'Paste your content here (HTML or plain text)...',
    help: 'The content will be analyzed for SEO optimization.',
  });

  const keywords = createTextInputField({
    label: 'Target keywords',
    id: 'keywords',
    required: true,
    placeholder: 'e.g., seo optimization, content marketing',
    help: 'Separate multiple keywords with commas.',
  });

  const contentType = createSelectField({
    label: 'Content type',
    id: 'contentType',
    required: false,
    options: CONTENT_TYPES,
    defaultValue: 'article',
  });

  const metaTitle = createTextInputField({
    label: 'Meta title',
    id: 'metaTitle',
    required: false,
    placeholder: 'Existing meta title (if any)',
  });

  const metaDescription = createTextAreaField({
    label: 'Meta description',
    id: 'metaDescription',
    required: false,
    rows: 2,
    placeholder: 'Existing meta description (if any)',
  });

  // Main fields
  container.appendChild(content.wrap);
  container.appendChild(keywords.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(contentType.wrap);
  moreBody.appendChild(metaTitle.wrap);
  moreBody.appendChild(metaDescription.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { content, keywords, contentType, metaTitle, metaDescription };

  return {
    getValues: async () => {
      content.clearError();
      keywords.clearError();

      const c = content.getTrimmed();
      if (!c) {
        content.setError('Please enter content');
        throw new FieldValidationError('content', 'Please enter content');
      }

      const kw = keywords.getTrimmed();
      if (!kw) {
        keywords.setError('Please enter keywords');
        throw new FieldValidationError('keywords', 'Please enter keywords');
      }

      const out = {
        content: c,
        keywords: kw,
        contentType: contentType.getValue(),
      };

      const title = metaTitle.getTrimmed();
      if (title) out.metaTitle = title;

      const desc = metaDescription.getTrimmed();
      if (desc) out.metaDescription = desc;

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
