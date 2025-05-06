import type { LanguageModelV1 } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createXai } from '@ai-sdk/xai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { awsCredentialsProvider } from '@vercel/functions/oidc';
import { captureException } from '@sentry/remix';
import { logger } from 'chef-agent/utils/logger';
import type { ProviderType } from '~/lib/common/annotations';
// workaround for Vercel environment from
// https://github.com/vercel/ai/issues/199#issuecomment-1605245593
import { fetch as undiciFetch } from 'undici';
import { getEnv } from '~/lib/.server/env';

type Fetch = typeof fetch;
const ALLOWED_AWS_REGIONS = ['us-east-1', 'us-east-2', 'us-west-2'];

export type ModelProvider = Exclude<ProviderType, 'Unknown'>;
type Provider = {
  maxTokens: number;
  model: LanguageModelV1;
  options?: {
    xai: {
      stream_options: { include_usage: true };
    };
  };
};

export function modelForProvider(provider: ModelProvider, modelChoice: string | undefined) {
  if (modelChoice) {
    return modelChoice;
  }
  switch (provider) {
    case 'Anthropic':
      return getEnv('ANTHROPIC_MODEL') || 'claude-3-5-sonnet-20241022';
    case 'Bedrock':
      return getEnv('AMAZON_BEDROCK_MODEL') || 'us.anthropic.claude-3-5-sonnet-20241022-v2:0';
    case 'OpenAI':
      return getEnv('OPENAI_MODEL') || 'gpt-4.1';
    case 'XAI':
      return getEnv('XAI_MODEL') || 'grok-3-mini';
    case 'Google':
      return getEnv('GOOGLE_MODEL') || 'gemini-2.5-pro-preview-03-25';
    default: {
      const _exhaustiveCheck: never = provider;
      throw new Error(`Unknown provider: ${_exhaustiveCheck}`);
    }
  }
}

export function getProvider(
  userApiKey: string | undefined,
  modelProvider: ModelProvider,
  modelChoice: string | undefined,
): Provider {
  let model: string;
  let provider: Provider;

  // https://github.com/vercel/ai/issues/199#issuecomment-1605245593
  const fetch = undiciFetch as unknown as Fetch;

  switch (modelProvider) {
    case 'Google': {
      model = modelForProvider(modelProvider, modelChoice);
      const google = createGoogleGenerativeAI({
        apiKey: userApiKey || getEnv('GOOGLE_API_KEY'),
        fetch: userApiKey ? userKeyApiFetch('Google') : fetch,
      });
      provider = {
        model: google(model),
        maxTokens: 20000,
      };
      break;
    }
    case 'XAI': {
      model = modelForProvider(modelProvider, modelChoice);
      const xai = createXai({
        apiKey: userApiKey || getEnv('XAI_API_KEY'),
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
      model = modelForProvider(modelProvider, modelChoice);
      const openai = createOpenAI({
        apiKey: userApiKey || getEnv('OPENAI_API_KEY'),
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
      model = modelForProvider(modelProvider, modelChoice);
      let region = getEnv('AWS_REGION');
      if (!region || !ALLOWED_AWS_REGIONS.includes(region)) {
        region = 'us-west-2';
      }
      const bedrock = createAmazonBedrock({
        region,
        credentialProvider: awsCredentialsProvider({
          roleArn: getEnv('AWS_ROLE_ARN')!,
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
      model = modelForProvider(modelProvider, modelChoice);
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

          const lowQosKey = getEnv('ANTHROPIC_LOW_QOS_API_KEY');
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
        apiKey: userApiKey || getEnv('ANTHROPIC_API_KEY'),
        fetch: userApiKey ? userKeyApiFetch('Anthropic') : rateLimitAwareFetch(),
      });

      provider = {
        model: anthropic(model),
        maxTokens: 8192,
      };
      break;
    }
  }

  return provider;
}

const userKeyApiFetch = (provider: ModelProvider) => {
  // https://github.com/vercel/ai/issues/199#issuecomment-1605245593
  const fetch = undiciFetch as unknown as Fetch;

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

// sujayakar, 2025-03-25: This is mega-hax, but I can't figure out
// how to get the AI SDK to pass the cache control header to
// Anthropic with the `streamText` function. Setting
// `providerOptions.anthropic.cacheControl` doesn't seem to do
// anything. So, we instead directly inject the cache control
// header into the body of the request.
//
// tom, 2025-04-25: This is still an outstanding bug
// https://github.com/vercel/ai/issues/5942
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
  // Cache tool definitions.
  body.tools[body.tools.length - 1].cache_control = { type: 'ephemeral' };

  // Cache system prompt.
  body.system[body.system.length - 1].cache_control = { type: 'ephemeral' };

  // Cache all messages.
  const lastMessage = body.messages[body.messages.length - 1];
  const lastMessagePartIndex = lastMessage.content.length - 1;
  lastMessage.content[lastMessagePartIndex].cache_control = { type: 'ephemeral' };
  body.messages[body.messages.length - 1].content[lastMessagePartIndex].cache_control = { type: 'ephemeral' };

  const newBody = JSON.stringify(body);
  console.log(`Injected system messages in ${Date.now() - start}ms`);
  return { ...options, body: newBody };
}
