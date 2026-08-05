/**
 * Model Selector Safe Agents
 *
 * Allowlist of agents that safely display the model selector UI.
 * These agents have been tested and work correctly with dynamic model selection.
 */

const MODEL_SELECTOR_SAFE_AGENTS = new Set([
  'background-remover',
  'image-upscaler',
  'image-generator',
  'video-generator',
  'face-swap',
  'video-face-swap',
  'video-face-swap-v2',
  'image-animator',
  'portrait-enhancer',
  'object-remover',
  'virtual-try-on',
  'style-transfer',
  'ai-background-generator',
  'ai-model-swap',
  'voice-cloner',
  'music-generator',
  'video-upscaler',
]);

/**
 * Check if an agent safely supports model selector UI
 * @param {string} agentId - The agent ID to check
 * @returns {boolean} - Whether the agent supports model selector
 */
export function isModelSelectorSafeAgent(agentId) {
  if (!agentId || typeof agentId !== 'string') return false;
  return MODEL_SELECTOR_SAFE_AGENTS.has(agentId);
}
