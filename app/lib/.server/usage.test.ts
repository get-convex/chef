import { expect, test } from 'vitest';
import { annotationValidator, encodeUsageAnnotation, usageValidator } from './usage';

test('encodeUsageAnnotationAnthropic', async () => {
  const usage = {
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
  };
  const providerMetadata = {
    anthropic: {
      cacheCreationInputTokens: 10,
      cacheReadInputTokens: 20,
    },
  };
  const annotation = encodeUsageAnnotation(undefined, usage, providerMetadata);
  const parsed = annotationValidator.safeParse({ type: 'usage', usage: annotation });
  expect(parsed.success).toBe(true);
  if (parsed.data?.type !== 'usage') {
    // Note -- this mostly functions as a typeguard for the following line
    throw new Error('Expected usage annotation');
  }
  const payload = usageValidator.parse(JSON.parse(parsed.data?.usage.payload ?? '{}'));
  expect(payload).toEqual({
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
    providerMetadata: {
      anthropic: {
        cacheCreationInputTokens: 10,
        cacheReadInputTokens: 20,
      },
    },
  });
});

test('encodeUsageAnnotationOpenAI', async () => {
  const usage = {
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
  };
  const providerMetadata = {
    openai: {
      cachedPromptTokens: 10,
    },
  };
  const annotation = encodeUsageAnnotation(undefined, usage, providerMetadata);
  const parsed = annotationValidator.safeParse({ type: 'usage', usage: annotation });
  expect(parsed.success).toBe(true);
  if (parsed.data?.type !== 'usage') {
    throw new Error('Expected usage annotation');
  }
  const payload = usageValidator.parse(JSON.parse(parsed.data?.usage.payload ?? '{}'));
  expect(payload).toEqual({
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
    providerMetadata: {
      openai: {
        cachedPromptTokens: 10,
      },
    },
  });
});

test('encodeUsageAnnotationXAI', async () => {
  const usage = {
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
  };
  const providerMetadata = {
    xai: {
      cachedPromptTokens: 10,
    },
  };
  const annotation = encodeUsageAnnotation(undefined, usage, providerMetadata);
  const parsed = annotationValidator.safeParse({ type: 'usage', usage: annotation });
  expect(parsed.success).toBe(true);
  if (parsed.data?.type !== 'usage') {
    throw new Error('Expected usage annotation');
  }
  const payload = usageValidator.parse(JSON.parse(parsed.data?.usage.payload ?? '{}'));
  expect(payload).toEqual({
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
    providerMetadata: {
      xai: {
        cachedPromptTokens: 10,
      },
    },
  });
});
