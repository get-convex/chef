import { json, redirect, type LoaderFunctionArgs } from '@vercel/remix';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return json({ error: 'No authorization code provided' }, { status: 400 });
  }

  const GOOGLE_CLIENT_ID = '561957498361-0f9mtcp25437nifbss26eei9a1b8rm6o.apps.googleusercontent.com';
  const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = url.origin + '/api/auth/google/callback';

  if (!GOOGLE_CLIENT_SECRET) {
    return json({ error: 'Server configuration error: Missing GOOGLE_CLIENT_SECRET' }, { status: 500 });
  }

  try {
    // Exchange code for tokens from Google
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Google token exchange failed:', errorText);
      return json({ error: 'Failed to exchange code for token' }, { status: 500 });
    }

    const tokens = await tokenResponse.json();
    const { access_token, id_token } = tokens;

    // Get user info from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });

    if (!userInfoResponse.ok) {
      return json({ error: 'Failed to get user info' }, { status: 500 });
    }

    const userInfo = await userInfoResponse.json();

    // Return HTML that stores the token and redirects
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Completing sign in...</title>
        </head>
        <body>
          <script>
            // Store the ID token in localStorage
            localStorage.setItem('google_id_token', '${id_token}');
            localStorage.setItem('google_access_token', '${access_token}');
            localStorage.setItem('convex_access_token', '${id_token}');

            // Store user info
            localStorage.setItem('user_info', JSON.stringify(${JSON.stringify(userInfo)}));

            // Redirect to home
            window.location.href = '/';
          </script>
          <p>Completing sign in...</p>
        </body>
      </html>
    `;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });
  } catch (error) {
    console.error('Error in Google OAuth callback:', error);
    return json({ error: 'Internal server error' }, { status: 500 });
  }
}
