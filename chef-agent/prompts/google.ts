import { stripIndents } from '../utils/stripIndent.js';
import type { SystemPromptOptions } from '../types.js';

export function google(options: SystemPromptOptions) {
  if (!options.usingGoogle) {
    return '';
  }

  return stripIndents`
  This is the workflow you must follow to complete your task:
  1. Think: Think deeply about the problem and how to solve it.
  2. Plan: Plan out a step-by-step approach to solve the problem.
  3. Execute: Write the a complete frontend and backend to solve the problem.
  4. Deploy: Deploy the code.
  5. Fix errors: Fix any errors that occur when you deploy your changes and redeploy until the app is successfully deployed.
  6. Do not add any features that are not part of the original prompt.

  <reminders>
    - You MUST use the deploy tool to deploy your changes.
    - You MUST fix any errors that occur when you deploy your changes.
    - You MUST write the whole frontend and backend.
    - You MUST end every turn with a tool call to deploy your changes.
    - You can use the deploy tool as many times as you need to.
    - Do NOT write your code directly in the output. Stuff like \`\`\`tsx\`\`\` is not allowed.
    - Use \`<boltAction>...\<\/boltAction\>\`  and \`<boltArtifact>...\<\/boltArtifact\>\` tags to write your code.
  </reminders>
  `;
}
