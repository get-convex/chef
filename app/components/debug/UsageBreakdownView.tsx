import type { Message } from 'ai';

import { useEffect } from 'react';

import { useState } from 'react';
import { JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { type Usage } from '~/lib/common/annotations';
import { calculateTotalUsageForMessage, calculateChefTokens } from '~/lib/common/usage';
import { decompressWithLz4 } from '~/lib/compression.client';

type DebugUsageData = {
  chatTotalRawUsage: Usage;
  chatTotalUsageBilledFor: Usage;
  chatTotalChefTokens: number;
  chatTotalChefBreakdown: ChefBreakdown;
  usagePerMessage: Array<{
    messageIdx: number;
    rawUsage: Usage;
    billedUsage: Usage;
    chefTokens: number;
    breakdown: ChefBreakdown;
  }>;
};

export function UsageBreakdownView({ chatInitialId, convexSiteUrl }: { chatInitialId: string; convexSiteUrl: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [usageData, setUsageData] = useState<DebugUsageData | null>(null);

  useEffect(() => {
    const fetchUsageData = async () => {
      const response = await fetch(`${convexSiteUrl}/__debug/download_messages`, {
        method: 'POST',
        body: JSON.stringify({ chatUuid: chatInitialId }),
        headers: {
          'X-Chef-Admin-Token': import.meta.env.VITE_CHEF_ADMIN_TOKEN,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) {
        throw new Error('Failed to fetch usage data');
      }
      const bytes = await response.arrayBuffer();
      const decompressed = decompressWithLz4(new Uint8Array(bytes));
      const messages = JSON.parse(new TextDecoder().decode(decompressed));
      setMessages(messages);
    };
    void fetchUsageData();
  }, [chatInitialId]);

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    getUsageBreakdown(messages).then(setUsageData);
  }, [messages]);

  if (!usageData) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      <h1>Usage Breakdown</h1>
      <div>
        <h2>Chat Total</h2>
        <div>
          <h3>Total Raw Usage</h3>
          <JsonView data={usageData.chatTotalRawUsage} />
        </div>
        <div>
          <h3>Total Billed Usage</h3>
          <JsonView data={usageData.chatTotalUsageBilledFor} />
        </div>
        <div>
          <h3>Total Chef Tokens</h3>
          <p>{usageData.chatTotalChefTokens}</p>
        </div>
        <div>
          <h3>Total Chef Breakdown</h3>
          <JsonView data={usageData.chatTotalChefBreakdown} />
        </div>
      </div>
      <div>
        <h2>Per Message</h2>
        {usageData?.usagePerMessage.map((usage) => (
          <div key={usage.messageIdx.toString()}>
            <h3>Message {usage.messageIdx}</h3>
            <div>
              <h4>Raw Usage</h4>
              <JsonView data={usage.rawUsage} />
            </div>
            <div>
              <h4>Billed Usage</h4>
              <JsonView data={usage.billedUsage} />
            </div>
            <div>
              <h4>Chef Tokens</h4>
              <p>{usage.chefTokens}</p>
            </div>
            <div>
              <h4>Chef Breakdown</h4>
              <JsonView data={usage.breakdown} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

async function getUsageBreakdown(messages: Message[]) {
  let chatTotalRawUsage = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
    anthropicCacheCreationInputTokens: 0,
    anthropicCacheReadInputTokens: 0,
    openaiCachedPromptTokens: 0,
    xaiCachedPromptTokens: 0,
  };
  let chatTotalUsageBilledFor = {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
    anthropicCacheCreationInputTokens: 0,
    anthropicCacheReadInputTokens: 0,
    openaiCachedPromptTokens: 0,
    xaiCachedPromptTokens: 0,
  };
  let chatTotalChefTokens = 0;
  let chatTotalChefBreakdown: ChefBreakdown = {
    completionTokens: {
      anthropic: 0,
      openai: 0,
      xai: 0,
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
  const usagePerMessage: Array<{
    messageIdx: number;
    rawUsage: Usage;
    billedUsage: Usage;
    chefTokens: number;
    breakdown: ChefBreakdown;
  }> = [];

  for (const [idx, message] of messages.entries()) {
    if (message.role !== 'assistant') {
      continue;
    }
    // This is incorrect -- TODO -- try and extract from the annotations
    const finalGeneration = {
      usage: {
        completionTokens: 0,
        promptTokens: 0,
        totalTokens: 0,
      },
      providerMetadata: {
        anthropic: {
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
          cachedPromptTokens: 0,
        },
      },
    };
    const { totalRawUsage, totalUsageBilledFor } = await calculateTotalUsageForMessage(message, finalGeneration);
    const { chefTokens, breakdown } = calculateChefTokens(totalUsageBilledFor, finalGeneration.providerMetadata);
    usagePerMessage.push({
      messageIdx: idx,
      rawUsage: totalRawUsage,
      billedUsage: totalUsageBilledFor,
      chefTokens,
      breakdown,
    });
    addUsage(chatTotalRawUsage, totalRawUsage);
    addUsage(chatTotalUsageBilledFor, totalUsageBilledFor);
    addBreakdown(chatTotalChefBreakdown, breakdown);
    chatTotalChefTokens += chefTokens;
    // let finalAnnotation: UsageAnnotation | null = null;
    // for (const annotation of message.annotations ?? []) {
    //     const parsedAnnotation = annotationValidator.safeParse(annotation);
    //     if (!parsedAnnotation.success) {
    //         console.error('Invalid annotation', annotation);
    //         continue;
    //     }
    //     if (parsedAnnotation.data.type !== 'usage') {
    //         console.log('Skipping non-usage annotation', parsedAnnotation.data.type);
    //         continue;
    //     }
    //     const parsedUsage = usageAnnotationValidator.parse(JSON.parse(parsedAnnotation.data.usage.payload));
    //     if (!parsedUsage.success) {
    //         console.error('Invalid usage annotation', parsedAnnotation.data.usage.payload);
    //         continue;
    //     }
    //     finalAnnotation = parsedUsage.data;
    //     break;
    //   };
    //   totalRawUsage.completionTokens += annotation.completionTokens;
    //   totalRawUsage.totalPromptTokens += annotation.promptTokens;
    //   totalRawUsage.totalTokens += annotation.totalTokens;
  }
  return {
    chatTotalRawUsage,
    chatTotalUsageBilledFor,
    chatTotalChefTokens,
    chatTotalChefBreakdown,
    usagePerMessage,
  };
}

function addUsage(usageA: Usage, update: Usage) {
  usageA.completionTokens += update.completionTokens;
  usageA.promptTokens += update.promptTokens;
  usageA.totalTokens += update.totalTokens;
  usageA.anthropicCacheCreationInputTokens += update.anthropicCacheCreationInputTokens;
  usageA.anthropicCacheReadInputTokens += update.anthropicCacheReadInputTokens;
  usageA.openaiCachedPromptTokens += update.openaiCachedPromptTokens;
  usageA.xaiCachedPromptTokens += update.xaiCachedPromptTokens;
}

type ChefBreakdown = {
  completionTokens: {
    anthropic: number;
    openai: number;
    xai: number;
  };
  promptTokens: {
    anthropic: {
      uncached: number;
      cached: number;
    };
    openai: {
      uncached: number;
      cached: number;
    };
    xai: {
      uncached: number;
      cached: number;
    };
    google: {
      uncached: number;
      cached: number;
    };
  };
};

function addBreakdown(breakdownA: ChefBreakdown, update: ChefBreakdown) {
  breakdownA.completionTokens.anthropic += update.completionTokens.anthropic;
  breakdownA.completionTokens.openai += update.completionTokens.openai;
  breakdownA.completionTokens.xai += update.completionTokens.xai;
  breakdownA.promptTokens.anthropic.cached += update.promptTokens.anthropic.cached;
  breakdownA.promptTokens.anthropic.uncached += update.promptTokens.anthropic.uncached;
  breakdownA.promptTokens.openai.cached += update.promptTokens.openai.cached;
  breakdownA.promptTokens.openai.uncached += update.promptTokens.openai.uncached;
  breakdownA.promptTokens.xai.cached += update.promptTokens.xai.cached;
  breakdownA.promptTokens.xai.uncached += update.promptTokens.xai.uncached;
  breakdownA.promptTokens.google.cached += update.promptTokens.google.cached;
}
