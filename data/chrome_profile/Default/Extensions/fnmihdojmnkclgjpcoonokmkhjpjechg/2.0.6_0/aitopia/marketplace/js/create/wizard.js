import { fetchHelper } from '../shared/fetch-helper.js';

const root = document.getElementById('wizardRoot');

const STEPS = [
  { id: 'type', title: 'Type', subtitle: 'What kind of agent are you building?' },
  { id: 'style', title: 'Style', subtitle: 'Pick a starting template.' },
  { id: 'inputs', title: 'Inputs', subtitle: 'Toggle optional roles and refine labels.' },
  { id: 'models', title: 'Models', subtitle: 'Select a recommended model (optional).' },
  { id: 'details', title: 'Details', subtitle: 'Name, visibility, and (optional) prompt tuning.' },
  { id: 'review', title: 'Review', subtitle: 'Create your private AppCore agent.' },
];

const STATE = {
  stepIndex: 0,
  templates: [],
  selectedType: null,
  selectedTemplateId: null,
  template: null, // full template record (includes definition)
  inputs: {}, // inputId -> { enabled, ui: {label,helpText,placeholder}, default }
  model: {
    mode: 'none', // 'none' | 'capability' | 'agent' | 'llm'
    capability: null,
    models: null,
    selectedModelId: null,
    selectedProvider: null,
    llmModel: null,
  },
  details: {
    name: '',
    description: '',
    visibility: 'private',
    systemPrompt: null,
    userMessageTemplate: null,
  },
  ui: {
    templateQuery: '',
    showAdvancedInputs: false,
    inputsPreset: 'recommended', // 'minimal' | 'recommended' | 'all' | 'custom'
    showPromptTuning: false,
    remixAgentQuery: '',
    remixAgentBusy: false,
    preview: {
      open: false,
      busy: false,
      template: null,
      error: null,
    },
  },
  toasts: [], // { id, tone, title, description }
  busy: false,
  error: null,
  created: null, // { appId, storeId }
  remix: null, // { agentId, agentName }
};

function uid() {
  try {
    return crypto.randomUUID();
  } catch {
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function toSnakeCase(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+/, '')
    .replace(/_+$/, '')
    .toLowerCase();
}

function normalizeAppInputId(candidate, fallback) {
  const fallbackId = String(fallback || 'input').trim() || 'input';
  let id = toSnakeCase(candidate);
  if (!id) id = toSnakeCase(fallbackId) || 'input';
  if (!/^[a-z]/.test(id)) id = `input_${id}`;
  id = id.replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
  id = id.slice(0, 64).replace(/_+$/, '');
  if (!/^[a-z][a-z0-9_]*$/.test(id)) {
    id = toSnakeCase(fallbackId) || 'input';
    if (!/^[a-z][a-z0-9_]*$/.test(id)) id = 'input';
  }
  return id;
}

function makeUniqueId(base, usedIds) {
  const safeBase = String(base || 'input').slice(0, 64) || 'input';
  let candidate = safeBase;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    const tail = `_${suffix++}`;
    candidate = `${safeBase.slice(0, Math.max(1, 64 - tail.length))}${tail}`;
  }
  usedIds.add(candidate);
  return candidate;
}

function humanizeLabel(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
}

function inferWizardTypeFromAgentMeta(agentMeta) {
  const outputs = Array.isArray(agentMeta?.outputTypes) ? agentMeta.outputTypes.map((t) => String(t)) : [];
  if (outputs.some((t) => t.toLowerCase() === 'video')) return 'video';
  if (outputs.some((t) => t.toLowerCase() === 'image')) return 'image';
  if (outputs.some((t) => t.toLowerCase() === 'audio')) return 'audio';
  return 'text';
}

function pickJsonSchemaType(schema) {
  const type = schema?.type;
  if (typeof type === 'string' && type.trim()) return type.trim();
  if (Array.isArray(type)) {
    const nonNull = type.find((t) => typeof t === 'string' && t !== 'null');
    if (typeof nonNull === 'string') return nonNull;
    const first = type.find((t) => typeof t === 'string');
    if (typeof first === 'string') return first;
  }
  return null;
}

function inferAppInputType(agentKey, schemaNode) {
  const xuap = isPlainObject(schemaNode?.['x-uap']) ? schemaNode['x-uap'] : null;
  const widget = typeof xuap?.widget === 'string' ? xuap.widget : null;
  const mediaKind = typeof xuap?.mediaKind === 'string' ? xuap.mediaKind : null;

  if (widget === 'json') return 'json';
  if (widget === 'textarea') return 'chat';
  if (widget === 'media' && (mediaKind === 'image' || mediaKind === 'video' || mediaKind === 'audio')) return mediaKind;

  const values = Array.isArray(schemaNode?.enum) ? schemaNode.enum : null;
  if (values && values.length > 0) return 'select';

  const type = pickJsonSchemaType(schemaNode);
  if (type === 'boolean') return 'boolean';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'object' || type === 'array') return 'json';

  if (type === 'string') {
    const format = typeof schemaNode?.format === 'string' ? schemaNode.format.toLowerCase() : '';
    if (format === 'uri' || format === 'url') {
      const k = String(agentKey || '').toLowerCase();
      if (/(image|img|photo|picture|mask)/.test(k)) return 'image';
      if (/(video|movie|clip)/.test(k)) return 'video';
      if (/(audio|voice|sound)/.test(k)) return 'audio';
    }
  }

  return 'text';
}

async function readJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { _raw: text };
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function badge(text) {
  return `<span class="px-2 py-0.5 rounded-full bg-secondary text-[11px] font-semibold text-muted-foreground">${escapeHtml(text)}</span>`;
}

function setBusy(busy) {
  STATE.busy = busy;
  render();
}

function setRemixBusy(busy) {
  STATE.ui.remixAgentBusy = Boolean(busy);
  render();
}

function extractAgentIdFromRemixInput(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && (parts[0] === 'agents' || parts[0] === 'agent')) return parts[1] || '';
      return '';
    } catch {
      return '';
    }
  }
  const match = raw.match(/\/(agents|agent)\/([a-z0-9-]+)/i);
  if (match && match[2]) return match[2];
  return raw;
}

async function loadRemixAgentFromUi() {
  const candidate = extractAgentIdFromRemixInput(STATE.ui.remixAgentQuery);
  if (!candidate) {
    setError('Enter an agent id (e.g. face-swap) or paste an /agents/:id URL.');
    return;
  }

  setError(null, { toast: false });
  setRemixBusy(true);

  try {
    const [agentMeta, schemaResponse] = await Promise.all([
      loadStoreAgentMetadata(candidate),
      loadStoreAgentSchema(candidate),
    ]);

    const built = buildDynamicTemplateFromAgent({ agentId: candidate, agentMeta, schemaResponse });
    initStateFromTemplate(built.template);
    STATE.selectedType = built.template.type;
    STATE.stepIndex = 2;
    STATE.remix = { agentId: candidate, agentName: built.agentName };
    pushToast({ tone: 'success', title: 'Remix loaded', description: `Loaded schema from ${built.agentName}.` });
    render();
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setRemixBusy(false);
  }
}

function pushToast(input) {
  const toast = {
    id: uid(),
    tone: input?.tone || 'info',
    title: String(input?.title || ''),
    description: input?.description ? String(input.description) : null,
  };
  STATE.toasts = [...(STATE.toasts || []), toast].slice(-4);
  render();

  const timeoutMs = input?.timeoutMs ?? 4200;
  setTimeout(() => {
    STATE.toasts = (STATE.toasts || []).filter((t) => t.id !== toast.id);
    render();
  }, timeoutMs);
}

function setError(error, options = {}) {
  const message = error ? String(error) : null;
  STATE.error = message;
  if (message && options.toast !== false) {
    pushToast({
      tone: 'error',
      title: 'Something went wrong',
      description: message,
    });
  }
  render();
}

function getStep() {
  return STEPS[STATE.stepIndex] ?? STEPS[0];
}

function canGoNext() {
  const step = getStep().id;
  if (step === 'type') return Boolean(STATE.selectedType);
  if (step === 'style') return Boolean(STATE.selectedTemplateId && STATE.template);
  if (step === 'details') return Boolean(String(STATE.details.name || '').trim());
  if (step === 'review') return false;
  return true;
}

function clampStepIndex(nextIndex) {
  return Math.max(0, Math.min(STEPS.length - 1, nextIndex));
}

function goToStepIndex(nextIndex) {
  STATE.stepIndex = clampStepIndex(nextIndex);
  render();
  if (getStep().id === 'models') void ensureCapabilityModelsLoaded();
}

function nextStep() {
  if (!canGoNext()) return;
  goToStepIndex(STATE.stepIndex + 1);
}

function prevStep() {
  goToStepIndex(STATE.stepIndex - 1);
}

