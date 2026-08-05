// Upload Component - Upload images/audio and insert /generated/... URLs into chat input

const UploadComponent = (function() {
  'use strict';

  let fileInput = null;
  let isUploading = false;

  function ensureFileInput() {
    if (fileInput) return fileInput;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,audio/*';
    input.style.display = 'none';
    document.body.appendChild(input);
    fileInput = input;
    return input;
  }

  function setUploadingState(button, uploading) {
    isUploading = uploading;
    if (!button) return;
    button.disabled = uploading;
    button.classList.toggle('uploading', uploading);
  }

  function insertAtCursor(textarea, text) {
    if (!textarea) return;
    const value = textarea.value || '';
    const start = typeof textarea.selectionStart === 'number' ? textarea.selectionStart : value.length;
    const end = typeof textarea.selectionEnd === 'number' ? textarea.selectionEnd : value.length;

    const prefix = value.slice(0, start);
    const suffix = value.slice(end);
    const insert = (prefix && !/\s$/.test(prefix) ? ' ' : '') + text + (suffix && !/^\s/.test(suffix) ? ' ' : '');

    textarea.value = prefix + insert + suffix;
    const nextPos = (prefix + insert).length;
    textarea.setSelectionRange(nextPos, nextPos);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    textarea.focus();
  }

  async function uploadFile(file) {
    const type = String(file?.type || '').toLowerCase();
    const isImage = type.startsWith('image/');
    const isAudio = type.startsWith('audio/');

    if (!isImage && !isAudio) {
      return { error: 'Unsupported file type. Please upload an image or audio file.' };
    }

    const endpoint = isImage ? 'https://aitopia.ai/api/upload/image' : 'https://aitopia.ai/api/upload/audio';
    const filename = encodeURIComponent(file?.name || (isImage ? 'upload.png' : 'upload.mp3'));
    const url = `${endpoint}?filename=${filename}`;

    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': file.type || (isImage ? 'image/png' : 'audio/mpeg') }, body: file });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { error: data?.error || `Upload failed (HTTP ${res.status})` };
    }

    const outUrl = isImage ? data?.imageUrl : data?.audioUrl;
    if (!outUrl) return { error: 'Upload succeeded but no URL was returned.' };
    return { url: outUrl, kind: isImage ? 'image' : 'audio' };
  }

  function init(uploadButton, messageInput) {
    if (!uploadButton || !messageInput) return;

    const input = ensureFileInput();

    uploadButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (isUploading) return;
      input.value = '';
      input.click();
    });

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;

      setUploadingState(uploadButton, true);
      try {
        const result = await uploadFile(file);
        if (result.error) {
          console.error('Upload error:', result.error);
          alert(result.error);
          return;
        }
        insertAtCursor(messageInput, result.url);
      } catch (err) {
        console.error('Upload error:', err);
        alert(err.message || 'Upload failed');
      } finally {
        setUploadingState(uploadButton, false);
      }
    });
  }

  return { init };
})();

window.UploadComponent = UploadComponent;
