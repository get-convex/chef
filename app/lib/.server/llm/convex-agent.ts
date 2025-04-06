import {
  convertToCoreMessages,
  createDataStream,
  streamText,
  type DataStreamWriter,
  type LanguageModelV1,
  type StepResult,
  type TextStreamPart,
} from 'ai';
import type { Messages } from './stream-text';
import type { ProgressAnnotation } from '~/types/context';
import { createAnthropic } from '@ai-sdk/anthropic';
import { constantPrompt, roleSystemPrompt } from '~/lib/common/prompts/system';
import { deployTool } from '~/lib/runtime/deployTool';
import { viewTool } from '~/lib/runtime/viewTool';
import type { ConvexToolSet } from '~/lib/common/types';
import { npmInstallTool } from '~/lib/runtime/npmInstallTool';
import { openai } from '@ai-sdk/openai';
import type { Tracer } from '~/routes/api.chat';
import { editTool } from '~/lib/runtime/editTool';

type AITextDataStream = ReturnType<typeof createDataStream>;

type Provider = {
  maxTokens: number;
  model: LanguageModelV1;
};

type RequestProgress = {
  counter: number;
  cumulativeUsage: { completionTokens: number; promptTokens: number; totalTokens: number };
};

const tools: ConvexToolSet = {
  deploy: deployTool,
  view: viewTool,
  npmInstall: npmInstallTool,
  edit: editTool,
};

export async function convexAgent(chatId: string, env: Env, firstUserMessage: boolean, messages: Messages, tracer: Tracer | null): Promise<AITextDataStream> {
  const progress: RequestProgress = {
    counter: 1,
    cumulativeUsage: {
      completionTokens: 0,
      promptTokens: 0,
      totalTokens: 0,
    },
  };
  const dataStream = createDataStream({
    async execute(dataStream) {
      dataStream.writeData({
        type: 'progress',
        label: 'response',
        status: 'in-progress',
        order: progress.counter++,
        message: 'Analyzing Messages',
      } satisfies ProgressAnnotation);
      let provider: Provider;
      if (getEnv(env, 'USE_OPENAI')) {
        const model = getEnv(env, 'OPENAI_MODEL') || 'gpt-4o-2024-11-20';
        provider = {
          model: openai(model),
          maxTokens: 8192,
        };
      } else {
        const anthropic = createAnthropic({
          apiKey: getEnv(env, 'ANTHROPIC_API_KEY'),
          fetch: async (url, options) => {
            return fetch(url, anthropicInjectCacheControl(constantPrompt, options));
          },
        });
        const model = getEnv(env, 'ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022';
        provider = {
          model: anthropic(model),
          maxTokens: 8192,
        };
      }
      dataStream.writeData({
        type: 'progress',
        label: 'response',
        status: 'in-progress',
        order: progress.counter++,
        message: 'Generating Response',
      } satisfies ProgressAnnotation);
      const result = streamText({
        model: provider.model,
        maxTokens: provider.maxTokens,
        messages: [
          {
            role: 'system',
            content: roleSystemPrompt,
          },
          {
            role: 'system',
            content: constantPrompt,
          },
          ...cleanupAssistantMessages(messages),
        ],
        tools,
        onFinish: (result) => onFinishHandler(dataStream, progress, result, tracer, chatId),

        experimental_telemetry: {
          isEnabled: true,
          metadata: {
            firstUserMessage,
            chatId,
          },
        },
      });
      void logErrors(result.fullStream);
      result.mergeIntoDataStream(dataStream);
    },
  });

  return dataStream;
}

// sujayakar, 2025-03-25: This is mega-hax, but I can't figure out
// how to get the AI SDK to pass the cache control header to
// Anthropic with the `streamText` function. Setting
// `providerOptions.anthropic.cacheControl` doesn't seem to do
// anything. So, we instead directly inject the cache control
// header into the body of the request.
function anthropicInjectCacheControl(guidelinesPrompt: string, options?: RequestInit) {
  const start = Date.now();
  if (!options) {
    return options;
  }
  if (options.method !== 'POST') {
    return options;
  }
  const headers = options.headers;
  if (!headers) {
    return options;
  }
  const contentType = new Headers(headers).get('content-type');
  if (contentType !== 'application/json') {
    return options;
  }
  if (typeof options.body !== 'string') {
    throw new Error('Body must be a string');
  }

  const body = JSON.parse(options.body);

  if (body.system.length < 2) {
    throw new Error('Body must contain at least two system messages');
  }
  if (body.system[0].text !== roleSystemPrompt) {
    throw new Error('First system message must be the roleSystemPrompt');
  }
  if (body.system[1].text !== constantPrompt) {
    throw new Error('Second system message must be the constantPrompt');
  }

  // Inject the cache control header after the constant prompt, but leave
  // the dynamic system prompts uncached.
  body.system[1].cache_control = { type: 'ephemeral' };

  const newBody = JSON.stringify(body);
  console.log(`Injected system messages in ${Date.now() - start}ms`);
  return { ...options, body: newBody };
}

function cleanupAssistantMessages(messages: Messages) {
  const processedMessages = messages.map((message) => {
    if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');
      return { ...message, content };
    } else {
      return message;
    }
  });
  return convertToCoreMessages(processedMessages);
}

async function onFinishHandler(
  dataStream: DataStreamWriter,
  progress: RequestProgress,
  result: Omit<StepResult<any>, 'stepType' | 'isContinued'>,
  tracer: Tracer | null,
  chatId: string,
) {
  const { usage } = result;
  console.log('Finished streaming', {
    finishReason: result.finishReason,
    usage,
    providerMetadata: result.providerMetadata,
  });
  if (usage) {
    progress.cumulativeUsage.completionTokens += usage.completionTokens || 0;
    progress.cumulativeUsage.promptTokens += usage.promptTokens || 0;
    progress.cumulativeUsage.totalTokens += usage.totalTokens || 0;
  }
  if (tracer) {
    const span = tracer.startSpan('on-finish-handler');
    span.setAttribute('chatId', chatId);
    span.setAttribute('finishReason', result.finishReason);
    span.setAttribute('usage.completionTokens', usage?.completionTokens || 0);
    span.setAttribute('usage.promptTokens', usage?.promptTokens || 0);
    span.setAttribute('usage.totalTokens', usage?.totalTokens || 0);
    if (result.providerMetadata) {
      const anthropic: any = result.providerMetadata.anthropic;
      if (anthropic) {
        span.setAttribute('providerMetadata.anthropic.cacheCreationInputTokens', anthropic.cacheCreationInputTokens);
        span.setAttribute('providerMetadata.anthropic.cacheReadInputTokens', anthropic.cacheReadInputTokens);
      }
    }
    span.end();
  }
  dataStream.writeMessageAnnotation({
    type: 'usage',
    value: {
      completionTokens: progress.cumulativeUsage.completionTokens,
      promptTokens: progress.cumulativeUsage.promptTokens,
      totalTokens: progress.cumulativeUsage.totalTokens,
    },
  });
  dataStream.writeData({
    type: 'progress',
    label: 'response',
    status: 'complete',
    order: progress.counter++,
    message: 'Response Generated',
  } satisfies ProgressAnnotation);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function logErrors(stream: AsyncIterable<TextStreamPart<any>>) {
  for await (const part of stream) {
    if (part.type === 'error') {
      console.error(part.error);
      return;
    }
  }
}

export function getEnv(env: Env, name: keyof Env): string | undefined {
  return env[name] || process.env[name];
}
