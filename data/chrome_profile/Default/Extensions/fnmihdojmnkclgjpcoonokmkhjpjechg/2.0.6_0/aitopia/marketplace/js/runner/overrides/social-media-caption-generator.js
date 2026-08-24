import { createTextAreaField, createTextInputField, createSelectField, createNumberField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'threads', label: 'Threads' },
  { value: 'pinterest', label: 'Pinterest' },
];

const TONES = [
  { value: 'casual', label: 'Casual' },
  { value: 'professional', label: 'Professional' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'inspirational', label: 'Inspirational' },
  { value: 'educational', label: 'Educational' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'storytelling', label: 'Storytelling' },
];

const CONTENT_TYPES = [
  { value: 'engagement', label: 'Engagement' },
  { value: 'product_launch', label: 'Product Launch' },
  { value: 'behind_the_scenes', label: 'Behind the Scenes' },
  { value: 'user_generated', label: 'User Generated' },
  { value: 'educational', label: 'Educational' },
  { value: 'promotional', label: 'Promotional' },
  { value: 'announcement', label: 'Announcement' },
  { value: 'lifestyle', label: 'Lifestyle' },
  { value: 'testimonial', label: 'Testimonial' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextAreaField({
    label: 'Topic',
    id: 'topic',
    required: true,
    rows: 3,
    placeholder: 'What is your post about?',
  });

  const platform = createSelectField({
    label: 'Platform',
    id: 'platform',
    required: false,
    options: PLATFORMS,
    defaultValue: 'instagram',
  });

  const context = createTextAreaField({
    label: 'Additional context',
    id: 'context',
    required: false,
    rows: 2,
    placeholder: 'Any additional details...',
  });

  const productName = createTextInputField({
    label: 'Product/brand name',
    id: 'productName',
    required: false,
    placeholder: 'e.g., Acme Inc.',
  });

  const keyPoints = createTextAreaField({
    label: 'Key points',
    id: 'keyPoints',
    required: false,
    rows: 2,
    placeholder: 'Key points to highlight (comma-separated)',
  });

  const writingStyle = createSelectField({
    label: 'Style',
    id: 'writingStyle',
    required: false,
    options: TONES,
    defaultValue: 'casual',
  });

  const contentType = createSelectField({
    label: 'Content type',
    id: 'contentType',
    required: false,
    options: CONTENT_TYPES,
    defaultValue: 'engagement',
  });

  const targetAudience = createTextInputField({
    label: 'Target audience',
    id: 'targetAudience',
    required: false,
    placeholder: 'e.g., young professionals, fitness enthusiasts',
  });

  const brandGuidelines = createTextAreaField({
    label: 'Brand guidelines',
    id: 'brandGuidelines',
    required: false,
    rows: 2,
    placeholder: 'Brand voice and style guidelines...',
  });

  const hashtagCount = createNumberField({
    label: 'Hashtag count',
    id: 'hashtagCount',
    required: false,
    min: 0,
    max: 30,
    defaultValue: 10,
  });

  const variationCount = createNumberField({
    label: 'Variations',
    id: 'variationCount',
    required: false,
    min: 1,
    max: 5,
    defaultValue: 3,
  });

  const includeHashtags = createCheckboxField({
    label: 'Include hashtags',
    id: 'includeHashtags',
    defaultChecked: true,
  });

  const includeEmojis = createCheckboxField({
    label: 'Include emojis',
    id: 'includeEmojis',
    defaultChecked: true,
  });

  const includeCTA = createCheckboxField({
    label: 'Include call-to-action',
    id: 'includeCTA',
    defaultChecked: true,
  });

  // Main fields
  container.appendChild(topic.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(platform.wrap);
  moreBody.appendChild(context.wrap);
  moreBody.appendChild(productName.wrap);
  moreBody.appendChild(keyPoints.wrap);

  const styleRow = window.document.createElement('div');
  styleRow.className = 'grid grid-cols-2 gap-4';
  styleRow.appendChild(writingStyle.wrap);
  styleRow.appendChild(contentType.wrap);
  moreBody.appendChild(styleRow);

  moreBody.appendChild(targetAudience.wrap);
  moreBody.appendChild(brandGuidelines.wrap);

  const countRow = window.document.createElement('div');
  countRow.className = 'grid grid-cols-2 gap-4';
  countRow.appendChild(hashtagCount.wrap);
  countRow.appendChild(variationCount.wrap);
  moreBody.appendChild(countRow);

  moreBody.appendChild(includeHashtags.wrap);
  moreBody.appendChild(includeEmojis.wrap);
  moreBody.appendChild(includeCTA.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, platform, context, productName, keyPoints, writingStyle, contentType, targetAudience, brandGuidelines, hashtagCount, variationCount, includeHashtags, includeEmojis, includeCTA };

  return {
    getValues: async () => {
      topic.clearError();

      const t = topic.getTrimmed();
      if (!t) {
        topic.setError('Please enter a topic');
        throw new FieldValidationError('topic', 'Please enter a topic');
      }

      const out = {
        topic: t,
        platform: platform.getValue(),
        writingStyle: writingStyle.getValue(),
        contentType: contentType.getValue(),
        hashtagCount: hashtagCount.getNumber() ?? 10,
        variationCount: variationCount.getNumber() ?? 3,
        includeHashtags: includeHashtags.getValue(),
        includeEmojis: includeEmojis.getValue(),
        includeCTA: includeCTA.getValue(),
      };

      const ctx = context.getTrimmed();
      if (ctx) out.context = ctx;

      const product = productName.getTrimmed();
      if (product) out.productName = product;

      const points = keyPoints.getTrimmed();
      if (points) out.keyPoints = points;

      const audience = targetAudience.getTrimmed();
      if (audience) out.targetAudience = audience;

      const brand = brandGuidelines.getTrimmed();
      if (brand) out.brandGuidelines = brand;

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
