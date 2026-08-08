// Model configurations with all parameters
const MODELS = {
  'seedance-pro': {
    id: 'bytedance/seedance-1-pro',
    name: 'Seedance 1 Pro',
    description: 'High-quality video generation with advanced motion synthesis. Supports text-to-video and image-to-video.',
    category: 'video',
    cost: { perSecond: 0.06 },
    icon: 'video',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the video you want to create...', rows: 4 },
      { name: 'image', type: 'file', label: 'Input Image (optional)', accept: 'image/*', help: 'For image-to-video mode' },
      { name: 'last_frame_image', type: 'file', label: 'End Frame Image (optional)', accept: 'image/*', help: 'Requires start image' },
      { name: 'duration', type: 'slider', label: 'Duration (seconds)', min: 2, max: 12, default: 5, step: 1 },
      { name: 'resolution', type: 'select', label: 'Resolution', options: ['480p', '720p', '1080p'], default: '1080p' },
      { name: 'aspect_ratio', type: 'select', label: 'Aspect Ratio', options: ['16:9', '4:3', '1:1', '3:4', '9:16', '21:9'], default: '16:9' },
      { name: 'camera_fixed', type: 'toggle', label: 'Lock Camera Position', default: false },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'seedance-pro-fast': {
    id: 'bytedance/seedance-1-pro-fast',
    name: 'Seedance 1 Pro Fast',
    description: 'Faster video generation with optimized performance. Same quality, quicker results.',
    category: 'video',
    cost: { perSecond: 0.04 },
    icon: 'video',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the video you want to create...', rows: 4 },
      { name: 'image', type: 'file', label: 'Input Image (optional)', accept: 'image/*', help: 'For image-to-video mode' },
      { name: 'duration', type: 'slider', label: 'Duration (seconds)', min: 2, max: 10, default: 5, step: 1 },
      { name: 'resolution', type: 'select', label: 'Resolution', options: ['480p', '720p', '1080p'], default: '1080p' },
      { name: 'aspect_ratio', type: 'select', label: 'Aspect Ratio', options: ['16:9', '4:3', '1:1', '3:4', '9:16'], default: '16:9' },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'seedance-lite': {
    id: 'bytedance/seedance-1-lite',
    name: 'Seedance 1 Lite',
    description: 'Lightweight video generation for quick results at lower cost.',
    category: 'video',
    cost: { perSecond: 0.03 },
    icon: 'video',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the video you want to create...', rows: 4 },
      { name: 'image', type: 'file', label: 'Input Image (optional)', accept: 'image/*', help: 'For image-to-video mode' },
      { name: 'duration', type: 'slider', label: 'Duration (seconds)', min: 2, max: 8, default: 5, step: 1 },
      { name: 'resolution', type: 'select', label: 'Resolution', options: ['480p', '720p'], default: '720p' },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'omni-human-1.5': {
    id: 'bytedance/omni-human-1.5',
    name: 'OmniHuman 1.5',
    description: 'Advanced full-body human animation from images. Requires human image and audio input.',
    category: 'animation',
    cost: { perSecond: 0.08 },
    icon: 'human',
    fields: [
      { name: 'image', type: 'file', label: 'Human Image', required: true, accept: 'image/*', help: 'Image containing a human subject' },
      { name: 'audio', type: 'file', label: 'Audio File', required: true, accept: 'audio/*', help: 'MP3, WAV (max 35 seconds)' },
      { name: 'prompt', type: 'textarea', label: 'Prompt (optional)', placeholder: 'Describe scene, movements, camera angles...', rows: 3, help: 'Supports EN, CN, JP, KR, ES, ID' },
      { name: 'fast_mode', type: 'toggle', label: 'Fast Mode', default: false, help: 'Faster but lower quality' },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'omni-human': {
    id: 'bytedance/omni-human',
    name: 'OmniHuman',
    description: 'Human animation and motion synthesis from static images.',
    category: 'animation',
    cost: { perSecond: 0.05 },
    icon: 'human',
    fields: [
      { name: 'image', type: 'file', label: 'Human Image', required: true, accept: 'image/*', help: 'Image containing a human subject' },
      { name: 'audio', type: 'file', label: 'Audio File', required: true, accept: 'audio/*', help: 'MP3, WAV (max 35 seconds)' },
      { name: 'prompt', type: 'textarea', label: 'Prompt (optional)', placeholder: 'Describe movements...', rows: 3 },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'latentsync': {
    id: 'bytedance/latentsync',
    name: 'LatentSync',
    description: 'Audio-driven lip synchronization for videos. Sync any video to any audio.',
    category: 'lipsync',
    cost: { perSecond: 0.05 },
    icon: 'audio',
    fields: [
      { name: 'video', type: 'file', label: 'Input Video', required: true, accept: 'video/*', help: 'MP4 format recommended' },
      { name: 'audio', type: 'file', label: 'Audio File', required: true, accept: 'audio/*', help: 'MP3, WAV, AAC, M4A' },
      { name: 'guidance_scale', type: 'slider', label: 'Guidance Scale', min: 0, max: 10, default: 1, step: 0.1 },
      { name: 'seed', type: 'number', label: 'Seed', default: 0, min: 0, help: '0 for random' }
    ]
  },
  'seedream-4.5': {
    id: 'bytedance/seedream-4.5',
    name: 'Seedream 4.5',
    description: 'Latest Seedream with superior image quality. Supports up to 4K resolution.',
    category: 'image',
    cost: { perOutput: 0.04 },
    icon: 'image',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the image you want to create...', rows: 4 },
      { name: 'image_input', type: 'file', label: 'Reference Image (optional)', accept: 'image/*', help: 'For image-to-image' },
      { name: 'size', type: 'select', label: 'Size', options: ['2K', '4K', 'custom'], default: '2K' },
      { name: 'width', type: 'number', label: 'Width (custom)', min: 1024, max: 4096, default: 2048, help: 'Only for custom size' },
      { name: 'height', type: 'number', label: 'Height (custom)', min: 1024, max: 4096, default: 2048, help: 'Only for custom size' },
      { name: 'aspect_ratio', type: 'select', label: 'Aspect Ratio', options: ['match_input_image', '1:1', '4:3', '3:4', '16:9', '9:16', '3:2', '2:3', '21:9'], default: '1:1' },
      { name: 'max_images', type: 'slider', label: 'Number of Images', min: 1, max: 4, default: 1, step: 1 }
    ]
  },
  'seedream-4': {
    id: 'bytedance/seedream-4',
    name: 'Seedream 4',
    description: 'High-quality image generation with excellent detail and prompt adherence.',
    category: 'image',
    cost: { perOutput: 0.03 },
    icon: 'image',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the image...', rows: 4 },
      { name: 'size', type: 'select', label: 'Size', options: ['2K', '4K'], default: '2K' },
      { name: 'aspect_ratio', type: 'select', label: 'Aspect Ratio', options: ['1:1', '4:3', '3:4', '16:9', '9:16'], default: '1:1' },
      { name: 'max_images', type: 'slider', label: 'Number of Images', min: 1, max: 4, default: 1, step: 1 }
    ]
  },
  'seedream-3': {
    id: 'bytedance/seedream-3',
    name: 'Seedream 3',
    description: 'Efficient image generation with good quality at lower cost.',
    category: 'image',
    cost: { perOutput: 0.02 },
    icon: 'image',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the image...', rows: 4 },
      { name: 'aspect_ratio', type: 'select', label: 'Aspect Ratio', options: ['1:1', '4:3', '3:4', '16:9', '9:16'], default: '1:1' },
      { name: 'max_images', type: 'slider', label: 'Number of Images', min: 1, max: 4, default: 1, step: 1 }
    ]
  },
  'dreamina-3.1': {
    id: 'bytedance/dreamina-3.1',
    name: 'Dreamina 3.1',
    description: 'Creative image generation with artistic styles and unique aesthetics.',
    category: 'image',
    cost: { perOutput: 0.03 },
    icon: 'image',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the image...', rows: 4 },
      { name: 'aspect_ratio', type: 'select', label: 'Aspect Ratio', options: ['1:1', '4:3', '3:4', '16:9', '9:16'], default: '1:1' },
      { name: 'max_images', type: 'slider', label: 'Number of Images', min: 1, max: 4, default: 1, step: 1 }
    ]
  },
  'hyper-flux-8step': {
    id: 'bytedance/hyper-flux-8step',
    name: 'Hyper-FLUX 8-Step',
    description: 'Ultra-fast FLUX with 8-step generation. Fastest image generation.',
    category: 'image',
    cost: { perOutput: 0.002 },
    icon: 'image',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the image...', rows: 4 },
      { name: 'width', type: 'number', label: 'Width', min: 512, max: 2048, default: 1024 },
      { name: 'height', type: 'number', label: 'Height', min: 512, max: 2048, default: 1024 },
      { name: 'num_outputs', type: 'slider', label: 'Number of Images', min: 1, max: 4, default: 1, step: 1 },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'hyper-flux-16step': {
    id: 'bytedance/hyper-flux-16step',
    name: 'Hyper-FLUX 16-Step',
    description: 'Fast FLUX with 16-step generation for better quality.',
    category: 'image',
    cost: { perOutput: 0.003 },
    icon: 'image',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the image...', rows: 4 },
      { name: 'width', type: 'number', label: 'Width', min: 512, max: 2048, default: 1024 },
      { name: 'height', type: 'number', label: 'Height', min: 512, max: 2048, default: 1024 },
      { name: 'num_outputs', type: 'slider', label: 'Number of Images', min: 1, max: 4, default: 1, step: 1 },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'sdxl-lightning-4step': {
    id: 'bytedance/sdxl-lightning-4step',
    name: 'SDXL Lightning 4-Step',
    description: 'Lightning-fast SDXL with 4-step distillation. Extremely fast generation.',
    category: 'image',
    cost: { perOutput: 0.002 },
    icon: 'image',
    fields: [
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, placeholder: 'Describe the image...', rows: 4 },
      { name: 'negative_prompt', type: 'textarea', label: 'Negative Prompt', placeholder: 'What to avoid...', rows: 2 },
      { name: 'width', type: 'number', label: 'Width', min: 512, max: 1536, default: 1024 },
      { name: 'height', type: 'number', label: 'Height', min: 512, max: 1536, default: 1024 },
      { name: 'num_outputs', type: 'slider', label: 'Number of Images', min: 1, max: 4, default: 1, step: 1 },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'flux-pulid': {
    id: 'bytedance/flux-pulid',
    name: 'FLUX PuLID',
    description: 'Pure and Lightning ID customization for FLUX. Generate images with face identity preservation.',
    category: 'faceid',
    cost: { perOutput: 0.021 },
    icon: 'face',
    fields: [
      { name: 'main_face_image', type: 'file', label: 'Main Face Image', required: true, accept: 'image/*', help: 'Primary face for identity' },
      { name: 'auxiliary_face_image1', type: 'file', label: 'Auxiliary Face 1 (optional)', accept: 'image/*' },
      { name: 'auxiliary_face_image2', type: 'file', label: 'Auxiliary Face 2 (optional)', accept: 'image/*' },
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, default: 'portrait, color, cinematic, in garden, soft light, detailed face', rows: 3 },
      { name: 'negative_prompt', type: 'textarea', label: 'Negative Prompt', default: 'flaws in the eyes, flaws in the face, lowres, non-HDRi', rows: 2 },
      { name: 'num_steps', type: 'slider', label: 'Inference Steps', min: 1, max: 100, default: 4, step: 1 },
      { name: 'cfg_scale', type: 'slider', label: 'Guidance Scale', min: 1.0, max: 1.5, default: 1.2, step: 0.05 },
      { name: 'identity_scale', type: 'slider', label: 'Identity Scale', min: 0, max: 5, default: 0.8, step: 0.1, help: 'How much to preserve identity' },
      { name: 'image_width', type: 'number', label: 'Width', min: 512, max: 2024, default: 768 },
      { name: 'image_height', type: 'number', label: 'Height', min: 512, max: 2024, default: 1024 },
      { name: 'num_samples', type: 'slider', label: 'Number of Images', min: 1, max: 8, default: 4, step: 1 },
      { name: 'generation_mode', type: 'select', label: 'Generation Mode', options: ['fidelity', 'extremely style'], default: 'fidelity' },
      { name: 'output_format', type: 'select', label: 'Output Format', options: ['webp', 'jpg', 'png'], default: 'webp' },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'pulid': {
    id: 'bytedance/pulid',
    name: 'PuLID (SDXL)',
    description: 'PuLID for SDXL. Fast and affordable face ID customization.',
    category: 'faceid',
    cost: { perOutput: 0.002 },
    icon: 'face',
    fields: [
      { name: 'main_face_image', type: 'file', label: 'Main Face Image', required: true, accept: 'image/*' },
      { name: 'prompt', type: 'textarea', label: 'Prompt', required: true, default: 'portrait, soft lighting, detailed face', rows: 3 },
      { name: 'negative_prompt', type: 'textarea', label: 'Negative Prompt', rows: 2 },
      { name: 'num_steps', type: 'slider', label: 'Inference Steps', min: 1, max: 50, default: 4, step: 1 },
      { name: 'cfg_scale', type: 'slider', label: 'Guidance Scale', min: 1.0, max: 2.0, default: 1.2, step: 0.1 },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  },
  'seededit-3.0': {
    id: 'bytedance/seededit-3.0',
    name: 'SeedEdit 3.0',
    description: 'Advanced instruction-based image editing. Edit images with natural language prompts.',
    category: 'editing',
    cost: { perOutput: 0.03 },
    icon: 'edit',
    fields: [
      { name: 'image', type: 'file', label: 'Input Image', required: true, accept: 'image/*', help: 'Image to edit' },
      { name: 'prompt', type: 'textarea', label: 'Edit Prompt', required: true, placeholder: 'Describe what to change...', rows: 4, help: 'e.g., "make the sky sunset colors"' },
      { name: 'guidance_scale', type: 'slider', label: 'Guidance Scale', min: 1, max: 10, default: 5.5, step: 0.5, help: 'Higher = more literal prompt following' },
      { name: 'seed', type: 'number', label: 'Seed (optional)', placeholder: 'Random if empty', min: 0 }
    ]
  }
};

// Current state
let currentModel = 'seedance-pro';
let uploadedFiles = {};
let pollingInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  selectModel('seedance-pro');
});

// Select model
function selectModel(modelKey) {
  currentModel = modelKey;
  const model = MODELS[modelKey];

  // Update button states
  document.querySelectorAll('.model-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.model === modelKey) {
      btn.classList.add('active');
    }
  });

  // Update header
  const modelNameEl = document.getElementById('modelName');
  if (modelNameEl) modelNameEl.textContent = model.name;
  const modelIdEl = document.getElementById('modelId');
  if (modelIdEl) modelIdEl.textContent = model.id;
  const modelDescEl = document.getElementById('modelDescription');
  if (modelDescEl) modelDescEl.textContent = model.description;

  // Update icon
  const iconMap = {
    video: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/>',
    human: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>',
    audio: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>',
    image: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>',
    face: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>',
    edit: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>'
  };
  const modelIconEl = document.getElementById('modelIcon');
  if (modelIconEl) modelIconEl.innerHTML = `<svg class="w-6 h-6 text-primary/90" fill="none" stroke="currentColor" viewBox="0 0 24 24">${iconMap[model.icon]}</svg>`;

  // Build form
  buildForm(model);

  // Update cost estimate
  updateCostEstimate();

  // Clear results
  document.getElementById('resultsSection')?.classList.add('hidden');
  document.getElementById('jobSection')?.classList.add('hidden');
  uploadedFiles = {};
}

// Build dynamic form
function buildForm(model) {
  const form = document.getElementById('playgroundForm');
  form.innerHTML = '';

  model.fields.forEach(field => {
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-2';

    const label = document.createElement('label');
    label.className = 'block text-sm font-medium text-gray-300';
    label.innerHTML = `${field.label}${field.required ? ' <span class="text-red-400">*</span>' : ''}`;
    wrapper.appendChild(label);

    let input;

    switch (field.type) {
      case 'textarea':
        input = document.createElement('textarea');
        input.className = 'w-full bg-neutral-800 border border-neutral-700 rounded-ios-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary/90 focus:ring-1 focus:ring-primary/90 outline-none transition-colors';
        input.rows = field.rows || 3;
        input.placeholder = field.placeholder || '';
        if (field.default) input.value = field.default;
        break;

      case 'select':
        input = document.createElement('select');
        input.className = 'w-full bg-neutral-800 border border-neutral-700 rounded-ios-lg px-4 py-3 text-white focus:border-primary/90 focus:ring-1 focus:ring-primary/90 outline-none transition-colors';
        field.options.forEach(opt => {
          const option = document.createElement('option');
          option.value = opt;
          option.textContent = opt;
          if (opt === field.default) option.selected = true;
          input.appendChild(option);
        });
        break;

      case 'slider':
        const sliderWrapper = document.createElement('div');
        sliderWrapper.className = 'flex items-center gap-4';

        input = document.createElement('input');
        input.type = 'range';
        input.className = 'flex-1';
        input.min = field.min;
        input.max = field.max;
        input.step = field.step || 1;
        input.value = field.default;

        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'text-sm font-medium w-12 text-right';
        valueDisplay.textContent = field.default;

        input.addEventListener('input', () => {
          valueDisplay.textContent = input.value;
          updateCostEstimate();
        });

        sliderWrapper.appendChild(input);
        sliderWrapper.appendChild(valueDisplay);
        wrapper.appendChild(sliderWrapper);
        input = null; // Don't add twice
        break;

      case 'number':
        input = document.createElement('input');
        input.type = 'number';
        input.className = 'w-full bg-neutral-800 border border-neutral-700 rounded-ios-lg px-4 py-3 text-white placeholder-gray-500 focus:border-primary/90 focus:ring-1 focus:ring-primary/90 outline-none transition-colors';
        input.placeholder = field.placeholder || '';
        if (field.min !== undefined) input.min = field.min;
        if (field.max !== undefined) input.max = field.max;
        if (field.default !== undefined) input.value = field.default;
        break;

      case 'toggle':
        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = 'flex items-center gap-3';

        input = document.createElement('button');
        input.type = 'button';
        input.className = `relative w-12 h-6 rounded-full transition-colors ${field.default ? 'bg-primary/90' : 'bg-neutral-700'}`;
        input.innerHTML = `<span class="absolute top-1 ${field.default ? 'left-7' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all"></span>`;
        input.dataset.checked = field.default;

        input.addEventListener('click', () => {
          const checked = input.dataset.checked === 'true';
          input.dataset.checked = !checked;
          input.className = `relative w-12 h-6 rounded-full transition-colors ${!checked ? 'bg-primary/90' : 'bg-neutral-700'}`;
          input.innerHTML = `<span class="absolute top-1 ${!checked ? 'left-7' : 'left-1'} w-4 h-4 bg-white rounded-full transition-all"></span>`;
        });

        toggleWrapper.appendChild(input);
        wrapper.appendChild(toggleWrapper);
        input = null;
        break;

      case 'file':
        const dropZone = document.createElement('div');
        dropZone.className = 'file-drop-zone rounded-ios-lg p-6 text-center cursor-pointer';
        dropZone.innerHTML = `
          <svg class="w-8 h-8 mx-auto mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/>
          </svg>
          <p class="text-sm text-gray-400">Drop file here or click to upload</p>
          <p class="text-xs text-gray-500 mt-1">${field.accept}</p>
          <p id="fileName_${field.name}" class="text-sm text-primary/90 mt-2 hidden"></p>
        `;

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = field.accept;
        fileInput.className = 'hidden';
        fileInput.id = `file_${field.name}`;

        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
        dropZone.addEventListener('drop', (e) => {
          e.preventDefault();
          dropZone.classList.remove('dragover');
          if (e.dataTransfer.files.length) {
            handleFileUpload(field.name, e.dataTransfer.files[0]);
          }
        });

        fileInput.addEventListener('change', () => {
          if (fileInput.files.length) {
            handleFileUpload(field.name, fileInput.files[0]);
          }
        });

        wrapper.appendChild(fileInput);
        wrapper.appendChild(dropZone);
        input = null;
        break;
    }

    if (input) {
      input.name = field.name;
      input.id = `input_${field.name}`;
      if (field.required) input.required = true;
      wrapper.appendChild(input);
    }

    if (field.help) {
      const help = document.createElement('p');
      help.className = 'text-xs text-gray-500';
      help.textContent = field.help;
      wrapper.appendChild(help);
    }

    form.appendChild(wrapper);
  });
}

// Handle file upload
async function handleFileUpload(fieldName, file) {
  const fileNameEl = document.getElementById(`fileName_${fieldName}`);
  fileNameEl.textContent = `Selected: ${file.name}`;
  fileNameEl.classList.remove('hidden');

  // Convert to data URL for API
  const reader = new FileReader();
  reader.onload = () => {
    uploadedFiles[fieldName] = reader.result;
  };
  reader.readAsDataURL(file);
}

// Update cost estimate
function updateCostEstimate() {
  const model = MODELS[currentModel];
  let cost = 0;

  if (model.cost.perSecond) {
    const durationInput = document.querySelector(`input[name="duration"]`);
    const duration = durationInput ? parseFloat(durationInput.value) : 5;
    cost = model.cost.perSecond * duration;
  } else if (model.cost.perOutput) {
    const numImagesInput = document.querySelector(`input[name="num_outputs"], input[name="max_images"], input[name="num_samples"]`);
    const numImages = numImagesInput ? parseInt(numImagesInput.value) : 1;
    cost = model.cost.perOutput * numImages;
  }

  const costEl = document.getElementById('estimatedCost');
  if (costEl) costEl.innerHTML = `Est. cost: <span class="text-green-400 font-medium">$${cost.toFixed(3)}</span>`;
}

// Collect form data
function collectFormData() {
  const model = MODELS[currentModel];
  const data = {};

  model.fields.forEach(field => {
    if (field.type === 'file') {
      if (uploadedFiles[field.name]) {
        data[field.name] = uploadedFiles[field.name];
      }
    } else if (field.type === 'toggle') {
      const btn = document.getElementById(`input_${field.name}`);
      data[field.name] = btn?.dataset.checked === 'true';
    } else if (field.type === 'slider') {
      const input = document.querySelector(`input[name="${field.name}"]`);
      data[field.name] = parseFloat(input.value);
    } else {
      const input = document.getElementById(`input_${field.name}`);
      if (input && input.value) {
        data[field.name] = field.type === 'number' ? parseFloat(input.value) : input.value;
      }
    }
  });

  return data;
}

// Generate
async function generate() {
  // Agreement check — show modal if user hasn't agreed yet
  if (window.PendingPaid?.showAgreementModal) {
    const agreed = await window.PendingPaid.showAgreementModal();
    if (!agreed) return;
  }

  const model = MODELS[currentModel];
  const formData = collectFormData();

  // Validate required fields
  for (const field of model.fields) {
    if (field.required && !formData[field.name]) {
      alert(`${field.label} is required`);
      return;
    }
  }

  // Show loading state
  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  document.getElementById('generateBtnText')?.classList.add('hidden');
  document.getElementById('generateBtnLoading')?.classList.remove('hidden');

  try {
    // For video/animation models, use async job flow
    const isAsync = ['video', 'animation', 'lipsync'].includes(model.category);

    const response = await fetch(`https://aitopia.ai/api/models/replicate/${model.id.replace('/', '/')}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const result = await response.json();

    if (result.error) {
      throw new Error(result.error);
    }

    if (result.jobId || result.id) {
      // Async job - show job status and poll
      showJobStatus(result.jobId || result.id);
    } else if (result.output || result.url || result.urls) {
      // Sync result - show immediately
      showResult(result);
    }

  } catch (error) {
    alert(`Error: ${error.message}`);
  } finally {
    if (btn) btn.disabled = false;
    document.getElementById('generateBtnText')?.classList.remove('hidden');
    document.getElementById('generateBtnLoading')?.classList.add('hidden');
  }
}

// Show job status
function showJobStatus(jobId) {
  document.getElementById('jobSection')?.classList.remove('hidden');
  document.getElementById('resultsSection')?.classList.add('hidden');
  const jobIdEl = document.getElementById('jobId');
  if (jobIdEl) jobIdEl.textContent = jobId;
  const jobStatusEl = document.getElementById('jobStatus');
  if (jobStatusEl) jobStatusEl.textContent = 'Processing...';

  // Poll for status
  if (pollingInterval) clearInterval(pollingInterval);
  pollingInterval = setInterval(() => pollJobStatus(jobId), 3000);
}

// Poll job status
async function pollJobStatus(jobId) {
  try {
    const response = await fetch(`https://aitopia.ai/mulerun/jobs/${jobId}`);
    const job = await response.json();

    const jobStatusEl = document.getElementById('jobStatus');
    if (jobStatusEl) jobStatusEl.textContent = `Status: ${job.status}`;

    if (job.status === 'completed' || job.status === 'succeeded') {
      clearInterval(pollingInterval);
      showResult(job);
    } else if (job.status === 'failed' || job.status === 'error') {
      clearInterval(pollingInterval);
      if (jobStatusEl) jobStatusEl.textContent = `Failed: ${job.error || 'Unknown error'}`;
    }
  } catch (error) {
    console.error('Poll error:', error);
  }
}

// Show result
function showResult(result) {
  document.getElementById('resultsSection')?.classList.remove('hidden');
  document.getElementById('jobSection')?.classList.add('hidden');

  const content = document.getElementById('resultContent');
  const model = MODELS[currentModel];
  const output = result.output || result.resultUrl || result.url;

  if (model.category === 'video' || model.category === 'animation' || model.category === 'lipsync') {
    content.innerHTML = `
      <video controls class="w-full rounded-ios-lg" autoplay>
        <source src="${output}" type="video/mp4">
      </video>
      <div class="flex gap-2 mt-4">
        <a href="${output}" download class="px-4 py-2 bg-primary/90 hover:bg-[#7B2BD6] rounded-ios-lg text-sm font-medium transition-colors">Download Video</a>
        <button data-action="copyToClipboard" data-param="${output}" class="px-4 py-2 bg-neutral-700 hover:bg-neutral-600 rounded-ios-lg text-sm font-medium transition-colors">Copy URL</button>
      </div>
    `;
  } else {
    // Image output
    const urls = Array.isArray(output) ? output : [output];
    content.innerHTML = `
      <div class="grid grid-cols-2 gap-4">
        ${urls.map((url, i) => `
          <div class="relative group">
            <img src="${url}" alt="Generated image ${i+1}" class="w-full rounded-ios-lg">
            <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-ios-lg">
              <a href="${url}" download class="p-2 bg-primary-foreground/20 rounded-lg hover:bg-primary-foreground/30">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }
}

// Copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text);
  alert('URL copied to clipboard!');
}

// CSP-safe event delegation
document.addEventListener('click', function(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  const param = el.dataset.param;
  if (action === 'selectModel') selectModel(param);
  else if (action === 'generate') generate();
  else if (action === 'copyToClipboard') copyToClipboard(param);
});