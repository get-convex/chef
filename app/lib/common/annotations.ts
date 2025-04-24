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
};

const modelValidator = z.enum(['anthropic', 'openai', 'xai', 'google', 'unknown']);
export type ModelType = z.infer<typeof modelValidator>;

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
    provider: modelValidator,
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
  usageForToolCall: Record<string, Usage | null>;
  modelForToolCall: Record<string, ModelType>;
} => {
  if (!annotations) {
    return {
      failedDueToRepeatedErrors: false,
      usageForToolCall: {},
      modelForToolCall: {},
    };
  }
  let failedDueToRepeatedErrors = false;
  const usageForToolCall: Record<string, Usage | null> = {};
  const modelForToolCall: Record<string, ModelType> = {};
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
      modelForToolCall[parsed.data.toolCallId] = parsed.data.provider;
    }
  }
  return {
    failedDueToRepeatedErrors,
    usageForToolCall,
    modelForToolCall,
  };
};
