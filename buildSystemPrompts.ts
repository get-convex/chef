#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { ROLE_SYSTEM_PROMPT, generalSystemPrompt } from './chef-agent/prompts/system.js';
import type { SystemPromptOptions } from './chef-agent/types.js';

console.log('Building chef system prompts release...');

const defaultOptions: SystemPromptOptions = {
  enableBulkEdits: true,
  includeTemplate: true,
  openaiProxyEnabled: true,
  usingOpenAi: true,
  usingGoogle: true,
  resendProxyEnabled: true,
  enableResend: true,
};

let output: string = `# Chef System Prompts\n`;
output += `Generated on: ${new Date().toISOString()}\n`;
output += `========================================\n\n`;
output += `This file contains the system prompts sent to Chef.\n\n`;

output += `## System Message 1: ROLE_SYSTEM_PROMPT\n\n`;
output += ROLE_SYSTEM_PROMPT + '\n\n';
output += `---\n\n`;

output += `## System Message 2: General System Prompt\n\n`;
try {
  const generalPromptContent = generalSystemPrompt(defaultOptions);
  output += generalPromptContent + '\n\n';
  output += `---\n\n`;
} catch (error: unknown) {
  const errorMessage: string = error instanceof Error ? error.message : String(error);
  console.log(`Could not generate general system prompt: ${errorMessage}`);
}

writeFileSync('chef-system-prompts.txt', output);
console.log('✅ Built chef-system-prompts.txt');
