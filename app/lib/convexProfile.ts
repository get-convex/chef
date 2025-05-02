import { VITE_PROVISION_HOST } from './convexProvisionHost';

export interface ConvexProfile {
  name: string;
  email: string;
  id: string;
}

export async function getConvexProfile(convexAuthToken: string): Promise<ConvexProfile> {
  const url = `${VITE_PROVISION_HOST}/api/dashboard/profile`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${convexAuthToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch profile: ${response.statusText}: ${body}`);
  }
  return response.json();
}
