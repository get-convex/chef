#!/usr/bin/env node

import { writeFileSync } from 'fs';
import { ROLE_SYSTEM_PROMPT, generalSystemPrompt } from './chef-agent/prompts/system.js';
import type { SystemPromptOptions } from './chef-agent/types.js';

console.log('Building chef system prompts release...');

// Create default options for system prompt generation
const defaultOptions: SystemPromptOptions = {
  enableBulkEdits: true,
  enablePreciseEdits: true,
  includeTemplate: true,
  openaiProxyEnabled: true,
  usingOpenAi: true,
  usingGoogle: true,
  resendProxyEnabled: true,
  smallFiles: true,
  enableResend: true,
};

let output: string = `# Chef System Prompts\n`;
output += `Generated on: ${new Date().toISOString()}\n`;
output += `========================================\n\n`;
output += `This file contains the actual system prompts sent to the Chef AI model.\n\n`;

// Add ROLE_SYSTEM_PROMPT
output += `## System Message 1: ROLE_SYSTEM_PROMPT\n\n`;
output += ROLE_SYSTEM_PROMPT + '\n\n';
output += `---\n\n`;

// Add generalSystemPrompt content
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
