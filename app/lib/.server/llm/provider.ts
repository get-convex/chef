import type { LanguageModelV1 } from 'ai';
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createXai } from '@ai-sdk/xai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createVertex } from '@ai-sdk/google-vertex';
import { createOpenAI } from '@ai-sdk/openai';
import { awsCredentialsProvider } from '@vercel/functions/oidc';
import { captureException } from '@sentry/remix';
import { logger } from 'chef-agent/utils/logger';
import type { ProviderType } from '~/lib/common/annotations';
import { getEnv } from '~/lib/.server/env';
// workaround for Vercel environment from
// https://github.com/vercel/ai/issues/199#issuecomment-1605245593
import { fetch } from '~/lib/.server/fetch';

const ALLOWED_AWS_REGIONS = ['us-east-1', 'us-west-2'];

export type ModelProvider = Exclude<ProviderType, 'Unknown'>;

/**
 * RETRY LOGIC FOR RATE LIMITS
 *
 * All API calls now automatically retry on rate limit errors (429, RESOURCE_EXHAUSTED, etc.)
 * with exponential backoff:
 * - Max 3 retries
 * - Base delay: 30 seconds
 * - Exponential backoff: 30s, 60s, 120s
 * - Uses API-suggested retry delays when available
 * - Works with all providers: Google, OpenAI, Anthropic, XAI, OpenRouter, Bedrock
 */

/**
 * Retry function with exponential backoff for rate limit errors
 */
