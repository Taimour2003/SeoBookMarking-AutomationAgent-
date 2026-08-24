import { createSelectField, createTextInputField, createMoreOptionsDisclosure, updateFormData, FieldValidationError } from './ui.js';
import { uploadFileToServer, uploadUrlToServer } from '../../shared/media.js';

const TRANSITION_TYPES = [
  { value: 'Blur', label: 'Blur', preview: 'https://aitopia.ai/agent-images/transition-blur.mp4' },
  { value: 'Dissolve', label: 'Dissolve', preview: 'https://aitopia.ai/agent-images/transition-dissolve.mp4' },
  { value: 'Fade', label: 'Fade', preview: 'https://aitopia.ai/agent-images/transition-fade.mp4' },
  { value: 'Fire Lava', label: 'Fire Lava', preview: 'https://aitopia.ai/agent-images/transition-firelava.mp4' },
  { value: 'Flying Cam', label: 'Flying Cam', preview: 'https://aitopia.ai/agent-images/transition-flying-cam.mp4' },
  { value: 'Glitch', label: 'Glitch', preview: 'https://aitopia.ai/agent-images/transition-glitch.mp4' },
  { value: 'Lightning', label: 'Lightning', preview: 'https://aitopia.ai/agent-images/transition-lightning.mp4' },
  { value: 'Melt', label: 'Melt', preview: 'https://aitopia.ai/agent-images/transition-melt.mp4' },
  { value: 'Morph', label: 'Morph', preview: 'https://aitopia.ai/agent-images/transition-morph.mp4' },
  { value: 'Seamless', label: 'Seamless', preview: 'https://aitopia.ai/agent-images/transition-sampless.mp4' },
  { value: 'Slide', label: 'Slide', preview: 'https://aitopia.ai/agent-images/transition-slide.mp4' },
  { value: 'Smoke', label: 'Smoke', preview: 'https://aitopia.ai/agent-images/transition-smoke.mp4' },
  { value: 'Wipe', label: 'Wipe', preview: 'https://aitopia.ai/agent-images/transition-wipe.mp4' },
  { value: 'Zoom', label: 'Zoom', preview: 'https://aitopia.ai/agent-images/transition-zoom.mp4' },
];

const BLEND_STYLES = [
  { value: 'Smooth', label: 'Smooth' },
  { value: 'Cinematic', label: 'Cinematic' },
  { value: 'Creative', label: 'Creative' },
];

const FRAME_ICON_DARK = `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="16" fill="#272727"/>
  <rect x="0.3" y="0.3" width="31.4" height="31.4" rx="15.7" stroke="#B6B6B6" stroke-opacity="0.3" stroke-width="0.6"/>
  <path d="M6.92578 15.9959C6.92578 18.8919 8.16311 20.1293 11.0591 20.1293V19.3293C8.60045 19.3293 7.72578 18.4546 7.72578 15.9959V12.7959C7.72578 10.3373 8.60045 9.4626 11.0591 9.4626H14.2591C16.7178 9.4626 17.5924 10.3373 17.5924 12.7959L18.3924 12.7959C18.3924 9.89993 17.1551 8.6626 14.2591 8.6626H11.0591C8.16311 8.6626 6.92578 9.89993 6.92578 12.7959V15.9959Z" fill="#B6B6B6"/>
  <path d="M11.0604 13.7295C10.2497 13.7295 9.59375 13.0735 9.59375 12.2628C9.59375 11.4521 10.2497 10.7961 11.0604 10.7961C11.8711 10.7961 12.5271 11.4521 12.5271 12.2628C12.5271 13.0735 11.8711 13.7295 11.0604 13.7295ZM11.0604 11.5961C10.6924 11.5961 10.3937 11.8948 10.3937 12.2628C10.3937 12.6308 10.6924 12.9295 11.0604 12.9295C11.4284 12.9295 11.7271 12.6308 11.7271 12.2628C11.7271 11.8948 11.4284 11.5961 11.0604 11.5961Z" fill="#B6B6B6"/>
  <path d="M16.6591 25.3293H19.8591C22.5258 25.3293 23.5924 24.2626 23.5924 21.5959V18.3959C23.5924 15.7293 22.5258 14.6626 19.8591 14.6626H16.6591C13.9924 14.6626 12.9258 15.7293 12.9258 18.3959V21.5959C12.9258 24.2626 13.9924 25.3293 16.6591 25.3293Z" stroke="#B6B6B6" stroke-width="0.833333" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16.7148 19.9963V19.207C16.7148 18.1883 17.4348 17.7776 18.3148 18.2843L18.9975 18.679L19.6802 19.0736C20.5602 19.5803 20.5602 20.4123 19.6802 20.919L18.9975 21.3136L18.3148 21.7083C17.4348 22.215 16.7148 21.799 16.7148 20.7856V19.9963Z" stroke="#B6B6B6" stroke-width="0.833333" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const FRAME_ICON_LIGHT = `
<svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="16" fill="#E5E5E5"/>
  <rect x="0.3" y="0.3" width="31.4" height="31.4" rx="15.7" stroke="#999" stroke-opacity="0.3" stroke-width="0.6"/>
  <path d="M6.92578 15.9959C6.92578 18.8919 8.16311 20.1293 11.0591 20.1293V19.3293C8.60045 19.3293 7.72578 18.4546 7.72578 15.9959V12.7959C7.72578 10.3373 8.60045 9.4626 11.0591 9.4626H14.2591C16.7178 9.4626 17.5924 10.3373 17.5924 12.7959L18.3924 12.7959C18.3924 9.89993 17.1551 8.6626 14.2591 8.6626H11.0591C8.16311 8.6626 6.92578 9.89993 6.92578 12.7959V15.9959Z" fill="#666"/>
  <path d="M11.0604 13.7295C10.2497 13.7295 9.59375 13.0735 9.59375 12.2628C9.59375 11.4521 10.2497 10.7961 11.0604 10.7961C11.8711 10.7961 12.5271 11.4521 12.5271 12.2628C12.5271 13.0735 11.8711 13.7295 11.0604 13.7295ZM11.0604 11.5961C10.6924 11.5961 10.3937 11.8948 10.3937 12.2628C10.3937 12.6308 10.6924 12.9295 11.0604 12.9295C11.4284 12.9295 11.7271 12.6308 11.7271 12.2628C11.7271 11.8948 11.4284 11.5961 11.0604 11.5961Z" fill="#666"/>
  <path d="M16.6591 25.3293H19.8591C22.5258 25.3293 23.5924 24.2626 23.5924 21.5959V18.3959C23.5924 15.7293 22.5258 14.6626 19.8591 14.6626H16.6591C13.9924 14.6626 12.9258 15.7293 12.9258 18.3959V21.5959C12.9258 24.2626 13.9924 25.3293 16.6591 25.3293Z" stroke="#666" stroke-width="0.833333" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M16.7148 19.9963V19.207C16.7148 18.1883 17.4348 17.7776 18.3148 18.2843L18.9975 18.679L19.6802 19.0736C20.5602 19.5803 20.5602 20.4123 19.6802 20.919L18.9975 21.3136L18.3148 21.7083C17.4348 22.215 16.7148 21.799 16.7148 20.7856V19.9963Z" stroke="#666" stroke-width="0.833333" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

function getFrameIcon() {
  const isDark = document.documentElement.classList.contains('dark');
  return isDark ? FRAME_ICON_DARK : FRAME_ICON_LIGHT;
}

