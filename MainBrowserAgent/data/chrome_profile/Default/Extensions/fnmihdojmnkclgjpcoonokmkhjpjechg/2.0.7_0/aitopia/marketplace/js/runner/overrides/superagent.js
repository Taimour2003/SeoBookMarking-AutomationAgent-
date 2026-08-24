import { createTextAreaField, createMoreOptionsDisclosure } from './ui.js';

export async function render({ container }) {
  container.innerHTML = '';

  const task = createTextAreaField({
    label: 'Task',
    id: 'task',
    required: true,
    rows: 4,
    placeholder: 'Describe what you want to accomplish...',
    help: 'Superagent will orchestrate other agents and tools to complete your task.',
  });

  const context = createTextAreaField({
    label: 'Additional context',
    id: 'context',
    required: false,
    rows: 3,
    placeholder: 'Any constraints, preferences, or prior results...',
  });

  // Main fields
  container.appendChild(task.wrap);

  // More options
  const moreBody = window.document.createElement('div');
  moreBody.className = 'space-y-4';
  moreBody.appendChild(context.wrap);

  container.appendChild(createMoreOptionsDisclosure({
    label: 'More options',
    defaultOpen: false,
    body: moreBody,
  }));

  return {
    getValues: async () => {
      const t = task.getTrimmed();
      if (!t) throw new Error('Task is required.');

      const out = { task: t };

      const ctx = context.getTrimmed();
      if (ctx) out.context = ctx;

      return out;
    },
  };
}
