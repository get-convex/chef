import type { LanguageModelUsage, Message, ProviderMetadata } from 'ai';
import { createScopedLogger } from 'chef-agent/utils/logger';
import { getTokenUsage } from '~/lib/convexUsage';
import type { Usage, UsageAnnotation } from './validators';
import { annotationValidator, usageAnnotationValidator } from './validators';

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
  toolCallId: string | undefined,
  usage: LanguageModelUsage,
  providerMetadata: ProviderMetadata | undefined,
) {
  const payload: UsageAnnotation = {
    toolCallId,
    completionTokens: usage.completionTokens,
    promptTokens: usage.promptTokens,
    totalTokens: usage.totalTokens,
    providerMetadata,
  };
  const serialized = JSON.stringify(payload);
  return { payload: serialized };
}

export function calculateUsage({
  usage,
  providerMetadata,
  lastMessage,
}: {
  usage: LanguageModelUsage;
  providerMetadata?: ProviderMetadata;
  lastMessage?: Message;
}): {
  totalBillableUsage: Usage;
  totalUnbillableUsage: Usage;
  totalBillableChefTokens: number;
  totalUnbillableChefTokens: number;
} {
  const totalBillableUsage = {
    completionTokens: usage.completionTokens,
    promptTokens: usage.promptTokens,
    totalTokens: usage.totalTokens,
    providerMetadata,
    anthropicCacheCreationInputTokens: Number(providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0),
    anthropicCacheReadInputTokens: Number(providerMetadata?.anthropic?.cacheReadInputTokens ?? 0),
    openaiCachedPromptTokens: Number(providerMetadata?.openai?.cachedPromptTokens ?? 0),
    xaiCachedPromptTokens: Number(providerMetadata?.xai?.cachedPromptTokens ?? 0),
  } satisfies Usage;
  const totalUnbillableUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
    providerMetadata,
    anthropicCacheCreationInputTokens: 0,
    anthropicCacheReadInputTokens: 0,
    openaiCachedPromptTokens: 0,
    xaiCachedPromptTokens: 0,
  } satisfies typeof totalBillableUsage;

  const failedToolCalls: Set<string> = new Set();
  for (const part of lastMessage?.parts ?? []) {
    if (part.type !== 'tool-invocation') {
      continue;
    }
    if (part.toolInvocation.state === 'result' && part.toolInvocation.result.startsWith('Error:')) {
      failedToolCalls.add(part.toolInvocation.toolCallId);
    }
  }

  if (lastMessage && lastMessage.role === 'assistant') {
    for (const annotation of lastMessage.annotations ?? []) {
      let totalUsage = totalBillableUsage;
      const parsed = annotationValidator.safeParse(annotation);
      if (!parsed.success) {
        console.error('Invalid annotation', parsed.error);
        continue;
      }
      if (parsed.data.type !== 'usage') {
        continue;
      }
      let payload: UsageAnnotation;
      try {
        payload = usageAnnotationValidator.parse(JSON.parse(parsed.data.usage.payload));
      } catch (e) {
        console.error('Invalid payload', parsed.data.usage.payload, e);
        continue;
      }
      if (payload.toolCallId && failedToolCalls.has(payload.toolCallId)) {
        console.warn('Skipping usage for failed tool call', payload.toolCallId);
        totalUsage = totalUnbillableUsage;
      }
      totalUsage.completionTokens += payload.completionTokens;
      totalUsage.promptTokens += payload.promptTokens;
      totalUsage.totalTokens += payload.totalTokens;
      totalUsage.anthropicCacheCreationInputTokens +=
        payload.providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0;
      totalUsage.anthropicCacheReadInputTokens += payload.providerMetadata?.anthropic?.cacheReadInputTokens ?? 0;
      totalUsage.openaiCachedPromptTokens += payload.providerMetadata?.openai?.cachedPromptTokens ?? 0;
      totalUsage.xaiCachedPromptTokens += payload.providerMetadata?.xai?.cachedPromptTokens ?? 0;
    }
  }

  let totalBillableChefTokens = 0;
  let totalUnbillableChefTokens = 0;

  for (const totalUsage of [totalBillableUsage, totalUnbillableUsage]) {
    // https://www.notion.so/convex-dev/Chef-Pricing-1cfb57ff32ab80f5aa2ecf3420523e2f
    let chefTokens = 0;
    if (providerMetadata?.anthropic) {
      chefTokens += totalUsage.completionTokens * 200;
      chefTokens += totalUsage.promptTokens * 40;
      chefTokens += totalUsage.anthropicCacheCreationInputTokens * 40 + totalUsage.anthropicCacheReadInputTokens * 3;
    } else if (providerMetadata?.openai) {
      chefTokens += totalUsage.completionTokens * 100;
      chefTokens += totalUsage.openaiCachedPromptTokens * 5;
      chefTokens += (totalUsage.promptTokens - totalUsage.openaiCachedPromptTokens) * 26;
    } else if (providerMetadata?.xai) {
      // TODO: This is a guess. Billing like openai
      chefTokens += totalUsage.completionTokens * 200;
      chefTokens += totalUsage.promptTokens * 40;
      // TODO - never seen xai set this field to anything but 0, so holding off until we understand.
      //chefTokens += totalUsage.xaiCachedPromptTokens * 3;
    } else if (providerMetadata?.google) {
      chefTokens += totalUsage.completionTokens * 140;
      chefTokens += totalUsage.promptTokens * 18;
      // TODO: Implement Google billing for the prompt tokens that are cached. Google doesn't offer caching yet.
    } else {
      console.error('WARNING: Unknown provider. Not recording usage. Giving away for free.', providerMetadata);
    }
    if (totalUsage === totalBillableUsage) {
      totalBillableChefTokens = chefTokens;
    } else if (totalUsage === totalUnbillableUsage) {
      totalUnbillableChefTokens = chefTokens;
    } else {
      throw new Error('impossible');
    }
  }

  return { totalBillableUsage, totalUnbillableUsage, totalBillableChefTokens, totalUnbillableChefTokens };
}

export async function recordUsage(
  provisionHost: string,
  token: string,
  teamSlug: string,
  deploymentName: string | undefined,
  lastMessage: Message | undefined,
  finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
) {
  const { totalBillableUsage: totalUsage, totalBillableChefTokens: chefTokens } = calculateUsage({
    ...finalGeneration,
    lastMessage,
  });

  const Authorization = `Bearer ${token}`;
  const url = `${provisionHost}/api/dashboard/teams/${teamSlug}/usage/record_tokens`;
  logger.info('Logging total usage', JSON.stringify(totalUsage), 'corresponding to chef tokens', chefTokens);
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
