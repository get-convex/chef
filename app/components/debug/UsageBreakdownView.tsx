import type { Message } from 'ai';

import { useEffect } from 'react';

import { useState } from 'react';
import { JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, type ChartOptions } from 'chart.js';
import { type Usage } from '~/lib/common/annotations';
import { calculateTotalUsageForMessage, calculateChefTokens } from '~/lib/common/usage';
import { decompressWithLz4 } from '~/lib/compression.client';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
// Register Chart.js components - needs to include ALL required elements
ChartJS.register(ArcElement, Tooltip, Legend);

// Utility function to format large numbers
function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(2)}M`;
  } else if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  return num.toString();
}

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
    chefBreakdown: ChefBreakdown;
  }>;
};

const chartOptions: ChartOptions<'pie'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    tooltip: {
      callbacks: {
        label: function (context) {
          const label = context.label || '';
          const value = context.raw as number;
          const total = (context.dataset.data as number[]).reduce((a, b) => a + b, 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return `${label}: ${formatNumber(value)} (${percentage}%)`;
        },
      },
    },
    legend: {
      display: false,
    },
  },
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
      <h1>Total Usage</h1>
      <BreakdownView
        rawUsage={usageData.chatTotalRawUsage}
        billedUsage={usageData.chatTotalUsageBilledFor}
        chefTokens={usageData.chatTotalChefTokens}
        chefBreakdown={usageData.chatTotalChefBreakdown}
        title="Total Usage"
        startOpen={true}
      />
      <div>
        <h2>Per Message</h2>
        {usageData?.usagePerMessage.map((usage) => (
          <CollapsibleView
            title={`Message ${usage.messageIdx} -- ${formatNumber(usage.chefTokens)} chef tokens`}
            key={usage.messageIdx.toString()}
          >
            <BreakdownView
              rawUsage={usage.rawUsage}
              billedUsage={usage.billedUsage}
              chefTokens={usage.chefTokens}
              chefBreakdown={usage.chefBreakdown}
            />
          </CollapsibleView>
        ))}
      </div>
    </div>
  );
}

const renderPieChart = (data: Record<string, number>, title: string) => {
  const chartData = {
    labels: Object.keys(data),
    datasets: [
      {
        data: Object.values(data),
        backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF'],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="w-64 h-64 relative">
      <Pie data={chartData} options={chartOptions} />
    </div>
  );
};

function BreakdownView({
  rawUsage,
  billedUsage,
  chefTokens,
  chefBreakdown,
  title,
  startOpen = false,
}: {
  rawUsage: Usage;
  billedUsage: Usage;
  chefTokens: number;
  chefBreakdown: ChefBreakdown;
  title?: string;
  startOpen?: boolean;
}) {
  const tokensData = {
    'Prompt - Anthropic (Uncached)': chefBreakdown.promptTokens.anthropic.uncached,
    'Prompt - Anthropic (Cached)': chefBreakdown.promptTokens.anthropic.cached,
    'Prompt - OpenAI (Uncached)': chefBreakdown.promptTokens.openai.uncached,
    'Prompt - OpenAI (Cached)': chefBreakdown.promptTokens.openai.cached,
    'Prompt - XAI (Uncached)': chefBreakdown.promptTokens.xai.uncached,
    'Prompt - XAI (Cached)': chefBreakdown.promptTokens.xai.cached,
    'Prompt - Google (Uncached)': chefBreakdown.promptTokens.google.uncached,
    'Prompt - Google (Cached)': chefBreakdown.promptTokens.google.cached,
    'Completion - Anthropic': chefBreakdown.completionTokens.anthropic,
    'Completion - OpenAI': chefBreakdown.completionTokens.openai,
    'Completion - XAI': chefBreakdown.completionTokens.xai,
  };
  return (
    <div>
      {title && <h4>{title}</h4>}
      <div>
        <CollapsibleView title="Raw Usage" startOpen={startOpen}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p>Completion Tokens: {formatNumber(rawUsage.completionTokens)}</p>
              <p>Prompt Tokens: {formatNumber(rawUsage.promptTokens)}</p>
              <p>Total Tokens: {formatNumber(rawUsage.totalTokens)}</p>
            </div>
            <div>
              <JsonView data={rawUsage} shouldExpandNode={(level, value) => level < 1} />
            </div>
          </div>
        </CollapsibleView>
        <CollapsibleView title="Billed Usage" startOpen={startOpen}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p>Completion Tokens: {formatNumber(billedUsage.completionTokens)}</p>
              <p>Prompt Tokens: {formatNumber(billedUsage.promptTokens)}</p>
              <p>Total Tokens: {formatNumber(billedUsage.totalTokens)}</p>
            </div>
            <div>
              <JsonView data={billedUsage} shouldExpandNode={(level, value) => level < 1} />
            </div>
          </div>
        </CollapsibleView>

        <CollapsibleView title="Chef Breakdown" startOpen={startOpen}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <p className="text-2xl font-bold">{formatNumber(chefTokens)}</p>
              <div className="flex flex-wrap gap-8">{renderPieChart(tokensData, 'Chef Tokens')}</div>
            </div>
            <div>
              <JsonView data={chefBreakdown} shouldExpandNode={(level, value) => level < 1} />
            </div>
          </div>
        </CollapsibleView>
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
    chefBreakdown: ChefBreakdown;
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
      chefBreakdown: breakdown,
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

function CollapsibleView({
  children,
  title,
  startOpen = false,
}: {
  children: React.ReactNode;
  title: string;
  startOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(startOpen);
  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2">
        {isOpen ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />} {title}
      </button>
      {isOpen && children}
    </div>
  );
}
