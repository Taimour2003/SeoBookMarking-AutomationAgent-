(() => {
  const trigger = document.querySelector('[data-agent-picker-trigger]');
  const dropdown = document.querySelector('[data-agent-picker-dropdown]');
  if (!trigger || !dropdown || trigger.disabled) return;

  function openPicker() {
    trigger.setAttribute('aria-expanded', 'true');
    dropdown.hidden = false;
  }
  function closePicker() {
    trigger.setAttribute('aria-expanded', 'false');
    dropdown.hidden = true;
  }

  trigger.addEventListener('click', (e) => {
    e.preventDefault();
    const open = trigger.getAttribute('aria-expanded') === 'true';
    if (open) closePicker();
    else openPicker();
  });

  document.addEventListener('click', (e) => {
    if (dropdown.hidden) return;
    if (!trigger.contains(e.target) && !dropdown.contains(e.target)) closePicker();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dropdown.hidden) closePicker();
  });

  const runPanel = document.querySelector('[data-run-panel]');
  if (runPanel) {
    const obs = new MutationObserver(() => {
      if (!runPanel.classList.contains('open') && !dropdown.hidden) closePicker();
    });
    obs.observe(runPanel, { attributes: true, attributeFilter: ['class'] });
  }
})();