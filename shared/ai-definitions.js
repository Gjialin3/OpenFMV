const DEFAULT_CLI_MODEL = 'default';
const DEFAULT_REASONING_EFFORT = 'default';
const legacyDefaultModelIds = new Set(['codex-default', 'opencode-default']);

const agentDefinitions = [
  { id: 'codex', name: 'Codex CLI', bin: 'codex', models: [DEFAULT_CLI_MODEL, 'gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.3-codex', 'gpt-5.1', 'gpt-5.1-codex-mini', 'gpt-5-codex', 'gpt-5', 'o3', 'o4-mini'], reasoningOptions: [DEFAULT_REASONING_EFFORT, 'none', 'minimal', 'low', 'medium', 'high', 'xhigh'] },
  { id: 'claude', name: 'Claude Code', bin: 'claude', models: [DEFAULT_CLI_MODEL, 'sonnet', 'opus', 'haiku', 'claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'] },
  { id: 'gemini', name: 'Gemini CLI', bin: 'gemini', models: [DEFAULT_CLI_MODEL, 'gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'] },
  { id: 'kimi', name: 'Kimi CLI', bin: 'kimi', models: [DEFAULT_CLI_MODEL, 'kimi-k2-turbo-preview', 'kimi-k2', 'moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'] },
  { id: 'qwen', name: 'Qwen CLI', bin: 'qwen', models: [DEFAULT_CLI_MODEL, 'qwen3-coder-plus', 'qwen3-coder-flash', 'qwen3-max'] },
  { id: 'opencode', name: 'OpenCode', bin: 'opencode', models: [DEFAULT_CLI_MODEL, 'anthropic/claude-sonnet-4-5', 'openai/gpt-5', 'google/gemini-2.5-pro'] },
];

