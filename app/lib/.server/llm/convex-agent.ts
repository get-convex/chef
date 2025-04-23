import {
  createDataStream,
  streamText,
  type DataStreamWriter,
  type LanguageModelUsage,
  type LanguageModelV1,
  type Message,
  type ProviderMetadata,
  type StepResult,
} from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createXai } from '@ai-sdk/xai';
import { ROLE_SYSTEM_PROMPT, GENERAL_SYSTEM_PROMPT_PRELUDE, generalSystemPrompt } from 'chef-agent/prompts/system';
import { deployTool } from 'chef-agent/tools/deploy';
import { viewTool } from 'chef-agent/tools/view';
import type { ConvexToolSet } from '~/lib/common/types';
import { npmInstallTool } from 'chef-agent/tools/npmInstall';
import { createOpenAI } from '@ai-sdk/openai';
import type { Tracer } from '~/lib/.server/chat';
import { editTool } from 'chef-agent/tools/edit';
import { captureException } from '@sentry/remix';
import type { SystemPromptOptions } from 'chef-agent/types';
import { awsCredentialsProvider } from '@vercel/functions/oidc';
import { cleanupAssistantMessages } from 'chef-agent/cleanupAssistantMessages';

// workaround for Vercel environment from
// https://github.com/vercel/ai/issues/199#issuecomment-1605245593
import { fetch as undiciFetch } from 'undici';
import { logger } from 'chef-agent/utils/logger';
import { encodeUsageAnnotation } from '~/lib/.server/usage';
import { REPEATED_ERROR_REASON } from '~/lib/common/errors';
type Fetch = typeof fetch;

type Messages = Message[];

type Provider = {
  maxTokens: number;
  model: LanguageModelV1;
  options?: {
    xai: {
      stream_options: { include_usage: true };
    };
  };
};

export type ModelProvider = 'Anthropic' | 'Bedrock' | 'OpenAI' | 'XAI' | 'Google';

const ALLOWED_AWS_REGIONS = ['us-east-1', 'us-east-2', 'us-west-2'];

