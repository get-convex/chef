export const SUPPORTED_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    apiKeyEnvVar: 'OPENAI_API_KEY',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    apiKeyEnvVar: 'ANTHROPIC_API_KEY',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    apiKeyEnvVar: 'OPENROUTER_API_KEY',
    isAggregator: true,
  },
] as const;