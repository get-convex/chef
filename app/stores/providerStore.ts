import { atom } from 'nanostores';

export const $selectedProvider = atom<'openai' | 'anthropic' | 'openrouter'>('openai');

export const setProvider = (provider: 'openai' | 'anthropic' | 'openrouter') => {
  $selectedProvider.set(provider);
};