import type { Tool } from 'ai';
import { z } from 'zod';

export const addEnvironmentVariablesParameters = z.object({
  envVarNames: z.array(z.string()).describe('List of environment variable names to add to the project.'),
});

export function addEnvironmentVariablesTool(): Tool {
  return {
    description: `Add environment variables to the Convex deployment. The user still needs to manually add the values in the Convex dashboard page this tool opens.`,
    inputSchema: addEnvironmentVariablesParameters,
  };
}
