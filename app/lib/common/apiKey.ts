import type { Doc } from '@convex/_generated/dataModel';
import { type ModelSelection } from '~/utils/constants';

export function hasApiKeySet(
  modelSelection: ModelSelection,
  useGeminiAuto: boolean,
  apiKey?: Doc<'convexMembers'>['apiKey'] | null,
) {
  if (!apiKey) {
    return false;
  }

  switch (modelSelection) {
    case 'auto':
      if (useGeminiAuto) {
        return !!apiKey.google?.trim();
      }
      return !!apiKey.value?.trim();
    case 'claude-3-5-haiku':
    case 'claude-4-sonnet':
    case 'claude-4.5-sonnet':
      return !!apiKey.value?.trim();
    case 'gpt-4.1':
    case 'gpt-4.1-mini':
    case 'gpt-5':
      return !!apiKey.openai?.trim();
    case 'grok-3-mini':
      return !!apiKey.xai?.trim();
    case 'grok-free':
      return !!apiKey.openrouter?.trim();
    case 'gemini-2.5-pro':
      return !!apiKey.google?.trim();
    case 'qwen-coder':
    case 'qwen-2.5-coder-32b':
    case 'gemini-2.0-flash-exp':
    case 'deepseek-coder':
    case 'llama-3.3-70b':
    case 'codestral-latest':
    case 'nemotron-nano-9b-v2':
    case 'kimi-k2':
    case 'devstral-small-2505':
    case 'mai-ds-r1':
      return !!apiKey.openrouter?.trim();
    default: {
      const _exhaustiveCheck: never = modelSelection;
      return false;
    }
  }
}

export function hasAnyApiKeySet(apiKey?: Doc<'convexMembers'>['apiKey'] | null) {
  if (!apiKey) {
    return false;
  }
  return Object.entries(apiKey).some(([key, value]) => {
    if (key === 'preference') {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim() !== '';
    }
    return false;
  });
}
