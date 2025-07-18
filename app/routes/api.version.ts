import { json } from '@vercel/remix';
import type { ActionFunctionArgs } from '@vercel/remix';

export async function action({ request }: ActionFunctionArgs) {
  const globalEnv = globalThis.process.env;
  const projectId = globalEnv.VERCEL_PROJECT_ID;
  const teamId = globalEnv.VERCEL_TEAM_ID;
  const productionBranchUrl = globalEnv.VERCEL_PRODUCTION_BRANCH_URL || 'chef.convex.dev';

  console.log('globalEnv', globalEnv);
  console.log('projectId', projectId);
  console.log('teamId', teamId);
  console.log('productionBranchUrl', productionBranchUrl);

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!globalEnv.VERCEL_TOKEN) {
    console.log('VERCEL_TOKEN not set');
    return json({ error: 'Failed to fetch version information' }, { status: 500 });
  }

  const requestOptions = {
    headers: {
      Authorization: `Bearer ${globalThis.process.env.VERCEL_TOKEN}`,
    },
    method: 'get',
  };

  if (globalThis.process.env.VERCEL_ENV !== 'preview') {
    // If we're not in a preview deployment, fetch the production deployment from Vercel's undocumented
    // production-deployment API.
    // This response includes a boolean indicating if the production deployment is stale (i.e. rolled back)
    // We accept the risk that this API might change because it is not documented, meaning the version
    // notification feature might silently fail.
    const prodResponse = await fetch(
      `https://vercel.com/api/v1/projects/${projectId}/production-deployment?teamId=${teamId}`,
      requestOptions,
    );
    console.log('prodResponse', prodResponse);
    if (!prodResponse.ok) {
      console.log('prodResponse not ok');
      return json({ error: 'Failed to fetch production version information' }, { status: 500 });
    }

    const prodData = await prodResponse.json();
    console.log('prodData', prodData);

    // Since we retrieved data from an undocumented API
    // let's defensively check that the data we need is present
    // and return an opaque error if it isn't.
    if (!prodData || typeof prodData.deploymentIsStale !== 'boolean') {
      console.log('prodData not ok');
      return json({ error: 'Failed to fetch production deployment' }, { status: 500 });
    }

    // If the production deployment is rolled back,
    // we should not show a version notification.
    if (prodData.deploymentIsStale) {
      console.log('prodData.deploymentIsStale', prodData.deploymentIsStale);
      return json({ sha: null }, { status: 200 });
    }
  }

  // Even though we retrieved the production data, we might be on a preview branch deployment.
  // So, fetch the data specific to the latest branch deployment.
  const branchUrl = globalThis.process.env.VERCEL_BRANCH_URL || productionBranchUrl;
  if (!branchUrl) {
    console.log('branchUrl not set');
    throw new Error('VERCEL_BRANCH_URL or VERCEL_PRODUCTION_BRANCH_URL not set');
  }
  const branchResponse = await fetch(
    `https://api.vercel.com/v13/deployments/${branchUrl}?teamId=${teamId}`,
    requestOptions,
  );
  if (!branchResponse.ok) {
    console.log('branchResponse not ok');
    throw new Error('Failed to fetch branch version information');
  }

  const branchData = await branchResponse.json();
  console.log('branchData', branchData);
  console.log('branchData.gitSource.sha', branchData.gitSource.sha);

  return json(
    {
      sha: branchData.gitSource.sha,
    },
    { status: 200 },
  );
}
