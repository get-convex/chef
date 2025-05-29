import {
  createDataStream,
  streamText,
  type CoreAssistantMessage,
  type CoreMessage,
  type CoreToolMessage,
  type DataStreamWriter,
  type LanguageModelUsage,
  type Message,
  type ProviderMetadata,
  type StepResult,
} from 'ai';
import { ROLE_SYSTEM_PROMPT, generalSystemPrompt } from 'chef-agent/prompts/system';
import { deployTool } from 'chef-agent/tools/deploy';
import { viewTool } from 'chef-agent/tools/view';
import type { ConvexToolSet } from '~/lib/common/types';
import { npmInstallTool } from 'chef-agent/tools/npmInstall';
import type { Tracer } from '~/lib/.server/chat';
import { editTool } from 'chef-agent/tools/edit';
import { captureException, captureMessage } from '@sentry/remix';
import type { SystemPromptOptions } from 'chef-agent/types';
import { cleanupAssistantMessages } from 'chef-agent/cleanupAssistantMessages';
import { logger } from 'chef-agent/utils/logger';
import { encodeUsageAnnotation, encodeModelAnnotation } from '~/lib/.server/usage';
import { compressWithLz4Server } from '~/lib/compression.server';
import { getConvexSiteUrl } from '~/lib/convexSiteUrl';
import { REPEATED_ERROR_REASON } from '~/lib/common/annotations';
import { waitUntil } from '@vercel/functions';
import type { internal } from '@convex/_generated/api';
import type { Usage } from '~/lib/common/annotations';
import type { UsageRecord } from '@convex/schema';
import { getProvider, type ModelProvider } from '~/lib/.server/llm/provider';
import { getEnv } from '~/lib/.server/env';
import { calculateChefTokens, usageFromGeneration } from '~/lib/common/usage';
import { lookupDocsTool } from 'chef-agent/tools/lookupDocs';

type Messages = Message[];

export async function convexAgent(args: {
  chatInitialId: string;
  firstUserMessage: boolean;
  messages: Messages;
  tracer: Tracer | null;
  modelProvider: ModelProvider;
  modelChoice: string | undefined;
  userApiKey: string | undefined;
  shouldDisableTools: boolean;
  recordUsageCb: (
    lastMessage: Message | undefined,
    finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
  ) => Promise<void>;
  recordRawPromptsForDebugging: boolean;
  collapsedMessages: boolean;
  featureFlags: {
    enablePreciseEdits: boolean;
    smallFiles: boolean;
  };
}) {
  const {
    chatInitialId,
    firstUserMessage,
    messages,
    tracer,
    modelProvider,
    userApiKey,
    modelChoice,
    shouldDisableTools,
    recordUsageCb,
    recordRawPromptsForDebugging,
    collapsedMessages,
    featureFlags,
  } = args;
  console.debug('Starting agent with model provider', modelProvider);
  if (userApiKey) {
    console.debug('Using user provided API key');
  }

  const startTime = Date.now();
  let firstResponseTime: number | null = null;

  const provider = getProvider(userApiKey, modelProvider, modelChoice);
  const opts: SystemPromptOptions = {
    enableBulkEdits: true,
    enablePreciseEdits: featureFlags.enablePreciseEdits,
    includeTemplate: true,
    openaiProxyEnabled: getEnv('OPENAI_PROXY_ENABLED') == '1',
    usingOpenAi: modelProvider == 'OpenAI',
    usingGoogle: modelProvider == 'Google',
    resendProxyEnabled: getEnv('RESEND_PROXY_ENABLED') == '1',
    smallFiles: featureFlags.smallFiles,
  };
  const tools: ConvexToolSet = {
    deploy: deployTool,
    npmInstall: npmInstallTool,
    lookupDocs: lookupDocsTool,
  };
  if (opts.enablePreciseEdits) {
    tools.view = viewTool;
    tools.edit = editTool;
  }

  const messagesForDataStream: CoreMessage[] = [
    {
      role: 'system' as const,
      content: ROLE_SYSTEM_PROMPT,
    },
    {
      role: 'system' as const,
      content: generalSystemPrompt(opts),
    },
    ...cleanupAssistantMessages(messages),
  ];

  const dataStream = createDataStream({
    execute(dataStream) {
      const result = streamText({
        model: provider.model,
        maxTokens: provider.maxTokens,
        providerOptions: provider.options,
        messages: messagesForDataStream,
        tools,
        toolChoice: shouldDisableTools ? 'none' : 'auto',
        onFinish: (result) => {
          onFinishHandler({
            dataStream,
            messages,
            result,
            tracer,
            chatInitialId,
            recordUsageCb,
            toolsDisabledFromRepeatedErrors: shouldDisableTools,
            recordRawPromptsForDebugging,
            coreMessages: messagesForDataStream,
            modelProvider,
            modelChoice,
            collapsedMessages,
            _startTime: startTime,
            _firstResponseTime: firstResponseTime,
            providerModel: provider.model.modelId,
            featureFlags,
          });
        },
        onError({ error }) {
          console.error(error);
        },
        experimental_telemetry: {
          isEnabled: true,
          metadata: {
            firstUserMessage,
            chatInitialId,
            provider: modelProvider,
          },
        },
      });

      // Track first response time
      (async () => {
        try {
          for await (const _ of result.textStream) {
            if (firstResponseTime === null) {
              firstResponseTime = Date.now();
              const timeToFirstResponse = firstResponseTime - startTime;
              if (tracer) {
                const span = tracer.startSpan('first-response');
                span.setAttribute('chatInitialId', chatInitialId);
                span.setAttribute('timeToFirstResponse', timeToFirstResponse);
                span.setAttribute('provider', modelProvider);
                span.end();
              }
              console.log('First response metrics:', {
                timeToFirstResponse: `${timeToFirstResponse}ms`,
                provider: modelProvider,
                chatInitialId,
              });
              break;
            }
          }
        } catch (error) {
          console.error('Error tracking first response time:', error);
        }
      })();

      result.mergeIntoDataStream(dataStream);
    },
    onError(error: any) {
      return error.message;
    },
  });
  return dataStream;
}

