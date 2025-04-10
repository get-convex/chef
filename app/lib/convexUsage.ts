const VITE_PROVISION_HOST = import.meta.env.VITE_PROVISION_HOST || 'https://api.convex.dev';

export async function getTokenUsage(convexAuthToken: string, teamSlug: string) {
  const url = `${VITE_PROVISION_HOST}/api/dashboard/teams/${teamSlug}/usage/get_token_info`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${convexAuthToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to fetch usage: ${response.statusText}: ${body}`);
  }
  const { tokensUsed, tokensQuota } = await response.json();
  return { tokensUsed, tokensQuota };
}
