import type { Message } from 'ai';
import { z } from 'zod';

// This is added as a message annotation by the server when the agent has
// stopped due to repeated errors.
//
// The client uses this to conditionally display UI.
export const REPEATED_ERROR_REASON = 'repeated-errors';
const annotationValidator = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('failure'),
    reason: z.literal(REPEATED_ERROR_REASON),
  }),
  z.object({
    type: z.literal('usage'),
    usage: z.any(),
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
