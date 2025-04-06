import type { Tool } from 'ai';
import { z } from 'zod';

const deployToolDescription = `
Deploy the app to Convex and start the Vite development server (if not already running).

Execute this tool call after you've used an artifact to write files to the filesystem
and the app is complete. Do NOT execute this tool if the app isn't in a working state.

After initially writing the app, you MUST execute this tool after making any changes
to the filesystem.
`;

export const deployTool: Tool = {
  description: deployToolDescription,
  parameters: z.object({}),
};
