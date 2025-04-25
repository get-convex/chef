import type { LanguageModelUsage, Message, ProviderMetadata } from 'ai';
import {
  type Usage,
  type UsageAnnotation,
  annotationValidator,
  usageAnnotationValidator,
} from '~/lib/common/annotations';

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
  const breakdown = {
    completionTokens: {
      anthropic: 0,
      openai: 0,
      xai: 0,
      google: 0,
    },
    promptTokens: {
      anthropic: {
        uncached: 0,
        cached: 0,
      },
      openai: {
        uncached: 0,
        cached: 0,
      },
      xai: {
        uncached: 0,
        cached: 0,
      },
      google: {
        uncached: 0,
        cached: 0,
      },
    },
  };
  if (providerMetadata?.anthropic) {
    const anthropicCompletionTokens = totalUsage.completionTokens * 200;
    chefTokens += anthropicCompletionTokens;
    breakdown.completionTokens.anthropic = anthropicCompletionTokens;

    const anthropicPromptTokens = totalUsage.promptTokens * 40;
    chefTokens += anthropicPromptTokens;
    breakdown.promptTokens.anthropic.uncached = anthropicPromptTokens;
    const cacheCreationInputTokens = totalUsage.anthropicCacheCreationInputTokens * 40;
    chefTokens += cacheCreationInputTokens;
    breakdown.promptTokens.anthropic.cached = cacheCreationInputTokens;
    const cacheReadInputTokens = totalUsage.anthropicCacheReadInputTokens * 3;
    chefTokens += cacheReadInputTokens;
    breakdown.promptTokens.anthropic.cached += cacheReadInputTokens;
  } else if (providerMetadata?.openai) {
    const openaiCompletionTokens = totalUsage.completionTokens * 100;
    chefTokens += openaiCompletionTokens;
    breakdown.completionTokens.openai = openaiCompletionTokens;
    const openaiCachedPromptTokens = totalUsage.openaiCachedPromptTokens * 5;
    chefTokens += openaiCachedPromptTokens;
    breakdown.promptTokens.openai.cached = openaiCachedPromptTokens;
    const openaiUncachedPromptTokens = (totalUsage.promptTokens - totalUsage.openaiCachedPromptTokens) * 26;
    chefTokens += openaiUncachedPromptTokens;
    breakdown.promptTokens.openai.uncached = openaiUncachedPromptTokens;
  } else if (providerMetadata?.xai) {
    // TODO: This is a guess. Billing like openai
    const xaiCompletionTokens = totalUsage.completionTokens * 200;
    chefTokens += xaiCompletionTokens;
    breakdown.completionTokens.xai = xaiCompletionTokens;
    const xaiPromptTokens = totalUsage.promptTokens * 40;
    chefTokens += xaiPromptTokens;
    breakdown.promptTokens.xai.uncached = xaiPromptTokens;
    // TODO - never seen xai set this field to anything but 0, so holding off until we understand.
    //chefTokens += totalUsage.xaiCachedPromptTokens * 3;
  } else if (providerMetadata?.google) {
    const googleCompletionTokens = totalUsage.completionTokens * 140;
    chefTokens += googleCompletionTokens;
    breakdown.completionTokens.google = googleCompletionTokens;
    const googlePromptTokens = totalUsage.promptTokens * 18;
    chefTokens += googlePromptTokens;
    breakdown.promptTokens.google.uncached = googlePromptTokens;
    // TODO: Implement Google billing for the prompt tokens that are cached. Google doesn't offer caching yet.
  } else {
    console.error('WARNING: Unknown provider. Not recording usage. Giving away for free.', providerMetadata);
  }

  return {
    chefTokens,
    breakdown,
  };
}