function resetDownstream(fromStepId) {
  const idx = STEPS.findIndex((s) => s.id === fromStepId);
  if (idx === -1) return;
  // Clear everything after a step that changes upstream selection.
  if (idx <= 0) {
    STATE.selectedTemplateId = null;
    STATE.template = null;
    STATE.inputs = {};
    STATE.model = { mode: 'none', capability: null, models: null, selectedModelId: null, selectedProvider: null, llmModel: null };
    STATE.details = { name: '', description: '', visibility: 'private', systemPrompt: null, userMessageTemplate: null };
    STATE.ui.templateQuery = '';
    STATE.ui.showAdvancedInputs = false;
    STATE.ui.inputsPreset = 'recommended';
    STATE.ui.showPromptTuning = false;
    STATE.ui.preview = { open: false, busy: false, template: null, error: null };
    STATE.created = null;
    STATE.remix = null;
  } else if (idx <= 1) {
    STATE.template = null;
    STATE.inputs = {};
    STATE.model = { mode: 'none', capability: null, models: null, selectedModelId: null, selectedProvider: null, llmModel: null };
    STATE.details = { name: '', description: '', visibility: 'private', systemPrompt: null, userMessageTemplate: null };
    STATE.ui.showAdvancedInputs = false;
    STATE.ui.inputsPreset = 'recommended';
    STATE.ui.showPromptTuning = false;
    STATE.ui.preview = { open: false, busy: false, template: null, error: null };
    STATE.created = null;
    STATE.remix = null;
  }
}

function templateTypes() {
  const types = new Set();
  for (const t of STATE.templates) {
    if (typeof t?.type === 'string' && t.type.trim()) types.add(t.type.trim());
  }
  const preferredOrder = ['text', 'image', 'video', 'audio'];
  const ordered = [
    ...preferredOrder.filter((t) => types.has(t)),
    ...Array.from(types).filter((t) => !preferredOrder.includes(t)),
  ];
  return ordered;
}

function filteredTemplates() {
  if (!STATE.selectedType) return [];
  return STATE.templates.filter((t) => String(t.type) === String(STATE.selectedType));
}

function getTemplateSummary(templateId) {
  return STATE.templates.find((t) => String(t.id) === String(templateId)) ?? null;
}

async function loadTemplates() {
  const res = await fetchHelper('https://aitopia.ai/api/apps/templates', { method: 'GET', headers: { Accept: 'application/json' } });
  const json = await readJson(res);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load templates (${res.status})`;
    throw new Error(String(msg));
  }
  return Array.isArray(json?.templates) ? json.templates : [];
}

async function loadTemplateDefinition(templateId) {
  const res = await fetchHelper(`https://aitopia.ai/api/apps/templates/${encodeURIComponent(templateId)}`, { method: 'GET', headers: { Accept: 'application/json' } });
  const json = await readJson(res);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load template (${res.status})`;
    throw new Error(String(msg));
  }
  if (!json?.template) throw new Error('Template not found');
  return json.template;
}

async function loadStoreAgentMetadata(agentId) {
  const res = await fetchHelper(`https://aitopia.ai/api/store/${encodeURIComponent(agentId)}`, { method: 'GET', headers: { Accept: 'application/json' } });
  const json = await readJson(res);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load agent metadata (${res.status})`;
    throw new Error(String(msg));
  }
  return json;
}

async function loadStoreAgentSchema(agentId) {
  const res = await fetchHelper(`https://aitopia.ai/api/store/${encodeURIComponent(agentId)}/schema/json?ui=uap`, { method: 'GET', headers: { Accept: 'application/json' } });
  const json = await readJson(res);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load agent schema (${res.status})`;
    throw new Error(String(msg));
  }
  return json;
}

function buildDynamicTemplateFromAgent(params) {
  const agentId = String(params.agentId || '').trim();
  const agentMeta = params.agentMeta || {};
  const schemaResponse = params.schemaResponse || {};

  const agentName = String(agentMeta?.name || agentId || 'Agent').trim() || agentId || 'Agent';
  const agentDescription = typeof agentMeta?.description === 'string' ? agentMeta.description.trim() : '';
  const modelCapability = typeof agentMeta?.modelCapability === 'string' ? agentMeta.modelCapability.trim() : '';
  const modelChoices = Array.isArray(agentMeta?.modelChoices) ? agentMeta.modelChoices : [];
  const modelSelectorEnabled = agentMeta?.modelSelectorEnabled === true;

  const type = inferWizardTypeFromAgentMeta(agentMeta);

  const inputSchema = schemaResponse?.input;
  const properties = isPlainObject(inputSchema?.properties) ? inputSchema.properties : {};
  const required = Array.isArray(inputSchema?.required) ? inputSchema.required.map((v) => String(v)) : [];
  const requiredSet = new Set(required);

  const usedIds = new Set();
  const inputs = [];
  const agentKeyToInputId = Object.create(null);

  const entries = Object.entries(properties);
  for (let index = 0; index < entries.length; index++) {
    const [agentKey, schemaNode] = entries[index];
    const key = String(agentKey || '').trim();
    if (!key) continue;

    const baseId = normalizeAppInputId(key, `input_${index + 1}`);
    const inputId = makeUniqueId(baseId, usedIds);
    agentKeyToInputId[key] = inputId;

    const isRequired = requiredSet.has(key);
    const inferredType = inferAppInputType(key, schemaNode);

    const title = typeof schemaNode?.title === 'string' ? schemaNode.title.trim() : '';
    const description = typeof schemaNode?.description === 'string' ? schemaNode.description.trim() : '';

    const xuap = isPlainObject(schemaNode?.['x-uap']) ? schemaNode['x-uap'] : null;
    const group = typeof xuap?.group === 'string' ? xuap.group : null;
    const advanced = typeof group === 'string' && group.trim().toLowerCase() === 'advanced';

    const inputDef = {
      id: inputId,
      type: inferredType,
      required: isRequired,
      ...(schemaNode && Object.prototype.hasOwnProperty.call(schemaNode, 'default') ? { default: schemaNode.default } : {}),
      ui: {
        label: title || humanizeLabel(key) || key,
        ...(description ? { helpText: description } : {}),
        ...(advanced ? { advanced: true } : {}),
      },
    };

    if (inferredType === 'select') {
      const values = Array.isArray(schemaNode?.enum) ? schemaNode.enum : [];
      const options = values.filter((v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
      if (options.length > 0) {
        inputDef.options = options;
      } else {
        inputDef.type = 'text';
      }
    }

    inputs.push(inputDef);
  }

  const inputMapping = Object.fromEntries(
    Object.entries(agentKeyToInputId).map(([agentKey, inputId]) => [
      agentKey,
      { from: 'input', inputId },
    ])
  );

  const remixName = `${agentName} — Remix`;
  const templateId = `from-agent:${agentId}`;

  return {
    template: {
      id: templateId,
      name: remixName,
      description: agentDescription,
      type,
      templateVersion: 1,
      fromAgent: {
        agentId,
        modelCapability,
        modelChoices,
        modelSelectorEnabled,
      },
      definition: {
        formatVersion: 1,
        name: remixName,
        ...(agentDescription ? { description: agentDescription } : {}),
        visibility: 'private',
        ui: { mode: 'form' },
        inputs,
        workflow: {
          mode: 'single',
          entryNodeId: 'main',
          nodes: [
            {
              id: 'main',
              type: 'agent',
              agentId,
              task: `Run agent: ${agentId}`,
              inputMapping,
            },
          ],
        },
        outputs: [],
        defaults: { tier: 'starter' },
      },
    },
    agentName,
  };
}

async function loadModelsForCapability(capability, tier) {
  const url = `https://aitopia.ai/api/models?capability=${encodeURIComponent(capability)}${tier ? `&tier=${encodeURIComponent(tier)}` : ''}`;
  const res = await fetchHelper(url, { method: 'GET', headers: { Accept: 'application/json' } });
  const json = await readJson(res);
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || `Failed to load models (${res.status})`;
    throw new Error(String(msg));
  }
  return Array.isArray(json?.models) ? json.models : [];
}

function getEntryNode(definition) {
  const nodes = Array.isArray(definition?.workflow?.nodes) ? definition.workflow.nodes : [];
  if (nodes.length === 0) return null;
  const entryId = definition?.workflow?.entryNodeId || nodes[0]?.id;
  return nodes.find((n) => n.id === entryId) ?? nodes[0] ?? null;
}

