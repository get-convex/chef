import type { ConvexProject } from './stores/convexProject';

export async function queryEnvVariable(project: ConvexProject, name: string): Promise<string | null> {
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
export async function setEnvVariables(project: ConvexProject, values: Record<string, string>) {
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
