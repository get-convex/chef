import type { LanguageModelUsage, UIMessage, ProviderMetadata } from 'ai';
import { type ProviderType, type Usage, type UsageAnnotation, parseAnnotations } from '~/lib/common/annotations';
import { captureMessage } from '@sentry/remix';

export function usageFromGeneration(generation: {
  usage: LanguageModelUsage;
  providerOptions?: ProviderMetadata;
}): Usage {
  return {
    outputTokens: generation.usage.outputTokens,
    inputTokens: generation.usage.inputTokens,
    totalTokens: generation.usage.totalTokens,
    providerOptions: generation.providerOptions,
    anthropicCacheCreationInputTokens: Number(generation.providerOptions?.anthropic?.cacheCreationInputTokens ?? 0),
    anthropicCacheReadInputTokens: Number(generation.providerOptions?.anthropic?.cacheReadInputTokens ?? 0),
    openaiCachedPromptTokens: Number(generation.providerOptions?.openai?.cachedPromptTokens ?? 0),
    xaiCachedPromptTokens: Number(generation.providerOptions?.xai?.cachedPromptTokens ?? 0),
    googleCachedContentTokenCount: Number(generation.providerOptions?.google?.cachedContentTokenCount ?? 0),
    googleThoughtsTokenCount: Number(generation.providerOptions?.google?.thoughtsTokenCount ?? 0),
  };
}

export function initializeUsage(): Usage {
  return {
    outputTokens: 0,
    inputTokens: 0,
    totalTokens: 0,
    anthropicCacheCreationInputTokens: 0,
    anthropicCacheReadInputTokens: 0,
    openaiCachedPromptTokens: 0,
    xaiCachedPromptTokens: 0,
    googleCachedContentTokenCount: 0,
    googleThoughtsTokenCount: 0,
  };
}

export function getFailedToolCalls(message: UIMessage): Set<string> {
  const failedToolCalls: Set<string> = new Set();
  for (const part of message.parts ?? []) {
    if (part.type !== 'tool-invocation') {
      continue;
    }
    if (part.toolInvocation.state === 'result' && part.toolInvocation.result.startsWith('Error:')) {
      failedToolCalls.add(part.toolInvocation.toolCallId);
    }
  }
  return failedToolCalls;
}

export function calculateTotalUsage(args: {
  startUsage: Usage | null;
  usageAnnotationsForToolCalls: Record<string, UsageAnnotation | null>;
}): { totalRawUsage: Usage; totalUsageBilledFor: Usage } {
  const { startUsage, usageAnnotationsForToolCalls } = args;
  const totalRawUsage = startUsage ? JSON.parse(JSON.stringify(startUsage)) : initializeUsage();
  const totalUsageBilledFor = startUsage ? JSON.parse(JSON.stringify(startUsage)) : initializeUsage();
  for (const payload of Object.values(usageAnnotationsForToolCalls)) {
    if (!payload) {
      continue;
    }
    addUsage(totalRawUsage, payload);
    addUsage(totalUsageBilledFor, payload);
  }
  return {
    totalRawUsage,
    totalUsageBilledFor,
  };
}

export async function calculateTotalBilledUsageForMessage(
  lastMessage: UIMessage | undefined,
  finalGeneration: { usage: LanguageModelUsage; providerOptions?: ProviderMetadata },
): Promise<Usage> {
  const { usageForToolCall } = parseAnnotations(lastMessage?.annotations ?? []);
  // If there's an annotation for the final part, start with an empty usage, otherwise, create a
  // usage object from the passed in final generation.
  const startUsage = usageForToolCall.final ? initializeUsage() : usageFromGeneration(finalGeneration);
  const { totalUsageBilledFor } = calculateTotalUsage({
    startUsage,
    usageAnnotationsForToolCalls: usageForToolCall,
  });
  return totalUsageBilledFor;
}

function addUsage(totalUsage: Usage, payload: UsageAnnotation) {
  totalUsage.outputTokens += payload.outputTokens;
  totalUsage.inputTokens += payload.inputTokens;
  totalUsage.totalTokens += payload.totalTokens;
  totalUsage.anthropicCacheCreationInputTokens += payload.providerOptions?.anthropic?.cacheCreationInputTokens ?? 0;
  totalUsage.anthropicCacheReadInputTokens += payload.providerOptions?.anthropic?.cacheReadInputTokens ?? 0;
  totalUsage.openaiCachedPromptTokens += payload.providerOptions?.openai?.cachedPromptTokens ?? 0;
  totalUsage.xaiCachedPromptTokens += payload.providerOptions?.xai?.cachedPromptTokens ?? 0;
  totalUsage.googleCachedContentTokenCount += payload.providerOptions?.google?.cachedContentTokenCount ?? 0;
}