async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  provider: ModelProvider,
  maxRetries: number = 3,
  baseDelay: number = 30000, // 30 seconds
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Check if this is a rate limit error (429 or RESOURCE_EXHAUSTED)
      const isRateLimitError =
        error.message?.includes('rate limiting') ||
        error.message?.includes('429') ||
        error.message?.includes('RESOURCE_EXHAUSTED') ||
        error.message?.includes('quota') ||
        error.message?.includes('limit') ||
        error.message?.includes('overloaded');

      // If it's not a rate limit error or we've exhausted retries, throw immediately
      if (!isRateLimitError || attempt === maxRetries) {
        throw error;
      }

      // Try to extract retry delay from error message (some APIs include this)
      let delay = baseDelay * Math.pow(2, attempt);

      // Check if the error contains a retry-after hint
      const retryAfterMatch = error.message?.match(/retry.*?(\d+)\s*(?:seconds?|minutes?|hours?)/i);
      if (retryAfterMatch) {
        const retryAfterValue = parseInt(retryAfterMatch[1]);
        const retryAfterUnit = retryAfterMatch[0].toLowerCase();

        if (retryAfterUnit.includes('hour')) {
          delay = retryAfterValue * 60 * 60 * 1000;
        } else if (retryAfterUnit.includes('minute')) {
          delay = retryAfterValue * 60 * 1000;
        } else {
          delay = retryAfterValue * 1000;
        }

        logger.info(`${provider} API suggested retry delay: ${delay}ms`);
      }

      logger.warn(`${provider} rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}
type Provider = {
  maxTokens: number;
  model: LanguageModelV1;
  options?: {
    xai?: {
      stream_options: { include_usage: true };
    };
    openai?: {
      reasoningEffort?: string;
    };
  };
};

export function modelForProvider(provider: ModelProvider, modelChoice: string | undefined) {
  if (modelChoice) {
    if (modelChoice === 'claude-sonnet-4-0' && provider === 'Bedrock') {
      return 'us.anthropic.claude-sonnet-4-20250514-v1:0';
    }

    if (modelChoice === 'gpt-5') {
      return 'gpt-5';
    }

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
      return getEnv('GOOGLE_MODEL') || 'gemini-2.5-pro';
    case 'OpenRouter':
      return getEnv('OPENROUTER_MODEL') || 'x-ai/grok-4-fast:free';
    default: {
      const _exhaustiveCheck: never = provider;
      throw new Error(`Unknown provider: ${_exhaustiveCheck}`);
    }
  }
}

function anthropicMaxTokens(modelChoice: string | undefined) {
  return modelChoice === 'claude-sonnet-4-0' || modelChoice === 'claude-sonnet-4-5' ? 24576 : 8192;
}

export function getProvider(
  userApiKey: string | undefined,
  modelProvider: ModelProvider,
  modelChoice: string | undefined,
): Provider {
  let model: string;
  let provider: Provider;

  switch (modelProvider) {
    case 'Google': {
      model = modelForProvider(modelProvider, modelChoice);
      let google;
      if (userApiKey) {
        google = createGoogleGenerativeAI({
          apiKey: userApiKey || getEnv('GOOGLE_API_KEY'),
          fetch: userKeyApiFetch('Google'),
        });
      } else {
        const credentials = JSON.parse(getEnv('GOOGLE_VERTEX_CREDENTIALS_JSON')!);
        google = createVertex({
          project: credentials.project_id,
          // Use global endpoint for higher availability
          baseURL: `https://aiplatform.googleapis.com/v1/projects/${credentials.project_id}/locations/global/publishers/google`,
          location: 'global',
          googleAuthOptions: {
            credentials: {
              client_email: credentials.client_email,
              private_key_id: credentials.private_key_id,
              private_key: credentials.private_key,
            },
          },
          fetch: createRetryFetch('Google'),
        });
      }
      provider = {
        model: google(model),
        maxTokens: 24576,
      };
      break;
    }
    case 'XAI': {
      model = modelForProvider(modelProvider, modelChoice);
      const xai = createXai({
        apiKey: userApiKey || getEnv('XAI_API_KEY'),
        fetch: userApiKey ? userKeyApiFetch('XAI') : createRetryFetch('XAI'),
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
        fetch: userApiKey ? userKeyApiFetch('OpenAI') : createRetryFetch('OpenAI'),
        compatibility: 'strict',
      });
      provider = {
        model: openai(model),
        maxTokens: 24576,
        options: modelChoice === 'gpt-5' ? { openai: { reasoningEffort: 'medium' } } : undefined,
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
        fetch: createRetryFetch('Bedrock'),
      });
      provider = {
        model: bedrock(model),
        maxTokens: anthropicMaxTokens(modelChoice),
        options: undefined,
      };
      break;
    }
    case 'Anthropic': {
      model = modelForProvider(modelProvider, modelChoice);
      // Falls back to the low Quality-of-Service Anthropic API key if the primary key is rate limited
      const rateLimitAwareFetch = () => {
        return async (input: RequestInfo | URL, init?: RequestInit) => {
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

          const response = await fetch(input, init);

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
          if (init && init.headers) {
            const headers = new Headers(init.headers);
            headers.set('x-api-key', lowQosKey);
            init.headers = headers;
          }
          const lowQosResponse = await fetch(input, init);
          return throwIfBad(lowQosResponse, true);
        };
      };
      const anthropic = createAnthropic({
        apiKey: userApiKey || getEnv('ANTHROPIC_API_KEY'),
        fetch: userApiKey ? userKeyApiFetch('Anthropic') : rateLimitAwareFetch(),
      });

      provider = {
        model: anthropic(model),
        maxTokens: anthropicMaxTokens(modelChoice),
      };
      break;
    }
    case 'OpenRouter': {
      model = modelForProvider(modelProvider, modelChoice);
      const openrouter = createOpenAI({
        apiKey: userApiKey || getEnv('OPENROUTER_API_KEY'),
        baseURL: 'https://openrouter.ai/api/v1',
        fetch: userApiKey ? userKeyApiFetch('OpenRouter') : createRetryFetch('OpenRouter'),
      });
      provider = {
        model: openrouter(model),
        maxTokens: 8192,
      };
      break;
    }
  }

  return provider;
}

/**
 * Creates a fetch function with automatic retry logic for rate limit errors.
 *
 * Features:
 * - Detects 429, RESOURCE_EXHAUSTED, and quota/limit errors
 * - Retries up to 3 times with exponential backoff (30s, 60s, 120s)
 * - Uses API-suggested retry delays when available
 * - Works with all AI providers (Google, OpenAI, Anthropic, etc.)
 */
const createRetryFetch = (provider: ModelProvider) => {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    return await retryWithExponentialBackoff(async () => {
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
    }, provider);
  };
};

/**
 * Creates a fetch function with automatic retry logic for rate limit errors.
 *
 * Features:
 * - Detects 429, RESOURCE_EXHAUSTED, and quota/limit errors
 * - Retries up to 3 times with exponential backoff (30s, 60s, 120s)
 * - Uses API-suggested retry delays when available
 * - Works with all AI providers (Google, OpenAI, Anthropic, etc.)
 */
const userKeyApiFetch = (provider: ModelProvider) => createRetryFetch(provider);
