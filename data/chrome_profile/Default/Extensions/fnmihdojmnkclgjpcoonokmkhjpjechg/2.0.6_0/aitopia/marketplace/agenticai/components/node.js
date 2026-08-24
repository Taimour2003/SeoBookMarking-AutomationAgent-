// Node Component - Collapsible nodes for thinking, tool calls, etc.

const NodeTypes = {
  THINKING: 'thinking',
  TOOL: 'tool',
  TODO: 'todo',
  ERROR: 'error',
};

function createNode(type, title, options = {}) {
  const { collapsed = false, badgeText = '', badgeState = '' } = options;

  const node = document.createElement('div');
  node.className = `node ${collapsed ? 'collapsed' : ''}`.trim();
  node.dataset.type = type;

  node.innerHTML = `
    <div class="node-header" role="button" tabindex="0">
      <span class="node-dot ${type}"></span>
      <span class="node-title">${escapeHtml(title)}</span>
      <span class="node-badge ${escapeHtml(badgeState)}" ${badgeText ? '' : 'hidden'}>${escapeHtml(badgeText)}</span>
      <span class="node-toggle" aria-hidden="true">▼</span>
    </div>
    <div class="node-content"></div>
  `;

  const header = node.querySelector('.node-header');
  header.addEventListener('click', () => node.classList.toggle('collapsed'));
  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      node.classList.toggle('collapsed');
    }
  });

  return node;
}

function setNodeBadge(node, badgeText, badgeState = '') {
  const badgeEl = node.querySelector('.node-badge');
  if (!badgeEl) return;
  badgeEl.textContent = badgeText || '';
  badgeEl.className = `node-badge ${badgeState || ''}`.trim();
  badgeEl.hidden = !badgeText;
}

function setNodeHTML(node, html) {
  const contentEl = node.querySelector('.node-content');
  if (contentEl) contentEl.innerHTML = html;
}

function appendToNodeText(node, text) {
  const contentEl = node.querySelector('.node-content');
  if (!contentEl) return;
  contentEl.textContent += text;
}

function createThinkingNode() {
  const node = createNode(NodeTypes.THINKING, 'Thinking', { collapsed: false });
  node.querySelector('.node-content').classList.add('node-prewrap');
  return node;
}

function createErrorNode(message) {
  const node = createNode(NodeTypes.ERROR, 'Error', { collapsed: false, badgeText: 'Error', badgeState: 'error' });
  appendToNodeText(node, String(message ?? 'Unknown error'));
  return node;
}

function createToolNode(toolUseId, toolName) {
  const node = createNode(NodeTypes.TOOL, toolName, { collapsed: false, badgeText: 'Preparing…', badgeState: 'pending' });
  node.dataset.toolUseId = toolUseId || '';
  setNodeHTML(node, `
    <div class="node-io">
      <div class="node-io-row">
        <div class="node-io-label">IN</div>
        <pre class="node-io-pre"><code class="node-io-code node-io-in"></code></pre>
      </div>
      <div class="node-io-row">
        <div class="node-io-label">OUT</div>
        <div class="node-io-out node-io-out-empty">—</div>
      </div>
    </div>
  `);
  return node;
}

function setToolInput(node, inputText) {
  const codeEl = node.querySelector('.node-io-in');
  if (!codeEl) return;
  codeEl.textContent = inputText || '';
}

function setToolOutputHTML(node, html) {
  const outEl = node.querySelector('.node-io-out');
  if (!outEl) return;
  outEl.classList.remove('node-io-out-empty');
  outEl.innerHTML = html;
  try {
    outEl.querySelectorAll('audio, video').forEach((el) => {
      try {
        el.autoplay = false;
        el.removeAttribute('autoplay');
      } catch {
        // ignore
      }
      try {
        el.loop = false;
        el.removeAttribute('loop');
      } catch {
        // ignore
      }
      try {
        el.pause?.();
      } catch {
        // ignore
      }
    });
  } catch {
    // ignore
  }
}

function setToolOutputText(node, text) {
  const outEl = node.querySelector('.node-io-out');
  if (!outEl) return;
  outEl.classList.remove('node-io-out-empty');
  outEl.textContent = text || '';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = String(text ?? '');
  return div.innerHTML;
}

window.NodeComponent = {
  NodeTypes,
  createNode,
  createThinkingNode,
  createToolNode,
  createErrorNode,
  setNodeBadge,
  setNodeHTML,
  appendToNodeText,
  setToolInput,
  setToolOutputHTML,
  setToolOutputText,
};