function initStateFromTemplate(template) {
  STATE.template = template;
  STATE.selectedTemplateId = template.id;
  STATE.ui.templateQuery = '';
  STATE.ui.showAdvancedInputs = false;
  STATE.ui.inputsPreset = 'recommended';
  STATE.ui.showPromptTuning = false;
  STATE.ui.preview = { open: false, busy: false, template: null, error: null };

  const templateFromAgent = isPlainObject(template?.fromAgent) ? template.fromAgent : null;

  const def = template.definition;
  const inputs = Array.isArray(def?.inputs) ? def.inputs : [];
  const nextInputs = {};
  for (const input of inputs) {
    const id = String(input.id);
    const required = input.required === true;
    const advanced = input?.ui?.advanced === true;
    nextInputs[id] = {
      enabled: required ? true : !advanced,
      required,
      type: input.type,
      ui: {
        label: input?.ui?.label ?? '',
        helpText: input?.ui?.helpText ?? '',
        placeholder: input?.ui?.placeholder ?? '',
      },
      default: input.default,
      options: Array.isArray(input.options) ? input.options : null,
      advanced,
    };
  }
  STATE.inputs = nextInputs;

  const entry = getEntryNode(def);
  const defaultsTier = def?.defaults?.tier || 'starter';

  if (entry?.type === 'agent' && Array.isArray(templateFromAgent?.modelChoices) && templateFromAgent.modelChoices.length > 0) {
    STATE.model = {
      mode: 'agent',
      capability: typeof templateFromAgent?.modelCapability === 'string' ? templateFromAgent.modelCapability : null,
      models: templateFromAgent.modelChoices,
      selectedModelId: entry.selectedModelId ?? null,
      selectedProvider: null,
      llmModel: null,
      tier: defaultsTier,
    };
  } else if (entry?.type === 'model' && entry?.selection?.strategy === 'capability') {
    STATE.model = {
      mode: 'capability',
      capability: entry.selection.capability,
      models: null,
      selectedModelId: entry.selection.selectedModelId ?? null,
      selectedProvider: entry.selection.preferredProvider ?? null,
      llmModel: null,
      tier: defaultsTier,
    };
  } else if (entry?.type === 'llm') {
    STATE.model = {
      mode: 'llm',
      capability: null,
      models: null,
      selectedModelId: null,
      selectedProvider: null,
      llmModel: entry.model ?? 'claude-sonnet-4-20250514',
      tier: defaultsTier,
    };
  } else {
    STATE.model = { mode: 'none', capability: null, models: null, selectedModelId: null, selectedProvider: null, llmModel: null, tier: defaultsTier };
  }

  STATE.details = {
    name: String(template.name || '').trim(),
    description: String(template.description || '').trim(),
    visibility: 'private',
    systemPrompt: entry?.type === 'llm' ? (entry.systemPrompt ?? '') : null,
    userMessageTemplate: entry?.type === 'llm' ? (entry.userMessageTemplate ?? '') : null,
  };

  STATE.created = null;
  STATE.remix = null;
}

function updateInputUi(inputId, field, value) {
  const entry = STATE.inputs?.[inputId];
  if (!entry) return;
  entry.ui = entry.ui || {};
  entry.ui[field] = value;
}

function setInputEnabled(inputId, enabled) {
  const entry = STATE.inputs?.[inputId];
  if (!entry) return;
  if (entry.required) return;
  entry.enabled = Boolean(enabled);
  if (STATE.ui.inputsPreset !== 'custom') STATE.ui.inputsPreset = 'custom';
}

function applyInputsPreset(preset) {
  const normalized = preset === 'minimal' || preset === 'recommended' || preset === 'all' ? preset : 'recommended';
  for (const entry of Object.values(STATE.inputs || {})) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.required) {
      entry.enabled = true;
      continue;
    }
    if (normalized === 'minimal') entry.enabled = false;
    else if (normalized === 'recommended') entry.enabled = !entry.advanced;
    else entry.enabled = true;
  }
  STATE.ui.inputsPreset = normalized;
}

function pruneInputMappings(definition) {
  const inputIds = new Set((definition.inputs || []).map((i) => i.id));
  const nodes = Array.isArray(definition?.workflow?.nodes) ? definition.workflow.nodes : [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const mapping = node.inputMapping;
    if (!mapping || typeof mapping !== 'object') continue;
    for (const [key, ref] of Object.entries(mapping)) {
      if (ref && typeof ref === 'object' && ref.from === 'input') {
        if (!inputIds.has(ref.inputId)) {
          delete mapping[key];
        }
      }
    }
  }
}

function buildOverriddenDefinition() {
  if (!STATE.template?.definition) return null;
  const def = deepClone(STATE.template.definition);

  const name = String(STATE.details.name || '').trim();
  const description = String(STATE.details.description || '').trim();
  const visibility = STATE.details.visibility || 'private';

  def.name = name;
  def.description = description ? description : undefined;
  def.visibility = visibility;

  const configuredInputs = [];
  for (const input of def.inputs || []) {
    const cfg = STATE.inputs?.[input.id];
    const enabled = cfg ? Boolean(cfg.enabled) : Boolean(input.required);
    if (!enabled && input.required !== true) continue;

    const next = { ...input };
    if (cfg?.ui) {
      next.ui = {
        ...(next.ui || {}),
        ...(cfg.ui.label ? { label: cfg.ui.label } : {}),
        ...(cfg.ui.helpText ? { helpText: cfg.ui.helpText } : {}),
        ...(cfg.ui.placeholder ? { placeholder: cfg.ui.placeholder } : {}),
      };
    }
    configuredInputs.push(next);
  }
  def.inputs = configuredInputs;

  // Apply model + prompt overrides to the entry node (MVP: single node).
  const entry = getEntryNode(def);
  if (entry?.type === 'agent') {
    if (STATE.model?.selectedModelId) entry.selectedModelId = STATE.model.selectedModelId;
    else delete entry.selectedModelId;
  }
  if (entry?.type === 'model' && entry?.selection?.strategy === 'capability') {
    if (STATE.model?.selectedModelId) entry.selection.selectedModelId = STATE.model.selectedModelId;
    if (STATE.model?.selectedProvider) entry.selection.preferredProvider = STATE.model.selectedProvider;
  }
  if (entry?.type === 'llm') {
    if (STATE.model?.llmModel) entry.model = STATE.model.llmModel;
    if (STATE.details.systemPrompt !== null) entry.systemPrompt = String(STATE.details.systemPrompt || '');
    if (STATE.details.userMessageTemplate !== null) entry.userMessageTemplate = String(STATE.details.userMessageTemplate || '');
  }

  pruneInputMappings(def);
  return def;
}

function summarizeEnabledInputs() {
  const all = Object.entries(STATE.inputs || {});
  const enabled = all.filter(([, v]) => v && v.enabled);
  return { enabledCount: enabled.length, totalCount: all.length };
}

function renderToasts() {
  const items = Array.isArray(STATE.toasts) ? STATE.toasts : [];
  if (items.length === 0) return '';

  const toneStyles = {
    info: 'border-border bg-card',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    error: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400',
  };

  return `
    <div class="fixed top-20 right-4 z-50 w-[92vw] max-w-sm space-y-2">
      ${items.map((t) => {
    const cls = toneStyles[t.tone] || toneStyles.info;
    return `
          <div class="rounded-ios-2xl border ${cls} p-4 shadow-sm">
            <div class="text-sm font-semibold">${escapeHtml(t.title || '')}</div>
            ${t.description ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(t.description)}</div>` : ''}
          </div>
        `;
  }).join('')}
    </div>
  `.trim();
}

function closeTemplatePreview() {
  STATE.ui.preview = { open: false, busy: false, template: null, error: null };
}

function renderTemplatePreviewModal() {
  const preview = STATE.ui?.preview;
  if (!preview?.open) return '';

  const tpl = preview.template;
  const templateId = tpl?.id ? String(tpl.id) : null;
  const name = tpl?.name || templateId || 'Template';
  const description = tpl?.description || '';
  const def = tpl?.definition;

  const inputs = Array.isArray(def?.inputs) ? def.inputs : null;
  const outputs = Array.isArray(def?.outputs) ? def.outputs : null;

  const content = (() => {
    if (preview.busy) {
      return `
        <div class="rounded-ios-2xl border border-border bg-card p-5">
          <div class="text-sm font-semibold">Loading…</div>
          <div class="mt-2 text-sm text-muted-foreground">Fetching template details.</div>
        </div>
      `;
    }

    if (preview.error) {
      return `
        <div class="rounded-ios-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-600 dark:text-red-400">
          <div class="text-sm font-semibold">Couldn’t load template</div>
          <div class="mt-2 text-sm">${escapeHtml(preview.error)}</div>
        </div>
      `;
    }

    if (!def) {
      return `<div class="text-sm text-muted-foreground">No definition available for this template.</div>`;
    }

    const inputsUi = (inputs || []).map((input) => {
      const label = input?.ui?.label || input?.id || 'input';
      const required = input?.required === true;
      const advanced = input?.ui?.advanced === true;
      return `
        <div class="rounded-ios-2xl border border-border bg-card p-4">
          <div class="text-sm font-semibold truncate">${escapeHtml(label)}</div>
          <div class="mt-1 text-xs text-muted-foreground">
            ${badge(input?.type || 'unknown')} ${required ? badge('required') : badge('optional')} ${advanced ? badge('advanced') : ''}
          </div>
          ${input?.ui?.helpText ? `<div class="mt-2 text-xs text-muted-foreground">${escapeHtml(input.ui.helpText)}</div>` : ''}
        </div>
      `;
    }).join('');

    const outputsUi = (outputs || []).map((out) => {
      const id = out?.id ? String(out.id) : 'output';
      const renderer = out?.renderer ? String(out.renderer) : 'unknown';
      const nodeId = out?.from?.nodeId ? String(out.from.nodeId) : null;
      return `
        <div class="rounded-ios-2xl border border-border bg-card p-4">
          <div class="text-sm font-semibold truncate">${escapeHtml(id)}</div>
          <div class="mt-1 text-xs text-muted-foreground">
            ${badge(renderer)} ${nodeId ? badge(`from:${nodeId}`) : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="grid gap-6">
        <div>
          <div class="text-xs font-semibold text-muted-foreground">Inputs</div>
          <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${inputsUi || `<div class="text-sm text-muted-foreground">No inputs defined.</div>`}
          </div>
        </div>
        <div>
          <div class="text-xs font-semibold text-muted-foreground">Outputs</div>
          <div class="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
            ${outputsUi || `<div class="text-sm text-muted-foreground">No outputs defined.</div>`}
          </div>
        </div>
      </div>
    `;
  })();

  return `
    <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" data-action="close-preview" aria-modal="true" role="dialog">
      <div class="min-h-full flex items-end sm:items-center justify-center p-4">
        <div data-action="preview-modal" class="w-full max-w-2xl rounded-ios-3xl border border-border bg-background shadow-xl">
          <div class="p-5 sm:p-6">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="text-xs font-semibold text-muted-foreground">Template preview</div>
                <div class="mt-1 text-xl font-semibold truncate">${escapeHtml(name)}</div>
                ${description ? `<div class="mt-1 text-sm text-muted-foreground">${escapeHtml(description)}</div>` : ''}
              </div>
              <button type="button" data-action="close-preview" class="h-9 px-3 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">
                Close
              </button>
            </div>

            <div class="mt-4 flex flex-wrap gap-2">
              ${tpl?.type ? badge(tpl.type) : ''}
              ${tpl?.style ? badge(tpl.style) : ''}
              ${tpl?.templateVersion ? badge(`v${tpl.templateVersion}`) : ''}
              ${def?.defaults?.tier ? badge(`tier:${def.defaults.tier}`) : ''}
              ${def?.ui?.mode ? badge(`ui:${def.ui.mode}`) : ''}
            </div>

            <div class="mt-6">
              ${content}
            </div>

            <div class="mt-6 flex flex-wrap gap-3">
              <button type="button" data-action="select-template" ${templateId ? `data-template-id="${escapeHtml(templateId)}"` : ''} class="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60" ${templateId ? '' : 'disabled'}>
                Use this template
              </button>
              <button type="button" data-action="close-preview" class="h-11 px-5 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `.trim();
}