async function onFinishHandler({
  dataStream,
  messages,
  result,
  tracer,
  chatInitialId,
  recordUsageCb,
  toolsDisabledFromRepeatedErrors,
  recordRawPromptsForDebugging,
  coreMessages,
  modelProvider,
  modelChoice,
  collapsedMessages,
  _startTime,
  _firstResponseTime,
  providerModel,
  featureFlags,
}: {
  dataStream: DataStreamWriter;
  messages: Messages;
  result: Omit<StepResult<any>, 'stepType' | 'isContinued'>;
  tracer: Tracer | null;
  chatInitialId: string;
  recordUsageCb: (
    lastMessage: Message | undefined,
    finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
  ) => Promise<void>;
  recordRawPromptsForDebugging: boolean;
  toolsDisabledFromRepeatedErrors: boolean;
  coreMessages: CoreMessage[];
  modelProvider: ModelProvider;
  modelChoice: string | undefined;
  collapsedMessages: boolean;
  _startTime: number;
  _firstResponseTime: number | null;
  providerModel: string;
  featureFlags: {
    enablePreciseEdits: boolean;
    smallFiles: boolean;
  };
}) {
  const { providerMetadata } = result;
  // This usage accumulates accross multiple /api/chat calls until finishReason of 'stop'.
  const usage = {
    completionTokens: normalizeUsage(result.usage.completionTokens),
    promptTokens: normalizeUsage(result.usage.promptTokens),
    totalTokens: normalizeUsage(result.usage.totalTokens),
  };
  console.log('Finished streaming', {
    finishReason: result.finishReason,
    usage,
    providerMetadata,
  });
  if (tracer) {
    const span = tracer.startSpan('on-finish-handler');
    span.setAttribute('chatInitialId', chatInitialId);
    span.setAttribute('finishReason', result.finishReason);
    span.setAttribute('usage.completionTokens', usage.completionTokens);
    span.setAttribute('usage.promptTokens', usage.promptTokens);
    span.setAttribute('usage.totalTokens', usage.totalTokens);
    span.setAttribute('featureFlags.smallFiles', featureFlags.smallFiles);
    span.setAttribute('featureFlags.enablePreciseEdits', featureFlags.enablePreciseEdits);
    span.setAttribute('collapsedMessages', collapsedMessages);
    span.setAttribute('model', providerModel);
    if (providerMetadata) {
      if (providerMetadata.anthropic) {
        const anthropic: any = providerMetadata.anthropic;
        span.setAttribute('providerMetadata.anthropic.cacheCreationInputTokens', anthropic.cacheCreationInputTokens);
        span.setAttribute('providerMetadata.anthropic.cacheReadInputTokens', anthropic.cacheReadInputTokens);
      }
      if (providerMetadata.google) {
        const google: any = providerMetadata.google;
        span.setAttribute('providerMetadata.google.cachedContentTokenCount', google.cachedContentTokenCount ?? 0);
      }
      if (providerMetadata.openai) {
        const openai: any = providerMetadata.openai;
        span.setAttribute('providerMetadata.openai.cachedPromptTokens', openai.cachedPromptTokens ?? 0);
      }
    }
    if (result.finishReason === 'stop' || result.finishReason === 'unknown') {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        // This field is deprecated, but for some reason, the new field "parts", does not contain all of the tool calls. This is likely a
        // vercel bug. We do this at the end end the request because it's when we have the results from all of the tool calls.
        const toolCalls = lastMessage.toolInvocations?.filter((t) => t.toolName === 'deploy' && t.state === 'result');
        const successfulDeploys =
          toolCalls?.filter((t) => t.state === 'result' && !t.result.startsWith('Error:')).length ?? 0;
        span.setAttribute('tools.successfulDeploys', successfulDeploys);
        span.setAttribute('tools.failedDeploys', toolCalls ? toolCalls.length - successfulDeploys : 0);
      }
      span.setAttribute('tools.disabledFromRepeatedErrors', toolsDisabledFromRepeatedErrors ? 'true' : 'false');
    }
    span.end();
  }

  if (toolsDisabledFromRepeatedErrors) {
    dataStream.writeMessageAnnotation({ type: 'failure', reason: REPEATED_ERROR_REASON });
  }

  let toolCallId: { kind: 'tool-call'; toolCallId: string } | { kind: 'final' } | undefined;
  // Always stash this part's usage as an annotation -- these are used for
  // displaying usage info in the UI as well as calculating usage when the message
  // finishes.
  if (result.finishReason === 'tool-calls') {
    if (result.toolCalls.length === 1) {
      toolCallId = { kind: 'tool-call', toolCallId: result.toolCalls[0].toolCallId };
    } else {
      logger.warn('Stopped with not exactly one tool call', {
        toolCalls: result.toolCalls,
      });
    }
  } else if (result.finishReason === 'stop') {
    toolCallId = { kind: 'final' };
  }
  if (toolCallId) {
    const annotation = encodeUsageAnnotation(toolCallId, usage, providerMetadata);
    dataStream.writeMessageAnnotation({ type: 'usage', usage: annotation });
    const modelAnnotation = encodeModelAnnotation(toolCallId, providerMetadata, modelChoice);
    dataStream.writeMessageAnnotation({ type: 'model', ...modelAnnotation });
  }

  // Record usage once we've generated the final part.
  if (result.finishReason === 'stop') {
    await recordUsageCb(messages[messages.length - 1], { usage, providerMetadata });
  }
  if (recordRawPromptsForDebugging) {
    const responseCoreMessages = result.response.messages as (CoreAssistantMessage | CoreToolMessage)[];
    // don't block the request but keep the request alive in Vercel Lambdas
    waitUntil(
      storeDebugPrompt(
        coreMessages,
        chatInitialId,
        responseCoreMessages,
        result,
        {
          usage,
          providerMetadata,
        },
        modelProvider,
      ),
    );
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/* Convert Usage into something stable to store in Convex debug logs */
function buildUsageRecord(usage: Usage): UsageRecord {
  const usageRecord = {
    completionTokens: 0,
    promptTokens: 0,
    cachedPromptTokens: 0,
  };

  for (const k of Object.keys(usage) as Array<keyof Usage>) {
    switch (k) {
      case 'completionTokens': {
        usageRecord.completionTokens += usage.completionTokens;
        break;
      }
      case 'promptTokens': {
        usageRecord.promptTokens += usage.promptTokens;
        break;
      }
      case 'xaiCachedPromptTokens': {
        usageRecord.cachedPromptTokens += usage.xaiCachedPromptTokens;
        usageRecord.promptTokens += usage.xaiCachedPromptTokens;
        break;
      }
      case 'openaiCachedPromptTokens': {
        usageRecord.cachedPromptTokens += usage.openaiCachedPromptTokens;
        break;
      }
      case 'anthropicCacheReadInputTokens': {
        usageRecord.cachedPromptTokens += usage.anthropicCacheReadInputTokens;
        usageRecord.promptTokens += usage.anthropicCacheReadInputTokens;
        break;
      }
      case 'anthropicCacheCreationInputTokens': {
        usageRecord.promptTokens += usage.anthropicCacheCreationInputTokens;
        break;
      }
      case 'googleCachedContentTokenCount': {
        usageRecord.cachedPromptTokens += usage.googleCachedContentTokenCount;
        break;
      }
      case 'toolCallId':
      case 'providerMetadata':
      case 'totalTokens': {
        break;
      }
      default: {
        const exhaustiveCheck: never = k;
        throw new Error(`Unhandled property: ${String(exhaustiveCheck)}`);
      }
    }
  }

  return usageRecord;
}

async function storeDebugPrompt(
  promptCoreMessages: CoreMessage[],
  chatInitialId: string,
  responseCoreMessages: CoreMessage[],
  result: Omit<StepResult<any>, 'stepType' | 'isContinued'>,
  generation: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
  modelProvider: ModelProvider,
) {
  try {
    const finishReason = result.finishReason;
    const modelId = result.response.modelId || '';
    const usage = usageFromGeneration(generation);

    const promptMessageData = new TextEncoder().encode(JSON.stringify(promptCoreMessages));
    const compressedData = compressWithLz4Server(promptMessageData);

    type Metadata = Omit<(typeof internal.debugPrompt.storeDebugPrompt)['_args'], 'promptCoreMessagesStorageId'>;
    const { chefTokens } = calculateChefTokens(usage, modelProvider);

    const metadata = {
      chatInitialId,
      responseCoreMessages,
      finishReason,
      modelId,
      usage: buildUsageRecord(usage),
      chefTokens,
    } satisfies Metadata;

    const formData = new FormData();
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('promptCoreMessages', new Blob([compressedData]));

    const response = await fetch(`${getConvexSiteUrl()}/upload_debug_prompt`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      const message = `Failed to store debug prompt: ${response.status} ${text}`;
      console.error(message);
      captureMessage(message);
    }
  } catch (error) {
    console.error(error);
    captureException(error);
  }
}

function normalizeUsage(usage: number) {
  return Number.isNaN(usage) ? 0 : usage;
}
