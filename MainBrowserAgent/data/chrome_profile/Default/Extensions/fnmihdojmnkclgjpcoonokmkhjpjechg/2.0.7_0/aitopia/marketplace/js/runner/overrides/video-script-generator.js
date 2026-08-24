import { createTextAreaField, createTextInputField, createSelectField, createCheckboxField, createMoreOptionsDisclosure, FieldValidationError } from './ui.js';

const PLATFORMS = [
  { value: 'YouTube (Long Form)', label: 'YouTube (Long Form)' },
  { value: 'YouTube Shorts', label: 'YouTube Shorts' },
  { value: 'TikTok', label: 'TikTok' },
  { value: 'Instagram Reels', label: 'Instagram Reels' },
  { value: 'LinkedIn', label: 'LinkedIn' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Podcast', label: 'Podcast' },
  { value: 'Presentation', label: 'Presentation' },
];

const CONTENT_TYPES = [
  { value: 'Tutorial / How-To', label: 'Tutorial / How-To' },
  { value: 'Explainer', label: 'Explainer' },
  { value: 'Listicle (Top 5, 10 Tips, etc.)', label: 'Listicle' },
  { value: 'Promotional / Ad', label: 'Promotional / Ad' },
  { value: 'Testimonial', label: 'Testimonial' },
  { value: 'Vlog', label: 'Vlog' },
  { value: 'Interview', label: 'Interview' },
  { value: 'Product Demo', label: 'Product Demo' },
  { value: 'Educational', label: 'Educational' },
  { value: 'Entertainment', label: 'Entertainment' },
];

const DURATIONS = [
  { value: '15 seconds', label: '15 seconds' },
  { value: '30 seconds', label: '30 seconds' },
  { value: '1 minute', label: '1 minute' },
  { value: '2 minutes', label: '2 minutes' },
  { value: '3 minutes', label: '3 minutes' },
  { value: '5 minutes', label: '5 minutes' },
  { value: '8 minutes', label: '8 minutes' },
  { value: '10 minutes', label: '10 minutes' },
  { value: '15 minutes', label: '15 minutes' },
  { value: '20 minutes', label: '20 minutes' },
];

const TONES = [
  { value: 'Conversational', label: 'Conversational' },
  { value: 'Professional', label: 'Professional' },
  { value: 'Casual & Friendly', label: 'Casual & Friendly' },
  { value: 'Energetic & Upbeat', label: 'Energetic & Upbeat' },
  { value: 'Authoritative', label: 'Authoritative' },
  { value: 'Inspirational', label: 'Inspirational' },
  { value: 'Humorous', label: 'Humorous' },
];

export async function render({ container }) {
  container.innerHTML = '';

  const topic = createTextInputField({
    label: 'Topic',
    id: 'topic',
    required: true,
    placeholder: 'e.g., How to Start a YouTube Channel',
  });

  const mainPoints = createTextAreaField({
    label: 'Key points',
    id: 'mainPoints',
    required: true,
    rows: 4,
    placeholder: 'List the main points to cover (one per line or comma-separated)...',
    help: 'These will form the structure of your video.',
  });

  const platform = createSelectField({
    label: 'Platform',
    id: 'platform',
    required: false,
    options: PLATFORMS,
    defaultValue: 'YouTube (Long Form)',
  });

  const contentType = createSelectField({
    label: 'Content type',
    id: 'contentType',
    required: false,
    options: CONTENT_TYPES,
    defaultValue: 'Tutorial / How-To',
  });

  const duration = createSelectField({
    label: 'Duration',
    id: 'duration',
    required: false,
    options: DURATIONS,
    defaultValue: '5 minutes',
  });

  const targetAudience = createTextInputField({
    label: 'Target audience',
    id: 'targetAudience',
    required: false,
    placeholder: 'e.g., Beginner content creators',
  });

  const goal = createTextInputField({
    label: 'Goal',
    id: 'goal',
    required: false,
    placeholder: 'What should viewers learn or do?',
  });

  const tone = createSelectField({
    label: 'Tone',
    id: 'tone',
    required: false,
    options: TONES,
    defaultValue: 'Conversational',
  });

  const includeHooks = createCheckboxField({
    label: 'Generate hooks',
    id: 'includeHooks',
    help: 'Create attention-grabbing opening options.',
    defaultChecked: true,
  });

  const includeBRoll = createCheckboxField({
    label: 'B-Roll suggestions',
    id: 'includeBRoll',
    help: 'Include visual footage recommendations.',
    defaultChecked: true,
  });

  const includeCTA = createCheckboxField({
    label: 'Include call-to-action',
    id: 'includeCTA',
    defaultChecked: true,
  });

  // Main fields
  container.appendChild(topic.wrap);
  container.appendChild(mainPoints.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';

  const row1 = window.document.createElement('div');
  row1.className = 'grid grid-cols-2 gap-4';
  row1.appendChild(platform.wrap);
  row1.appendChild(contentType.wrap);
  moreBody.appendChild(row1);

  const row2 = window.document.createElement('div');
  row2.className = 'grid grid-cols-2 gap-4';
  row2.appendChild(duration.wrap);
  row2.appendChild(tone.wrap);
  moreBody.appendChild(row2);

  moreBody.appendChild(targetAudience.wrap);
  moreBody.appendChild(goal.wrap);

  moreBody.appendChild(includeHooks.wrap);
  moreBody.appendChild(includeBRoll.wrap);
  moreBody.appendChild(includeCTA.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { topic, mainPoints, platform, contentType, duration, targetAudience, goal, tone, includeHooks, includeBRoll, includeCTA };

  return {
    getValues: async () => {
      topic.clearError();
      mainPoints.clearError();

      const t = topic.getTrimmed();
      if (!t) {
        topic.setError('Please enter a topic');
        throw new FieldValidationError('topic', 'Please enter a topic');
      }

      const points = mainPoints.getTrimmed();
      if (!points) {
        mainPoints.setError('Please enter key points');
        throw new FieldValidationError('mainPoints', 'Please enter key points');
      }

      const out = {
        topic: t,
        mainPoints: points,
        platform: platform.getValue(),
        contentType: contentType.getValue(),
        duration: duration.getValue(),
        tone: tone.getValue(),
        includeHooks: includeHooks.getValue(),
        includeBRoll: includeBRoll.getValue(),
        includeCTA: includeCTA.getValue(),
      };

      const audience = targetAudience.getTrimmed();
      if (audience) out.targetAudience = audience;

      const g = goal.getTrimmed();
      if (g) out.goal = g;

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