export type ChefTokenBreakdown = {
  completionTokens: {
    anthropic: number;
    openai: number;
    xai: number;
    google: number;
    bedrock: number;
  };
  promptTokens: {
    anthropic: { uncached: number; cached: number };
    openai: { uncached: number; cached: number };
    xai: { uncached: number; cached: number };
    google: { uncached: number; cached: number };
    bedrock: { uncached: number; cached: number };
  };
};

// TODO this these wrong
// Based on how the final generation came from (which may not be the provided used for the other generations came from)
// https://www.notion.so/convex-dev/Chef-Pricing-1cfb57ff32ab80f5aa2ecf3420523e2f
export function calculateChefTokens(totalUsage: Usage, provider?: ProviderType) {
  let chefTokens = 0;
  const breakdown = {
    outputTokens: {
      anthropic: 0,
      openai: 0,
      xai: 0,
      google: 0,
      bedrock: 0,
    },
    inputTokens: {
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
      bedrock: {
        uncached: 0,
        cached: 0,
      },
    },
  };
  if (provider === 'Anthropic') {
    const anthropicCompletionTokens = totalUsage.outputTokens * 200;
    chefTokens += anthropicCompletionTokens;
    breakdown.outputTokens.anthropic = anthropicCompletionTokens;
    const anthropicPromptTokens = totalUsage.inputTokens * 40;
    chefTokens += anthropicPromptTokens;
    breakdown.inputTokens.anthropic.uncached = anthropicPromptTokens;
    const cacheCreationInputTokens = totalUsage.anthropicCacheCreationInputTokens * 40;
    chefTokens += cacheCreationInputTokens;
    breakdown.inputTokens.anthropic.cached = cacheCreationInputTokens;
    const cacheReadInputTokens = totalUsage.anthropicCacheReadInputTokens * 3;
    chefTokens += cacheReadInputTokens;
    breakdown.inputTokens.anthropic.cached += cacheReadInputTokens;
  } else if (provider === 'Bedrock') {
    const bedrockCompletionTokens = totalUsage.outputTokens * 200;
    chefTokens += bedrockCompletionTokens;
    breakdown.outputTokens.bedrock = bedrockCompletionTokens;
    const bedrockPromptTokens = totalUsage.inputTokens * 40;
    chefTokens += bedrockPromptTokens;
    breakdown.inputTokens.bedrock.uncached = bedrockPromptTokens;
  } else if (provider === 'OpenAI') {
    const openaiCompletionTokens = totalUsage.outputTokens * 100;
    chefTokens += openaiCompletionTokens;
    breakdown.outputTokens.openai = openaiCompletionTokens;
    const openaiCachedPromptTokens = totalUsage.openaiCachedPromptTokens * 5;
    chefTokens += openaiCachedPromptTokens;
    breakdown.inputTokens.openai.cached = openaiCachedPromptTokens;
    const openaiUncachedPromptTokens = (totalUsage.inputTokens - totalUsage.openaiCachedPromptTokens) * 26;
    chefTokens += openaiUncachedPromptTokens;
    breakdown.inputTokens.openai.uncached = openaiUncachedPromptTokens;
  } else if (provider === 'XAI') {
    // TODO: This is a guess. Billing like anthropic
    const xaiCompletionTokens = totalUsage.outputTokens * 200;
    chefTokens += xaiCompletionTokens;
    breakdown.outputTokens.xai = xaiCompletionTokens;
    const xaiPromptTokens = totalUsage.inputTokens * 40;
    chefTokens += xaiPromptTokens;
    breakdown.inputTokens.xai.uncached = xaiPromptTokens;
    // TODO - never seen xai set this field to anything but 0, so holding off until we understand.
    //chefTokens += totalUsage.xaiCachedPromptTokens * 3;
  } else if (provider === 'Google') {
    const googleCompletionTokens = totalUsage.outputTokens * 140;
    chefTokens += googleCompletionTokens;
    const googleThoughtTokens = totalUsage.googleThoughtsTokenCount * 140;
    chefTokens += googleThoughtTokens;
    breakdown.outputTokens.google = googleCompletionTokens;
    const googlePromptTokens = (totalUsage.inputTokens - totalUsage.googleCachedContentTokenCount) * 18;
    chefTokens += googlePromptTokens;
    breakdown.inputTokens.google.uncached = googlePromptTokens;
    const googleCachedContentTokens = totalUsage.googleCachedContentTokenCount * 5;
    chefTokens += googleCachedContentTokens;
    breakdown.inputTokens.google.cached = googleCachedContentTokens;
  } else {
    captureMessage('WARNING: Unknown provider. Not recording usage. Giving away for free.', {
      level: 'error',
      tags: {
        provider,
      },
    });
  }

  return {
    chefTokens,
    breakdown,
  };
}
