export type CheckTokenUsageResponse =
  | {
      status: 'success';
      tokensUsed: number;
      tokensQuota: number;
      isTeamDisabled: boolean;
    }
  | {
      status: 'error';
      httpStatus: number;
      httpBody: string;
    };

export const disabledText =
  'You have exceeded the free plan limits, ' +
  'so your deployments have been disabled. ' +
  'Please upgrade to a Pro plan or reach out to us ' +
  'at support@convex.dev for help.';

export function noTokensText(tokensUsed: number, tokensQuota: number) {
  return `No remaining tokens available. Please upgrade to a Pro plan or add your own Anthropic API key to continue. Used ${tokensUsed.toLocaleString()} of ${tokensQuota.toLocaleString()}.`;
}

export async function getTokenUsage(
  provisionHost: string,
  convexAuthToken: string,
  teamSlug: string,
): Promise<CheckTokenUsageResponse> {
  const url = `${provisionHost}/api/dashboard/teams/${teamSlug}/usage/get_token_info`;
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
  if (!response.ok) {
    const body = await response.text();
    return {
      status: 'error',
      httpStatus: response.status,
      httpBody: body,
    };
  }
  const {
    tokensUsed,
    tokensQuota,
    isTeamDisabled,
  }: { tokensUsed: number; tokensQuota: number; isTeamDisabled: boolean } = await response.json();
  return { status: 'success', tokensUsed, tokensQuota, isTeamDisabled };
}
