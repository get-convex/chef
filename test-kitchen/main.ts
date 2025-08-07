import { anthropic } from '@ai-sdk/anthropic';
import { chefTask } from './chefTask.js';
import { ChefModel } from './types.js';
import { mkdirSync } from 'fs';
import { chefSetLogLevel } from 'chef-agent/utils/logger.js';

chefSetLogLevel('info');

const model: ChefModel = {
  name: 'claude-3.5-sonnet',
  model_slug: 'claude-3-5-sonnet-20240620',
  ai: anthropic('claude-3-5-sonnet-20241022'),
  maxOutputTokens: 8192,
};
mkdirSync('/tmp/backend', { recursive: true });
const result = await chefTask(model, '/tmp/backend', 'Make me a chat app');
console.log(result);
