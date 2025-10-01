import type { Message } from 'ai';
import { z } from 'zod';

// This is added as a message annotation by the server when the agent has
// stopped due to repeated errors.
//
// The client uses this to conditionally display UI.
export const REPEATED_ERROR_REASON = 'repeated-errors';

export const usageAnnotationValidator = z.object({
  toolCallId: z.string().optional(),
  completionTokens: z.number(),
  promptTokens: z.number(),
  totalTokens: z.number(),
  providerMetadata: z
    .object({
      openai: z
        .object({
          cachedPromptTokens: z.number(),
        })
        .optional(),
      anthropic: z
        .object({
          cacheCreationInputTokens: z.number(),
          cacheReadInputTokens: z.number(),
        })
        .optional(),
      xai: z
        .object({
          cachedPromptTokens: z.number(),
        })
        .optional(),
      google: z
        .object({
          cachedContentTokenCount: z.number(),
        })
        .optional(),
      bedrock: z
        .object({
          usage: z.object({
            cacheWriteInputTokens: z.number(),
            cacheReadInputTokens: z.number(),
          }),
        })
        .optional(),
    })
    .optional(),
});
export type UsageAnnotation = z.infer<typeof usageAnnotationValidator>;

/* similar, but flattened and non-optional */
export type Usage = UsageAnnotation & {
  anthropicCacheReadInputTokens: number;
  anthropicCacheCreationInputTokens: number;
  openaiCachedPromptTokens: number;
  xaiCachedPromptTokens: number;
  googleCachedContentTokenCount: number;
  googleThoughtsTokenCount: number;
  bedrockCacheWriteInputTokens: number;
  bedrockCacheReadInputTokens: number;
};

const providerValidator = z.enum(['Anthropic', 'Bedrock', 'OpenAI', 'XAI', 'Google', 'OpenRouter', 'Unknown']);
export type ProviderType = z.infer<typeof providerValidator>;

export const annotationValidator = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('usage'),
    usage: z.object({
      payload: z.string(),
    }),
  }),
  z.object({
    type: z.literal('failure'),
    reason: z.literal(REPEATED_ERROR_REASON),
  }),
  z.object({
    type: z.literal('model'),
    toolCallId: z.string(),
    provider: providerValidator,
    model: z.optional(z.string()),
  }),
]);

export const failedDueToRepeatedErrors = (annotations: Message['annotations']) => {
  if (!annotations) {
    return false;
  }
  return annotations.some((annotation) => {
    const parsed = annotationValidator.safeParse(annotation);
    return parsed.success && parsed.data.type === 'failure' && parsed.data.reason === REPEATED_ERROR_REASON;
  });
};

export const parseAnnotations = (
  annotations: Message['annotations'],
): {
  failedDueToRepeatedErrors: boolean;
  usageForToolCall: Record<string, UsageAnnotation | null>;
  modelForToolCall: Record<string, { provider: ProviderType; model: string | undefined }>;
} => {
  if (!annotations) {
    return {
      failedDueToRepeatedErrors: false,
      usageForToolCall: {},
      modelForToolCall: {},
    };
  }
  let failedDueToRepeatedErrors = false;
  const usageForToolCall: Record<string, UsageAnnotation | null> = {};
  const modelForToolCall: Record<string, { provider: ProviderType; model: string | undefined }> = {};
  for (const annotation of annotations) {
    const parsed = annotationValidator.safeParse(annotation);
    if (!parsed.success) {
      continue;
    }
    if (parsed.data.type === 'failure' && parsed.data.reason === REPEATED_ERROR_REASON) {
      failedDueToRepeatedErrors = true;
    }
    if (parsed.data.type === 'usage') {
      const usage = usageAnnotationValidator.safeParse(JSON.parse(parsed.data.usage.payload));
      if (usage.success) {
        if (usage.data.toolCallId) {
          usageForToolCall[usage.data.toolCallId] = usage.data;
        }
      }
    }
    if (parsed.data.type === 'model') {
      modelForToolCall[parsed.data.toolCallId] = { provider: parsed.data.provider, model: parsed.data.model };
    }
  }
  return {
    failedDueToRepeatedErrors,
    usageForToolCall,
    modelForToolCall,
  };
};
