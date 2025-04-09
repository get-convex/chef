import { json } from '@vercel/remix';
import type { ActionFunctionArgs } from '@vercel/remix';
import Cloudflare from 'cloudflare';

export async function deploy({ request }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const deploymentName = formData.get('deploymentName') as string;
    let token = formData.get('token') as string;

    // If it's a project token, great
    if (!token.includes('project')) {
      // if not then use our hardcoded project token
      token = globalThis.process.env.BIG_BRAIN_API_KEY!;
    }
    console.log(deploymentName);

    if (!file) {
      return json({ error: 'No file provided' }, { status: 400 });
    }

    if (!token || !deploymentName) {
      return json({ error: 'Missing authentication or deployment info' }, { status: 400 });
    }

    const PROVISION_HOST = globalThis.process.env.PROVISION_HOST || 'https://api.convex.dev';
    //const PROVISION_HOST = "http://127.0.0.1:8000";
    const Authorization = `Bearer ${token}`;
    const response = await fetch(`${PROVISION_HOST}/api/hosting/deploy?deploymentName=${deploymentName}`, {
      method: 'POST',
      headers: {
        Authorization,
      },
      body: file,
    });
    console.log(response);

    if (!response.ok) {
      const error = await response.json();
      console.log(error);
      return json(error, { status: response.status });
    }

    const result = await response.json();

    // Try to purge Cloudflare cache
    const cfApiToken = globalThis.process.env.CLOUDFLARE_API_KEY;
    const zoneId = globalThis.process.env.CLOUDFLARE_ZONE_ID;

    if (cfApiToken && zoneId) {
      try {
        const client = new Cloudflare({ apiToken: cfApiToken });
        await client.cache.purge({
          zone_id: zoneId,
          hosts: [`${deploymentName}.convex.app`],
        });
        console.log(`Purged cache for ${deploymentName}.convex.app`);
      } catch (err) {
        // Log failure but continue with deployment response
        console.error('Failed to purge cache:', err instanceof Error ? err.message : 'Unknown error');
      }
    }

    return json(result);
  } catch (error) {
    console.error('Deploy error:', error);
    return json({ error: 'Deployment failed' }, { status: 500 });
  }
}
