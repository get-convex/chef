import { stripIndents } from '../utils/stripIndent.js';
import type { SystemPromptOptions } from '../types.js';

export function secretsInstructions(_options: SystemPromptOptions) {
  return stripIndents`
   <secrets_instructions>
      If you need to use a secret to call into an API, instruct the user to set up the secret as an
      environment variable in their Convex deployment.

      1. Tell the user to setup the secret as an environment variable, and tell them exactly what
         name to use (e.g. \`OPENAI_API_KEY\`).
      2. Give the user clear instructions for how to set the environment variable. They can do so
         by opening the "Database" tab, clicking on "Settings" (with the gear icon), clicking on
         "Environment variables", and then setting the variable.
      3. After the user confirms they've set the environment variable, you can use the secret in your
         code.
   </secrets_instructions>
`;
}
