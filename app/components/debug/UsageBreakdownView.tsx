import type { Message } from 'ai';

import { useEffect } from 'react';

import { useState } from 'react';
import { JsonView } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, type ChartOptions } from 'chart.js';
import { parseAnnotations, type ProviderType, type Usage, type UsageAnnotation } from '~/lib/common/annotations';
import {
  calculateChefTokens,
  getFailedToolCalls,
  calculateTotalUsage,
  initializeUsage,
  usageFromGeneration,
} from '~/lib/common/usage';
import { decompressWithLz4 } from '~/lib/compression.client';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { getConvexAuthToken } from '~/lib/stores/sessionId';
import { useConvex } from 'convex/react';
import { setChefDebugProperty } from 'chef-agent/utils/chefDebug';
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
    parts: {
      partIdx: number;
      partType: string;
      partText: string;
      usageInfo: {
        rawUsage: Usage;
        billedUsage: Usage;
        chefTokens: number;
        chefBreakdown: ChefBreakdown;
      } | null;
    }[];
    messageSummaryInfo: { numParts: number; numToolInvocations: number; numFailedToolInvocations: number };
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
        label: (context) => {
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

export function UsageBreakdownView({
  chatInitialId,
  convexSiteUrl,
  fileContent,
}: {
  chatInitialId: string | null;
  fileContent: Blob | null;
  convexSiteUrl: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [usageData, setUsageData] = useState<DebugUsageData | null>(null);
  const convex = useConvex();
  useEffect(() => {
    if (fileContent !== null) {
      async function parseFileContent(blob: Blob) {
        const decompressed = decompressWithLz4(new Uint8Array(await blob.arrayBuffer()));
        const messages = JSON.parse(new TextDecoder().decode(decompressed));
        setMessages(messages);
        setChefDebugProperty('messages', messages);
      }
      void parseFileContent(fileContent);
    } else {
      const fetchUsageData = async () => {
        const authToken = await getConvexAuthToken(convex);
        const response = await fetch(`${convexSiteUrl}/__debug/download_messages`, {
          method: 'POST',
          body: JSON.stringify({ chatUuid: chatInitialId }),
          headers: {
            Authorization: `Bearer ${authToken}`,
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
        setChefDebugProperty('messages', messages);
      };
      void fetchUsageData();
    }
  }, [chatInitialId, fileContent, convexSiteUrl, convex]);

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
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
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
            <div className="ml-4">
              <p>
                {usage.messageSummaryInfo.numParts} parts, {usage.messageSummaryInfo.numToolInvocations} tool
                invocations, {usage.messageSummaryInfo.numFailedToolInvocations} failed tool invocations
              </p>
              <BreakdownView
                rawUsage={usage.rawUsage}
                billedUsage={usage.billedUsage}
                chefTokens={usage.chefTokens}
                chefBreakdown={usage.chefBreakdown}
              />
              <CollapsibleView title="Parts" startOpen={false}>
                <div className="ml-4 flex flex-col gap-4">
                  {usage.parts.map((part, idx) => (
                    <div className="flex flex-col gap-4" key={idx}>
                      <CollapsibleView
                        title={`Part ${idx} -- Chef Tokens: ${formatNumber(part.usageInfo?.chefTokens ?? 0)}`}
                        startOpen={false}
                      >
                        <div className="ml-4 flex flex-col gap-4">
                          <CollapsibleView title={`Content`} startOpen={false}>
                            <p className="whitespace-pre-wrap border-b border-gray-500 pb-4" key={idx}>
                              {part.partText}
                            </p>
                          </CollapsibleView>
                          {part.usageInfo ? (
                            <BreakdownView
                              rawUsage={part.usageInfo.rawUsage}
                              billedUsage={part.usageInfo.billedUsage}
                              chefTokens={part.usageInfo.chefTokens}
                              chefBreakdown={part.usageInfo.chefBreakdown}
                            />
                          ) : (
                            <p>No usage info</p>
                          )}
                        </div>
                      </CollapsibleView>
                    </div>
                  ))}
                </div>
              </CollapsibleView>
            </div>
          </CollapsibleView>
        ))}
      </div>
    </div>
  );
}

const renderPieChart = (data: Record<string, number>) => {
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
    <div className="relative size-64">
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
    'Completion - Google': chefBreakdown.completionTokens.google,
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
              <JsonView data={rawUsage} shouldExpandNode={(level) => level < 1} />
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
              <JsonView data={billedUsage} shouldExpandNode={(level) => level < 1} />
            </div>
          </div>
        </CollapsibleView>

        <CollapsibleView title="Chef Breakdown" startOpen={true}>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <p className="text-2xl font-bold">{formatNumber(chefTokens)}</p>
              <div className="flex flex-wrap gap-8">{renderPieChart(tokensData)}</div>
            </div>
            <div>
              <JsonView data={chefBreakdown} shouldExpandNode={(level) => level < 1} />
            </div>
          </div>
        </CollapsibleView>
      </div>
    </div>
  );
}
async function getUsageBreakdown(messages: Message[]) {
  const chatTotalRawUsage = {
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
  const chatTotalUsageBilledFor = {
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
  let chatTotalChefTokens = 0;
  const chatTotalChefBreakdown: ChefBreakdown = {
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
  const usagePerMessage: Array<{
    messageIdx: number;
    parts: {
      partIdx: number;
      partType: string;
      partText: string;
      usageInfo: {
        rawUsage: Usage;
        billedUsage: Usage;
        chefTokens: number;
        chefBreakdown: ChefBreakdown;
      } | null;
    }[];
    messageSummaryInfo: { numParts: number; numToolInvocations: number; numFailedToolInvocations: number };
    rawUsage: Usage;
    billedUsage: Usage;
    chefTokens: number;
    chefBreakdown: ChefBreakdown;
  }> = [];

  for (const [idx, message] of messages.entries()) {
    if (message.role !== 'assistant') {
      continue;
    }
    const parsedAnnotations = parseAnnotations(message.annotations);
    const failedToolCalls = getFailedToolCalls(message);
    const { totalRawUsage, totalUsageBilledFor } = await calculateTotalUsage({
      startUsage: null,
      usageAnnotationsForToolCalls: parsedAnnotations.usageForToolCall,
    });
    const provider = parsedAnnotations.modelForToolCall.final?.provider ?? 'Anthropic';
    const { chefTokens, breakdown } = calculateChefTokens(totalUsageBilledFor, provider);
    usagePerMessage.push({
      messageIdx: idx,
      parts: getPartInfos({
        message,
        usageAnnotationsForToolCalls: parsedAnnotations.usageForToolCall,
        providerAnnotationsForToolCalls: parsedAnnotations.modelForToolCall,
      }),
      rawUsage: totalRawUsage,
      billedUsage: totalUsageBilledFor,
      chefTokens,
      chefBreakdown: breakdown,
      messageSummaryInfo: {
        numParts: message.parts?.length ?? 0,
        numToolInvocations: message.parts?.filter((p) => p.type === 'tool-invocation').length ?? 0,
        numFailedToolInvocations: failedToolCalls.size,
      },
    });
    addUsage(chatTotalRawUsage, totalRawUsage);
    addUsage(chatTotalUsageBilledFor, totalUsageBilledFor);
    addBreakdown(chatTotalChefBreakdown, breakdown);
    chatTotalChefTokens += chefTokens;
  }
  return {
    chatTotalRawUsage,
    chatTotalUsageBilledFor,
    chatTotalChefTokens,
    chatTotalChefBreakdown,
    usagePerMessage,
  };
}

function getPartInfos({
  message,
  usageAnnotationsForToolCalls,
  providerAnnotationsForToolCalls,
}: {
  message: Message;
  usageAnnotationsForToolCalls: Record<string, UsageAnnotation | null>;
  providerAnnotationsForToolCalls: Record<string, { provider: ProviderType; model: string | undefined }>;
}) {
  const partInfos: Array<{
    partIdx: number;
    partType: string;
    partText: string;
    usageInfo: {
      rawUsage: Usage;
      billedUsage: Usage;
      chefTokens: number;
      chefBreakdown: ChefBreakdown;
    } | null;
  }> = [];
  for (const [idx, part] of message.parts?.entries() ?? []) {
    if (part.type === 'text') {
      partInfos.push({
        partIdx: idx,
        partType: 'text',
        partText: part.text,
        usageInfo: null,
      });
    } else if (part.type === 'tool-invocation') {
      const provider = providerAnnotationsForToolCalls[part.toolInvocation.toolCallId]?.provider ?? 'Anthropic';
      const rawUsageForPart = usageAnnotationsForToolCalls[part.toolInvocation.toolCallId]
        ? usageFromGeneration({
            usage: usageAnnotationsForToolCalls[part.toolInvocation.toolCallId]!,
            providerMetadata: usageAnnotationsForToolCalls[part.toolInvocation.toolCallId]?.providerMetadata,
          })
        : initializeUsage();
      const billedUsageForPart = rawUsageForPart;
      const { chefTokens, breakdown } = calculateChefTokens(billedUsageForPart, provider);
      partInfos.push({
        partIdx: idx,
        partType: 'tool-invocation',
        partText: `Tool invocation: ${part.toolInvocation.toolName} (${part.toolInvocation.toolCallId})\n\n${part.toolInvocation.state === 'result' ? part.toolInvocation.result : '(incomplete call)'}`,
        usageInfo: {
          rawUsage: rawUsageForPart,
          billedUsage: billedUsageForPart,
          chefTokens,
          chefBreakdown: breakdown,
        },
      });
    }
  }
  const finalUsage = usageFromGeneration({
    usage: usageAnnotationsForToolCalls.final ?? initializeUsage(),
    providerMetadata: usageAnnotationsForToolCalls.final?.providerMetadata ?? undefined,
  });
  const provider = providerAnnotationsForToolCalls.final?.provider ?? 'Anthropic';
  const { chefTokens, breakdown } = calculateChefTokens(finalUsage, provider);
  partInfos.push({
    partIdx: message.parts?.length ?? 0,
    partType: 'final',
    partText: 'Final usage',
    usageInfo: {
      rawUsage: finalUsage,
      billedUsage: finalUsage,
      chefTokens,
      chefBreakdown: breakdown,
    },
  });
  return partInfos;
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
    google: number;
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
  breakdownA.completionTokens.google += update.completionTokens.google;
  breakdownA.promptTokens.anthropic.cached += update.promptTokens.anthropic.cached;
  breakdownA.promptTokens.anthropic.uncached += update.promptTokens.anthropic.uncached;
  breakdownA.promptTokens.openai.cached += update.promptTokens.openai.cached;
  breakdownA.promptTokens.openai.uncached += update.promptTokens.openai.uncached;
  breakdownA.promptTokens.xai.cached += update.promptTokens.xai.cached;
  breakdownA.promptTokens.xai.uncached += update.promptTokens.xai.uncached;
  breakdownA.promptTokens.google.cached += update.promptTokens.google.cached;
  breakdownA.promptTokens.google.uncached += update.promptTokens.google.uncached;
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
        {isOpen ? <ChevronDownIcon className="size-4" /> : <ChevronRightIcon className="size-4" />} {title}
      </button>
      <div className="ml-4 border-l border-gray-500 pl-4">{isOpen && children}</div>
    </div>
  );
}
