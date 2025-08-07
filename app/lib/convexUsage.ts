export type CheckTokenUsageResponse =
  | {
      status: 'success';
      centitokensUsed: number;
      centitokensQuota: number;
      isTeamDisabled: boolean;
      isPaidPlan: boolean;
    }
  | {
      status: 'error';
      httpStatus: number;
      httpBody: string;
    };

export function disabledText(isPaidPlan: boolean) {
  return isPaidPlan
    ? 'You have exceeded your spending limits, so your deployments have been disabled. ' +
        'Please increase your spending limit on the Convex dashboard or wait until limits reset.'
    : 'You have exceeded the free plan limits, so your deployments have been disabled. ' +
        'Please upgrade your plan or reach out to us at support@convex.dev for help.';
}

export function renderTokenCount(tokens: number) {
  const renderedTokens = Math.max(1, tokens);
  return renderedTokens.toLocaleString();
}

export function noTokensText(centitokensUsed: number, centitokensQuota: number) {
  return (
    `No remaining tokens available. ` +
    `Please upgrade to a paid plan or add your own API key at chef.convex.dev/settings to continue. ` +
    `Used ${renderTokenCount(Math.floor(centitokensUsed / 100))} of ${renderTokenCount(Math.floor(centitokensQuota / 100))}.`
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
    const body = await response.text.text();
    throw new Error(`Failed to fetch usage: ${response.statusText}: ${body}`);
  }
  if (!response.ok) {
    const body = await response.text.text();
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
    isPaidPlan,
  }: { centitokensUsed: number; centitokensQuota: number; isTeamDisabled: boolean; isPaidPlan: boolean } =
    await response.json();
  return {
    status: 'success',
    centitokensUsed,
    centitokensQuota,
    isTeamDisabled,
    isPaidPlan,
  };
}
