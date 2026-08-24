// Todo Component - Task list with status tracking

function createTodoList(todos) {
  const container = document.createElement('div');
  container.className = 'todo-list';

  container.innerHTML = `
    <div class="todo-header">
      <span class="node-dot todo"></span>
      <span>Update Todos</span>
    </div>
    <div class="todo-items">
      ${todos.map(todo => createTodoItem(todo)).join('')}
    </div>
  `;

  return container;
}

function createTodoItem(todo) {
  const status = todo.status || 'pending';
  let icon = '';

  switch (status) {
    case 'completed':
      icon = '✓';
      break;
    case 'in_progress':
      icon = '●';
      break;
    default:
      icon = '';
  }

  return `
    <div class="todo-item ${status}">
      <div class="todo-checkbox">${icon}</div>
      <span class="todo-text">${escapeHtml(todo.content || todo.activeForm || '')}</span>
    </div>
  `;
}

function updateTodoList(container, todos) {
  const itemsContainer = container.querySelector('.todo-items');
  if (itemsContainer) {
    itemsContainer.innerHTML = todos.map(todo => createTodoItem(todo)).join('');
  }
}

function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Export for use in app.js
window.TodoComponent = {
  createTodoList,
  updateTodoList
};
