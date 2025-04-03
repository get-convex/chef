import { json } from '@remix-run/cloudflare';
import type { ActionFunctionArgs } from '@remix-run/cloudflare';

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

    if (!response.ok) {
      const error = await response.json();
      console.log(error);
      return json(error, { status: response.status });
    }

    const result = await response.json();
    return json(result);
  } catch (error) {
    console.error('Deploy error:', error);
    return json({ error: 'Deployment failed' }, { status: 500 });
  }
}
