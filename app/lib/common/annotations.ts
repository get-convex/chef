import type { UIMessage } from 'ai';
import { z } from 'zod';

// This is added as message metadata by the server when the agent has
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
      vertex: z
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

const providerValidator = z.enum(['Anthropic', 'Bedrock', 'OpenAI', 'XAI', 'Google', 'Unknown']);
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

type MessageMetadata = UIMessage['metadata'];

export const failedDueToRepeatedErrors = (metadata: MessageMetadata) => {
  if (!metadata) {
    return false;
  }
  const md = metadata as Record<string, unknown>;
  // Check metadata-based format (v6)
  if (md.failure === REPEATED_ERROR_REASON) {
    return true;
  }
  // Check legacy annotations format (stored in Convex)
  const annotations = md.annotations as unknown[] | undefined;
  if (annotations) {
    return annotations.some((annotation) => {
      const parsed = annotationValidator.safeParse(annotation);
      return parsed.success && parsed.data.type === 'failure' && parsed.data.reason === REPEATED_ERROR_REASON;
    });
  }
  return false;
};

export const parseAnnotations = (
  metadata: MessageMetadata,
): {
  failedDueToRepeatedErrors: boolean;
  usageForToolCall: Record<string, UsageAnnotation | null>;
  modelForToolCall: Record<string, { provider: ProviderType; model: string | undefined }>;
} => {
  if (!metadata) {
    return {
      failedDueToRepeatedErrors: false,
      usageForToolCall: {},
      modelForToolCall: {},
    };
  }
  let failed = false;
  const usageForToolCall: Record<string, UsageAnnotation | null> = {};
  const modelForToolCall: Record<string, { provider: ProviderType; model: string | undefined }> = {};
  const md = metadata as Record<string, unknown>;

  // Parse v6 metadata format (keyed entries)
  if (md.failure === REPEATED_ERROR_REASON) {
    failed = true;
  }
  for (const [key, value] of Object.entries(md)) {
    if (key.startsWith('usage:')) {
      const usage = usageAnnotationValidator.safeParse(JSON.parse((value as { payload: string }).payload));
      if (usage.success) {
        const id = key.slice('usage:'.length);
        usageForToolCall[id] = usage.data;
      }
    }
    if (key.startsWith('model:')) {
      const model = value as { provider: ProviderType; model: string | undefined; toolCallId: string };
      const id = key.slice('model:'.length);
      modelForToolCall[id] = { provider: model.provider, model: model.model };
    }
  }

  // Also parse legacy annotations format (for messages loaded from Convex)
  const annotations = md.annotations as unknown[] | undefined;
  if (annotations) {
    for (const annotation of annotations) {
      const parsed = annotationValidator.safeParse(annotation);
      if (!parsed.success) {
        continue;
      }
      if (parsed.data.type === 'failure' && parsed.data.reason === REPEATED_ERROR_REASON) {
        failed = true;
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
  }

  return {
    failedDueToRepeatedErrors: failed,
    usageForToolCall,
    modelForToolCall,
  };
};
