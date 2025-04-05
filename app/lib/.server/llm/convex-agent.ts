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

export type AITextDataStream = ReturnType<typeof createDataStream>;

export type Provider = {
  maxTokens: number;
  model: LanguageModelV1;
  systemPrompt?: string;
};

export type RequestProgress = {
  counter: number;
  cumulativeUsage: { completionTokens: number; promptTokens: number; totalTokens: number };
};

const tools: ConvexToolSet = {
  deploy: deployTool,
  view: viewTool,
  npmInstall: npmInstallTool,
};

export async function convexAgent(env: Env, firstUserMessage: boolean, messages: Messages): Promise<AITextDataStream> {
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
          systemPrompt: [roleSystemPrompt, constantPrompt].join('\n'),
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
        system: provider.systemPrompt,

        // NB: We will prepend system messages (with the appropriate cache control headers)
        // in our custom fetch implementation hooked in above.
        messages: cleanupAssistantMessages(messages),
        tools,
        onFinish: (result) => onFinishHandler(dataStream, progress, result),

        experimental_telemetry: {
          isEnabled: true,
          metadata: {
            firstUserMessage,
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
  const startChars = options.body.length;
  const body = JSON.parse(options.body);
  body.system = [
    {
      type: 'text',
      text: roleSystemPrompt,
    },
    {
      type: 'text',
      text: guidelinesPrompt,
      cache_control: { type: 'ephemeral' },
    },
    // NB: The client dynamically manages files injected as context
    // past this point, and we don't want them to pollute the cache.
    ...(body.system ?? []),
  ];
  const newBody = JSON.stringify(body);
  console.log(`Injected system messages in ${Date.now() - start}ms (${startChars} -> ${newBody.length} chars)`);
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
