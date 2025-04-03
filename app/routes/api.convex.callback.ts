import type { LoaderFunctionArgs } from '@remix-run/cloudflare';

export async function loader({ request, context }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const CLIENT_ID =
    (context.cloudflare.env as Record<string, any>).CONVEX_OAUTH_CLIENT_ID || process.env.CONVEX_OAUTH_CLIENT_ID;
  const CLIENT_SECRET =
    (context.cloudflare.env as Record<string, any>).CONVEX_OAUTH_CLIENT_SECRET ||
    process.env.CONVEX_OAUTH_CLIENT_SECRET;

  if (!code) {
    return Response.json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    // Get the current origin for the redirect_uri
    const origin = url.origin;

    // Exchange the code for a token
    const tokenResponse = await fetch('https://api.convex.dev/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: origin + '/convex/callback',
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange failed:', errorData);

      return Response.json({ error: 'Failed to exchange code for token' }, { status: 500 });
    }

    const tokenResponseJson = await tokenResponse.json();
    const tokenData = tokenResponseJson as { access_token: string; token_type: 'bearer' };
    const token = tokenData.access_token;

    const { deploymentName, url: deploymentUrl } = await fetchDeploymentCredentials(token, 'dev');

    // Return the token as JSON
    return Response.json({ token, deploymentName, deploymentUrl });
  } catch (error) {
    console.error('Error in Convex OAuth callback:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const CONVEX_PROVISION_API = 'https://provision.convex.dev/api';

async function fetchDeploymentCredentials(projectDeployKey: string, deploymentType: 'prod' | 'dev') {
  const response = await fetch(`${CONVEX_PROVISION_API}/deployment/provision_and_authorize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Convex-Client': 'bolt-0.0.0',
      Authorization: `Bearer ${projectDeployKey}`,
    },
    body: JSON.stringify({
      // teamSlug and projectSlug are not needed since we’re using a project deploy key as an auth token
      teamSlug: null,
      projectSlug: null,
      deploymentType,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to fetch deployment credentials');
  }

  const json = (await response.json()) as {
    deploymentName: string;
    url: string;
    adminKey: string;
  };

  return json;
}