const byokProviderDefinitions = [
  { id: 'anthropic', name: 'Anthropic', defaultBaseUrl: 'https://api.anthropic.com', defaultModel: 'claude-sonnet-4.5', needsKey: true },
  { id: 'openai-compatible', name: 'OpenAI Compatible', defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-5', needsKey: true },
  { id: 'google-gemini', name: 'Google Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'gemini-2.5-pro', needsKey: true },
  { id: 'ollama', name: 'Ollama / Local', defaultBaseUrl: 'http://127.0.0.1:11434/v1', defaultModel: 'llama3.1', needsKey: false },
];

const mediaProviderDefinitions = [
  { id: 'openai-image', name: 'OpenAI Image', types: ['image'], defaultBaseUrl: 'https://api.openai.com/v1', defaultModel: 'gpt-image-1' },
  { id: 'doubao-image', name: 'Volcengine / Doubao Image', types: ['image'], defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-seedream-4-0' },
  { id: 'doubao-video', name: 'Volcengine / Doubao Video', types: ['video'], defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', defaultModel: 'doubao-seedance-1-0-pro' },
  { id: 'google-imagen', name: 'Google Imagen', types: ['image'], defaultBaseUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'imagen-4.0-generate-preview-06-06' },
  { id: 'google-veo', name: 'Google Veo', types: ['video'], defaultBaseUrl: 'https://generativelanguage.googleapis.com', defaultModel: 'veo-3.1-generate-preview' },
  { id: 'kling-video', name: 'Kling Video', types: ['video'], defaultBaseUrl: 'https://api.klingai.com', defaultModel: 'kling-v1-6' },
  { id: 'minimax-video', name: 'MiniMax Video', types: ['video'], defaultBaseUrl: 'https://api.minimax.io/v1', defaultModel: 'video-01' },
  { id: 'minimax-tts', name: 'MiniMax TTS', types: ['audio'], defaultBaseUrl: 'https://api.minimax.io/v1', defaultModel: 'speech-02-hd' },
  { id: 'elevenlabs-audio', name: 'ElevenLabs Audio', types: ['audio'], defaultBaseUrl: 'https://api.elevenlabs.io/v1', defaultModel: 'eleven_multilingual_v2' },
  { id: 'senseaudio', name: 'SenseAudio', types: ['audio'], defaultBaseUrl: '', defaultModel: 'senseaudio-small' },
];

const agentIds = new Set(agentDefinitions.map((item) => item.id));
const byokIds = new Set(byokProviderDefinitions.map((item) => item.id));
const mediaIds = new Set(mediaProviderDefinitions.map((item) => item.id));

const isRecord = (value) => typeof value === 'object' && value !== null;
const textValue = (value) => typeof value === 'string' ? value : '';

const sanitizeCustomModel = (value) => {
  const trimmed = textValue(value).trim();
  if (!trimmed || trimmed.length > 200) return '';
  if (!/^[A-Za-z0-9][A-Za-z0-9._/:@-]*$/.test(trimmed)) return '';
  return trimmed;
};

const normalizeCliModel = (definition, incomingModel, fallbackModel) => {
  const model = textValue(incomingModel);
  if (legacyDefaultModelIds.has(model)) return DEFAULT_CLI_MODEL;
  if (definition?.models.includes(model)) return model;
  return sanitizeCustomModel(model) || fallbackModel;
};

const normalizeReasoningEffort = (definition, incomingReasoning, fallbackReasoning, incomingModel) => {
  if (!definition?.reasoningOptions) return undefined;
  const reasoning = textValue(incomingReasoning);
  if (legacyDefaultModelIds.has(textValue(incomingModel)) && reasoning === 'medium') return DEFAULT_REASONING_EFFORT;
  return definition.reasoningOptions.includes(reasoning) ? reasoning : fallbackReasoning;
};

const getDefaultAiConfig = () => ({
  executionMode: 'cli',
  selectedCliAgentId: 'codex',
  cliSelections: agentDefinitions.map((agent) => ({
    agentId: agent.id,
    model: agent.models[0],
    ...(agent.reasoningOptions ? { reasoningEffort: DEFAULT_REASONING_EFFORT } : {}),
  })),
  selectedByokProviderId: 'anthropic',
  byokProviders: byokProviderDefinitions.map((provider) => ({
    providerId: provider.id,
    apiKey: '',
    baseUrl: provider.defaultBaseUrl,
    model: provider.defaultModel,
  })),
  mediaProviders: mediaProviderDefinitions.map((provider) => ({
    providerId: provider.id,
    apiKey: '',
    baseUrl: provider.defaultBaseUrl,
    model: provider.defaultModel,
  })),
});

const normalizeAiConfig = (value) => {
  const defaults = getDefaultAiConfig();
  if (!isRecord(value)) return defaults;
  const rawCliSelections = Array.isArray(value.cliSelections) ? value.cliSelections.filter(isRecord) : [];
  const rawByokProviders = Array.isArray(value.byokProviders) ? value.byokProviders.filter(isRecord) : [];
  const rawMediaProviders = Array.isArray(value.mediaProviders) ? value.mediaProviders.filter(isRecord) : [];

  return {
    executionMode: 'cli',
    selectedCliAgentId: agentIds.has(value.selectedCliAgentId) ? value.selectedCliAgentId : defaults.selectedCliAgentId,
    selectedByokProviderId: byokIds.has(value.selectedByokProviderId) ? value.selectedByokProviderId : defaults.selectedByokProviderId,
    cliSelections: defaults.cliSelections.map((fallback) => {
      const incoming = rawCliSelections.find((item) => item.agentId === fallback.agentId);
      const definition = agentDefinitions.find((item) => item.id === fallback.agentId);
      const reasoningEffort = normalizeReasoningEffort(definition, incoming?.reasoningEffort, fallback.reasoningEffort, incoming?.model);
      return {
        agentId: fallback.agentId,
        model: normalizeCliModel(definition, incoming?.model, fallback.model),
        ...(definition?.reasoningOptions ? { reasoningEffort } : {}),
      };
    }),
    byokProviders: defaults.byokProviders.map((fallback) => {
      const incoming = rawByokProviders.find((item) => item.providerId === fallback.providerId);
      return {
        providerId: fallback.providerId,
        apiKey: textValue(incoming?.apiKey),
        baseUrl: textValue(incoming?.baseUrl) || fallback.baseUrl,
        model: textValue(incoming?.model) || fallback.model,
      };
    }),
    mediaProviders: defaults.mediaProviders.map((fallback) => {
      const incoming = rawMediaProviders.find((item) => item.providerId === fallback.providerId);
      return {
        providerId: fallback.providerId,
        apiKey: textValue(incoming?.apiKey),
        baseUrl: textValue(incoming?.baseUrl) || fallback.baseUrl,
        model: textValue(incoming?.model) || fallback.model,
      };
    }),
  };
};

module.exports = {
  DEFAULT_CLI_MODEL,
  DEFAULT_REASONING_EFFORT,
  agentDefinitions,
  byokProviderDefinitions,
  mediaProviderDefinitions,
  getDefaultAiConfig,
  normalizeAiConfig,
  sanitizeCustomModel,
};
