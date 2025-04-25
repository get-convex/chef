import type { LanguageModelUsage, Message, ProviderMetadata } from 'ai';
import { createScopedLogger } from 'chef-agent/utils/logger';
import { getTokenUsage } from '~/lib/convexUsage';
import type { ProviderType, UsageAnnotation } from '~/lib/common/annotations';
import { modelForProvider } from './llm/provider';
import { calculateTotalUsageForMessage, calculateChefTokens } from '~/lib/common/usage';

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
    logger.info(
      `${teamSlug}/${deploymentName}: Tokens used: ${tokenUsage.centitokensUsed} / ${tokenUsage.centitokensQuota}`,
    );
  }
  return tokenUsage;
}

export function encodeUsageAnnotation(
  toolCallId: { kind: 'tool-call'; toolCallId: string | undefined } | { kind: 'final' },
  usage: LanguageModelUsage,
  providerMetadata: ProviderMetadata | undefined,
) {
  const payload: UsageAnnotation = {
    toolCallId: toolCallId.kind === 'tool-call' ? toolCallId.toolCallId : 'final',
    completionTokens: usage.completionTokens,
    promptTokens: usage.promptTokens,
    totalTokens: usage.totalTokens,
    providerMetadata,
  };
  const serialized = JSON.stringify(payload);
  return { payload: serialized };
}

export function encodeModelAnnotation(
  call: { kind: 'tool-call'; toolCallId: string | null } | { kind: 'final' },
  providerMetadata: ProviderMetadata | undefined,
) {
  let provider: ProviderType | null = null;
  let model: string | null = null;
  if (providerMetadata?.anthropic) {
    provider = 'Anthropic';
    // This covers both claude on Bedrock vs. Anthropic, unclear if we want to
    // try and differentiate between the two.
    model = modelForProvider('Anthropic');
  } else if (providerMetadata?.openai) {
    provider = 'OpenAI';
    model = modelForProvider('OpenAI');
  } else if (providerMetadata?.xai) {
    provider = 'XAI';
    model = modelForProvider('XAI');
  } else if (providerMetadata?.google) {
    provider = 'Google';
    model = modelForProvider('Google');
  }
  return { toolCallId: call.kind === 'tool-call' ? call.toolCallId : 'final', provider, model };
}

export async function recordUsage(
  provisionHost: string,
  token: string,
  teamSlug: string,
  deploymentName: string | undefined,
  lastMessage: Message | undefined,
  finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
) {
  const { totalUsageBilledFor } = await calculateTotalUsageForMessage(lastMessage, finalGeneration);
  const { chefTokens } = calculateChefTokens(totalUsageBilledFor, finalGeneration.providerMetadata);

  const Authorization = `Bearer ${token}`;
  const url = `${provisionHost}/api/dashboard/teams/${teamSlug}/usage/record_tokens`;

  logger.info('Logging total usage', JSON.stringify(totalUsageBilledFor), 'corresponding to chef tokens', chefTokens);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      centitokens: chefTokens,
    }),
  });
  if (!response.ok) {
    logger.error('Failed to record usage', response);
    logger.error(await response.json());
  }

  const { centitokensUsed, centitokensQuota } = await response.json();
  logger.info(`${teamSlug}/${deploymentName}: Tokens used: ${centitokensUsed} / ${centitokensQuota}`);
}
