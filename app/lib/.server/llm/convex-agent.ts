import {
  convertToCoreMessages,
  streamText,
  type LanguageModelUsage,
  type LanguageModelV1,
  type Message,
  type StepResult,
} from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAnthropic } from '@ai-sdk/anthropic';
import { ROLE_SYSTEM_PROMPT, GENERAL_SYSTEM_PROMPT_PRELUDE, generalSystemPrompt } from '~/lib/common/prompts/system';
import { deployTool } from '~/lib/runtime/deployTool';
import { viewTool } from '~/lib/runtime/viewTool';
import type { ConvexToolSet } from '~/lib/common/types';
import { npmInstallTool } from '~/lib/runtime/npmInstallTool';
import { createOpenAI } from '@ai-sdk/openai';
import type { Tracer } from '~/lib/.server/chat';
import { editTool } from '~/lib/runtime/editTool';
import { captureException } from '@sentry/remix';
import type { SystemPromptOptions } from '~/lib/common/prompts/types';
import { awsCredentialsProvider } from '@vercel/functions/oidc';

// workaround for Vercel environment from
// https://github.com/vercel/ai/issues/199#issuecomment-1605245593
import { fetch as undiciFetch } from 'undici';
type Fetch = typeof fetch;

type Messages = Message[];

type Provider = {
  maxTokens: number;
  model: LanguageModelV1;
};

export type ModelProvider = 'Anthropic' | 'Bedrock' | 'OpenAI';

const ALLOWED_AWS_REGIONS = ['us-east-1', 'us-east-2', 'us-west-2'];

export async function convexAgent(
  chatId: string,
  env: Record<string, string | undefined>,
  firstUserMessage: boolean,
  messages: Messages,
  tracer: Tracer | null,
  modelProvider: ModelProvider,
  userApiKey: string | undefined,
  recordUsageCb: (usage: LanguageModelUsage) => Promise<void>,
) {
  console.debug('Starting agent with model provider', modelProvider);
  if (userApiKey) {
    console.debug('Using user provided API key');
  }

  let provider: Provider;
  let model: string;
  // https://github.com/vercel/ai/issues/199#issuecomment-1605245593
  const fetch = undiciFetch as unknown as Fetch;
  switch (modelProvider) {
    case 'OpenAI': {
      model = getEnv(env, 'OPENAI_MODEL') || 'gpt-4o-2024-11-20';
      const openai = createOpenAI({
        fetch,
      });
      provider = {
        model: openai(model),
        maxTokens: 8192,
      };
      break;
    }
    case 'Bedrock': {
      model = getEnv(env, 'AMAZON_BEDROCK_MODEL') || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
      let region = getEnv(env, 'AWS_REGION');
      if (!region || !ALLOWED_AWS_REGIONS.includes(region)) {
        region = 'us-west-2';
      }
      const bedrock = createAmazonBedrock({
        region,
        credentialProvider: awsCredentialsProvider({
          roleArn: getEnv(env, 'AWS_ROLE_ARN')!,
        }),
        fetch,
      });
      provider = {
        model: bedrock(model),
        maxTokens: 8192,
      };
      break;
    }
    case 'Anthropic': {
      model = getEnv(env, 'ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022';
      // Falls back to the low Quality-of-Service Anthropic API key if the primary key is rate limited
      const rateLimitAwareFetch = () => {
        return async (input: RequestInfo | URL, init?: RequestInit) => {
          const enrichedOptions = anthropicInjectCacheControl(init);
          try {
            const response = await fetch(input, enrichedOptions);
            if (response.status == 429) {
              captureException('Rate limited by Anthropic, switching to low QoS API key', {
                level: 'warning',
                extra: {
                  response,
                },
              });
              const lowQosKey = getEnv(env, 'ANTHROPIC_LOW_QOS_API_KEY');
              if (!lowQosKey) {
                return response;
              }
              if (enrichedOptions && enrichedOptions.headers) {
                const headers = new Headers(enrichedOptions.headers);
                headers.set('x-api-key', lowQosKey);
                enrichedOptions.headers = headers;
              }
              return fetch(input, enrichedOptions);
            }

            return response;
          } catch (error) {
            throw error;
          }
        };
      };
      const anthropic = createAnthropic({
        apiKey: userApiKey || getEnv(env, 'ANTHROPIC_API_KEY'),
        fetch: userApiKey ? fetch : rateLimitAwareFetch(),
      });

      provider = {
        model: anthropic(model),
        maxTokens: 8192,
      };
      break;
    }
  }

  const opts: SystemPromptOptions = {
    enableBulkEdits: true,
    enablePreciseEdits: false,
    includeTemplate: true,
    openaiProxyEnabled: getEnv(env, 'OPENAI_PROXY_ENABLED') == '1',
  };
  const tools: ConvexToolSet = {
    deploy: deployTool,
    npmInstall: npmInstallTool,
  };
  if (opts.enablePreciseEdits) {
    tools.view = viewTool;
    tools.edit = editTool;
  }
  const result = streamText({
    model: provider.model,
    maxTokens: provider.maxTokens,
    messages: [
      {
        role: 'system',
        content: ROLE_SYSTEM_PROMPT,
      },
      {
        role: 'system',
        content: generalSystemPrompt(opts),
      },
      ...cleanupAssistantMessages(messages),
    ],
    tools,
    onFinish: (result) => onFinishHandler(result, tracer, chatId, recordUsageCb),
    onError({ error }) {
      console.error(error);
    },

    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        firstUserMessage,
        chatId,
        provider: modelProvider,
      },
    },
  });
  return result.toDataStream({
    getErrorMessage: (error: any) => {
      return error.message;
    },
  });
}

