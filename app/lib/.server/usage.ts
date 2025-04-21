import type { LanguageModelUsage, Message, ProviderMetadata } from 'ai';
import { createScopedLogger } from 'chef-agent/utils/logger';
import { getTokenUsage } from '~/lib/convexUsage';
import { z } from 'zod';

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

export const annotationValidator = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('usage'),
    usage: z.object({
      payload: z.string(),
    }),
  }),
  z.object({
    type: z.literal('failure'),
    reason: z.string(),
  }),
]);

export const usageValidator = z.object({
  toolCallId: z.string().optional(),
  completionTokens: z.number(),
  promptTokens: z.number(),
  totalTokens: z.number(),
  providerMetadata: z
    .object({
      openai: z
        .object({
          cachedPromptTokens: z.number(),
        })
        .optional(),
      anthropic: z
        .object({
          cacheCreationInputTokens: z.number(),
          cacheReadInputTokens: z.number(),
        })
        .optional(),
      xai: z
        .object({
          cachedPromptTokens: z.number(),
        })
        .optional(),
    })
    .optional(),
});
type Usage = z.infer<typeof usageValidator>;

export function encodeUsageAnnotation(
  toolCallId: string | undefined,
  usage: LanguageModelUsage,
  providerMetadata: ProviderMetadata | undefined,
) {
  const payload: Usage = {
    toolCallId,
    completionTokens: usage.completionTokens,
    promptTokens: usage.promptTokens,
    totalTokens: usage.totalTokens,
    providerMetadata,
  };
  const serialized = JSON.stringify(payload);
  return { payload: serialized };
}

export async function recordUsage(
  provisionHost: string,
  token: string,
  teamSlug: string,
  deploymentName: string | undefined,
  lastMessage: Message | undefined,
  finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
) {
  const totalUsage = {
    completionTokens: finalGeneration.usage.completionTokens,
    promptTokens: finalGeneration.usage.promptTokens,
    totalTokens: finalGeneration.usage.totalTokens,
    providerMetadata: finalGeneration.providerMetadata,
    anthropicCacheCreationInputTokens: Number(
      finalGeneration.providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0,
    ),
    anthropicCacheReadInputTokens: Number(finalGeneration.providerMetadata?.anthropic?.cacheReadInputTokens ?? 0),
    openaiCachedPromptTokens: Number(finalGeneration.providerMetadata?.openai?.cachedPromptTokens ?? 0),
    xaiCachedPromptTokens: Number(finalGeneration.providerMetadata?.xai?.cachedPromptTokens ?? 0),
  };

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
      const parsed = annotationValidator.safeParse(annotation);
      if (!parsed.success) {
        console.error('Invalid annotation', parsed.error);
        continue;
      }
      if (parsed.data.type !== 'usage') {
        continue;
      }
      let payload: Usage;
      try {
        payload = usageValidator.parse(JSON.parse(parsed.data.usage.payload));
      } catch (e) {
        console.error('Invalid payload', parsed.data.usage.payload, e);
        continue;
      }
      if (payload.toolCallId && failedToolCalls.has(payload.toolCallId)) {
        console.warn('Skipping usage for failed tool call', payload.toolCallId);
        continue;
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

  const Authorization = `Bearer ${token}`;
  const url = `${provisionHost}/api/dashboard/teams/${teamSlug}/usage/record_tokens`;
  // https://www.notion.so/convex-dev/Chef-Pricing-1cfb57ff32ab80f5aa2ecf3420523e2f
  let chefTokens = 0;
  if (finalGeneration.providerMetadata?.anthropic) {
    chefTokens += totalUsage.completionTokens * 200;
    chefTokens += totalUsage.promptTokens * 40;
    chefTokens += totalUsage.anthropicCacheCreationInputTokens * 40 + totalUsage.anthropicCacheReadInputTokens * 3;
  } else if (finalGeneration.providerMetadata?.openai) {
    chefTokens += totalUsage.completionTokens * 100;
    chefTokens += totalUsage.openaiCachedPromptTokens * 5;
    chefTokens += (totalUsage.promptTokens - totalUsage.openaiCachedPromptTokens) * 26;
  } else if (finalGeneration.providerMetadata?.xai) {
    // TODO: This is a guess. Billing like openai
    chefTokens += totalUsage.completionTokens * 200;
    chefTokens += totalUsage.promptTokens * 40;
    // TODO - never seen xai set this field to anything but 0, so holding off until we understand.
    //chefTokens += totalUsage.xaiCachedPromptTokens * 3;
  } else if (finalGeneration.providerMetadata?.google) {
    chefTokens += totalUsage.completionTokens * 140;
    chefTokens += totalUsage.promptTokens * 18;
    // TODO: Implement Google billing for the prompt tokens that are cached. Google doesn't offer caching yet.
  } else {
    console.error(
      'WARNING: Unknown provider. Not recording usage. Giving away for free.',
      finalGeneration.providerMetadata,
    );
  }
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
