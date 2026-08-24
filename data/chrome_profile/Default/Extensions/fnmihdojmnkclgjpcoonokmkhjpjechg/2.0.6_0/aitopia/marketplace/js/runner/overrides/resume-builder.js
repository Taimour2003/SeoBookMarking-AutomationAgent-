import { createTextAreaField, createTextInputField, createSelectField, createCheckboxField, createFieldLabel, createHelpToggle, createMoreOptionsDisclosure, setHidden, updateFormData, FieldValidationError } from './ui.js';

const TEMPLATES = [
  { value: 'modern', label: 'Modern' },
  { value: 'classic', label: 'Classic' },
  { value: 'creative', label: 'Creative' },
  { value: 'minimalist', label: 'Minimalist' },
  { value: 'executive', label: 'Executive' },
  { value: 'tech', label: 'Tech' },
  { value: 'academic', label: 'Academic' },
];

const OUTPUT_FORMATS = [
  { value: 'markdown', label: 'Markdown' },
  { value: 'html', label: 'HTML' },
  { value: 'json', label: 'JSON' },
];

function createPillToggle({ label, id, options, defaultValue, help }) {
  const wrap = document.createElement('div');
  const fieldKey = id || label || 'pillToggle';
  if (id) wrap.setAttribute('data-id', id);

  const header = document.createElement('div');
  header.className = 'mb-3';
  const row = document.createElement('div');
  row.className = 'flex items-center';

  const labelEl = createFieldLabel(label, { required: true });
  labelEl.className = 'block text-sm font-semibold';
  row.appendChild(labelEl);

  const { trigger, panel } = createHelpToggle({ idSeed: label, labelText: label, helpText: help });
  if (trigger && panel) {
    wrap.setAttribute('data-help-scope', '');
    row.appendChild(trigger);
    header.appendChild(row);
    header.appendChild(panel);
  } else {
    header.appendChild(row);
  }
  wrap.appendChild(header);

  const group = document.createElement('div');
  group.className = 'inline-flex w-full p-1 rounded-full bg-[#EAEFF6] dark:bg-[#1C1E20] border border-[#D9D9D9]/[4%] dark:border-[#D9D9D9]/[4%]';
  wrap.appendChild(group);

  let selected = defaultValue;
  const buttons = [];

  // Sync to global form data
  const syncToGlobal = () => updateFormData(fieldKey, selected);

  function apply() {
    for (const { btn, value } of buttons) {
      const active = value === selected;
      btn.className =
        'flex-1 py-2 rounded-full text-[13px] font-medium text-center transition-all ' +
        (active
          ? 'bg-primary/90 text-primary-foreground shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white');
    }
  }

  for (const opt of options) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      selected = opt.value;
      apply();
      syncToGlobal();
    });
    group.appendChild(btn);
    buttons.push({ btn, value: opt.value });
  }

  apply();
  syncToGlobal(); // Initial sync

  return {
    wrap,
    getValue: () => selected,
    setValue: (v) => { selected = v; apply(); syncToGlobal(); },
  };
}

