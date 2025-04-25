import { usageAnnotationValidator } from '../.server/validators';

import type { UsageAnnotation } from '../.server/validators';

import type { LanguageModelUsage, Message, ProviderMetadata } from 'ai';
import { annotationValidator } from '../.server/validators';
import type { Usage } from '../.server/validators';

export function usageFromGeneration(generation: {
  usage: LanguageModelUsage;
  providerMetadata?: ProviderMetadata;
}): Usage {
  return {
    completionTokens: generation.usage.completionTokens,
    promptTokens: generation.usage.promptTokens,
    totalTokens: generation.usage.totalTokens,
    providerMetadata: generation.providerMetadata,
    anthropicCacheCreationInputTokens: Number(generation.providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0),
    anthropicCacheReadInputTokens: Number(generation.providerMetadata?.anthropic?.cacheReadInputTokens ?? 0),
    openaiCachedPromptTokens: Number(generation.providerMetadata?.openai?.cachedPromptTokens ?? 0),
    xaiCachedPromptTokens: Number(generation.providerMetadata?.xai?.cachedPromptTokens ?? 0),
  };
}

export async function calculateTotalUsageForMessage(
  lastMessage: Message | undefined,
  finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
): Promise<{ totalRawUsage: Usage; totalUsageBilledFor: Usage }> {
  // The main distinction is we don't count usage from failed tool calls in
  // totalUsageBilledFor.
  const totalUsageBilledFor = usageFromGeneration(finalGeneration);
  const totalRawUsage = {
    ...totalUsageBilledFor,
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
      let payload: UsageAnnotation;
      try {
        payload = usageAnnotationValidator.parse(JSON.parse(parsed.data.usage.payload));
      } catch (e) {
        console.error('Invalid payload', parsed.data.usage.payload, e);
        continue;
      }
      addUsage(totalRawUsage, payload);
      if (payload.toolCallId && failedToolCalls.has(payload.toolCallId)) {
        console.warn('Skipping usage for failed tool call', payload.toolCallId);
        continue;
      }
      addUsage(totalUsageBilledFor, payload);
    }
  }
  return {
    totalRawUsage,
    totalUsageBilledFor,
  };
}

function addUsage(totalUsage: Usage, payload: UsageAnnotation) {
  totalUsage.completionTokens += payload.completionTokens;
  totalUsage.promptTokens += payload.promptTokens;
  totalUsage.totalTokens += payload.totalTokens;
  totalUsage.anthropicCacheCreationInputTokens += payload.providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0;
  totalUsage.anthropicCacheReadInputTokens += payload.providerMetadata?.anthropic?.cacheReadInputTokens ?? 0;
  totalUsage.openaiCachedPromptTokens += payload.providerMetadata?.openai?.cachedPromptTokens ?? 0;
  totalUsage.xaiCachedPromptTokens += payload.providerMetadata?.xai?.cachedPromptTokens ?? 0;
}

// TODO this these wrong
// Based on how the final generation came from (which may not be the provided used for the other generations came from)
// https://www.notion.so/convex-dev/Chef-Pricing-1cfb57ff32ab80f5aa2ecf3420523e2f
export function calculateChefTokens(totalUsage: Usage, providerMetadata?: ProviderMetadata) {
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
  return chefTokens;
}
