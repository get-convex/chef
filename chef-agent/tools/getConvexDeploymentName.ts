import type { Tool } from 'ai';
import { z } from 'zod';

export const getConvexDeploymentNameDescription = `
Get the name of the Convex deployment this project is using. This tool returns the deployment name that is used
to identify in the dashboard and for deployment operations.

The deployment name is a unique identifier and can be used to access the Convex dashboard:
https://dashboard.convex.dev/d/{deploymentName}.
`;

export const getConvexDeploymentNameParameters = z.object({});

export const getConvexDeploymentNameTool: Tool = {
  description: getConvexDeploymentNameDescription,
  inputSchema: getConvexDeploymentNameParameters,
};