function createFrameUpload({ label, sublabel }) {
  const wrap = document.createElement('div');

  // Upload area
  const uploadArea = document.createElement('div');
  uploadArea.className = 'rounded-[16px] border border-dashed border-white dark:border-[#3a3a3a] bg-[#EAEFF6] dark:bg-[#1C1E20] p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-[#ddd] dark:hover:border-[#555] transition-colors h-[115px]';

  const iconWrap = document.createElement('div');
  iconWrap.innerHTML = getFrameIcon();

  const titleEl = document.createElement('div');
  titleEl.className = 'text-sm font-medium text-foreground';
  titleEl.textContent = label;

  const subtitleEl = document.createElement('div');
  subtitleEl.className = 'text-xs text-muted-foreground';
  subtitleEl.textContent = sublabel;

  uploadArea.appendChild(iconWrap);
  uploadArea.appendChild(titleEl);
  uploadArea.appendChild(subtitleEl);

  // Hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'video/*';
  fileInput.className = 'hidden';
  uploadArea.appendChild(fileInput);

  // Preview elements
  const previewImg = document.createElement('img');
  previewImg.className = 'hidden w-full h-full object-cover rounded-xl absolute inset-0';

  const previewVideo = document.createElement('video');
  previewVideo.className = 'hidden w-full h-full object-cover rounded-xl absolute inset-0';
  previewVideo.muted = true;
  previewVideo.loop = true;
  previewVideo.playsInline = true;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'hidden absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black transition-colors z-10';
  removeBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';

  uploadArea.appendChild(previewImg);
  uploadArea.appendChild(previewVideo);
  uploadArea.appendChild(removeBtn);

  wrap.appendChild(uploadArea);

  const errorEl = document.createElement('p');
  errorEl.className = 'mt-1 text-[11px] leading-normal text-red-500 dark:text-red-400 hidden';
  errorEl.setAttribute('role', 'alert');
  wrap.appendChild(errorEl);

  let currentFile = null;
  let remixDataUrl = null; // For remix: stores base64/URL value when no File object

  function showPreview(src) {
    uploadArea.classList.add('relative', 'p-0', 'overflow-hidden');
    uploadArea.classList.remove('p-6');
    iconWrap.classList.add('hidden');
    titleEl.classList.add('hidden');
    subtitleEl.classList.add('hidden');

    // base64 video or URL → show in video element
    previewVideo.src = src;
    previewVideo.classList.remove('hidden');
    previewImg.classList.add('hidden');
    previewVideo.play().catch(() => {});
    removeBtn.classList.remove('hidden');
  }

  function clearPreview() {
    currentFile = null;
    remixDataUrl = null;
    fileInput.value = '';
    previewImg.classList.add('hidden');
    previewVideo.classList.add('hidden');
    removeBtn.classList.add('hidden');
    uploadArea.classList.remove('relative', 'p-0', 'overflow-hidden');
    uploadArea.classList.add('p-6');
    iconWrap.classList.remove('hidden');
    titleEl.classList.remove('hidden');
    subtitleEl.classList.remove('hidden');
  }

  function setError(message) {
    if (!message) {
      errorEl.textContent = '';
      errorEl.classList.add('hidden');
      uploadArea.style.borderColor = '';
      uploadArea.style.borderStyle = '';
      return;
    }
    errorEl.textContent = String(message);
    errorEl.classList.remove('hidden');
    uploadArea.style.borderColor = '#f87171';
    uploadArea.style.borderStyle = 'solid';
  }

  function clearError() {
    setError('');
  }

  uploadArea.addEventListener('click', (e) => {
    if (e.target === removeBtn || removeBtn.contains(e.target)) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    currentFile = file;
    remixDataUrl = null;
    const url = URL.createObjectURL(file);

    uploadArea.classList.add('relative', 'p-0', 'overflow-hidden');
    uploadArea.classList.remove('p-6');
    iconWrap.classList.add('hidden');
    titleEl.classList.add('hidden');
    subtitleEl.classList.add('hidden');

    if (file.type.startsWith('video/')) {
      previewVideo.src = url;
      previewVideo.classList.remove('hidden');
      previewImg.classList.add('hidden');
      previewVideo.play();
    } else {
      previewImg.src = url;
      previewImg.classList.remove('hidden');
      previewVideo.classList.add('hidden');
    }
    removeBtn.classList.remove('hidden');
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearPreview();
  });

  fileInput.addEventListener('change', clearError);

  return {
    wrap,
    setValue(dataUrl) {
      if (!dataUrl || typeof dataUrl !== 'string') return;
      remixDataUrl = dataUrl;
      currentFile = null;
      showPreview(dataUrl);
    },
    getValue: async () => {
      if (currentFile) {
        return await uploadFileToServer(currentFile, { filename: currentFile.name });
      }
      if (remixDataUrl) {
        // If it's already a CDN URL, return as-is
        if (remixDataUrl.startsWith('http')) return remixDataUrl;
        // If it's base64, upload to CDN first
        if (remixDataUrl.startsWith('data:')) {
          return await uploadUrlToServer(remixDataUrl);
        }
        return remixDataUrl;
      }
      return null;
    },
    setError,
    clearError,
  };
}