export async function convexAgent(args: {
  chatInitialId: string;
  env: Record<string, string | undefined>;
  firstUserMessage: boolean;
  messages: Messages;
  tracer: Tracer | null;
  modelProvider: ModelProvider;
  userApiKey: string | undefined;
  shouldDisableTools: boolean;
  recordUsageCb: (
    lastMessage: Message | undefined,
    finalGeneration: { usage: LanguageModelUsage; providerMetadata?: ProviderMetadata },
  ) => Promise<void>;
}) {
  const {
    chatInitialId,
    env,
    firstUserMessage,
    messages,
    tracer,
    modelProvider,
    userApiKey,
    shouldDisableTools,
    recordUsageCb,
  } = args;
  console.debug('Starting agent with model provider', modelProvider);
  if (userApiKey) {
    console.debug('Using user provided API key');
  }

  let provider: Provider;
  let model: string;
  // https://github.com/vercel/ai/issues/199#issuecomment-1605245593
  const fetch = undiciFetch as unknown as Fetch;
  const userKeyApiFetch = (provider: ModelProvider) => {
    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const result = await fetch(input, init);
      if (result.status === 401) {
        const text = await result.text();
        throw new Error(JSON.stringify({ error: 'Invalid API key', details: text }));
      }
      if (result.status === 413) {
        const text = await result.text();
        throw new Error(
          JSON.stringify({
            error: 'Request exceeds the maximum allowed number of bytes.',
            details: text,
          }),
        );
      }
      if (result.status === 429) {
        const text = await result.text();
        throw new Error(
          JSON.stringify({
            error: `${provider} is rate limiting your requests`,
            details: text,
          }),
        );
      }
      if (result.status === 529) {
        const text = await result.text();
        throw new Error(
          JSON.stringify({
            error: `${provider}'s API is temporarily overloaded`,
            details: text,
          }),
        );
      }
      if (!result.ok) {
        const text = await result.text();
        throw new Error(
          JSON.stringify({
            error: `${provider} returned an error (${result.status} ${result.statusText}) when using your provided API key: ${text}`,
            details: text,
          }),
        );
      }
      return result;
    };
  };
  switch (modelProvider) {
    case 'Google': {
      model = getEnv(env, 'GOOGLE_MODEL') || 'gemini-2.5-pro-preview-03-25';
      const google = createGoogleGenerativeAI({
        apiKey: userApiKey || getEnv(env, 'GOOGLE_API_KEY'),
        fetch: userApiKey ? userKeyApiFetch('Google') : fetch,
      });
      provider = {
        model: google(model),
        maxTokens: 20000,
      };
      break;
    }
    case 'XAI': {
      model = getEnv(env, 'XAI_MODEL') || 'grok-3-mini';
      const xai = createXai({
        apiKey: userApiKey || getEnv(env, 'XAI_API_KEY'),
        fetch: userApiKey ? userKeyApiFetch('XAI') : fetch,
      });
      provider = {
        model: xai(model),
        maxTokens: 8192,
        options: {
          xai: {
            stream_options: { include_usage: true },
          },
        },
      };
      break;
    }
    case 'OpenAI': {
      model = getEnv(env, 'OPENAI_MODEL') || 'gpt-4.1';
      const openai = createOpenAI({
        apiKey: userApiKey || getEnv(env, 'OPENAI_API_KEY'),
        fetch: userApiKey ? userKeyApiFetch('OpenAI') : fetch,
        compatibility: 'strict',
      });
      provider = {
        model: openai(model),
        maxTokens: 8192,
        options: undefined,
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
        options: undefined,
      };
      break;
    }
    case 'Anthropic': {
      model = getEnv(env, 'ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022';
      // Falls back to the low Quality-of-Service Anthropic API key if the primary key is rate limited
      const rateLimitAwareFetch = () => {
        return async (input: RequestInfo | URL, init?: RequestInit) => {
          const enrichedOptions = anthropicInjectCacheControl(init);

          const throwIfBad = async (response: Response, isLowQos: boolean) => {
            if (response.ok) {
              return response;
            }
            const text = await response.text();
            captureException('Anthropic returned an error', {
              level: 'error',
              extra: {
                response,
                text,
              },
            });
            logger.error(
              `Anthropic${isLowQos ? ' (low QoS)' : ''} returned an error (${response.status} ${response.statusText}): ${text}`,
            );
            throw new Error(JSON.stringify({ error: 'The model hit an error. Try sending your message again.' }));
          };

          const response = await fetch(input, enrichedOptions);

          if (response.status !== 429 && response.status !== 529) {
            return throwIfBad(response, false);
          }

          const lowQosKey = getEnv(env, 'ANTHROPIC_LOW_QOS_API_KEY');
          if (!lowQosKey) {
            captureException('Anthropic low qos api key not set', { level: 'error' });
            console.error('Anthropic low qos api key not set');
            return throwIfBad(response, false);
          }

          logger.error(`Falling back to low QoS API key...`);
          captureException('Rate limited by Anthropic, switching to low QoS API key', {
            level: 'warning',
            extra: {
              response,
            },
          });
          if (enrichedOptions && enrichedOptions.headers) {
            const headers = new Headers(enrichedOptions.headers);
            headers.set('x-api-key', lowQosKey);
            enrichedOptions.headers = headers;
          }
          const lowQosResponse = await fetch(input, enrichedOptions);
          return throwIfBad(lowQosResponse, true);
        };
      };
      const anthropic = createAnthropic({
        apiKey: userApiKey || getEnv(env, 'ANTHROPIC_API_KEY'),
        fetch: userApiKey ? userKeyApiFetch('Anthropic') : rateLimitAwareFetch(),
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
    usingOpenAi: modelProvider == 'OpenAI',
    usingGoogle: modelProvider == 'Google',
    resendProxyEnabled: getEnv(env, 'RESEND_PROXY_ENABLED') == '1',
  };
  const tools: ConvexToolSet = {
    deploy: deployTool,
    npmInstall: npmInstallTool,
  };
  if (opts.enablePreciseEdits) {
    tools.view = viewTool;
    tools.edit = editTool;
  }

  const dataStream = createDataStream({
    execute(dataStream) {
      const result = streamText({
        model: provider.model,
        maxTokens: provider.maxTokens,
        providerOptions: provider.options,
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
      result.mergeIntoDataStream(dataStream);
    },
    onError(error: any) {
      return error.message;
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

async function onFinishHandler({
  dataStream,
  messages,
  result,
  tracer,
  chatInitialId,
  recordUsageCb,
  toolsDisabledFromRepeatedErrors,
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
  toolsDisabledFromRepeatedErrors: boolean;
}) {
  const { providerMetadata } = result;
  const usage = {
    completionTokens: normalizeUsage(result.usage.completionTokens),
    promptTokens: normalizeUsage(result.usage.promptTokens),
    totalTokens: normalizeUsage(result.usage.totalTokens),
  };
  console.log('Finished streaming', {
    finishReason: result.finishReason,
    usage,
    providerMetadata: result.providerMetadata,
  });
  if (tracer) {
    const span = tracer.startSpan('on-finish-handler');
    span.setAttribute('chatInitialId', chatInitialId);
    span.setAttribute('finishReason', result.finishReason);
    span.setAttribute('usage.completionTokens', usage.completionTokens);
    span.setAttribute('usage.promptTokens', usage.promptTokens);
    span.setAttribute('usage.totalTokens', usage.totalTokens);
    if (result.providerMetadata) {
      const anthropic: any = result.providerMetadata.anthropic;
      if (anthropic) {
        span.setAttribute('providerMetadata.anthropic.cacheCreationInputTokens', anthropic.cacheCreationInputTokens);
        span.setAttribute('providerMetadata.anthropic.cacheReadInputTokens', anthropic.cacheReadInputTokens);
      }
    }
    span.end();
  }

  if (toolsDisabledFromRepeatedErrors) {
    dataStream.writeMessageAnnotation({ type: 'failure', reason: REPEATED_ERROR_REASON });
  }

  // Stash this part's usage as an annotation if we're not done yet.
  if (result.finishReason !== 'stop') {
    let toolCallId: string | undefined;
    if (result.finishReason === 'tool-calls') {
      if (result.toolCalls.length === 1) {
        toolCallId = result.toolCalls[0].toolCallId;
      } else {
        logger.warn('Stopped with not exactly one tool call', {
          toolCalls: result.toolCalls,
        });
      }
    }
    const annotation = encodeUsageAnnotation(toolCallId, usage, providerMetadata);
    dataStream.writeMessageAnnotation({ type: 'usage', usage: annotation });
  }
  // Otherwise, record usage once we've generated the final part.
  else {
    await recordUsageCb(messages[messages.length - 1], { usage, providerMetadata });
  }

  await new Promise((resolve) => setTimeout(resolve, 0));
}

// TODO this was cool, do something to type our environment variables
export function getEnv(env: Record<string, string | undefined>, name: string): string | undefined {
  return env[name] || globalThis.process.env[name];
}

function normalizeUsage(usage: number) {
  return Number.isNaN(usage) ? 0 : usage;
}
