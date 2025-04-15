export type CheckTokenUsageResponse =
  | {
      status: 'success';
      centitokensUsed: number;
      centitokensQuota: number;
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

// We render centitokens as 100x smaller than their actual amount to get them
// closer to user's expectations for Claude tokens.
export function renderTokenCount(centitokens: number) {
  const renderedTokens = Math.max(1, Math.floor(centitokens / 100));
  return renderedTokens.toLocaleString();
}

export function noTokensText(centitokensUsed: number, centitokensQuota: number) {
  return (
    `No remaining tokens available. ` +
    `Please upgrade to a paid plan or add your own API key at chef.convex.dev/settings to continue. ` +
    `Used ${renderTokenCount(centitokensUsed)} of ${renderTokenCount(centitokensQuota)}.`
  );
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
    centitokensUsed,
    centitokensQuota,
    isTeamDisabled,
  }: { centitokensUsed: number; centitokensQuota: number; isTeamDisabled: boolean } = await response.json();
  return { status: 'success', centitokensUsed: centitokensUsed * 100, centitokensQuota, isTeamDisabled };
}
