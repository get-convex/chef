import {
  convertToCoreMessages,
  createDataStream,
  streamText,
  type DataStreamWriter,
  type LanguageModelV1,
  type StepResult,
  type TextStreamPart,
  type ToolSet,
} from 'ai';
import type { Messages } from './stream-text';
import type { ProgressAnnotation } from '~/types/context';
import { createAnthropic } from '@ai-sdk/anthropic';
import { flexSystemPrompt } from '~/lib/common/prompts/flexPrompts';
import { makeFlexGuidelinesPrompt } from '~/lib/common/prompts/flexPrompts';
import { convexGuidelines } from '~/lib/common/prompts/convex';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';

export type AITextDataStream = ReturnType<typeof createDataStream>;

export type Provider = {
  maxTokens: number;
  model: LanguageModelV1;
  includeSystemPrompt: boolean;
  tools: ToolSet;
};

export type RequestProgress = {
  counter: number;
  cumulativeUsage: { completionTokens: number; promptTokens: number; totalTokens: number };
};

const genericAnthropic = createAnthropic({});

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
      let systemPrompt: string;
      let tools: ToolSet;
      dataStream.writeData({
        type: 'progress',
        label: 'response',
        status: 'in-progress',
        order: progress.counter++,
        message: 'Analyzing Messages',
      } satisfies ProgressAnnotation);
      if (firstUserMessage) {
        console.log('Using XML-based coding agent');
        systemPrompt = getSystemPrompt();
        tools = {};
      } else {
        console.log('Using tool-based coding agent');
        systemPrompt = makeFlexGuidelinesPrompt(convexGuidelines);
        tools = {
          str_replace_editor: genericAnthropic.tools.textEditor_20241022(),
          bash: genericAnthropic.tools.bash_20241022(),
        };
      }
      const anthropic = createAnthropic({
        apiKey: getEnv(env, 'ANTHROPIC_API_KEY'),
        fetch: async (url, options) => {
          return fetch(url, anthropicInjectCacheControl(systemPrompt, options));
        },
      });
      const model = anthropic('claude-3-5-sonnet-20241022');

      dataStream.writeData({
        type: 'progress',
        label: 'response',
        status: 'in-progress',
        order: progress.counter++,
        message: 'Generating Response',
      } satisfies ProgressAnnotation);
      const result = streamText({
        model,
        maxTokens: 8192,
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
      text: flexSystemPrompt,
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
