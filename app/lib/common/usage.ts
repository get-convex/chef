import type { LanguageModelUsage, Message, ProviderMetadata } from 'ai';
import { type ProviderType, type Usage, type UsageAnnotation, parseAnnotations } from '~/lib/common/annotations';
import { captureMessage } from '@sentry/remix';

export function usageFromGeneration(generation: {
  usage: LanguageModelUsage;
  providerMetadata?: ProviderMetadata;
}): Usage {
  const bedrockUsage = generation.providerMetadata?.bedrock?.usage as any;
  return {
    completionTokens: generation.usage.completionTokens,
    promptTokens: generation.usage.promptTokens,
    totalTokens: generation.usage.totalTokens,
    providerMetadata: generation.providerMetadata,
    anthropicCacheCreationInputTokens: Number(generation.providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0),
    anthropicCacheReadInputTokens: Number(generation.providerMetadata?.anthropic?.cacheReadInputTokens ?? 0),
    openaiCachedPromptTokens: Number(generation.providerMetadata?.openai?.cachedPromptTokens ?? 0),
    xaiCachedPromptTokens: Number(generation.providerMetadata?.xai?.cachedPromptTokens ?? 0),
    googleCachedContentTokenCount: Number(generation.providerMetadata?.google?.cachedContentTokenCount ?? 0),
    googleThoughtsTokenCount: Number(generation.providerMetadata?.google?.thoughtsTokenCount ?? 0),
    bedrockCacheWriteInputTokens: Number(bedrockUsage?.cacheWriteInputTokens ?? 0),
    bedrockCacheReadInputTokens: Number(bedrockUsage?.cacheReadInputTokens ?? 0),
  };
}

export function initializeUsage(): Usage {
  return {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
    anthropicCacheCreationInputTokens: 0,
    anthropicCacheReadInputTokens: 0,
    openaiCachedPromptTokens: 0,
    xaiCachedPromptTokens: 0,
    googleCachedContentTokenCount: 0,
    googleThoughtsTokenCount: 0,
    bedrockCacheWriteInputTokens: 0,
    bedrockCacheReadInputTokens: 0,
  };
}

export function getFailedToolCalls(message: Message): Set<string> {
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
  lastMessage: Message | undefined,
  finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
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
  totalUsage.completionTokens += payload.completionTokens;
  totalUsage.promptTokens += payload.promptTokens;
  totalUsage.totalTokens += payload.totalTokens;
  totalUsage.anthropicCacheCreationInputTokens += payload.providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0;
  totalUsage.anthropicCacheReadInputTokens += payload.providerMetadata?.anthropic?.cacheReadInputTokens ?? 0;
  totalUsage.openaiCachedPromptTokens += payload.providerMetadata?.openai?.cachedPromptTokens ?? 0;
  totalUsage.xaiCachedPromptTokens += payload.providerMetadata?.xai?.cachedPromptTokens ?? 0;
  totalUsage.googleCachedContentTokenCount += payload.providerMetadata?.google?.cachedContentTokenCount ?? 0;
  totalUsage.bedrockCacheWriteInputTokens += payload.providerMetadata?.bedrock?.usage?.cacheWriteInputTokens ?? 0;
  totalUsage.bedrockCacheReadInputTokens += payload.providerMetadata?.bedrock?.usage?.cacheReadInputTokens ?? 0;
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
    completionTokens: {
      anthropic: 0,
      openai: 0,
      xai: 0,
      google: 0,
      bedrock: 0,
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
      bedrock: {
        uncached: 0,
        cached: 0,
      },
    },
  };
  if (provider === 'Anthropic') {
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
  } else if (provider === 'Bedrock') {
    const bedrockCompletionTokens = totalUsage.completionTokens * 200;
    chefTokens += bedrockCompletionTokens;
    breakdown.completionTokens.bedrock = bedrockCompletionTokens;
    const bedrockPromptTokens = totalUsage.promptTokens * 40;
    chefTokens += bedrockPromptTokens;
    breakdown.promptTokens.bedrock.uncached = bedrockPromptTokens;
    const cacheWriteInputTokens = totalUsage.bedrockCacheWriteInputTokens * 40;
    chefTokens += cacheWriteInputTokens;
    breakdown.promptTokens.bedrock.cached = cacheWriteInputTokens;
    const cacheReadInputTokens = totalUsage.bedrockCacheReadInputTokens * 3;
    chefTokens += cacheReadInputTokens;
    breakdown.promptTokens.bedrock.cached += cacheReadInputTokens;
  } else if (provider === 'OpenAI') {
    const openaiCompletionTokens = totalUsage.completionTokens * 100;
    chefTokens += openaiCompletionTokens;
    breakdown.completionTokens.openai = openaiCompletionTokens;
    const openaiCachedPromptTokens = totalUsage.openaiCachedPromptTokens * 5;
    chefTokens += openaiCachedPromptTokens;
    breakdown.promptTokens.openai.cached = openaiCachedPromptTokens;
    const openaiUncachedPromptTokens = (totalUsage.promptTokens - totalUsage.openaiCachedPromptTokens) * 26;
    chefTokens += openaiUncachedPromptTokens;
    breakdown.promptTokens.openai.uncached = openaiUncachedPromptTokens;
  } else if (provider === 'XAI') {
    // TODO: This is a guess. Billing like anthropic
    const xaiCompletionTokens = totalUsage.completionTokens * 200;
    chefTokens += xaiCompletionTokens;
    breakdown.completionTokens.xai = xaiCompletionTokens;
    const xaiPromptTokens = totalUsage.promptTokens * 40;
    chefTokens += xaiPromptTokens;
    breakdown.promptTokens.xai.uncached = xaiPromptTokens;
    // TODO - never seen xai set this field to anything but 0, so holding off until we understand.
    //chefTokens += totalUsage.xaiCachedPromptTokens * 3;
  } else if (provider === 'Google') {
    const googleCompletionTokens = totalUsage.completionTokens * 140;
    chefTokens += googleCompletionTokens;
    const googleThoughtTokens = totalUsage.googleThoughtsTokenCount * 140;
    chefTokens += googleThoughtTokens;
    breakdown.completionTokens.google = googleCompletionTokens;
    const googlePromptTokens = (totalUsage.promptTokens - totalUsage.googleCachedContentTokenCount) * 18;
    chefTokens += googlePromptTokens;
    breakdown.promptTokens.google.uncached = googlePromptTokens;
    const googleCachedContentTokens = totalUsage.googleCachedContentTokenCount * 5;
    chefTokens += googleCachedContentTokens;
    breakdown.promptTokens.google.cached = googleCachedContentTokens;
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
