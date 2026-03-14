import { anthropic } from '@ai-sdk/anthropic';
import { chefTask } from './chefTask.js';
import { ChefModel } from './types.js';
import { mkdirSync } from 'fs';
import { chefSetLogLevel } from 'chef-agent/utils/logger.js';

chefSetLogLevel('info');

const model: ChefModel = {
  name: 'claude-4.6-sonnet',
  model_slug: 'claude-sonnet-4-6',
  ai: anthropic('claude-sonnet-4-6'),
  maxOutputTokens: 16384,
};
mkdirSync('/tmp/backend', { recursive: true });
const result = await chefTask(model, '/tmp/backend', 'Make me a chat app');
console.log(result);
