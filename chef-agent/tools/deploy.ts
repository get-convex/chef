import type { Tool } from 'ai';
import { z } from 'zod';

export const deployToolDescription = `
Deploy the app to Convex and start the Vite development server (if not already running).

Execute this tool call after you've used an artifact to write files to the filesystem
and the app is complete. Do NOT execute this tool if the app isn't in a working state.

After initially writing the app, you MUST execute this tool after making any changes
to the filesystem.

If this tool call fails with esbuild bundler errors, a library that requires Node.js
APIs may be being used. Isolating those dependencies into a convex file of only actions
with "use node" at the top is the only way to fix this. The files with "use node" at the
top can only contain actions. They can NEVER contains queries or mutations.
`;

export const deployTool: Tool = {
  description: deployToolDescription,
  inputSchema: z.object({}),
};

export const deployToolParameters = z.object({});