function createTransitionWithDuration({ defaultValue = 'Fade', defaultDuration = '5s' }) {
  const wrap = document.createElement('div');
  wrap.className = 'flex flex-col items-center';

  let selectedTransition = TRANSITION_TYPES.find(t => t.value === defaultValue) || TRANSITION_TYPES[0];
  let selectedDuration = defaultDuration;

  // Preview card - clickable
  const previewCard = document.createElement('button');
  previewCard.type = 'button';
  previewCard.className = 'relative w-[140px] h-[80px] rounded-[16px] overflow-hidden cursor-pointer group';

  const thumbVideo = document.createElement('video');
  thumbVideo.className = 'w-full h-full object-cover';
  thumbVideo.muted = true;
  thumbVideo.loop = true;
  thumbVideo.playsInline = true;
  thumbVideo.src = selectedTransition.preview;
  thumbVideo.play().catch(() => {});
  previewCard.appendChild(thumbVideo);

  const overlay = document.createElement('div');
  overlay.className = 'absolute inset-0 flex flex-col items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors';

  const icon = document.createElement('div');
  icon.className = 'mb-0.5';
  icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 23" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12.3845 1.88928H7.38837C2.56018 1.88928 0.628906 3.56865 0.628906 7.76708V12.8052C0.628906 17.0036 2.56018 18.683 7.38837 18.683H12.3845" stroke="white" stroke-width="1.25953" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M17.4664 1.97325C19.5356 1.97325 20.3633 3.64423 20.3633 7.82166V12.8346C20.3633 17.012 19.5356 18.683 17.4664 18.683" stroke="white" stroke-width="1.25953" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M5.75391 10.2857V9.04293C5.75391 7.43913 6.88748 6.79257 8.27296 7.59027L9.34776 8.21164L10.4226 8.833C11.808 9.63071 11.808 10.9406 10.4226 11.7383L9.34776 12.3597L8.27296 12.981C6.88748 13.7787 5.75391 13.1238 5.75391 11.5284V10.2857Z" stroke="white" stroke-width="1.25953" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14.9023 0.629761L14.9023 19.9425" stroke="white" stroke-width="1.25953" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

  const selectedName = document.createElement('div');
  selectedName.className = 'text-white text-xs font-semibold';
  selectedName.textContent = selectedTransition.label;

  overlay.appendChild(icon);
  overlay.appendChild(selectedName);
  previewCard.appendChild(overlay);
  wrap.appendChild(previewCard);

  // Duration toggle
  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'mt-3 flex p-1 bg-[#F2F5F9] dark:bg-[#1a1a1a] rounded-full w-[140px] h-[32px]';

  const btn5s = document.createElement('button');
  btn5s.type = 'button';
  btn5s.className = selectedDuration === '5s'
    ? 'flex-1 rounded-full text-[11px] font-semibold bg-white dark:bg-[#333] text-foreground shadow-sm transition-all'
    : 'flex-1 rounded-full text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-all';
  btn5s.textContent = '5s';

  const btn10s = document.createElement('button');
  btn10s.type = 'button';
  btn10s.className = selectedDuration === '10s'
    ? 'flex-1 rounded-full text-[11px] font-semibold bg-white dark:bg-[#333] text-foreground shadow-sm transition-all'
    : 'flex-1 rounded-full text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-all';
  btn10s.textContent = '10s';

  toggleWrap.appendChild(btn5s);
  toggleWrap.appendChild(btn10s);
  wrap.appendChild(toggleWrap);

  const activeClass = 'flex-1 rounded-full text-[11px] font-semibold bg-white dark:bg-[#333] text-foreground shadow-sm transition-all';
  const inactiveClass = 'flex-1 rounded-full text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-all';

  btn5s.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedDuration = '5s';
    btn5s.className = activeClass;
    btn10s.className = inactiveClass;
  });

  btn10s.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedDuration = '10s';
    btn10s.className = activeClass;
    btn5s.className = inactiveClass;
  });

  // Modal
  const modal = document.createElement('div');
  modal.className = 'fixed inset-0 z-50 hidden items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
  modal.innerHTML = `
    <div class="bg-white dark:bg-[#0A0A0A] rounded-2xl w-full max-w-lg sm:max-w-2xl lg:max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-xl">
      <div class="flex items-center justify-between px-4 pt-4 pb-2">
        <h3 class="text-[16px] font-bold text-foreground">Transitions</h3>
        <button type="button" class="modal-close w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#333] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="px-4 pb-2">
        <div class="relative">
          <svg class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          <input type="text" class="search-input w-full h-10 sm:h-12 pl-12 pr-4 rounded-[16px] bg-[#F2F5F9] dark:bg-[#262626]/80 text-foreground placeholder-muted-foreground focus:outline-none text-sm" placeholder="Search transitions">
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-3 sm:p-4">
        <div class="transitions-grid grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-4"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const grid = modal.querySelector('.transitions-grid');
  const searchInput = modal.querySelector('.search-input');
  const closeBtn = modal.querySelector('.modal-close');

  function renderGrid(filter = '') {
    grid.innerHTML = '';
    const filtered = TRANSITION_TYPES.filter(t =>
      t.label.toLowerCase().includes(filter.toLowerCase())
    );

    filtered.forEach(transition => {
      const isSelected = selectedTransition.value === transition.value;

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'text-left transition-all';

      const videoWrap = document.createElement('div');
      videoWrap.className = `w-full aspect-square rounded-[14.2px] bg-[#e5e5e5] dark:bg-[#0f0f0f] overflow-hidden mb-1 sm:mb-2 relative ${isSelected ? 'ring-2 ring-primary/90' : ''}`;

      const video = document.createElement('video');
      video.className = 'w-full h-full object-cover';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.src = transition.preview;

      videoWrap.appendChild(video);

      if (isSelected) {
        const checkmark = document.createElement('div');
        checkmark.className = 'absolute top-1 right-1 sm:top-2 sm:right-2 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/90 flex items-center justify-center';
        checkmark.innerHTML = '<svg class="w-3 h-3 sm:w-4 sm:h-4 text-white" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
        videoWrap.appendChild(checkmark);
      }

      // Autoplay video
      video.play().catch(() => {});

      const name = document.createElement('div');
      name.className = `text-[12px] sm:text-[15px] font-medium ${isSelected ? 'text-primary/90' : 'text-foreground'}`;
      name.textContent = transition.label;

      item.appendChild(videoWrap);
      item.appendChild(name);

      item.addEventListener('click', () => {
        selectedTransition = transition;
        selectedName.textContent = transition.label;
        thumbVideo.src = transition.preview;
        thumbVideo.play().catch(() => {});
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        renderGrid(searchInput.value);
      });

      grid.appendChild(item);
    });
  }

  previewCard.addEventListener('click', () => {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    renderGrid();
    searchInput.value = '';
    searchInput.focus();
  });

  closeBtn.addEventListener('click', () => {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });

  searchInput.addEventListener('input', () => {
    renderGrid(searchInput.value);
  });

  return {
    wrap,
    getTransition: () => selectedTransition.value,
    getDuration: () => selectedDuration === '5s' ? 5 : 10,
    setTransition(value) {
      if (!value) return;
      const v = String(value);
      const match = TRANSITION_TYPES.find(t => t.value === v || t.value.toLowerCase() === v.toLowerCase());
      if (!match) return;
      selectedTransition = match;
      selectedName.textContent = match.label;
      thumbVideo.src = match.preview;
      thumbVideo.play().catch(() => {});
    },
    setDuration(value) {
      if (!value) return;
      const v = String(value).toLowerCase();
      const numeric = Number.parseFloat(v.replace(/[^\d.]/g, ''));
      const useFive = Number.isFinite(numeric)
        ? numeric < 8
        : (v.includes('normal') || v.includes('slow') || v.includes('1') || v.includes('2') || v.includes('3') || v.includes('4'));
      if (useFive) {
        selectedDuration = '5s';
        btn5s.className = activeClass;
        btn10s.className = inactiveClass;
      } else {
        selectedDuration = '10s';
        btn10s.className = activeClass;
        btn5s.className = inactiveClass;
      }
    },
  };
}

