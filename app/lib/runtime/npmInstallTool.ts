import type { Tool } from 'ai';
import { z } from 'zod';

const npmInstallToolDescription = `Install additional dependencies for the project with npm.`;
export const npmInstallToolParameters = z.object({
  packages: z.array(z.string()),
});

export const npmInstallTool: Tool = {
  description: npmInstallToolDescription,
  parameters: npmInstallToolParameters,
};
