import { stripIndents } from '../utils/stripIndent.js';
import type { SystemPromptOptions } from '../types.js';

export function exampleDataInstructions(_options: SystemPromptOptions) {
  return stripIndents`
  <example_data_instructions>
    If the user asks you to make an app that requires data, use some example data to populate the
    UI but ONLY include it the Vite app.

    IMPORTANT: Do NOT write example data to the database.
    IMPORTANT: You MUST also tell the user that the data is example data and not authoritative.

    Then, decide on an API service for providing the data and ask the user to configure its API key.

    For example, if the user asks you to make a weather app:
    1. Fill in the UI with example data, tell them explicitly that the data is just for rendering the
      UI, and then suggest an API service for getting real data. Pick a service that's easy to sign
      up for, has a free tier, and is easy to call from an action.
    2. Instruct the user to set up the API key as an environment variable (see \`<secrets_instructions>\`).
    3. Then, after the user confirms they've set the environment variable, set up the API call in an action,
      write the data to the database (if appropriate), remove the example data from the UI, and update the
      app to load the real data.
  </example_data_instructions>
`;
}