// sujayakar, 2025-03-25: This is mega-hax, but I can't figure out
// how to get the AI SDK to pass the cache control header to
// Anthropic with the `streamText` function. Setting
// `providerOptions.anthropic.cacheControl` doesn't seem to do
// anything. So, we instead directly inject the cache control
// header into the body of the request.
function anthropicInjectCacheControl(options?: RequestInit) {
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
  if (body.system[0].text !== ROLE_SYSTEM_PROMPT) {
    throw new Error('First system message must be the roleSystemPrompt');
  }
  if (!body.system[1].text.startsWith(GENERAL_SYSTEM_PROMPT_PRELUDE)) {
    throw new Error('Second system message must be the generalSystemPrompt');
  }

  // Inject the cache control header after the constant prompt, but leave
  // the dynamic system prompts uncached.
  body.system[1].cache_control = { type: 'ephemeral' };

  const newBody = JSON.stringify(body);
  console.log(`Injected system messages in ${Date.now() - start}ms`);
  return { ...options, body: newBody };
}

function cleanupAssistantMessages(messages: Messages) {
  let processedMessages = messages.map((message) => {
    if (message.role == 'assistant') {
      let content = message.content;
      content = content.replace(/<div class=\\"__boltThought__\\">.*?<\/div>/s, '');
      content = content.replace(/<think>.*?<\/think>/s, '');
      return { ...message, content };
    } else {
      return message;
    }
  });
  // Filter out empty messages and messages with empty parts
  processedMessages = processedMessages.filter(
    (message) => message.content.trim() !== '' || (message.parts && message.parts.length > 0),
  );
  return convertToCoreMessages(processedMessages);
}

async function onFinishHandler(
  result: Omit<StepResult<any>, 'stepType' | 'isContinued'>,
  tracer: Tracer | null,
  chatId: string,
  recordUsageCb: (usage: LanguageModelUsage) => Promise<void>,
) {
  const { usage } = result;
  console.log('Finished streaming', {
    finishReason: result.finishReason,
    usage,
    providerMetadata: result.providerMetadata,
  });
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

  // Record usage once the dataStream is closed.
  await recordUsageCb(usage);

  await new Promise((resolve) => setTimeout(resolve, 0));
}

// TODO this was cool, do something to type our environment variables
export function getEnv(env: Record<string, string | undefined>, name: string): string | undefined {
  return env[name] || globalThis.process.env[name];
}
