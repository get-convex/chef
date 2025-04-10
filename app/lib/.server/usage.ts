import type { LanguageModelUsage, ProviderMetadata } from 'ai';
import { createScopedLogger } from '~/utils/logger';
import { getTokenUsage } from '~/lib/convexUsage';

const logger = createScopedLogger('usage');

export async function checkTokenUsage(
  provisionHost: string,
  token: string,
  teamSlug: string,
  deploymentName: string | undefined,
) {
  const tokenUsage = await getTokenUsage(provisionHost, token, teamSlug);
  if (tokenUsage.status === 'error') {
    logger.error(`Failed to check for token usage: ${tokenUsage.httpStatus}: ${tokenUsage.httpBody}`);
  }
  if (tokenUsage.status === 'success') {
    logger.info(`${teamSlug}/${deploymentName}: Tokens used: ${tokenUsage.tokensUsed} / ${tokenUsage.tokensQuota}`);
  }
  return tokenUsage;
}

export async function recordUsage(
  provisionHost: string,
  token: string,
  teamSlug: string,
  deploymentName: string | undefined,
  usage: LanguageModelUsage,
  providerMetadata: ProviderMetadata | undefined,
) {
  const Authorization = `Bearer ${token}`;
  const url = `${provisionHost}/api/dashboard/teams/${teamSlug}/usage/record_tokens`;
  // https://www.notion.so/convex-dev/Chef-Pricing-1cfb57ff32ab80f5aa2ecf3420523e2f
  let chefTokens = usage.promptTokens * 40 + usage.completionTokens * 200;
  if (providerMetadata?.anthropic) {
    const anthropic = providerMetadata.anthropic;
    const cacheCreationInputTokens = Number(anthropic.cacheCreationInputTokens ?? 0);
    const cacheReadInputTokens = Number(anthropic.cacheReadInputTokens ?? 0);
    chefTokens += cacheCreationInputTokens * 40 + cacheReadInputTokens * 3;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      tokens: chefTokens,
    }),
  });
  if (!response.ok) {
    logger.error('Failed to record usage', response);
    logger.error(await response.json());
  }

  const { tokensUsed, tokensQuota } = await response.json();
  logger.info(`${teamSlug}/${deploymentName}: Tokens used: ${tokensUsed} / ${tokensQuota}`);
}
