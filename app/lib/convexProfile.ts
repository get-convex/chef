import { VITE_PROVISION_HOST } from './convexProvisionHost';
import { getConvexDashboardToken } from './stores/convexDashboardAuth';

export interface ConvexProfile {
  name: string;
  email: string;
  id: string;
}

/**
 * Fetch Convex profile using the dashboard OAuth token.
 * If no token is provided, it will attempt to use the stored dashboard token.
 *
 * NOTE: This function is currently disabled because third-party OAuth apps
 * don't have access to the dashboard APIs. See: https://docs.convex.dev/platform-apis/oauth-applications
 */
export async function getConvexProfile(convexAuthToken?: string): Promise<ConvexProfile> {
  // DISABLED: Third-party OAuth apps don't have access to /api/dashboard/profile
  // This returns 403 Forbidden for OAuth apps
  throw new Error('Dashboard API access not available for third-party OAuth apps. Using fallback profile from Google OAuth.');

  // const token = convexAuthToken || getConvexDashboardToken();
  // if (!token) {
  //   throw new Error('No Convex dashboard token available. Please connect your Convex account.');
  // }
  // const url = `${VITE_PROVISION_HOST}/api/dashboard/profile`;
  // const response = await fetch(url, {
  //   method: 'GET',
  //   headers: {
  //     Authorization: `Bearer ${token}`,
  //     'Content-Type': 'application/json',
  //   },
  // });
  // if (!response.ok) {
  //   const body = await response.text();
  //   throw new Error(`Failed to fetch profile: ${response.statusText}: ${body}`);
  // }
  // return response.json();
}
