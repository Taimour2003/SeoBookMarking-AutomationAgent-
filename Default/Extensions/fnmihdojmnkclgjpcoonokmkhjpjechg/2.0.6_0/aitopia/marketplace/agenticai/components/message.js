// Message Component - User and assistant message bubbles

function createUserMessage(text) {
  const message = document.createElement('div');
  message.className = 'message user';
  message.innerHTML = `
    <div class="message-content">${escapeHtml(text)}</div>
  `;
  return message;
}

function createAssistantMessage() {
  const message = document.createElement('div');
  message.className = 'message assistant';
  message.innerHTML = `
    <div class="message-content"></div>
  `;
  return message;
}

function createLoadingIndicator() {
  const loading = document.createElement('div');
  loading.className = 'message assistant';
  loading.innerHTML = `
    <div class="message-content">
      <div class="loading-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  return loading;
}

function appendToAssistantMessage(messageEl, content) {
  const contentEl = messageEl.querySelector('.message-content');
  if (contentEl) {
    contentEl.innerHTML += content;
  }
}

function createImageElement(imageUrl) {
  const img = document.createElement('img');
  img.src = imageUrl;
  img.className = 'generated-image';
  img.alt = 'Generated image';
  return img;
}

function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export for use in app.js
window.MessageComponent = {
  createUserMessage,
  createAssistantMessage,
  createLoadingIndicator,
  appendToAssistantMessage,
  createImageElement
};
