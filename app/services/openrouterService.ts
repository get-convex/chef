import { createOpenRouter } from '@ai-sdk/openrouter';
import { ApiKeyManager } from '../utils/apiKeyManager';

export class OpenRouterService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async createCompletion(messages: any[]) {
    const response = await fetch('https://openrouter.com/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'openrouter',
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error('OpenRouter API request failed');
    }

    return response.json();
  }
}