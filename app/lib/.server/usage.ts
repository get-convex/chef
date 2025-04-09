import type { LanguageModelUsage } from 'ai';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('usage');

export type CheckTokenUsageResponse =
  | {
      status: 'success';
      tokensUsed: number;
      tokensQuota: number;
    }
  | {
      status: 'error';
      response: Response;
    };

export async function checkTokenUsage(
  provisionHost: string,
  token: string,
  teamSlug: string,
  deploymentName: string | undefined,
): Promise<CheckTokenUsageResponse> {
  const Authorization = `Bearer ${token}`;
  const url = `${provisionHost}/api/dashboard/teams/${teamSlug}/usage/get_token_info`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) {
    const body = await response.text();
    logger.error(`Failed to check for token usage: ${url} -> ${response.statusText}: ${body}`);
    return {
      status: 'error',
      response: new Response(JSON.stringify({ error: 'Failed to check for tokens' }), {
        status: response.status,
      }),
    };
  }
  const { tokensUsed, tokensQuota }: { tokensUsed: number; tokensQuota: number } = await response.json();
  logger.info(`${teamSlug}/${deploymentName}: Tokens used: ${tokensUsed} / ${tokensQuota}`);
  return { status: 'success', tokensUsed, tokensQuota };
}

export async function recordUsage(
  provisionHost: string,
  token: string,
  teamSlug: string,
  deploymentName: string | undefined,
  usage: LanguageModelUsage,
) {
  const Authorization = `Bearer ${token}`;
  const url = `${provisionHost}/api/dashboard/teams/${teamSlug}/usage/record_tokens`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tokens: usage.totalTokens,
    }),
  });
  if (!response.ok) {
    logger.error('Failed to record usage', response);
    logger.error(await response.json());
  }

  let { tokensUsed, tokensQuota } = await response.json();
  logger.info(`${teamSlug}/${deploymentName}: Tokens used: ${tokensUsed} / ${tokensQuota}`);
}
