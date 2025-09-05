import { expect, test } from 'vitest';
import { encodeUsageAnnotation } from './usage';
import { annotationValidator, usageAnnotationValidator } from '~/lib/common/annotations';

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
  const annotation = encodeUsageAnnotation({ kind: 'tool-call', toolCallId: undefined }, usage, providerMetadata);
  const parsed = annotationValidator.safeParse({ type: 'usage', usage: annotation });
  expect(parsed.success).toBe(true);
  if (parsed.data?.type !== 'usage') {
    // Note -- this mostly functions as a typeguard for the following line
    throw new Error('Expected usage annotation');
  }
  const payload = usageAnnotationValidator.parse(JSON.parse(parsed.data?.usage.payload ?? '{}'));
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
  const annotation = encodeUsageAnnotation({ kind: 'tool-call', toolCallId: undefined }, usage, providerMetadata);
  const parsed = annotationValidator.safeParse({ type: 'usage', usage: annotation });
  expect(parsed.success).toBe(true);
  if (parsed.data?.type !== 'usage') {
    throw new Error('Expected usage annotation');
  }
  const payload = usageAnnotationValidator.parse(JSON.parse(parsed.data?.usage.payload ?? '{}'));
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
  const annotation = encodeUsageAnnotation({ kind: 'tool-call', toolCallId: undefined }, usage, providerMetadata);
  const parsed = annotationValidator.safeParse({ type: 'usage', usage: annotation });
  expect(parsed.success).toBe(true);
  if (parsed.data?.type !== 'usage') {
    throw new Error('Expected usage annotation');
  }
  const payload = usageAnnotationValidator.parse(JSON.parse(parsed.data?.usage.payload ?? '{}'));
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

test('encodeUsageAnnotationGoogle', async () => {
  const usage = {
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
  };
  const providerMetadata = {
    google: {
      cachedContentTokenCount: 10,
    },
  };
  const annotation = encodeUsageAnnotation({ kind: 'tool-call', toolCallId: undefined }, usage, providerMetadata);
  const parsed = annotationValidator.safeParse({ type: 'usage', usage: annotation });
  expect(parsed.success).toBe(true);
  if (parsed.data?.type !== 'usage') {
    throw new Error('Expected usage annotation');
  }
  const payload = usageAnnotationValidator.parse(JSON.parse(parsed.data?.usage.payload ?? '{}'));
  expect(payload).toEqual({
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
    providerMetadata: {
      google: {
        cachedContentTokenCount: 10,
      },
    },
  });
});

test('encodeUsageAnnotationBedrock', async () => {
  const usage = {
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
  };
  const providerMetadata = {
    bedrock: {
      usage: {
        cacheWriteInputTokens: 10,
        cacheReadInputTokens: 20,
      },
    },
  };
  const annotation = encodeUsageAnnotation({ kind: 'tool-call', toolCallId: undefined }, usage, providerMetadata);
  const parsed = annotationValidator.safeParse({ type: 'usage', usage: annotation });
  expect(parsed.success).toBe(true);
  if (parsed.data?.type !== 'usage') {
    throw new Error('Expected usage annotation');
  }
  const payload = usageAnnotationValidator.parse(JSON.parse(parsed.data?.usage.payload ?? '{}'));
  expect(payload).toEqual({
    completionTokens: 100,
    promptTokens: 200,
    totalTokens: 300,
    providerMetadata: {
      bedrock: {
        usage: {
          cacheWriteInputTokens: 10,
          cacheReadInputTokens: 20,
        },
      },
    },
  });
});
