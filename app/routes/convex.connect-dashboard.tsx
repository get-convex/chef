import { useEffect } from 'react';
import type { MetaFunction } from '@remix-run/node';
import { Spinner } from '@ui/Spinner';

export const meta: MetaFunction = () => {
  return [{ title: 'Connecting Convex Account | AI Standard' }];
};

const dashboardHost = import.meta.env.VITE_DASHBOARD_HOST || 'https://dashboard.convex.dev';
const clientId = import.meta.env.VITE_CONVEX_OAUTH_CLIENT_ID;

/**
 * Initiates Convex OAuth flow for dashboard/team access.
 * This is separate from the project creation OAuth flow.
 */
export default function ConvexConnectDashboard() {
  useEffect(() => {
    if (!clientId) {
      console.error('Missing VITE_CONVEX_OAUTH_CLIENT_ID');
      return;
    }

    const origin = window.location.origin;
    const redirectUri = `${origin}/api/convex/dashboard/callback`;

    // Build the OAuth authorization URL for team-scoped access
    const authUrl = new URL(`${dashboardHost}/oauth/authorize/team`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'team');

    // Redirect to Convex OAuth
    window.location.href = authUrl.toString();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: '#f9f7ee' }}>
      <div className="text-center">
        <Spinner />
        <p className="mt-4 text-gray-600">Connecting to Convex...</p>
      </div>
    </div>
  );
}
