#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';

console.log('Building chef system prompts release...');

// Extract ROLE_SYSTEM_PROMPT
const systemFile: string = readFileSync('chef-agent/prompts/system.ts', 'utf8');
const rolePromptMatch: RegExpMatchArray | null = systemFile.match(
  /export const ROLE_SYSTEM_PROMPT = stripIndents`([\s\S]*?)`;/,
);

let output: string = `# Chef System Prompts\n`;
output += `Generated on: ${new Date().toISOString()}\n`;
output += `========================================\n\n`;
output += `This file contains the actual system prompts sent to the Chef AI model.\n\n`;

if (rolePromptMatch && rolePromptMatch[1]) {
  output += `## System Message 1: ROLE_SYSTEM_PROMPT\n\n`;
  output += rolePromptMatch[1].trim() + '\n\n';
  output += `---\n\n`;
}

// Extract key prompt files content
const promptFiles: readonly string[] = [
  'solutionConstraints.ts',
  'formattingInstructions.ts',
  'exampleDataInstructions.ts',
  'secretsInstructions.ts',
  'outputInstructions.ts',
  'openaiProxyGuidelines.ts',
  'resendProxyGuidelines.ts',
] as const;

output += `## System Message 2: Component Prompts\n\n`;

for (const file of promptFiles) {
  try {
    const content: string = readFileSync(`chef-agent/prompts/${file}`, 'utf8');

    // Look for function that returns stripIndents template literal
    const functionMatch: RegExpMatchArray | null = content.match(
      /export function \w+.*?\{[\s\S]*?return stripIndents`([\s\S]*?)`;[\s\S]*?\}/,
    );

    if (functionMatch && functionMatch[1]) {
      output += `### ${file}\n\n`;
      // Clean up the template literal content
      const cleanContent: string = functionMatch[1]
        .replace(/\$\{[^}]*\}/g, '[INTERPOLATED]') // Replace interpolations
        .trim();
      output += cleanContent + '\n\n';
      output += `---\n\n`;
    } else {
      // Fallback: look for any stripIndents usage
      const stripIndentsMatches: RegExpMatchArray | null = content.match(/stripIndents`([\s\S]*?)`;?/g);
      if (stripIndentsMatches && stripIndentsMatches.length > 0) {
        output += `### ${file}\n\n`;
        stripIndentsMatches.forEach((match: string) => {
          const textMatch: RegExpMatchArray | null = match.match(/stripIndents`([\s\S]*?)`;?$/);
          if (textMatch && textMatch[1]) {
            const cleanContent: string = textMatch[1].replace(/\$\{[^}]*\}/g, '[INTERPOLATED]').trim();
            output += cleanContent + '\n\n';
          }
        });
        output += `---\n\n`;
      }
    }
  } catch (error: unknown) {
    const errorMessage: string = error instanceof Error ? error.message : String(error);
    console.log(`Could not process ${file}: ${errorMessage}`);
  }
}

writeFileSync('chef-system-prompts.txt', output);
console.log('✅ Built chef-system-prompts.txt');