export async function render({ container, remix }) {
  container.innerHTML = '';

  const mode = createPillToggle({
    label: 'Mode',
    id: 'mode',
    options: [
      { value: 'create', label: 'Create' },
      { value: 'improve', label: 'Improve' },
      { value: 'tailor', label: 'Tailor' },
    ],
    defaultValue: 'create',
    help: 'Create a new resume, improve an existing one, or tailor it for a specific job.',
  });

  const name = createTextInputField({
    label: 'Full name',
    id: 'name',
    required: true,
    placeholder: 'Your full name',
  });

  const email = createTextInputField({
    label: 'Email',
    id: 'email',
    required: true,
    placeholder: 'Your email address',
  });

  const existingResume = createTextAreaField({
    label: 'Existing resume',
    id: 'existingResume',
    required: false,
    rows: 6,
    placeholder: 'Paste your existing resume here...',
    help: 'Required for improve and tailor modes.',
  });

  const jobDescription = createTextAreaField({
    label: 'Job description',
    id: 'jobDescription',
    required: false,
    rows: 4,
    placeholder: 'Paste the job description here...',
    help: 'Optional but recommended for better keyword matching.',
  });

  const phone = createTextInputField({
    label: 'Phone',
    id: 'phone',
    required: false,
    placeholder: 'Your phone number',
  });

  const location = createTextInputField({
    label: 'Location',
    id: 'location',
    required: false,
    placeholder: 'Your location',
  });

  const linkedin = createTextInputField({
    label: 'LinkedIn',
    id: 'linkedin',
    required: false,
    placeholder: 'Your LinkedIn URL',
  });

  const github = createTextInputField({
    label: 'GitHub',
    id: 'github',
    required: false,
    placeholder: 'Your GitHub URL',
  });

  const portfolio = createTextInputField({
    label: 'Portfolio',
    id: 'portfolio',
    required: false,
    placeholder: 'Your portfolio URL',
  });

  const summary = createTextAreaField({
    label: 'Professional summary',
    id: 'summary',
    required: false,
    rows: 3,
    placeholder: 'Your professional summary...',
  });

  const experienceText = createTextAreaField({
    label: 'Experience',
    id: 'experienceText',
    required: false,
    rows: 5,
    placeholder: 'Your work experience...',
    help: 'Include job titles, companies, dates, achievements, and technologies.',
  });

  const educationText = createTextAreaField({
    label: 'Education',
    id: 'educationText',
    required: false,
    rows: 3,
    placeholder: 'Your education background...',
  });

  const skillsText = createTextAreaField({
    label: 'Skills',
    id: 'skillsText',
    required: false,
    rows: 2,
    placeholder: 'Your skills...',
  });

  const projectsText = createTextAreaField({
    label: 'Projects',
    id: 'projectsText',
    required: false,
    rows: 3,
    placeholder: 'Your projects...',
  });

  const certificationsText = createTextAreaField({
    label: 'Certifications',
    id: 'certificationsText',
    required: false,
    rows: 2,
    placeholder: 'Your certifications...',
  });

  const targetKeywords = createTextInputField({
    label: 'Target keywords',
    id: 'targetKeywords',
    required: false,
    placeholder: 'Keywords to highlight (comma-separated)',
    help: 'Keywords to highlight in your resume.',
  });

  const template = createSelectField({
    label: 'Template',
    id: 'template',
    required: false,
    options: TEMPLATES,
    defaultValue: 'modern',
  });

  const outputFormat = createSelectField({
    label: 'Output format',
    id: 'outputFormat',
    required: false,
    options: OUTPUT_FORMATS,
    defaultValue: 'markdown',
  });

  const includeObjective = createCheckboxField({
    label: 'Include career objective',
    id: 'includeObjective',
    help: 'Add a career objective section at the top.',
    defaultChecked: false,
  });

  // Existing resume wrap (shown for improve/tailor modes)
  const existingResumeWrap = document.createElement('div');
  existingResumeWrap.className = 'space-y-4';
  existingResumeWrap.appendChild(existingResume.wrap);

  function syncMode() {
    const m = mode.getValue();
    setHidden(existingResumeWrap, m === 'create');
  }

  mode.wrap.querySelectorAll('button').forEach(btn => btn.addEventListener('click', syncMode));

  // Remix: auto-detect mode from defaults
  const remixDefaults = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  if (remixDefaults) {
    const explicitMode = remixDefaults.mode;
    if (explicitMode === 'improve' || explicitMode === 'tailor') {
      mode.setValue(explicitMode);
    } else if (!explicitMode && typeof remixDefaults.existingResume === 'string' && remixDefaults.existingResume.trim()) {
      const targetMode = (typeof remixDefaults.jobDescription === 'string' && remixDefaults.jobDescription.trim()) ? 'tailor' : 'improve';
      mode.setValue(targetMode);
    }
  }
  syncMode();

  // Main fields
  container.appendChild(mode.wrap);
  container.appendChild(name.wrap);
  container.appendChild(email.wrap);
  container.appendChild(existingResumeWrap);
  container.appendChild(jobDescription.wrap);

  // More options
  const moreBody = document.createElement('div');
  moreBody.className = 'space-y-4';

  moreBody.appendChild(phone.wrap);
  moreBody.appendChild(location.wrap);

  // Links
  moreBody.appendChild(linkedin.wrap);
  moreBody.appendChild(github.wrap);
  moreBody.appendChild(portfolio.wrap);

  moreBody.appendChild(summary.wrap);
  moreBody.appendChild(experienceText.wrap);
  moreBody.appendChild(educationText.wrap);
  moreBody.appendChild(skillsText.wrap);
  moreBody.appendChild(projectsText.wrap);
  moreBody.appendChild(certificationsText.wrap);
  moreBody.appendChild(targetKeywords.wrap);

  // Settings row
  const settingsRow = document.createElement('div');
  settingsRow.className = 'grid grid-cols-2 gap-4';
  settingsRow.appendChild(template.wrap);
  settingsRow.appendChild(outputFormat.wrap);
  moreBody.appendChild(settingsRow);

  moreBody.appendChild(includeObjective.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  const fieldRefs = { name, email, existingResume, jobDescription, phone, location, linkedin, github, portfolio, summary, experienceText, educationText, skillsText, projectsText, certificationsText, targetKeywords, template, outputFormat, includeObjective };

  return {
    getValues: async () => {
      name.clearError();
      email.clearError();

      let hasError = false;

      const nameVal = name.getTrimmed();
      if (!nameVal) {
        name.setError('Please enter your full name');
        hasError = true;
      }

      const emailVal = email.getTrimmed();
      if (!emailVal) {
        email.setError('Please enter your email');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      const m = mode.getValue();

      const out = {
        mode: m,
        name: nameVal,
        email: emailVal,
        template: template.getValue(),
        outputFormat: outputFormat.getValue(),
        includeObjective: includeObjective.getValue(),
      };

      const existing = existingResume.getTrimmed();
      if (existing) out.existingResume = existing;

      const job = jobDescription.getTrimmed();
      if (job) out.jobDescription = job;

      const phoneVal = phone.getTrimmed();
      if (phoneVal) out.phone = phoneVal;

      const locationVal = location.getTrimmed();
      if (locationVal) out.location = locationVal;

      const linkedinVal = linkedin.getTrimmed();
      if (linkedinVal) out.linkedin = linkedinVal;

      const githubVal = github.getTrimmed();
      if (githubVal) out.github = githubVal;

      const portfolioVal = portfolio.getTrimmed();
      if (portfolioVal) out.portfolio = portfolioVal;

      const summaryVal = summary.getTrimmed();
      if (summaryVal) out.summary = summaryVal;

      const expVal = experienceText.getTrimmed();
      if (expVal) out.experienceText = expVal;

      const eduVal = educationText.getTrimmed();
      if (eduVal) out.educationText = eduVal;

      const skillsVal = skillsText.getTrimmed();
      if (skillsVal) out.skillsText = skillsVal;

      const projVal = projectsText.getTrimmed();
      if (projVal) out.projectsText = projVal;

      const certVal = certificationsText.getTrimmed();
      if (certVal) out.certificationsText = certVal;

      const keywords = targetKeywords.getTrimmed();
      if (keywords) out.targetKeywords = keywords;

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
