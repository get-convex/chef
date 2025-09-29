import { json, redirect } from '@vercel/remix';
import type { ActionFunctionArgs } from '@vercel/remix';

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  
  if (!code) {
    return json({ error: 'No authorization code provided' }, { status: 400 });
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });

    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      return json({ error: tokenData.error_description }, { status: 400 });
    }

    // Get user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    return json({
      accessToken: tokenData.access_token,
      username: userData.login,
      avatarUrl: userData.avatar_url,
    });
  } catch (error) {
    return json({ error: 'Failed to authenticate with GitHub' }, { status: 500 });
  }
}

export async function loader() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = `${process.env.VITE_APP_URL || 'http://127.0.0.1:5173'}/settings`;
  
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo`;
  
  return redirect(githubAuthUrl);
}
