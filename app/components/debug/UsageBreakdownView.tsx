import type { Message } from 'ai';

import { useEffect } from 'react';

import { useState } from 'react';
import { JsonView } from 'react-json-view-lite';
import { type Usage } from '~/lib/.server/validators';
import { calculateTotalUsageForMessage, calculateChefTokens } from '~/lib/common/usage';
import { decompressWithLz4 } from '~/lib/compression.client';

type DebugUsageData = {
  chatTotalRawUsage: Usage;
  chatTotalUsageBilledFor: Usage;
  chatTotalChefTokens: number;
  usagePerMessage: Array<{
    messageIdx: number;
    rawUsage: Usage;
    billedUsage: Usage;
    chefTokens: number;
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
    if (!messages) {
      return;
    }
    getUsageBreakdown(messages).then(setUsageData);
  }, [messages]);

  if (!usageData) {
    return <div>Loading...</div>;
  }

  return (
    <div>
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
  const usagePerMessage: Array<{
    messageIdx: number;
    rawUsage: Usage;
    billedUsage: Usage;
    chefTokens: number;
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
    const chefTokens = calculateChefTokens(totalUsageBilledFor);
    usagePerMessage.push({
      messageIdx: idx,
      rawUsage: totalRawUsage,
      billedUsage: totalUsageBilledFor,
      chefTokens,
    });
    addUsage(chatTotalRawUsage, totalRawUsage);
    addUsage(chatTotalUsageBilledFor, totalUsageBilledFor);
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
