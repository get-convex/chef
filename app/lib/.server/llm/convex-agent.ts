import { convertToCoreMessages, streamText, type LanguageModelV1, type Message, type StepResult } from 'ai';
import { bedrock, createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAnthropic } from '@ai-sdk/anthropic';
import { constantPrompt, roleSystemPrompt } from '~/lib/common/prompts/system';
import { deployTool } from '~/lib/runtime/deployTool';
import { viewTool } from '~/lib/runtime/viewTool';
import type { ConvexToolSet } from '~/lib/common/types';
import { npmInstallTool } from '~/lib/runtime/npmInstallTool';
import { openai } from '@ai-sdk/openai';
import type { Tracer } from '~/routes/api.chat';
import { editTool } from '~/lib/runtime/editTool';
import { captureException } from '@sentry/remix';

type Messages = Message[];

type Provider = {
  maxTokens: number;
  model: LanguageModelV1;
};

const tools: ConvexToolSet = {
  deploy: deployTool,
  view: viewTool,
  npmInstall: npmInstallTool,
  edit: editTool,
};

type ModelProvider = 'Anthropic' | 'Bedrock' | 'OpenAI';

export async function convexAgentWithRetries(
  chatId: string,
  env: Env,
  firstUserMessage: boolean,
  messages: Messages,
  tracer: Tracer | null,
  maxRetries: number = 3,
) {
  let randomizedProviders: ModelProvider[] = ['Anthropic', 'Bedrock'];
  randomizedProviders.sort(() => Math.random() - 0.5);
  if (getEnv(env, 'USE_OPENAI')) {
    randomizedProviders = ['OpenAI'];
  }
  for (let i = 0; i < maxRetries; i++) {
    const provider = randomizedProviders[i % randomizedProviders.length];
    try {
      return await convexAgent(chatId, env, firstUserMessage, messages, tracer, provider);
    } catch (error) {
      if (i == maxRetries - 1) {
        throw error;
      } else {
        captureException('Error with provider', {
          level: 'warning',
          extra: {
            provider,
            error,
          },
        });
      }
    }
  }
}

async function convexAgent(
  chatId: string,
  env: Env,
  firstUserMessage: boolean,
  messages: Messages,
  tracer: Tracer | null,
  modelProvider: ModelProvider,
) {
  let provider: Provider;
  if (modelProvider == 'OpenAI') {
    const model = getEnv(env, 'OPENAI_MODEL') || 'gpt-4o-2024-11-20';
    provider = {
      model: openai(model),
      maxTokens: 8192,
    };
  } else if (modelProvider == 'Bedrock') {
    const model = getEnv(env, 'AMAZON_BEDROCK_MODEL') || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
    const region = getEnv(env, 'AWS_REGION') || 'us-west-2';

    const bedrock = createAmazonBedrock({
      region,
      accessKeyId: getEnv(env, 'AWS_ACCESS_KEY_ID'),
      secretAccessKey: getEnv(env, 'AWS_SECRET_ACCESS_KEY'),
      sessionToken: getEnv(env, 'AWS_SESSION_TOKEN'),
    });
    provider = {
      model: bedrock(model),
      maxTokens: 8192,
    };
  } else {
    // Falls back to the low Quality-of-Service Anthropic API key if the primary key is rate limited
    const rateLimitAwareFetch = () => {
      return async (input: RequestInfo | URL, init?: RequestInit) => {
        const enrichedOptions = anthropicInjectCacheControl(constantPrompt, init);
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
      apiKey: getEnv(env, 'ANTHROPIC_API_KEY'),
      fetch: rateLimitAwareFetch(),
    });
    const model = getEnv(env, 'ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022';
    provider = {
      model: anthropic(model),
      maxTokens: 8192,
    };
  }
  const result = streamText({
    model: provider.model,
    maxTokens: provider.maxTokens,
    messages: [
      {
        role: 'system',
        content: roleSystemPrompt,
        /*
        providerOptions: {
          bedrock: {
            cachePoint: { type: 'default' },
          },
        },
        */
      },
      {
        role: 'system',
        content: constantPrompt,
        /*
        providerOptions: {
          bedrock: {
            cachePoint: { type: 'default' },
          },
        },
        */
      },
      ...cleanupAssistantMessages(messages),
    ],
    tools,
    onFinish: (result) => onFinishHandler(result, tracer, chatId),

    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        firstUserMessage,
        chatId,
      },
    },
  });
  return result.toDataStream({
    getErrorMessage: (error: any) => {
      return `Failed to generate response: ${error.message}`;
    },
  });
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
  await new Promise((resolve) => setTimeout(resolve, 0));
}

export function getEnv(env: Env, name: keyof Env): string | undefined {
  return env[name] || process.env[name];
}
