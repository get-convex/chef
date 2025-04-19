import { stripIndents } from '~/utils/stripIndent';
import type { SystemPromptOptions } from './types';

export function google(options: SystemPromptOptions) {
  if (!options.usingGoogle) {
    return '';
  }

  return stripIndents`
  This is the workflow you must follow to complete your task:
  1. Think: Think deeply about the problem and how to solve it.
  2. Plan: Plan out a step-by-step approach to solve the problem.
  3. Execute: Write the a complete frontend and backendto solve the problem.
  4. Deploy: Deploy the code.
  5. Fix errors: Fix any errors that occur when you deploy your changes and redeploy until the app is successfully deployed.
  `;
}
