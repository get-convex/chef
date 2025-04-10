export type CheckTokenUsageResponse =
  | {
      status: 'success';
      tokensUsed: number;
      tokensQuota: number;
    }
  | {
      status: 'error';
      httpStatus: number;
      httpBody: string;
    };

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
  const { tokensUsed, tokensQuota }: { tokensUsed: number; tokensQuota: number } = await response.json();
  return { status: 'success', tokensUsed, tokensQuota };
}
