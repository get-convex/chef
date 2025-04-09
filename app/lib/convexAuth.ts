import { generateKeyPair, exportPKCS8, exportJWK } from 'jose';
import type { ConvexProject } from './stores/convexProject';

export async function initializeConvexAuth(project: ConvexProject) {
  const SITE_URL = await queryEnvVariable(project, 'SITE_URL');
  const JWKS = await queryEnvVariable(project, 'JWKS');
  const JWT_PRIVATE_KEY = await queryEnvVariable(project, 'JWT_PRIVATE_KEY');

  const newEnv: Record<string, string> = {};

  if (SITE_URL && SITE_URL !== 'http://localhost:5173') {
    console.warn('SITE_URL is not http://localhost:5173');
  }
  if (!SITE_URL) {
    newEnv.SITE_URL = 'http://localhost:5173';
  }

  if (!JWKS || !JWT_PRIVATE_KEY) {
    const keys = await generateKeys();
    newEnv.JWKS = JSON.stringify(keys.JWKS);
    newEnv.JWT_PRIVATE_KEY = keys.JWT_PRIVATE_KEY;
  }
  if (!SITE_URL) {
    newEnv.SITE_URL = 'http://localhost:5173';
  }
  if (Object.entries(newEnv).length > 0) {
    await setEnvVariables(project, newEnv);
  }
  console.log('✅ Convex Auth setup!');
}

async function generateKeys() {
  const keys = await generateKeyPair('RS256', { extractable: true });
  const privateKey = await exportPKCS8(keys.privateKey);
  const publicKey = await exportJWK(keys.publicKey);
  const jwks = { keys: [{ use: 'sig', ...publicKey }] };
  return {
    JWT_PRIVATE_KEY: `${privateKey.trimEnd().replace(/\n/g, ' ')}`,
    JWKS: jwks,
  };
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