export async function render({ container, remix }) {
  container.innerHTML = '';

  const startFrame = createFrameUpload({
    label: 'Start Video',
    sublabel: 'Upload your first video clip',
  });

  const endFrame = createFrameUpload({
    label: 'End Video',
    sublabel: 'Upload your second video clip',
  });

  const transitionWithDuration = createTransitionWithDuration({ defaultValue: 'Fade', defaultDuration: '5s' });

  const blendStyle = createSelectField({
    label: 'Blend style',
    id: 'blendStyle',
    required: false,
    options: BLEND_STYLES,
    defaultValue: 'Smooth',
  });

  const customEffect = createTextInputField({
    label: 'Custom effect',
    id: 'customEffect',
    required: false,
    placeholder: 'e.g., golden sparkles, underwater bubbles',
    help: 'Add your own description to enhance the transition.',
  });

  // Set data-id for applyRemixDefaultsToForm() fallback
  // Note: transitionType/transitionDuration are handled internally (not via data-id)
  // because their wrap contains clickable buttons that the generic handler would trigger
  startFrame.wrap.setAttribute('data-id', 'videoUrl1');
  endFrame.wrap.setAttribute('data-id', 'videoUrl2');

  container.appendChild(startFrame.wrap);
  container.appendChild(transitionWithDuration.wrap);
  container.appendChild(endFrame.wrap);

  // More options
  const moreBody = document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(blendStyle.wrap);
  moreBody.appendChild(customEffect.wrap);
  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  // Apply remix defaults
  const rd = remix?.defaults && typeof remix.defaults === 'object' ? remix.defaults : null;
  if (rd) {
    if (rd.videoUrl1) startFrame.setValue(rd.videoUrl1);
    if (rd.videoUrl2) endFrame.setValue(rd.videoUrl2);
    if (rd.transitionType) transitionWithDuration.setTransition(rd.transitionType);
    if (rd.transitionDuration) transitionWithDuration.setDuration(String(rd.transitionDuration));
    if (rd.blendStyle) blendStyle.setValue(rd.blendStyle);
    if (rd.customEffect && customEffect.setValue) customEffect.setValue(rd.customEffect);
  }

  const fieldRefs = { startFrame, endFrame, blendStyle, customEffect };

  return {
    getValues: async (opts) => {
      const onUploadProgress = opts?.onUploadProgress;
      startFrame.clearError();
      endFrame.clearError();

      onUploadProgress?.(0, 2); // signal: 0 of 2 done, set correct caps before uploads start

      let start, end;
      try {
        start = await startFrame.getValue();
      } catch (err) {
        start = null;
      }
      onUploadProgress?.(1, 2); // 1st file done out of 2
      try {
        end = await endFrame.getValue();
      } catch (err) {
        end = null;
      }
      onUploadProgress?.(2, 2); // 2nd file done out of 2

      let hasError = false;
      if (!start) {
        startFrame.setError('Please upload a start video');
        hasError = true;
      }
      if (!end) {
        endFrame.setError('Please upload an end video');
        hasError = true;
      }

      if (hasError) {
        throw new FieldValidationError('validation', 'Please fix the errors above');
      }

      const out = {
        videoUrl1: start,
        videoUrl2: end,
        transitionType: transitionWithDuration.getTransition(),
        transitionDuration: transitionWithDuration.getDuration(),
        blendStyle: blendStyle.getValue(),
      };

      const custom = customEffect.getTrimmed();
      if (custom) out.customEffect = custom;

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
