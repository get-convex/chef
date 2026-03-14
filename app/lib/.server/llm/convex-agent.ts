import {
  createUIMessageStream,
  streamText,
  type AssistantModelMessage,
  type ModelMessage,
  type ToolModelMessage,
  type UIMessageStreamWriter,
  type LanguageModelUsage,
  type UIMessage,
  type ProviderMetadata,
  type StepResult,
} from 'ai';
import { ROLE_SYSTEM_PROMPT, generalSystemPrompt } from 'chef-agent/prompts/system';
import { deployTool } from 'chef-agent/tools/deploy';
import { viewTool } from 'chef-agent/tools/view';
import type { ConvexToolSet } from 'chef-agent/types';
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
import { addEnvironmentVariablesTool } from 'chef-agent/tools/addEnvironmentVariables';
import { getConvexDeploymentNameTool } from 'chef-agent/tools/getConvexDeploymentName';
import type { PromptCharacterCounts } from 'chef-agent/ChatContextManager';

type Messages = UIMessage[];

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
    lastMessage: UIMessage | undefined,
    finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
  ) => Promise<void>;
  recordRawPromptsForDebugging: boolean;
  collapsedMessages: boolean;
  promptCharacterCounts?: PromptCharacterCounts;
  featureFlags: {
    enableResend: boolean;
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
    promptCharacterCounts,
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
    includeTemplate: true,
    openaiProxyEnabled: getEnv('OPENAI_PROXY_ENABLED') == '1',
    usingOpenAi: modelProvider == 'OpenAI',
    usingGoogle: modelProvider == 'Google',
    resendProxyEnabled: getEnv('RESEND_PROXY_ENABLED') == '1',
    enableResend: featureFlags.enableResend,
  };
  const tools: ConvexToolSet = {
    deploy: deployTool,
    npmInstall: npmInstallTool,
    lookupDocs: lookupDocsTool(),
    getConvexDeploymentName: getConvexDeploymentNameTool,
    addEnvironmentVariables: addEnvironmentVariablesTool(),
    view: viewTool,
    edit: editTool,
  } as any;

  const messagesForStream: ModelMessage[] = [
    {
      role: 'system' as const,
      content: ROLE_SYSTEM_PROMPT,
    },
    {
      role: 'system' as const,
      content: generalSystemPrompt(opts),
    },
    ...(await cleanupAssistantMessages(messages)),
  ];

  if (modelProvider === 'Bedrock') {
    messagesForStream[messagesForStream.length - 1].providerOptions = {
      bedrock: {
        cachePoint: {
          type: 'default',
        },
      },
    };
  }

  if (modelProvider === 'Anthropic') {
    messagesForStream[messagesForStream.length - 1].providerOptions = {
      anthropic: {
        cacheControl: {
          type: 'ephemeral',
        },
      },
    };
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const result = streamText({
        model: provider.model,
        maxOutputTokens: provider.maxTokens,
        providerOptions: provider.options,
        messages: messagesForStream,
        tools,
        toolChoice: shouldDisableTools ? 'none' : 'auto',
        onFinish: (result) => {
          onFinishHandler({
            writer,
            messages,
            result,
            tracer,
            chatInitialId,
            recordUsageCb,
            toolsDisabledFromRepeatedErrors: shouldDisableTools,
            recordRawPromptsForDebugging,
            modelMessages: messagesForStream,
            modelProvider,
            modelChoice,
            collapsedMessages,
            promptCharacterCounts,
            _startTime: startTime,
            _firstResponseTime: firstResponseTime,
            providerModel: typeof provider.model === 'string' ? provider.model : provider.model.modelId,
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

      writer.merge(result.toUIMessageStream());
    },
    onError(error: unknown) {
      return error instanceof Error ? error.message : String(error);
    },
  });
  return stream;
}

async function onFinishHandler({
  writer,
  messages,
  result,
  tracer,
  chatInitialId,
  recordUsageCb,
  toolsDisabledFromRepeatedErrors,
  recordRawPromptsForDebugging,
  modelMessages,
  modelProvider,
  modelChoice,
  collapsedMessages,
  promptCharacterCounts,
  _startTime,
  _firstResponseTime,
  providerModel,
}: {
  writer: UIMessageStreamWriter;
  messages: Messages;
  result: StepResult<any>;
  tracer: Tracer | null;
  chatInitialId: string;
  recordUsageCb: (
    lastMessage: UIMessage | undefined,
    finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
  ) => Promise<void>;
  recordRawPromptsForDebugging: boolean;
  toolsDisabledFromRepeatedErrors: boolean;
  modelMessages: ModelMessage[];
  modelProvider: ModelProvider;
  modelChoice: string | undefined;
  collapsedMessages: boolean;
  promptCharacterCounts?: PromptCharacterCounts;
  _startTime: number;
  _firstResponseTime: number | null;
  providerModel: string;
}) {
  const { providerMetadata } = result;
  // This usage accumulates accross multiple /api/chat calls until finishReason of 'stop'.
  const usage: LanguageModelUsage = {
    inputTokens: normalizeUsage(result.usage.inputTokens),
    inputTokenDetails: result.usage.inputTokenDetails,
    outputTokens: normalizeUsage(result.usage.outputTokens),
    outputTokenDetails: result.usage.outputTokenDetails,
    totalTokens: normalizeUsage(result.usage.totalTokens),
  };
  console.log('Finished streaming', {
    finishReason: result.finishReason,
    usage,
    providerMetadata,
  });
  console.log('Prompt character counts', promptCharacterCounts);
  if (tracer) {
    const span = tracer.startSpan('on-finish-handler');
    span.setAttribute('chatInitialId', chatInitialId);
    span.setAttribute('finishReason', result.finishReason);
    span.setAttribute('usage.outputTokens', usage.outputTokens ?? 0);
    span.setAttribute('usage.inputTokens', usage.inputTokens ?? 0);
    span.setAttribute('usage.totalTokens', usage.totalTokens ?? 0);
    span.setAttribute('collapsedMessages', collapsedMessages);
    span.setAttribute('model', providerModel);

    if (promptCharacterCounts) {
      span.setAttribute('promptCharacterCounts.messageHistoryChars', promptCharacterCounts.messageHistoryChars);
      span.setAttribute('promptCharacterCounts.currentTurnChars', promptCharacterCounts.currentTurnChars);
      span.setAttribute('promptCharacterCounts.totalPromptChars', promptCharacterCounts.totalPromptChars);
    }
    if (providerMetadata) {
      if (providerMetadata.anthropic) {
        const anthropic: any = providerMetadata.anthropic;
        span.setAttribute('providerMetadata.anthropic.cacheCreationInputTokens', anthropic.cacheCreationInputTokens);
        span.setAttribute('providerMetadata.anthropic.cacheReadInputTokens', anthropic.cacheReadInputTokens);
      }
      const vertexOrGoogle = providerMetadata.vertex ?? providerMetadata.google;
      if (vertexOrGoogle) {
        const google: any = vertexOrGoogle;
        span.setAttribute('providerMetadata.google.cachedContentTokenCount', google.cachedContentTokenCount ?? 0);
      }
      if (providerMetadata.openai) {
        const openai: any = providerMetadata.openai;
        span.setAttribute('providerMetadata.openai.cachedPromptTokens', openai.cachedPromptTokens ?? 0);
      }
      if (providerMetadata.bedrock) {
        const bedrock: any = providerMetadata.bedrock;
        span.setAttribute(
          'providerMetadata.bedrock.cacheCreationInputTokens',
          bedrock.usage?.cacheCreationInputTokens ?? 0,
        );
        span.setAttribute('providerMetadata.bedrock.cacheReadInputTokens', bedrock.usage?.cacheReadInputTokens ?? 0);
      }
    }
    if (result.finishReason === 'stop' || result.finishReason === 'other') {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        // Count deploy tool calls from parts
        const toolCalls = lastMessage.parts.filter(
          (p: any) =>
            'toolCallId' in p &&
            (p.type === 'tool-deploy' || ('toolName' in p && p.toolName === 'deploy')) &&
            p.state === 'output-available',
        );
        const successfulDeploys = toolCalls.filter(
          (t: any) => t.state === 'output-available' && typeof t.output === 'string' && !t.output.startsWith('Error:'),
        ).length;
        span.setAttribute('tools.successfulDeploys', successfulDeploys);
        span.setAttribute('tools.failedDeploys', toolCalls.length - successfulDeploys);
      }
      span.setAttribute('tools.disabledFromRepeatedErrors', toolsDisabledFromRepeatedErrors ? 'true' : 'false');
    }
    span.end();
  }

  // Write metadata instead of annotations
  if (toolsDisabledFromRepeatedErrors) {
    writer.write({ type: 'message-metadata', metadata: { failure: REPEATED_ERROR_REASON } } as any);
  }

  let toolCallId: { kind: 'tool-call'; toolCallId: string } | { kind: 'final' } | undefined;
  // Always stash this part's usage as metadata -- these are used for
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
  } else {
    toolCallId = { kind: 'final' };
  }
  if (toolCallId) {
    const id = toolCallId.kind === 'tool-call' ? toolCallId.toolCallId : 'final';
    const annotation = encodeUsageAnnotation(toolCallId, usage, providerMetadata);
    writer.write({ type: 'message-metadata', metadata: { [`usage:${id}`]: annotation } } as any);
    const modelAnnotation = encodeModelAnnotation(toolCallId, providerMetadata, modelChoice);
    writer.write({ type: 'message-metadata', metadata: { [`model:${id}`]: modelAnnotation } } as any);
  }

  // Record usage once we've generated the final part.
  if (result.finishReason !== 'tool-calls') {
    await recordUsageCb(messages[messages.length - 1], { usage, providerMetadata });
  }
  if (recordRawPromptsForDebugging) {
    const responseModelMessages = result.response.messages as (AssistantModelMessage | ToolModelMessage)[];
    // don't block the request but keep the request alive in Vercel Lambdas
    waitUntil(
      storeDebugPrompt(
        modelMessages,
        chatInitialId,
        responseModelMessages,
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
      case 'googleThoughtsTokenCount': {
        usageRecord.completionTokens += usage.googleThoughtsTokenCount;
        break;
      }
      case 'bedrockCacheWriteInputTokens': {
        usageRecord.promptTokens += usage.bedrockCacheWriteInputTokens;
        break;
      }
      case 'bedrockCacheReadInputTokens': {
        usageRecord.cachedPromptTokens += usage.bedrockCacheReadInputTokens;
        usageRecord.promptTokens += usage.bedrockCacheReadInputTokens;
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
  promptModelMessages: ModelMessage[],
  chatInitialId: string,
  responseModelMessages: ModelMessage[],
  result: StepResult<any>,
  generation: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
  modelProvider: ModelProvider,
) {
  try {
    const finishReason = result.finishReason;
    const modelId = result.response.modelId || '';
    const usage = usageFromGeneration(generation);

    const promptMessageData = new TextEncoder().encode(JSON.stringify(promptModelMessages));
    const compressedData = compressWithLz4Server(promptMessageData);

    type Metadata = Omit<(typeof internal.debugPrompt.storeDebugPrompt)['_args'], 'promptCoreMessagesStorageId'>;
    const { chefTokens } = calculateChefTokens(usage, modelProvider);

    const metadata = {
      chatInitialId,
      responseCoreMessages: responseModelMessages,
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

function normalizeUsage(usage: number | undefined) {
  return usage == null || Number.isNaN(usage) ? 0 : usage;
}
