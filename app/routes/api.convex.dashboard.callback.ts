import { json, type LoaderFunctionArgs } from '@remix-run/node';

/**
 * Handles OAuth callback for Convex dashboard/team access.
 * This exchanges the authorization code for an access token that can be used
 * to call api.convex.dev/api/dashboard/* endpoints.
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const error = url.searchParams.get('error');

  console.log('Convex dashboard OAuth callback received:', {
    hasCode: !!code,
    hasError: !!error,
    origin: url.origin,
  });

  // Handle OAuth errors
  if (error) {
    console.error('OAuth error:', error);
    return json({ error }, { status: 400 });
  }

  if (!code) {
    return json({ error: 'No authorization code provided' }, { status: 400 });
  }

  const CLIENT_ID = globalThis.process.env.CONVEX_OAUTH_CLIENT_ID;
  const CLIENT_SECRET = globalThis.process.env.CONVEX_OAUTH_CLIENT_SECRET;

  console.log('OAuth credentials check:', {
    hasClientId: !!CLIENT_ID,
    hasClientSecret: !!CLIENT_SECRET,
    clientIdLength: CLIENT_ID?.length,
  });

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('Missing CONVEX_OAUTH_CLIENT_ID or CONVEX_OAUTH_CLIENT_SECRET');
    return json(
      { error: 'Server configuration error: Missing OAuth credentials' },
      { status: 500 }
    );
  }

  try {
    const origin = url.origin;
    const redirectUri = `${origin}/api/convex/dashboard/callback`;

    // Exchange the authorization code for an access token
    const OAUTH_TOKEN_ENDPOINT = 'https://api.convex.dev/oauth/token';
    const tokenResponse = await fetch(OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        body: errorText,
        redirectUri,
        clientId: CLIENT_ID,
      });
      return json(
        {
          error: 'Failed to exchange code for token',
          details: `Status: ${tokenResponse.status}`,
        },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Return HTML that stores the token and redirects
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Convex Account Connected</title>
        </head>
        <body>
          <script>
            // Store the Convex dashboard access token
            localStorage.setItem('convex_dashboard_token', '${accessToken}');

            // Notify parent window (if opened in popup)
            if (window.opener) {
              window.opener.postMessage({ type: 'convex_dashboard_connected' }, window.location.origin);
              window.close();
            } else {
              // Redirect to settings page
              window.location.href = '/settings';
            }
          </script>
          <p>Convex account connected successfully. Redirecting...</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error in Convex OAuth callback:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return json(
      {
        error: 'Internal server error',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
