// Feedback Modal - used for Reject flows (plan/images approval)

(function () {
  'use strict';

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = String(text ?? '');
    return div.innerHTML;
  }

  function open(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const title = typeof opts.title === 'string' && opts.title.trim() ? opts.title.trim() : 'Request changes';
    const hint =
      typeof opts.hint === 'string' && opts.hint.trim()
        ? opts.hint.trim()
        : 'Describe what you want changed. Be specific (tone/style, number of scenes, duration, models, etc.).';
    const placeholder =
      typeof opts.placeholder === 'string'
        ? opts.placeholder
        : 'Example: Make it more cinematic, shorten to 30s, use 3 scenes, and avoid political content.';
    const submitLabel = typeof opts.submitLabel === 'string' && opts.submitLabel.trim() ? opts.submitLabel.trim() : 'Submit';
    const cancelLabel = typeof opts.cancelLabel === 'string' && opts.cancelLabel.trim() ? opts.cancelLabel.trim() : 'Cancel';
    const defaultValue = typeof opts.defaultValue === 'string' ? opts.defaultValue : '';

    return new Promise((resolve) => {
      let overlayEl = null;
      let modalEl = null;
      let resolved = false;

      const finish = (value) => {
        if (resolved) return;
        resolved = true;
        try {
          window.removeEventListener('keydown', onKeyDown);
        } catch {
          // ignore
        }
        if (overlayEl) overlayEl.remove();
        overlayEl = null;
        modalEl = null;
        try {
          document.body.classList.remove('modal-open');
        } catch {
          // ignore
        }
        resolve(value);
      };

      const onKeyDown = (e) => {
        if (e.key === 'Escape') finish(null);
      };

      overlayEl = document.createElement('div');
      overlayEl.className = 'modal-overlay';
      overlayEl.addEventListener('click', (e) => {
        if (e.target === overlayEl) finish(null);
      });

      modalEl = document.createElement('div');
      modalEl.className = 'modal';
      modalEl.innerHTML = `
        <div class="modal-header">
          <div class="modal-title">${escapeHtml(title)}</div>
          <button type="button" class="modal-close" aria-label="Close">×</button>
        </div>
        <div class="modal-body">
          <div class="settings-row">
            <div class="settings-hint">${escapeHtml(hint)}</div>
            <textarea id="agenticai-feedback-text" class="settings-textarea" rows="5" spellcheck="true" placeholder="${escapeHtml(placeholder)}"></textarea>
          </div>
          <div class="approval-actions">
            <button type="button" class="approval-btn secondary" data-action="cancel">${escapeHtml(cancelLabel)}</button>
            <button type="button" class="approval-btn primary" data-action="submit">${escapeHtml(submitLabel)}</button>
          </div>
        </div>
      `;

      const closeBtn = modalEl.querySelector('.modal-close');
      closeBtn?.addEventListener('click', () => finish(null));

      const textarea = modalEl.querySelector('#agenticai-feedback-text');
      if (textarea) textarea.value = defaultValue;

      modalEl.querySelector('[data-action="cancel"]')?.addEventListener('click', () => finish(null));
      modalEl.querySelector('[data-action="submit"]')?.addEventListener('click', () => {
        const value = textarea && typeof textarea.value === 'string' ? textarea.value : '';
        finish(value.trim());
      });

      overlayEl.appendChild(modalEl);
      document.body.appendChild(overlayEl);
      try {
        document.body.classList.add('modal-open');
      } catch {
        // ignore
      }

      window.addEventListener('keydown', onKeyDown);
      setTimeout(() => {
        try {
          textarea?.focus?.();
          textarea?.setSelectionRange?.(textarea.value.length, textarea.value.length);
        } catch {
          // ignore
        }
      }, 0);
    });
  }

  window.AgenticAiFeedbackModal = {
    open,
  };
})();