function renderStepper() {
  const progress = Math.round(((STATE.stepIndex + 1) / STEPS.length) * 100);
  return `
    <div class="rounded-ios-2xl border border-border bg-card p-4 sm:p-5">
      <div class="flex flex-wrap gap-3 items-center justify-between">
        <div class="min-w-0">
          <div class="text-xs font-semibold text-muted-foreground">Create Agent</div>
          <div class="mt-1 text-sm font-semibold">${escapeHtml(getStep().title)}</div>
          <div class="text-xs text-muted-foreground mt-1">${escapeHtml(getStep().subtitle)}</div>
        </div>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span class="font-semibold text-foreground">${progress}%</span>
        </div>
      </div>

      <div class="mt-4 h-2 rounded-full bg-secondary/80 overflow-hidden">
        <div class="h-full bg-primary transition-[width] duration-300" style="width:${progress}%"></div>
      </div>

      <div class="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        ${STEPS.map((s, i) => {
    const active = i === STATE.stepIndex;
    const done = i < STATE.stepIndex;
    const base = 'h-10 rounded-ios-xl border border-border flex items-center gap-2 px-3 transition-colors';
    const cls = active
      ? `${base} bg-secondary/80`
      : done
        ? `${base} bg-background/40`
        : `${base} bg-background/20 opacity-70`;
    const dot = done
      ? `<span class="w-5 h-5 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[11px] font-bold">✓</span>`
      : `<span class="w-5 h-5 rounded-full border border-border inline-flex items-center justify-center text-[11px] font-bold">${i + 1}</span>`;
    return `
            <button type="button" data-action="goto-step" data-step-index="${i}" class="${cls}" aria-current="${active ? 'step' : 'false'}">
              ${dot}
              <span class="truncate text-[12px] font-semibold">${escapeHtml(s.title)}</span>
            </button>
          `;
  }).join('')}
      </div>
    </div>
  `.trim();
}

function renderStepRail() {
  const progress = Math.round(((STATE.stepIndex + 1) / STEPS.length) * 100);

  return `
    <div class="rounded-ios-2xl border border-border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <div class="text-xs font-semibold text-muted-foreground">Steps</div>
        <div class="text-xs text-muted-foreground">
          <span class="font-semibold text-foreground">${STATE.stepIndex + 1}</span> / ${STEPS.length}
        </div>
      </div>

      <div class="mt-3 h-2 rounded-full bg-secondary/80 overflow-hidden">
        <div class="h-full bg-primary transition-[width] duration-300" style="width:${progress}%"></div>
      </div>

      <div class="mt-4 space-y-2">
        ${STEPS.map((s, i) => {
    const active = i === STATE.stepIndex;
    const done = i < STATE.stepIndex;
    const base = 'w-full h-11 rounded-ios-xl border border-border flex items-center gap-3 px-3 transition-colors';
    const cls = active
      ? `${base} bg-secondary/80`
      : done
        ? `${base} bg-background/40 hover:bg-secondary/40`
        : `${base} bg-background/20 hover:bg-secondary/30 opacity-80`;

    const dot = done
      ? `<span class="w-6 h-6 rounded-full bg-primary text-primary-foreground inline-flex items-center justify-center text-[11px] font-bold">✓</span>`
      : `<span class="w-6 h-6 rounded-full border border-border inline-flex items-center justify-center text-[11px] font-bold">${i + 1}</span>`;

    return `
            <button type="button" data-action="goto-step" data-step-index="${i}" class="${cls}" aria-current="${active ? 'step' : 'false'}">
              ${dot}
              <span class="truncate text-sm font-semibold">${escapeHtml(s.title)}</span>
            </button>
          `;
  }).join('')}
      </div>
    </div>
  `.trim();
}

function renderDesktopStepHeader() {
  const step = getStep();
  return `
    <div class="hidden lg:block">
      <div class="text-xs font-semibold text-muted-foreground">Step ${STATE.stepIndex + 1} of ${STEPS.length}</div>
      <div class="mt-2 text-2xl font-semibold tracking-tight">${escapeHtml(step.title)}</div>
      <div class="mt-1 text-sm text-muted-foreground">${escapeHtml(step.subtitle)}</div>
    </div>
  `.trim();
}

function renderRemixBanner() {
  const remix = STATE.remix;
  if (!remix || typeof remix !== 'object') return '';
  const name = String(remix.agentName || '').trim();
  if (!name) return '';
  return `
    <div class="mt-4 rounded-ios-2xl border border-border bg-card px-5 py-4">
      <div class="text-sm font-semibold">Remixing: ${escapeHtml(name)}</div>
    </div>
  `.trim();
}

function renderTypeStep() {
  const types = templateTypes();
  const cards = [
    { id: 'text', icon: '📝', title: 'Text', desc: 'Writers, assistants, chat agents.' },
    { id: 'image', icon: '🖼️', title: 'Image', desc: 'Generate or transform images.' },
    { id: 'video', icon: '🎬', title: 'Video', desc: 'Text-to-video, image-to-video, upscaling.' },
    { id: 'audio', icon: '🔊', title: 'Audio', desc: 'Text-to-speech and audio-first agents.' },
  ].filter((c) => types.includes(c.id));

  if (cards.length === 0) {
    return `
      <div class="rounded-ios-2xl border border-border bg-card p-6">
        <div class="text-sm text-muted-foreground">No templates available.</div>
      </div>
    `;
  }

  return `
    <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      ${cards.map((c) => {
    const selected = STATE.selectedType === c.id;
    const cls = selected
      ? 'border-primary/50 ring-2 ring-primary/20'
      : 'border-border hover:border-primary/30';
    return `
          <button type="button" data-action="select-type" data-type="${escapeHtml(c.id)}"
            class="text-left rounded-ios-2xl border ${cls} bg-card p-5 transition-colors">
            <div class="flex items-start justify-between gap-3">
              <div class="w-10 h-10 rounded-ios-xl bg-secondary flex items-center justify-center text-xl">${c.icon}</div>
              ${selected ? `<div class="text-xs font-semibold text-primary">Selected</div>` : ''}
            </div>
            <div class="mt-4 text-lg font-semibold">${escapeHtml(c.title)}</div>
            <div class="mt-1 text-sm text-muted-foreground">${escapeHtml(c.desc)}</div>
          </button>
        `;
  }).join('')}
    </div>
  `;
}

