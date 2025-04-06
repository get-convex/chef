import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';
import Cloudflare from 'cloudflare';

const PROVISION_HOST = 'https://provision.convex.dev';
//const PROVISION_HOST = "http://127.0.0.1:8000";

export async function action({ request, context }: ActionFunctionArgs) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const deploymentName = formData.get('deploymentName') as string;
    let token = formData.get('token') as string;

    // If it's a project token, great
    if (!token.includes('project')) {
      // if not then use our hardcoded project token
      token = (context.cloudflare.env as Record<string, any>).BIG_BRAIN_API_KEY || process.env.BIG_BRAIN_API_KEY;
    }
    console.log(deploymentName);

    if (!file) {
      return json({ error: 'No file provided' }, { status: 400 });
    }

    if (!token || !deploymentName) {
      return json({ error: 'Missing authentication or deployment info' }, { status: 400 });
    }

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
    const cfApiToken =
      (context.cloudflare.env as Record<string, any>).CLOUDFLARE_API_KEY || process.env.CLOUDFLARE_API_KEY;
    const zoneId = (context.cloudflare.env as Record<string, any>).CLOUDFLARE_ZONE_ID || process.env.CLOUDFLARE_ZONE_ID;

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
