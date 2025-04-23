import type { Tool } from 'ai';
import { z } from 'zod';

export const npmInstallToolDescription = `
Install additional dependencies for the project with NPM.

Choose high quality, flexible libraries that are well-maintained and have
significant adoption. Always use libraries that have TypeScript definitions.
`;

const packagesDescription = `
Space separated list of NPM packages to install. This will be passed directly to \`npm install\`.

Examples:
- 'date-fns'
- 'chart.js react-chartjs-2'
- 'motion'
`;

export const npmInstallToolParameters = z.object({
  packages: z.string().describe(packagesDescription),
});

export const npmInstallTool: Tool = {
  description: npmInstallToolDescription,
  parameters: npmInstallToolParameters,
};