function renderStyleStep() {
  if (!STATE.selectedType) {
    return `<div class="text-sm text-muted-foreground">Select a type first.</div>`;
  }

  const templates = filteredTemplates();
  const remixCard = `
    <div class="rounded-ios-2xl border border-border bg-card p-6">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div class="min-w-0">
          <div class="text-sm font-semibold">Remix an existing agent</div>
          <div class="mt-1 text-xs text-muted-foreground">Paste an agent URL or type its id to prefill the wizard from its schema.</div>
        </div>
        <a href="/aitopia/marketplace/agents.html" class="h-9 px-4 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">
          Browse agents
        </a>
      </div>

      <div class="mt-4 flex flex-col sm:flex-row gap-2">
        <input
          data-action="edit-remix-agent"
          value="${escapeHtml(STATE.ui.remixAgentQuery || '')}"
          placeholder="face-swap or https://aitopia.ai/agents/face-swap"
          class="flex-1 h-11 px-4 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <button
          type="button"
          data-action="load-remix-agent"
          ${STATE.ui.remixAgentBusy ? 'disabled' : ''}
          class="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
        >${STATE.ui.remixAgentBusy ? 'Loading…' : 'Load remix'}</button>
      </div>
    </div>
  `.trim();

  if (templates.length === 0) {
    return `
      <div class="space-y-4">
        ${remixCard}
        <div class="text-sm text-muted-foreground">No templates found for this type.</div>
      </div>
    `;
  }

  const query = String(STATE.ui.templateQuery || '').trim().toLowerCase();
  const filtered = query
    ? templates.filter((tpl) => {
      const haystack = [
        tpl?.name,
        tpl?.id,
        tpl?.description,
        tpl?.style,
        tpl?.type,
        tpl?.templateVersion ? `v${tpl.templateVersion}` : '',
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    })
    : templates;

  const clearBtn = query
    ? `
      <button type="button" data-action="clear-template-query" class="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-secondary hover:bg-secondary/80 text-muted-foreground transition-colors" aria-label="Clear search">
        ×
      </button>
    `
    : '';

  return `
    <div class="space-y-4">
      ${remixCard}
      <div class="flex flex-col sm:flex-row sm:items-end gap-3">
        <div class="flex-1">
          <label class="block text-xs font-semibold text-muted-foreground mb-1">Search templates</label>
          <div class="relative">
            <div class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">⌕</div>
            <input data-action="filter-templates" value="${escapeHtml(STATE.ui.templateQuery || '')}"
              placeholder="Search by name, style, description…"
              class="w-full h-11 pl-9 pr-10 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
            ${clearBtn}
          </div>
        </div>
        <div class="text-xs text-muted-foreground">
          Showing <span class="font-semibold text-foreground">${filtered.length}</span> / ${templates.length}
        </div>
      </div>

      ${filtered.length === 0
    ? `
            <div class="rounded-ios-2xl border border-border bg-card p-6">
              <div class="text-sm font-semibold">No matches</div>
              <div class="mt-1 text-sm text-muted-foreground">Try a different search, or clear the filter.</div>
              <div class="mt-4">
                <button type="button" data-action="clear-template-query" class="h-10 px-4 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">
                  Clear search
                </button>
              </div>
            </div>
          `
    : `
            <div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              ${filtered.map((tpl) => {
      const selected = STATE.selectedTemplateId === tpl.id;
      const cls = selected
        ? 'border-primary/50 ring-2 ring-primary/20'
        : 'border-border hover:border-primary/30';
      return `
                    <div data-action="select-template" data-template-id="${escapeHtml(String(tpl.id))}" role="button" tabindex="0"
                      class="group cursor-pointer text-left rounded-ios-2xl border ${cls} bg-card p-5 transition-colors">
                      <div class="flex items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="text-base font-semibold truncate">${escapeHtml(tpl.name || tpl.id)}</div>
                          <div class="mt-1 text-sm text-muted-foreground">${escapeHtml(tpl.description || '')}</div>
                        </div>
                        ${selected ? `<div class="text-xs font-semibold text-primary">Selected</div>` : ''}
                      </div>
                      <div class="mt-4 flex flex-wrap gap-2">
                        ${tpl.type ? badge(tpl.type) : ''}
                        ${tpl.style ? badge(tpl.style) : ''}
                        ${tpl.templateVersion ? badge(`v${tpl.templateVersion}`) : ''}
                      </div>
                      <div class="mt-4 flex items-center justify-between gap-3">
                        <div class="text-xs text-muted-foreground">
                          ${selected ? 'Continue to customize inputs →' : 'Click to select'}
                        </div>
                        <button type="button" data-action="preview-template" data-template-id="${escapeHtml(String(tpl.id))}"
                          class="h-9 px-3 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-semibold transition-colors">
                          Preview
                        </button>
                      </div>
                    </div>
                  `;
    }).join('')}
            </div>
          `}
    </div>
  `;
}

function renderInputsStep() {
  const def = STATE.template?.definition;
  if (!def) return `<div class="text-sm text-muted-foreground">Select a template first.</div>`;

  const inputs = Array.isArray(def.inputs) ? def.inputs : [];
  if (inputs.length === 0) {
    return `
      <div class="rounded-ios-2xl border border-border bg-card p-6">
        <div class="text-sm font-semibold">No inputs</div>
        <div class="mt-1 text-sm text-muted-foreground">This template does not define any inputs.</div>
      </div>
    `.trim();
  }

  const preset = STATE.ui.inputsPreset || 'recommended';
  const summary = summarizeEnabledInputs();

  const requiredInputs = inputs.filter((i) => i?.required === true);
  const optionalInputs = inputs.filter((i) => i?.required !== true && i?.ui?.advanced !== true);
  const advancedInputs = inputs.filter((i) => i?.required !== true && i?.ui?.advanced === true);

  const presets = [
    { id: 'minimal', label: 'Minimal', desc: 'Required only' },
    { id: 'recommended', label: 'Recommended', desc: 'Best default' },
    { id: 'all', label: 'All', desc: 'Include advanced' },
    { id: 'custom', label: 'Custom', desc: 'You’ve edited toggles' },
  ];

  const presetUi = `
    <div class="rounded-ios-2xl border border-border bg-card p-5">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div class="text-sm text-muted-foreground">
          Enabled inputs: <span class="font-semibold text-foreground">${summary.enabledCount}</span> / ${summary.totalCount}
        </div>
        <div class="text-xs text-muted-foreground">
          Preset: <span class="font-semibold text-foreground">${escapeHtml(preset)}</span>
        </div>
      </div>

      <div class="mt-4">
	        <div class="text-xs font-semibold text-muted-foreground mb-2">Input preset</div>
	        <div class="inline-flex items-stretch rounded-ios-xl bg-secondary/80 border border-border p-1">
	          ${presets.filter((p) => p.id !== 'custom' || preset === 'custom').map((p) => {
	    const active = preset === p.id;
	    const cls = active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground';
	    if (p.id === 'custom') {
	      return `
	              <div class="h-9 px-3 rounded-ios-lg text-xs font-semibold flex items-center ${cls}" title="${escapeHtml(p.desc)}">
	                ${escapeHtml(p.label)}
	              </div>
	            `;
	    }
	    return `
	              <button type="button" data-action="inputs-preset" data-preset="${p.id}"
	                class="h-9 px-3 rounded-ios-lg text-xs font-semibold transition-colors ${cls}"
	                title="${escapeHtml(p.desc)}">
	                ${escapeHtml(p.label)}
	              </button>
	            `;
	  }).join('')}
	        </div>
        <div class="mt-2 text-xs text-muted-foreground">
          Start with a preset, then toggle optional roles below.
        </div>
      </div>
    </div>
  `.trim();

  const renderInputCard = (input) => {
    const cfg = STATE.inputs?.[input.id];
    const enabled = cfg ? Boolean(cfg.enabled) : Boolean(input.required);
    const required = input.required === true;
    const advanced = input?.ui?.advanced === true;
    const label = cfg?.ui?.label ?? input?.ui?.label ?? '';
    const placeholder = cfg?.ui?.placeholder ?? input?.ui?.placeholder ?? '';
    const helpText = cfg?.ui?.helpText ?? input?.ui?.helpText ?? '';

    const toggle = required
      ? `<span class="text-xs font-semibold text-muted-foreground">Required</span>`
      : `
        <label class="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" data-action="toggle-input" data-input-id="${escapeHtml(input.id)}" ${enabled ? 'checked' : ''} class="h-4 w-4 accent-primary" />
          <span class="text-xs font-semibold">${enabled ? 'On' : 'Off'}</span>
        </label>
      `;

    return `
      <div class="rounded-ios-2xl border border-border bg-card p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-semibold truncate">${escapeHtml(label || input.id)}</div>
            <div class="mt-1 text-xs text-muted-foreground">
              ${badge(input.type)} ${advanced ? badge('advanced') : ''} ${required ? badge('required') : badge('optional')}
            </div>
          </div>
          <div class="shrink-0">${toggle}</div>
        </div>

        <div class="mt-4 grid gap-3 ${enabled ? '' : 'opacity-60'}">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-semibold text-muted-foreground mb-1">Label</label>
              <input ${enabled ? '' : 'disabled'} data-action="edit-input-ui" data-input-id="${escapeHtml(input.id)}" data-field="label"
                value="${escapeHtml(label)}"
                placeholder="${escapeHtml(input.id)}"
                class="w-full h-10 px-3 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-70" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-muted-foreground mb-1">Placeholder</label>
              <input ${enabled ? '' : 'disabled'} data-action="edit-input-ui" data-input-id="${escapeHtml(input.id)}" data-field="placeholder"
                value="${escapeHtml(placeholder)}"
                placeholder="Optional…"
                class="w-full h-10 px-3 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-70" />
            </div>
          </div>
          <div>
            <label class="block text-xs font-semibold text-muted-foreground mb-1">Help text</label>
            <textarea ${enabled ? '' : 'disabled'} data-action="edit-input-ui" data-input-id="${escapeHtml(input.id)}" data-field="helpText"
              class="w-full px-3 py-2 rounded-ios-xl bg-secondary/80 border-0 text-sm h-20 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-70"
              placeholder="Optional…">${escapeHtml(helpText)}</textarea>
          </div>
        </div>
      </div>
    `;
  };

  const section = (title, subtitle, contentHtml) => `
    <div class="space-y-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-semibold">${escapeHtml(title)}</div>
          ${subtitle ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(subtitle)}</div>` : ''}
        </div>
      </div>
      <div class="grid grid-cols-1 gap-4">
        ${contentHtml}
      </div>
    </div>
  `;

  const requiredHtml = requiredInputs.length > 0
    ? requiredInputs.map(renderInputCard).join('')
    : `<div class="text-sm text-muted-foreground">No required inputs.</div>`;

  const optionalHtml = optionalInputs.length > 0
    ? optionalInputs.map(renderInputCard).join('')
    : `<div class="text-sm text-muted-foreground">No optional inputs.</div>`;

  const advancedToggleBtn = advancedInputs.length > 0
    ? `
      <button type="button" data-action="toggle-advanced-inputs" class="text-sm font-semibold text-primary hover:underline">
        ${STATE.ui.showAdvancedInputs ? 'Hide advanced roles' : 'Show advanced roles'}
      </button>
    `
    : '';

  const advancedToggleRow = advancedInputs.length > 0 && STATE.ui.showAdvancedInputs
    ? `<div class="flex justify-end">${advancedToggleBtn}</div>`
    : '';

  const advancedHtml = advancedInputs.length === 0
    ? ''
    : STATE.ui.showAdvancedInputs
      ? section('Advanced roles', 'Power users only. Enable if you need them.', advancedInputs.map(renderInputCard).join(''))
      : `
        <div class="rounded-ios-2xl border border-border bg-card p-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-semibold">Advanced roles</div>
              <div class="mt-1 text-xs text-muted-foreground">Hidden by default (${advancedInputs.length} available).</div>
            </div>
            ${advancedToggleBtn}
          </div>
        </div>
      `;

  return `
    <div class="grid gap-4">
      ${presetUi}
      ${section('Required roles', 'Always included. These are essential for the template.', requiredHtml)}
      ${section('Optional roles', 'Toggle these on if your agent needs them.', optionalHtml)}
      ${advancedToggleRow}
      ${advancedHtml}
    </div>
  `;
}

function renderModelsStep() {
  const def = STATE.template?.definition;
  if (!def) return `<div class="text-sm text-muted-foreground">Select a template first.</div>`;

  const entry = getEntryNode(def);
  const tier = def?.defaults?.tier || 'starter';

  if (entry?.type === 'agent' && STATE.model.mode === 'agent') {
    const capability = STATE.model.capability ? String(STATE.model.capability) : '';
    const selected = STATE.model.selectedModelId || '';
    const models = Array.isArray(STATE.model.models) ? STATE.model.models : [];

    const options = models.map((choice) => {
      const id = typeof choice === 'string' ? choice : String(choice?.id || '');
      if (!id) return '';
      const provider = typeof choice === 'object' && choice && choice.provider ? String(choice.provider) : '';
      const displayName = typeof choice === 'object' && choice && choice.displayName ? String(choice.displayName) : id;
      const modelTier = typeof choice === 'object' && choice && choice.tier ? String(choice.tier) : '';
      const star = typeof choice === 'object' && choice && choice.recommended ? ' ★' : '';
      return `<option value="${escapeHtml(id)}" ${selected === id ? 'selected' : ''}>${escapeHtml(displayName)}${star}${provider ? ` — ${escapeHtml(provider)}` : ''}${modelTier ? ` (${escapeHtml(modelTier)})` : ''}</option>`;
    });

    return `
      <div class="rounded-ios-2xl border border-border bg-card p-6">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-semibold">Model</div>
            <div class="mt-1 text-sm text-muted-foreground">${capability ? `Capability: ${escapeHtml(capability)}` : 'Select a default model for this agent.'}</div>
          </div>
          <div class="text-xs text-muted-foreground">Tier: <span class="font-semibold text-foreground">${escapeHtml(tier)}</span></div>
        </div>

        <div class="mt-5">
          <label class="block text-xs font-semibold text-muted-foreground mb-1">Model (optional override)</label>
          <select data-action="select-capability-model" class="w-full h-11 px-3 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value="" ${selected ? '' : 'selected'}>Recommended default</option>
            ${options.join('')}
          </select>
          <div class="mt-2 text-xs text-muted-foreground">
            Select a specific model, or leave as “Recommended default”.
          </div>
        </div>
      </div>
    `.trim();
  }

  if (entry?.type === 'model' && entry?.selection?.strategy === 'capability') {
    const capability = entry.selection.capability;
    const selected = STATE.model.selectedModelId || '';
    const models = Array.isArray(STATE.model.models) ? STATE.model.models : [];

    const options = models.map((m) => {
      const id = String(m.id || '');
      const provider = String(m.provider || '');
      const displayName = String(m.displayName || id);
      const modelTier = String(m.tier || '');
      return `<option value="${escapeHtml(id)}" ${selected === id ? 'selected' : ''}>${escapeHtml(displayName)} — ${escapeHtml(provider)}${modelTier ? ` (${escapeHtml(modelTier)})` : ''}</option>`;
    });

    const loading = STATE.busy && models.length === 0;

    return `
      <div class="rounded-ios-2xl border border-border bg-card p-6">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-semibold">Capability</div>
            <div class="mt-1 text-sm text-muted-foreground">${escapeHtml(capability)}</div>
          </div>
          <div class="text-xs text-muted-foreground">Tier: <span class="font-semibold text-foreground">${escapeHtml(tier)}</span></div>
        </div>

        <div class="mt-5">
          <label class="block text-xs font-semibold text-muted-foreground mb-1">Model (optional override)</label>
          <select data-action="select-capability-model" class="w-full h-11 px-3 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" ${loading ? 'disabled' : ''}>
            <option value="" ${selected ? '' : 'selected'}>Recommended default</option>
            ${options.join('')}
          </select>
          <div class="mt-2 text-xs text-muted-foreground">
            ${loading ? 'Loading models…' : 'Select a specific model, or leave as “Recommended default”.'}
          </div>
        </div>
      </div>
    `.trim();
  }

  if (entry?.type === 'llm') {
    const modelId = STATE.model.llmModel || entry.model || 'claude-sonnet-4-20250514';
    const options = [
      { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'claude-haiku-3-5-20241022', label: 'Claude Haiku 3.5' },
    ].map((m) => `<option value="${m.id}" ${m.id === modelId ? 'selected' : ''}>${m.label}</option>`);

    return `
      <div class="rounded-ios-2xl border border-border bg-card p-6">
        <div class="text-sm font-semibold">LLM model</div>
        <div class="mt-1 text-sm text-muted-foreground">Choose which Claude model powers this template.</div>
        <div class="mt-5">
          <select data-action="select-llm-model" class="w-full h-11 px-3 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
            ${options.join('')}
          </select>
        </div>
      </div>
    `.trim();
  }

  return `
    <div class="rounded-ios-2xl border border-border bg-card p-6">
      <div class="text-sm font-semibold">No model selection</div>
      <div class="mt-1 text-sm text-muted-foreground">This template does not expose model overrides (yet).</div>
    </div>
  `;
}

function renderDetailsStep() {
  const def = STATE.template?.definition;
  const entry = def ? getEntryNode(def) : null;
  const promptOpen = STATE.ui.showPromptTuning === true;

  const promptEditor = entry?.type === 'llm'
    ? `
      <div class="mt-6 rounded-ios-2xl border border-border bg-card p-6">
        <button type="button" data-action="toggle-prompt-tuning" class="w-full text-left flex items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="text-sm font-semibold">Prompt tuning (optional)</div>
            <div class="mt-1 text-sm text-muted-foreground">Advanced: edit the system prompt and template message.</div>
          </div>
          <div class="shrink-0 text-xs font-semibold text-primary">
            ${promptOpen ? 'Hide' : 'Show'}
          </div>
        </button>

        ${promptOpen
          ? `
              <div class="mt-5 space-y-4">
                <div>
                  <label class="block text-xs font-semibold text-muted-foreground mb-1">System prompt</label>
                  <textarea data-action="edit-details" data-field="systemPrompt"
                    class="w-full px-3 py-2 rounded-ios-xl bg-secondary/80 border-0 text-sm h-28 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="System prompt…">${escapeHtml(STATE.details.systemPrompt ?? '')}</textarea>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-muted-foreground mb-1">User message template</label>
                  <textarea data-action="edit-details" data-field="userMessageTemplate"
                    class="w-full px-3 py-2 rounded-ios-xl bg-secondary/80 border-0 text-sm h-28 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="User message template…">${escapeHtml(STATE.details.userMessageTemplate ?? '')}</textarea>
                  <div class="mt-2 text-xs text-muted-foreground">
                    Use <code class="px-1 py-0.5 rounded bg-secondary">{{variable}}</code> to reference inputs.
                  </div>
                </div>
              </div>
            `
          : `
              <div class="mt-4 text-xs text-muted-foreground">
                Using the template’s default prompt. You can enable prompt tuning if you need tighter behavior.
              </div>
            `}
      </div>
    `
    : '';

  return `
    <div class="rounded-ios-2xl border border-border bg-card p-6">
      <div class="grid gap-4">
        <div>
          <label class="block text-xs font-semibold text-muted-foreground mb-1">Name</label>
          <input data-action="edit-details" data-field="name"
            value="${escapeHtml(STATE.details.name)}"
            placeholder="My Agent"
            class="w-full h-11 px-3 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20" />
        </div>
        <div>
          <label class="block text-xs font-semibold text-muted-foreground mb-1">Description</label>
          <textarea data-action="edit-details" data-field="description"
            class="w-full px-3 py-2 rounded-ios-xl bg-secondary/80 border-0 text-sm h-24 focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Optional…">${escapeHtml(STATE.details.description)}</textarea>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-muted-foreground mb-1">Visibility</label>
            <select data-action="edit-details" data-field="visibility" class="w-full h-11 px-3 rounded-ios-xl bg-secondary/80 border-0 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="private" ${STATE.details.visibility === 'private' ? 'selected' : ''}>Private</option>
              <option value="unlisted" ${STATE.details.visibility === 'unlisted' ? 'selected' : ''}>Unlisted</option>
            </select>
            <div class="mt-2 text-xs text-muted-foreground">
              Public listing happens via App Studio review.
            </div>
          </div>
          <div class="rounded-ios-xl border border-border bg-background/40 p-4">
            <div class="text-xs font-semibold">Tip</div>
            <div class="mt-1 text-xs text-muted-foreground">
              You can always edit workflows later in <a class="text-primary hover:underline" href="/aitopia/marketplace/app-studio.html">App Studio</a>.
            </div>
          </div>
        </div>
      </div>
    </div>
    ${promptEditor}
  `;
}

function renderReviewStep() {
  const tpl = STATE.template;
  const type = STATE.selectedType;
  const inputs = summarizeEnabledInputs();
  const modelLine = (() => {
    if (STATE.model.mode === 'capability') {
      if (STATE.model.selectedModelId) return `Model override: ${STATE.model.selectedModelId}`;
      return `Model: recommended (${STATE.model.capability})`;
    }
    if (STATE.model.mode === 'agent') {
      if (STATE.model.selectedModelId) return `Model override: ${STATE.model.selectedModelId}`;
      return 'Model: agent default';
    }
    if (STATE.model.mode === 'llm') return `LLM: ${STATE.model.llmModel || 'claude-sonnet-4-20250514'}`;
    return 'Model: default';
  })();

  const created = STATE.created;
  const createDisabled = STATE.busy;

  const resultCard = created
    ? `
      <div class="mt-6 rounded-ios-2xl border border-border bg-card p-6">
        <div class="text-lg font-semibold">Created</div>
        <div class="mt-2 text-sm text-muted-foreground">Your agent is private by default.</div>
        <div class="mt-4 rounded-ios-xl border border-border bg-background/40 p-4">
          <div class="text-xs text-muted-foreground">App ID</div>
          <div class="mt-1 font-mono text-sm break-all">${escapeHtml(created.appId)}</div>
          <div class="mt-3 text-xs text-muted-foreground">Store ID</div>
          <div class="mt-1 font-mono text-sm break-all">${escapeHtml(created.storeId)}</div>
          <div class="mt-4 flex flex-wrap gap-2">
            <a href="/aitopia/marketplace/app.html?appId=${encodeURIComponent(created.appId)}" class="h-10 px-4 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors">
              Open Runner
            </a>
            <a href="/aitopia/marketplace/app-studio.html" class="h-10 px-4 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">
              Open App Studio
            </a>
          </div>
        </div>
      </div>
    `
    : '';

  return `
    <div class="rounded-ios-2xl border border-border bg-card p-6">
      <div class="text-sm font-semibold">Summary</div>
      <div class="mt-4 grid gap-3 text-sm">
        <div class="flex items-center justify-between gap-3"><span class="text-muted-foreground">Type</span><span class="font-semibold">${escapeHtml(type || '—')}</span></div>
        <div class="flex items-center justify-between gap-3"><span class="text-muted-foreground">Template</span><span class="font-semibold">${escapeHtml(tpl?.name || '—')}</span></div>
        <div class="flex items-center justify-between gap-3"><span class="text-muted-foreground">Inputs</span><span class="font-semibold">${inputs.enabledCount}/${inputs.totalCount}</span></div>
        <div class="flex items-center justify-between gap-3"><span class="text-muted-foreground">Visibility</span><span class="font-semibold">${escapeHtml(STATE.details.visibility)}</span></div>
        <div class="pt-2 border-t border-border text-xs text-muted-foreground">${escapeHtml(modelLine)}</div>
      </div>

      <div class="mt-6 flex flex-wrap gap-3">
        <button type="button" data-action="create" ${createDisabled ? 'disabled' : ''} class="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
          ${STATE.busy ? 'Creating…' : 'Create'}
        </button>
        <a href="/aitopia/marketplace/app-studio.html" class="h-11 px-5 inline-flex items-center justify-center rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors">
          Advanced: App Studio
        </a>
      </div>
    </div>
    ${resultCard}
  `;
}

function renderBody() {
  const stepId = getStep().id;
  const content = (() => {
    if (stepId === 'type') return renderTypeStep();
    if (stepId === 'style') return renderStyleStep();
    if (stepId === 'inputs') return renderInputsStep();
    if (stepId === 'models') return renderModelsStep();
    if (stepId === 'details') return renderDetailsStep();
    if (stepId === 'review') return renderReviewStep();
    return '';
  })();

  const error = STATE.error
    ? `<div class="mb-4 rounded-ios-xl border border-red-500/30 bg-red-500/10 text-red-500 px-4 py-3 text-sm">${escapeHtml(STATE.error)}</div>`
    : '';

  return `
    ${renderToasts()}
    ${renderTemplatePreviewModal()}
    <div class="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside class="hidden lg:block">
        <div class="sticky top-24 space-y-4">
          ${renderStepRail()}
        </div>
      </aside>

      <div>
        <div class="lg:hidden">${renderStepper()}</div>
        ${renderDesktopStepHeader()}
        ${renderRemixBanner()}
        <div class="mt-6">
          ${error}
          ${content}
        </div>
        <div class="mt-6 flex items-center justify-between gap-3">
          <button type="button" data-action="back" ${STATE.stepIndex === 0 || STATE.busy ? 'disabled' : ''} class="h-11 px-5 rounded-full bg-secondary hover:bg-secondary/80 text-sm font-semibold transition-colors disabled:opacity-60">
            Back
          </button>
          <button type="button" data-action="next" ${!canGoNext() || STATE.busy ? 'disabled' : ''} class="h-11 px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
            Next
          </button>
        </div>
      </div>
    </div>
  `.trim();
}

function render() {
  if (!root) return;

  if (STATE.busy && STATE.templates.length === 0) {
    root.innerHTML = `
      <div class="rounded-ios-2xl border border-border bg-card p-6">
        <div class="text-sm text-muted-foreground">Loading…</div>
      </div>
    `;
    return;
  }

  root.innerHTML = renderBody();
}

async function ensureCapabilityModelsLoaded() {
  if (STATE.model.mode !== 'capability') return;
  if (Array.isArray(STATE.model.models)) return;

  try {
    setBusy(true);
    const tier = STATE.template?.definition?.defaults?.tier || 'starter';
    const models = await loadModelsForCapability(STATE.model.capability, tier);
    STATE.model.models = models;
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setBusy(false);
  }
}

async function createApp() {
  if (!STATE.template) return;
  const templateId = STATE.template.id;
  const name = String(STATE.details.name || '').trim();
  const description = String(STATE.details.description || '').trim();
  const visibility = STATE.details.visibility || 'private';

  if (!name) {
    setError('Name is required.');
    return;
  }

  setError(null);
  setBusy(true);

  try {
    const isFromAgent = String(templateId).startsWith('from-agent:');
    if (isFromAgent) {
      const overridden = buildOverriddenDefinition();
      if (!overridden) throw new Error('Missing app definition.');

      const fromAgentId = typeof STATE.remix?.agentId === 'string' ? STATE.remix.agentId : null;
      const reason = fromAgentId ? `ui:create-wizard:from-agent:${fromAgentId}` : 'ui:create-wizard:from-agent';

      const res = await fetchHelper('https://aitopia.ai/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          ...(description ? { description } : {}),
          visibility,
          definition: overridden,
          reason,
        }),
      });

      const json = await readJson(res);
      if (!res.ok) {
        const msg = json?.error?.message || json?.error || `Create failed (${res.status})`;
        throw new Error(String(msg));
      }

      const appId = json?.app?.id;
      if (!appId) throw new Error('Create succeeded but appId is missing.');

      STATE.created = { appId: String(appId), storeId: `app:${String(appId)}` };
      render();
      return;
    }

    const res = await fetchHelper(`https://aitopia.ai/api/apps/templates/${encodeURIComponent(templateId)}/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        ...(description ? { description } : {}),
        visibility,
        reason: 'ui:create-wizard',
      }),
    });
    const json = await readJson(res);
    if (!res.ok) {
      const msg = json?.error?.message || json?.error || `Create failed (${res.status})`;
      throw new Error(String(msg));
    }

    const appId = json?.app?.id;
    if (!appId) throw new Error('Create succeeded but appId is missing.');

    const overridden = buildOverriddenDefinition();
    if (overridden) {
      const updateRes = await fetchHelper(`https://aitopia.ai/api/apps/${encodeURIComponent(appId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          visibility,
          definition: overridden,
          reason: 'ui:wizard:overrides',
        }),
      });
      const updateJson = await readJson(updateRes);
      if (!updateRes.ok) {
        const msg = updateJson?.error?.message || updateJson?.error || `Update failed (${updateRes.status})`;
        throw new Error(String(msg));
      }
    }

    STATE.created = { appId: String(appId), storeId: `app:${String(appId)}` };
    render();
  } finally {
    setBusy(false);
  }
}

function bindEvents() {
  if (!root) return;

  root.addEventListener('click', async (e) => {
    const btn = e.target?.closest?.('[data-action]');
    const action = btn?.getAttribute?.('data-action');
    if (!action) return;

    if (action === 'preview-modal') return;
    if (action === 'close-preview') {
      closeTemplatePreview();
      render();
      return;
    }

    if (action === 'back') return prevStep();
    if (action === 'next') {
      return nextStep();
    }

    if (action === 'goto-step') {
      const idx = Number(btn.getAttribute('data-step-index'));
      if (!Number.isFinite(idx)) return;
      goToStepIndex(idx);
      return;
    }

    if (action === 'clear-template-query') {
      STATE.ui.templateQuery = '';
      render();
      return;
    }

    if (action === 'preview-template') {
      if (STATE.busy) return;
      const templateId = btn.getAttribute('data-template-id');
      if (!templateId) return;

      STATE.ui.preview.open = true;
      STATE.ui.preview.busy = true;
      STATE.ui.preview.error = null;
      STATE.ui.preview.template = getTemplateSummary(templateId) || { id: templateId };
      render();

      try {
        const full = STATE.template?.id === templateId ? STATE.template : await loadTemplateDefinition(templateId);
        STATE.ui.preview.template = full;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        STATE.ui.preview.error = message;
        pushToast({ tone: 'error', title: 'Preview failed', description: message });
      } finally {
        STATE.ui.preview.busy = false;
        render();
      }
      return;
    }

    if (action === 'select-type') {
      if (STATE.busy) return;
      const type = btn.getAttribute('data-type');
      if (!type) return;
      STATE.selectedType = type;
      resetDownstream('type');
      STATE.stepIndex = 1;
      render();
      return;
    }

    if (action === 'select-template') {
      if (STATE.busy) return;
      const templateId = btn.getAttribute('data-template-id');
      if (!templateId) return;

      try {
        closeTemplatePreview();
        setError(null);
        setBusy(true);
        const full = await loadTemplateDefinition(templateId);
        initStateFromTemplate(full);
        STATE.stepIndex = 2;
        render();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (action === 'inputs-preset') {
      const preset = btn.getAttribute('data-preset');
      if (preset === 'custom') return;
      const normalized = preset === 'minimal' || preset === 'recommended' || preset === 'all' ? preset : 'recommended';
      applyInputsPreset(normalized);
      STATE.ui.showAdvancedInputs = normalized === 'all';
      render();
      return;
    }

    if (action === 'toggle-input') {
      const inputId = btn.getAttribute('data-input-id');
      if (!inputId) return;
      const checked = btn.checked === true;
      setInputEnabled(inputId, checked);
      render();
      return;
    }

    if (action === 'toggle-advanced-inputs') {
      STATE.ui.showAdvancedInputs = !STATE.ui.showAdvancedInputs;
      render();
      return;
    }

    if (action === 'toggle-prompt-tuning') {
      STATE.ui.showPromptTuning = !STATE.ui.showPromptTuning;
      render();
      return;
    }

    if (action === 'create') {
      if (STATE.busy) return;
      void createApp();
      return;
    }

    if (action === 'load-remix-agent') {
      if (STATE.busy || STATE.ui.remixAgentBusy) return;
      void loadRemixAgentFromUi();
      return;
    }
  });

  root.addEventListener('input', (e) => {
    const el = e.target;
    const action = el?.getAttribute?.('data-action');
    if (!action) return;

    if (action === 'filter-templates') {
      STATE.ui.templateQuery = String(el.value || '');
      render();
      return;
    }

    if (action === 'edit-input-ui') {
      const inputId = el.getAttribute('data-input-id');
      const field = el.getAttribute('data-field');
      if (!inputId || !field) return;
      updateInputUi(inputId, field, String(el.value || ''));
      return;
    }

    if (action === 'edit-details') {
      const field = el.getAttribute('data-field');
      if (!field) return;
      if (field === 'name') STATE.details.name = String(el.value || '');
      if (field === 'description') STATE.details.description = String(el.value || '');
      if (field === 'systemPrompt') STATE.details.systemPrompt = String(el.value || '');
      if (field === 'userMessageTemplate') STATE.details.userMessageTemplate = String(el.value || '');
      return;
    }

    if (action === 'edit-remix-agent') {
      STATE.ui.remixAgentQuery = String(el.value || '');
      return;
    }
  });

  root.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target?.closest?.('[data-action="select-template"]');
    if (!el) return;
    if (String(el.tagName).toLowerCase() === 'button') return;
    e.preventDefault();
    el.click();
  });

  root.addEventListener('change', async (e) => {
    const el = e.target;
    const action = el?.getAttribute?.('data-action');
    if (!action) return;

    if (action === 'select-capability-model') {
      const value = String(el.value || '').trim();
      if (!value) {
        STATE.model.selectedModelId = null;
        STATE.model.selectedProvider = null;
        render();
        return;
      }

      const models = Array.isArray(STATE.model.models) ? STATE.model.models : [];
      const found = models.find((m) => String(typeof m === 'string' ? m : m?.id) === value);
      STATE.model.selectedModelId = value;
      STATE.model.selectedProvider = typeof found === 'object' && found && found.provider ? String(found.provider) : null;
      render();
      return;
    }

    if (action === 'select-llm-model') {
      STATE.model.llmModel = String(el.value || 'claude-sonnet-4-20250514');
      render();
      return;
    }

    if (action === 'edit-details') {
      const field = el.getAttribute('data-field');
      if (field === 'visibility') {
        STATE.details.visibility = String(el.value || 'private');
        render();
      }
    }
  });
}

async function init() {
  if (!root) return;
  bindEvents();

  const params = new URLSearchParams(window.location.search);
  const fromAgentId = (params.get('fromAgent') || '').trim();

  try {
    setBusy(true);
    STATE.templates = await loadTemplates();

    if (fromAgentId) {
      const [agentMeta, schemaResponse] = await Promise.all([
        loadStoreAgentMetadata(fromAgentId),
        loadStoreAgentSchema(fromAgentId),
      ]);

      const built = buildDynamicTemplateFromAgent({ agentId: fromAgentId, agentMeta, schemaResponse });

      initStateFromTemplate(built.template);
      STATE.selectedType = built.template.type;
      STATE.stepIndex = 2;
      STATE.remix = { agentId: fromAgentId, agentName: built.agentName };
      render();
      return;
    }

    STATE.stepIndex = 0;
    render();
  } catch (err) {
    setError(err instanceof Error ? err.message : String(err));
  } finally {
    setBusy(false);
  }
}

void init();
