import type { ConvexProject } from './types.js';

async function withRetries<T>(operation: () => Promise<T>, maxRetries: number = 3, retryDelay: number = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

export async function queryEnvVariableWithRetries(project: ConvexProject, name: string) {
  return withRetries(() => queryEnvVariable(project, name));
}

async function queryEnvVariable(project: ConvexProject, name: string): Promise<string | null> {
  const response = await fetch(`${project.deploymentUrl}/api/query`, {
    method: 'POST',
    body: JSON.stringify({
      path: '_system/cli/queryEnvironmentVariables:get',
      format: 'convex_encoded_json',
      args: [{ name }],
    }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Convex ${project.token}`,
    },
  });
  if (!response.ok) {
    throw new Error('Failed to query environment variables');
  }
  const respJSON: any = await response.json();
  if (respJSON.status !== 'success') {
    throw new Error(`Failed to query environment variables: ${JSON.stringify(respJSON)}`);
  }
  const udfResult = respJSON.value;
  return udfResult && udfResult.value;
}

export async function setEnvVariablesWithRetries(project: ConvexProject, values: Record<string, string>) {
  return withRetries(() => setEnvVariables(project, values));
}

async function setEnvVariables(project: ConvexProject, values: Record<string, string>) {
  const response = await fetch(`${project.deploymentUrl}/api/update_environment_variables`, {
    method: 'POST',
    body: JSON.stringify({
      changes: Object.entries(values).map(([name, value]) => ({
        name,
        value,
      })),
    }),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Convex ${project.token}`,
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to set environment variables: ${await response.text()}`);
  }
}
